// Glossary: every compound sense in the deck, grouped by verb, with times made and when last seen.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BASE_COMPOUNDS as COMPOUNDS, DRAFT_COMPOUNDS, compoundText } from '../../engine/deck';
import { dayLabel, t } from '../../i18n';
import { madeCount, progress, sfProgress } from '../../storage';
import { SF, phraseSeen, phraseText } from '../../engine/storfhocail';
import { Face } from '../cards';
import { Header, Screen, Scroll } from '../kit';

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Verb groups rendered while the screen slides in; the rest follow once it has landed. */
const FIRST_GROUPS = 5;
const SLIDE_MS = 420;

export function GlossaryScreen({ focus, draftsOnly }: { focus?: string; draftsOnly?: boolean }) {
  const [q, setQ] = useState('');
  const [onlyDrafts, setOnlyDrafts] = useState(!!draftsOnly);
  const [open, setOpen] = useState<string | null>(focus ?? null);
  // A deep link to one compound needs every row at once, to scroll to it.
  const [full, setFull] = useState(!!focus);
  useEffect(() => {
    if (full) return;
    const id = setTimeout(() => setFull(true), SLIDE_MS);
    return () => clearTimeout(id);
  }, []);
  const prog = progress.value.byCompound;
  const made = madeCount();
  const groups = useMemo(() => {
    const fq = fold(q.trim());
    const by = new Map<string, typeof COMPOUNDS>();
    for (const c of COMPOUNDS) {
      if (onlyDrafts && !DRAFT_COMPOUNDS.has(c.id)) continue;
      if (fq && !fold(compoundText(c)).includes(fq) && !fold(c.g).includes(fq)) continue;
      if (!by.has(c.v)) by.set(c.v, []);
      by.get(c.v)!.push(c);
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ga'));
  }, [q, onlyDrafts]);
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) focusRef.current?.scrollIntoView({ block: 'center' });
  }, []);
  return (
    <Screen class="glossary">
      <Scroll>
        <div class="pad">
          <Header title={t('glossary.title')} right={<span class="caption muted tabnum">{t('home.made', { n: made, total: COMPOUNDS.length })}</span>} />
          {made === 0 && !onlyDrafts && <p class="body muted">{t('glossary.emptyHead')}</p>}
          {DRAFT_COMPOUNDS.size > 0 && (
            <button class={'draft-filter' + (onlyDrafts ? ' is-on' : '')} aria-pressed={onlyDrafts ? 'true' : 'false'} onClick={() => setOnlyDrafts(!onlyDrafts)}>
              <span class="draft-chip">{t('glossary.draft')}</span> {t(onlyDrafts ? 'glossary.draftFilterOn' : 'glossary.draftFilter', { n: DRAFT_COMPOUNDS.size })}
            </button>
          )}
          <input class="search" type="search" placeholder={t('glossary.search')} aria-label={t('glossary.search')} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} autocomplete="off" spellcheck={false} />
          {!groups.length && <p class="body muted">{t('glossary.noMatch', { q })}</p>}
          {(full ? groups : groups.slice(0, FIRST_GROUPS)).map(([verb, cs]) => (
            <section class="g-group" key={verb}>
              <div class="g-head">
                <Face card={{ id: -1, k: 'V', t: verb }} size="river" extraClass="g-chip" />
                <span class="caption muted">{cs.length === 1 ? t('glossary.one') : t('glossary.count', { n: cs.length })}</span>
              </div>
              {cs.map((c) => {
                const p = prog[c.id];
                const isMade = !!p && p.made > 0;
                const isOpen = open === c.id;
                return (
                  <div class={'g-row' + (isMade ? '' : ' is-unmade')} key={c.id} ref={focus === c.id ? focusRef : undefined}>
                    <button class="g-main" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen ? 'true' : 'false'}>
                      <span class="lr-text">
                        <span class="lr-ga">
                          {compoundText(c)}
                          {DRAFT_COMPOUNDS.has(c.id) && <span class="draft-chip">{t('glossary.draft')}</span>}
                        </span>
                        <span class="lr-en">{c.g.toLowerCase()}</span>
                      </span>
                      <span class="g-stats">
                        {isMade ? (
                          <>
                            <span>{t('glossary.madeN', { n: p.made })}</span>
                            {p.lastMade && <span>{dayLabel(p.lastMade)}</span>}
                          </>
                        ) : (
                          <span>{t('glossary.notYet')}</span>
                        )}
                      </span>
                    </button>
                    {isOpen && <div class="g-example">{t('glossary.example')}</div>}
                  </div>
                );
              })}
            </section>
          ))}
          {full && !onlyDrafts && <SfSection q={q} focus={focus} />}
        </div>
      </Scroll>
    </Screen>
  );
}

/**
 * Stórfhocail (spec §8): only phrases seen laid on the table (or printed on a tile the player owns), with
 * how often they were seen and whether the tile is owned. No total, so nothing hints at what is unseen.
 */
function SfSection({ q, focus }: { q: string; focus?: string }) {
  const pr = sfProgress.value;
  const fq = fold(q.trim());
  const rows = SF.words
    .flatMap((w) => w.phrases.map((ph) => ({ w, ph })))
    .filter(({ ph }) => phraseSeen(pr, ph.id))
    .filter(({ w, ph }) => !fq || fold(phraseText(ph, w.word)).includes(fq) || fold(ph.meaning).includes(fq))
    .sort((a, b) => a.w.word.localeCompare(b.w.word, 'ga'));
  if (!rows.length) return null;
  return (
    <section class="g-group sf-gloss">
      <h2 class="sec-label">{t('sf.title')}</h2>
      {rows.map(({ w, ph }) => {
        const seen = pr.seen[ph.id];
        const own = pr.owned[w.id] ?? 0;
        return (
          <div class="g-row" key={ph.id} id={'g-' + ph.id} ref={(el) => {
              if (focus === ph.id) el?.scrollIntoView({ block: 'center' });
            }}>
            <div class="g-main">
              <span class="ba-card ba-sf sf-chip" aria-hidden="true">
                <span class="ba-word">{w.word}</span>
              </span>
              <span class="lr-text">
                <span class="lr-ga">{phraseText(ph, w.word)}</span>
                <span class="lr-en">{ph.meaning.toLowerCase()}</span>
              </span>
              <span class="g-stats">
                {seen && <span>{t('sf.seenN', { n: seen.times })}</span>}
                <span>{own ? t('sf.ownedN', { n: own }) : t('sf.notOwned')}</span>
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
