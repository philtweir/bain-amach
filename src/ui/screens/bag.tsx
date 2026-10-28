// Your Stórfhocail (the bag): one slot per word in the list, in a fixed order. A filled slot shows the
// tile; an empty one is blank, so the set's size shows without spoiling the words. Tap a tile for its
// detail. At 10, 20, 30 tiles the bag offers a restore point; restoring works only into an empty bag.
import { useState } from 'preact/hooks';
import { SF, SF_WORD, applyRestore, ownedCount, restoreCode, restoreDue } from '../../engine/storfhocail';
import { saveFile } from '../../app/backup';
import { ago, t } from '../../i18n';
import { sfProgress } from '../../storage';
import { Header, Screen, Scroll } from '../kit';
import { nav } from '../nav';
import { SfMini, SfWide } from '../storfhocal';

const today = () => new Date().toISOString().slice(0, 10);

export function BagScreen() {
  const pr = sfProgress.value;
  const [open, setOpen] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const total = SF.words.length;
  const n = ownedCount(pr);
  const due = restoreDue(pr);
  return (
    <Screen class="bag">
      <Scroll>
        <div class="pad">
          <Header title={t('bag.title')} right={<span class="caption muted tabnum">{t('sf.countOf', { n, total })}</span>} />
          <p class="body muted">{t('bag.intro')}</p>
          {due > 0 && <RestorePoint at={due} />}
          <div class="bag-grid">
            {SF.words.map((w) =>
              (pr.owned[w.id] ?? 0) > 0 ? (
                <button class="bag-slot is-owned" key={w.id} data-word={w.id} aria-label={w.word} onClick={() => setOpen(w.id)}>
                  <SfMini word={w.id} size={72} />
                </button>
              ) : (
                <div class="bag-slot is-empty" key={w.id} role="img" aria-label={t('bag.empty')} />
              ),
            )}
          </div>
          {n === 0 && (
            <button class="ba-btn ba-btn-quiet bag-restore" onClick={() => setRestoring(true)}>
              {t('bag.restore')}
            </button>
          )}
          <div class="bottom-space" />
        </div>
      </Scroll>
      {open && <TileDetail word={open} onClose={() => setOpen(null)} />}
      {restoring && <RestoreSheet onClose={() => setRestoring(false)} />}
    </Screen>
  );
}

/** A milestone reached: save a code that brings the bag back to this point after lost data. */
function RestorePoint({ at }: { at: number }) {
  const done = () => (sfProgress.value = { ...sfProgress.value, restoreSeen: at });
  return (
    <div class="panel restore-point" role="region" aria-label={t('bag.milestone', { n: at })}>
      <div class="rp-head">
        <span class="rp-n">{t('bag.milestone', { n: at })}</span>
        <span class="caption muted">{t('bag.milestoneReady')}</span>
      </div>
      <p class="body">{t('bag.milestoneBody', { n: at })}</p>
      <div class="row2">
        <button class="ba-btn ba-btn-secondary" onClick={done}>
          {t('bag.notNow')}
        </button>
        <button
          class="ba-btn ba-btn-primary"
          onClick={async () => {
            const code = restoreCode(sfProgress.value);
            try {
              await navigator.clipboard?.writeText(code);
            } catch {
              // no clipboard: the file is enough
            }
            await saveFile(`bain-amach-bag-${at}.txt`, code + '\n', 'text/plain');
            done();
          }}
        >
          {t('bag.saveRestore')}
        </button>
      </div>
    </div>
  );
}

function TileDetail({ word, onClose }: { word: string; onClose: () => void }) {
  const pr = sfProgress.value;
  const w = SF_WORD[word];
  const from = pr.wonFrom[word];
  const seenGames = w.phrases.reduce((a, ph) => a + (pr.seen[ph.id]?.times ?? 0), 0);
  const laid = pr.laid[word] ?? 0;
  return (
    <div class="sheet-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="ba-scrim scrim-in" aria-hidden="true" />
      <div class="ba-sheet sheet sheet-in bag-detail" role="dialog" aria-modal="true" aria-label={w.word}>
        <div class="grabber" aria-hidden="true" />
        <div class="bd-face">
          <SfWide word={word} />
        </div>
        <dl class="bd-facts">
          {from && (
            <div>
              <dt>{t('bag.wonFrom')}</dt>
              <dd>{t('bag.wonFromVal', { name: from.name, ago: ago(new Date(from.date).getTime()) })}</dd>
            </div>
          )}
          <div>
            <dt>{t('bag.seenIn')}</dt>
            <dd>{seenGames === 1 ? t('bag.oneGame') : t('bag.games', { n: seenGames })}</dd>
          </div>
          <div>
            <dt>{t('bag.youLaid')}</dt>
            <dd>{laid === 0 ? t('bag.never') : laid === 1 ? t('bag.once') : t('bag.times', { n: laid })}</dd>
          </div>
        </dl>
        <button
          class="ba-btn ba-btn-secondary wide"
          onClick={() => {
            onClose();
            nav.push('glossary', { focus: w.phrases[0].id });
          }}
        >
          {t('bag.openGlossary')}
        </button>
      </div>
    </div>
  );
}

/** Restore a bag from a saved code: only into an empty bag. */
function RestoreSheet({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <div class="sheet-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="ba-scrim scrim-in" aria-hidden="true" />
      <div class="ba-sheet sheet sheet-in" role="dialog" aria-modal="true" aria-label={t('bag.restore')}>
        <div class="grabber" aria-hidden="true" />
        <h2 class="sheet-title">{t('bag.restore')}</h2>
        <p class="sheet-sub">{t('bag.restoreSub')}</p>
        <textarea class="restore-code" rows={3} value={code} aria-label={t('bag.restoreCode')} placeholder="BA1-…" onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} spellcheck={false} autocomplete="off" />
        {err && (
          <p class="body alert-text" role="alert">
            {err}
          </p>
        )}
        <div class="row2">
          <button class="ba-btn ba-btn-secondary" onClick={onClose}>
            {t('sf.close')}
          </button>
          <button
            class="ba-btn ba-btn-primary"
            disabled={!code.trim()}
            onClick={() => {
              const r = applyRestore(sfProgress.value, code, today());
              if (r.error) return setErr(r.error === 'notEmpty' ? t('bag.restoreNotEmpty') : t('bag.restoreBad'));
              sfProgress.value = r.progress!;
              onClose();
            }}
          >
            {t('bag.restoreGo')}
          </button>
        </div>
      </div>
    </div>
  );
}
