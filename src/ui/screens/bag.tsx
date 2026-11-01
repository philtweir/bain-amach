// Your Stórfhocail (the bag): one slot per word in the list, in a fixed order. A filled slot shows the
// tile; an empty one is blank, so the set's size shows without spoiling the words. Tap a tile for its
// detail. At 10, 20, 30 tiles the bag takes a restore point, which waits here until it is saved;
// restoring works only into an empty bag.
import { useState } from 'preact/hooks';
import { SF, SF_WORD, applyRestore, ownedCount, type RestorePoint } from '../../engine/storfhocail';
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
  const rp = pr.restorePoint;
  // "Later" hides the card for this visit only.
  const [later, setLater] = useState(false);
  return (
    <Screen class="bag">
      <Scroll>
        <div class="pad">
          <Header title={t('bag.title')} right={<span class="caption muted tabnum">{t('sf.countOf', { n, total })}</span>} />
          <p class="body muted">{t('bag.intro')}</p>
          {rp && !rp.saved && !later && <RestoreCard rp={rp} onLater={() => setLater(true)} />}
          {rp?.saved && <SavedPoint rp={rp} />}
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

const shortDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

async function saveCode(rp: RestorePoint) {
  try {
    await navigator.clipboard?.writeText(rp.code);
  } catch {
    // no clipboard: the file is enough
  }
  await saveFile(`bain-amach-bag-${rp.at}.txt`, rp.code + '\n', 'text/plain');
}

/** The tiles a restore point holds; any that have left the bag since are faded. */
function PointStrip({ rp }: { rp: RestorePoint }) {
  const owned = sfProgress.value.owned;
  return (
    <div class="rp-strip" role="list" aria-label={t('bag.pointHolds', { list: rp.words.map((w) => SF_WORD[w]?.word ?? w).join(', ') })}>
      {rp.words.map((w) => (
        <span role="listitem" key={w} class={(owned[w] ?? 0) > 0 ? '' : 'is-gone'}>
          <SfMini word={w} size={24} glyph />
        </span>
      ))}
    </div>
  );
}

/** A restore point not yet saved: it waits here, and losing tiles afterwards doesn't change it. */
function RestoreCard({ rp, onLater }: { rp: RestorePoint; onLater: () => void }) {
  const pr = sfProgress.value;
  const intact = rp.words.every((w) => (pr.owned[w] ?? 0) > 0);
  return (
    <div class="panel restore-point" role="region" aria-label={t('bag.pointTitle', { n: rp.at })}>
      <div class="rp-head">
        <span class="rp-n">{intact ? t('bag.milestone', { n: rp.at }) : t('bag.pointTitle', { n: rp.at })}</span>
        <span class="caption muted">{intact ? t('bag.milestoneReady') : t('bag.notSaved')}</span>
      </div>
      <p class="body">{intact ? t('bag.milestoneBody', { n: rp.at }) : t('bag.pointBody', { n: rp.at, date: shortDate(rp.reached) })}</p>
      {!intact && <PointStrip rp={rp} />}
      <div class="row2">
        <button class="ba-btn ba-btn-secondary" onClick={onLater}>
          {t('bag.later')}
        </button>
        <button
          class="ba-btn ba-btn-primary"
          onClick={async () => {
            await saveCode(rp);
            const today = new Date().toISOString().slice(0, 10);
            sfProgress.value = { ...sfProgress.value, restorePoint: { ...rp, saved: true, savedOn: rp.savedOn ?? today } };
          }}
        >
          {t('bag.saveRestore')}
        </button>
      </div>
    </div>
  );
}

/** A saved restore point stays listed, so its code can be copied again. */
function SavedPoint({ rp }: { rp: RestorePoint }) {
  const [show, setShow] = useState(false);
  return (
    <div class="rp-saved">
      <div class="rp-saved-row">
        <span class="caption muted">{t('bag.savedRow', { n: rp.at, date: shortDate(rp.savedOn ?? rp.reached) })}</span>
        <button class="ba-btn ba-btn-quiet link-btn" onClick={() => setShow(!show)} aria-expanded={show ? 'true' : 'false'}>
          {show ? t('bag.hideCode') : t('bag.showCode')}
        </button>
      </div>
      {show && (
        <>
          <textarea class="restore-code" rows={3} readOnly value={rp.code} aria-label={t('bag.restoreCode')} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
          <button class="ba-btn ba-btn-secondary" onClick={() => saveCode(rp)}>
            {t('bag.copyAgain')}
          </button>
        </>
      )}
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
