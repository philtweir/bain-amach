// Glossary: all 36 compounds grouped by verb, with times made and when last seen.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { COMPOUNDS, compoundText } from '../../engine/deck';
import { dayLabel, t } from '../../i18n';
import { madeCount, progress } from '../../storage';
import { Face } from '../cards';
import { Header, Screen, Scroll } from '../kit';

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function GlossaryScreen({ focus }: { focus?: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(focus ?? null);
  const prog = progress.value.byCompound;
  const made = madeCount();
  const groups = useMemo(() => {
    const fq = fold(q.trim());
    const by = new Map<string, typeof COMPOUNDS>();
    for (const c of COMPOUNDS) {
      if (fq && !fold(compoundText(c)).includes(fq) && !fold(c.g).includes(fq)) continue;
      if (!by.has(c.v)) by.set(c.v, []);
      by.get(c.v)!.push(c);
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ga'));
  }, [q]);
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) focusRef.current?.scrollIntoView({ block: 'center' });
  }, []);
  return (
    <Screen class="glossary">
      <Scroll>
        <div class="pad">
          <Header title={t('glossary.title')} right={<span class="caption muted tabnum">{t('home.made', { n: made, total: COMPOUNDS.length })}</span>} />
          {made === 0 && <p class="body muted">{t('glossary.emptyHead')}</p>}
          <input class="search" type="search" placeholder={t('glossary.search')} aria-label={t('glossary.search')} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} autocomplete="off" spellcheck={false} />
          {!groups.length && <p class="body muted">{t('glossary.noMatch', { q })}</p>}
          {groups.map(([verb, cs]) => (
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
                        <span class="lr-ga">{compoundText(c)}</span>
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
        </div>
      </Scroll>
    </Screen>
  );
}
