// The bag (spec/storfhocal.md §7): one slot per stórfhocal, in Irish alphabetical order. Owned: the tile
// and its count. Seen, not owned: an outline with the word greyed. Unseen: a blank silhouette, so the
// bag never gives away a word the glossary hides.
import { useState } from 'preact/hooks';
import { SF, phraseText, wordSeen } from '../../engine/storfhocail';
import { t } from '../../i18n';
import { sfProgress } from '../../storage';
import { Header, Screen, Scroll } from '../kit';
import { SfTile } from '../storfhocal';

export function BagScreen() {
  const pr = sfProgress.value;
  const [open, setOpen] = useState<string | null>(null);
  const words = [...SF.words].sort((a, b) => a.word.localeCompare(b.word, 'ga'));
  const owned = words.filter((w) => (pr.owned[w.id] ?? 0) > 0).length;
  const sel = words.find((w) => w.id === open);
  return (
    <Screen class="bag">
      <Scroll>
        <div class="pad">
          <Header title={t('bag.title')} right={<span class="caption muted tabnum">{t('bag.count', { n: owned, total: words.length })}</span>} />
          <p class="body muted">{t('bag.intro')}</p>
          <div class="bag-grid">
            {words.map((w) => {
              const n = pr.owned[w.id] ?? 0;
              const seen = wordSeen(pr, w.id) || pr.lostByPlayer.includes(w.id);
              if (!seen && !n)
                return (
                  <div class="bag-slot is-unseen" key={w.id} role="img" aria-label={t('bag.unseen')}>
                    <span class="bag-sil" />
                  </div>
                );
              return (
                <button class={'bag-slot' + (n ? ' is-owned' : ' is-seen') + (open === w.id ? ' is-open' : '')} key={w.id} aria-expanded={open === w.id ? 'true' : 'false'} onClick={() => setOpen(open === w.id ? null : w.id)} aria-label={n ? t('bag.ownedLabel', { word: w.word, n }) : t('bag.seenLabel', { word: w.word })}>
                  <span class="ba-card ba-sf bag-tile">
                    <span class="ba-word">{w.word}</span>
                  </span>
                  {n > 0 && <span class="bag-n tabnum">×{n}</span>}
                </button>
              );
            })}
          </div>
          {sel && (
            <div class="panel bag-detail" role="region" aria-label={sel.word}>
              {(pr.owned[sel.id] ?? 0) > 0 ? <SfTile word={sel.id} /> : null}
              {sel.phrases.map((ph) => (
                <p key={ph.id}>
                  <strong>{phraseText(ph)}</strong> · {ph.meaning.toLowerCase()}
                </p>
              ))}
              <p class="muted">{(pr.owned[sel.id] ?? 0) > 0 ? t('bag.laid', { n: pr.laid[sel.id] ?? 0 }) : t('bag.notOwned')}</p>
            </div>
          )}
        </div>
      </Scroll>
    </Screen>
  );
}
