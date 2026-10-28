// Custom decks (spec/deck-editor.md): the list of decks, and the editor for one.
import { useMemo, useRef, useState } from 'preact/hooks';
import { cardTotal, deckById, deckFit, deleteDeck, duplicateDeck, exportDeck, importDeck, renameDeck, saveDeck, deckNotice } from '../../app/decks';
import { BASE, PARTICLE_TYPE, VERBS, compoundText, type DeckCompound } from '../../engine/deck';
import { availableMeanings, buildDeck, generateMeaningCards, maxCards, MAX_COPIES, MAX_WILDCARDS, validateDeck, type CustomDeck } from '../../engine/deckTools';
import type { DeckTestResult } from '../../engine/deckTest';
import { t } from '../../i18n';
import { customDecks } from '../../storage';
import { Header, Note, Screen, Scroll, Section, Seg } from '../kit';
import { nav } from '../nav';

const COUNTS = [2, 3, 4] as const;
const byIrish = (a: string, b: string) => a.localeCompare(b, 'ga');

function fitText(d: CustomDeck | undefined): string {
  const f = deckFit(d);
  const ok = COUNTS.filter((n) => f[n] !== null);
  return ok.length ? t('decks.players', { list: ok.join(', ') }) : t('decks.noPlayers');
}

// ---------- the list ----------

export function DecksScreen() {
  const list = customDecks.value;
  const [open, setOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; alert?: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const doExport = async (d: CustomDeck) => {
    const text = exportDeck(d);
    const fname = (d.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'deck') + '.json';
    const blob = new Blob([text], { type: 'application/json' });
    const f = new File([blob], fname, { type: 'application/json' });
    const nav2 = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav2.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: d.name });
        return;
      } catch {
        // cancelled: fall through to a download
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const onImport = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const r = importDeck(await f.text());
    if (!r.deck) setMsg({ text: t('decks.importFailed', { why: r.error ?? '' }), alert: true });
    else {
      setMsg({ text: r.dropped.length ? t('decks.importedDropped', { name: r.deck.name, list: r.dropped.join(', ') }) : t('decks.imported', { name: r.deck.name }) });
      setOpen(r.deck.id);
    }
  };

  const edit = (id: string) => nav.push('deckEdit', { id });

  return (
    <Screen class="decks">
      <Scroll>
        <div class="pad">
          <Header title={t('decks.title')} />
          <p class="body muted">{t('decks.intro')}</p>
          {deckNotice.value > 0 && (
            <div class="panel deck-msg" role="status">
              {t('decks.migrated', { n: deckNotice.value })}
              <button class="ba-btn ba-btn-quiet" onClick={() => (deckNotice.value = 0)}>
                {t('decks.ok')}
              </button>
            </div>
          )}
          {msg && (
            <div class={'panel deck-msg' + (msg.alert ? ' is-alert' : '')} role={msg.alert ? 'alert' : 'status'}>
              {msg.text}
            </div>
          )}
          <div class="group">
            <div class="deck-row">
              <button class="row row-btn" aria-expanded={open === 'default' ? 'true' : 'false'} onClick={() => setOpen(open === 'default' ? null : 'default')}>
                <span class="row-text">
                  <span class="row-label">
                    {t('decks.default')} <span class="lock-chip">{t('decks.locked')}</span>
                  </span>
                  <span class="row-sub">
                    {t('decks.cards', { n: cardTotal(undefined) })} · {fitText(undefined)}
                  </span>
                </span>
              </button>
              {open === 'default' && (
                <div class="deck-actions">
                  <button class="ba-btn ba-btn-secondary" onClick={() => edit(duplicateDeck(2, t('decks.copyName', { name: t('decks.default') })).id)}>
                    {t('decks.dupe2')}
                  </button>
                  <button class="ba-btn ba-btn-secondary" onClick={() => edit(duplicateDeck(4, t('decks.copyName34', { name: t('decks.default') })).id)}>
                    {t('decks.dupe34')}
                  </button>
                </div>
              )}
            </div>
            {list.map((d) => (
              <div class="deck-row" key={d.id}>
                {renaming === d.id ? (
                  <div class="row">
                    <input
                      class="name-input"
                      value={name}
                      maxLength={40}
                      aria-label={t('decks.rename')}
                      onInput={(e) => setName((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameDeck(d.id, name);
                          setRenaming(null);
                        }
                      }}
                      ref={(el) => el?.focus()}
                    />
                    <button
                      class="ba-btn ba-btn-primary"
                      onClick={() => {
                        renameDeck(d.id, name);
                        setRenaming(null);
                      }}
                    >
                      {t('decks.save')}
                    </button>
                  </div>
                ) : (
                  <button class="row row-btn" aria-expanded={open === d.id ? 'true' : 'false'} onClick={() => setOpen(open === d.id ? null : d.id)}>
                    <span class="row-text">
                      <span class="row-label">{d.name}</span>
                      <span class="row-sub">
                        {t('decks.cards', { n: cardTotal(d) })} · {fitText(d)}
                      </span>
                    </span>
                  </button>
                )}
                {open === d.id && renaming !== d.id && (
                  <div class="deck-actions">
                    {deleting === d.id ? (
                      <>
                        <span class="confirm-q">{t('decks.deleteQ', { name: d.name })}</span>
                        <button class="ba-btn ba-btn-secondary" onClick={() => setDeleting(null)}>
                          {t('decks.keep')}
                        </button>
                        <button
                          class="ba-btn ba-btn-primary danger"
                          onClick={() => {
                            deleteDeck(d.id);
                            setDeleting(null);
                            setOpen(null);
                          }}
                        >
                          {t('decks.delete')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button class="ba-btn ba-btn-primary" onClick={() => edit(d.id)}>
                          {t('decks.edit')}
                        </button>
                        <button class="ba-btn ba-btn-secondary" onClick={() => setOpen(duplicateDeck(d, t('decks.copyName', { name: d.name })).id)}>
                          {t('decks.duplicate')}
                        </button>
                        <button
                          class="ba-btn ba-btn-secondary"
                          onClick={() => {
                            setName(d.name);
                            setRenaming(d.id);
                          }}
                        >
                          {t('decks.rename')}
                        </button>
                        <button class="ba-btn ba-btn-secondary" onClick={() => doExport(d)}>
                          {t('decks.export')}
                        </button>
                        <button class="ba-btn ba-btn-quiet" onClick={() => setDeleting(d.id)}>
                          {t('decks.delete')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button class="ba-btn ba-btn-secondary wide" onClick={() => file.current?.click()}>
            {t('decks.import')}
          </button>
          <input ref={file} type="file" accept="application/json,.json" class="sr-only" tabIndex={-1} aria-hidden="true" onChange={onImport} />
        </div>
      </Scroll>
    </Screen>
  );
}

// ---------- the editor ----------

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button class="step-btn" aria-label={t('decks.less', { what: label })} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span class="step-n tabnum" aria-live="polite">
        {value}
      </span>
      <button class="step-btn" aria-label={t('decks.more', { what: label })} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

const pct = (x: number) => Math.round(100 * x) + '%';

export function DeckEditScreen({ id }: { id: string }) {
  const stored = deckById(id);
  const [d, setD] = useState<CustomDeck | undefined>(stored);
  const [details, setDetails] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [testN, setTestN] = useState<2 | 3 | 4>(2);
  const [test, setTest] = useState<{ for: CustomDeck; r?: DeckTestResult; running?: boolean } | null>(null);
  const deck = d ?? stored;
  const v = useMemo(() => (deck ? validateDeck(BASE, deck) : null), [deck]);
  const avail = useMemo(() => (deck ? availableMeanings(BASE, deck) : new Map<string, DeckCompound[]>()), [deck]);
  const gen = useMemo(() => (deck ? generateMeaningCards(BASE, deck) : null), [deck]);
  if (!deck || !v || !gen) return null;
  const dirty = deck !== stored;
  const set = (patch: Partial<CustomDeck>) => setD({ ...deck, ...patch });

  const sel = new Set(deck.meanings);
  const live = deck.meanings.filter((m) => avail.has(m));
  const liveComps = live.flatMap((m) => avail.get(m)!);
  const usedByVerb = (verb: string) => live.filter((m) => avail.get(m)!.some((c) => c.verb === verb)).length;
  const partTotal = Object.values(deck.particles).reduce((a, b) => a + b, 0);
  const demand: Record<string, number> = {};
  let dTot = 0;
  for (const m of live) {
    const cs = avail.get(m)!;
    for (const c of cs)
      for (const p of c.particles) {
        demand[p] = (demand[p] || 0) + 1 / cs.length;
        dTot += 1 / cs.length;
      }
  }
  const verbs = [...new Set([...VERBS, ...Object.keys(deck.verbs)])].sort(byIrish);
  const parts = (type: 'adverb' | 'preposition') => BASE.particles.filter((p) => PARTICLE_TYPE[p.word] === type).map((p) => p.word);
  const missing = (c: DeckCompound) => [c.verb, ...c.particles].filter((w) => !((c.verb === w ? deck.verbs[w] : deck.particles[w]) > 0));
  const groups = verbs.map((verb) => ({ verb, comps: BASE.compounds.filter((c) => c.verb === verb) })).filter((g) => g.comps.length);
  const setMeanings = (ms: string[]) => set({ meanings: [...new Set(ms)] });
  const toggle = (m: string, on: boolean) => setMeanings(on ? [...deck.meanings, m] : deck.meanings.filter((x) => x !== m));
  const total = Object.values(deck.verbs).reduce((a, b) => a + b, 0) + partTotal + deck.wildcards + deck.meaningCards;
  const testCurrent = test && test.for === deck ? test : null;
  const testBad = !!testCurrent?.r?.unfinished;
  const canSave = !v.errors.length && !testBad;

  const runTest = () => {
    const w = new Worker(new URL('../../app/deckTest.worker.ts', import.meta.url), { type: 'module' });
    const forDeck = deck;
    setTest({ for: forDeck, running: true });
    w.onmessage = (e: MessageEvent<DeckTestResult>) => {
      setTest({ for: forDeck, r: e.data });
      w.terminate();
    };
    w.postMessage({ deck: buildDeck(BASE, deck), n: testN, games: 50 });
  };

  const save = () => {
    saveDeck(deck);
    nav.back();
  };

  return (
    <Screen class="deck-edit">
      <Scroll>
        <div class="pad">
          <Header title={t('decks.editTitle')} onBack={() => (dirty ? setLeaving(true) : nav.back())} />
          {leaving && (
            <div class="panel deck-msg" role="alertdialog" aria-label={t('decks.leaveQ')}>
              <span>{t('decks.leaveQ')}</span>
              <div class="row2">
                <button class="ba-btn ba-btn-secondary" onClick={() => setLeaving(false)}>
                  {t('decks.keepEditing')}
                </button>
                <button class="ba-btn ba-btn-primary danger" onClick={() => nav.back()}>
                  {t('decks.discard')}
                </button>
              </div>
            </div>
          )}
          <input class="name-input deck-name" value={deck.name} maxLength={40} aria-label={t('decks.name')} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />

          <button class="deck-summary" aria-expanded={details ? 'true' : 'false'} onClick={() => setDetails(!details)}>
            <span class="tabnum">{t('decks.cards', { n: total })}</span>
            <span class="ds-fit">
              {COUNTS.map((n) => (
                <span key={n} class={'ds-n' + (v.players[n].ok ? ' is-ok' : '')}>
                  {n}
                  {v.players[n].ok ? '✓' : '✗'}
                </span>
              ))}
            </span>
            <span class={v.errors.length ? 'ds-err' : 'muted'}>
              {t('decks.issues', { e: v.errors.length + (testBad ? 1 : 0), w: v.warnings.length })}
            </span>
          </button>
          {details && (
            <div class="panel deck-details">
              {v.errors.map((e) => (
                <p class="ds-err" key={e.code}>
                  ✗ {e.text}
                </p>
              ))}
              {testBad && <p class="ds-err">✗ {t('decks.testUnfinished', { n: testCurrent!.r!.unfinished })}</p>}
              {v.warnings.map((w, i) => (
                <p key={w.code + i}>! {w.text}</p>
              ))}
              {COUNTS.map((n) => {
                const f = v.players[n];
                return (
                  <p key={n} class="muted">
                    {t('decks.forN', { n })}: {f.ok ? (f.note ?? t('decks.handsOf', { n: f.handSize })) : f.reason}
                  </p>
                );
              })}
            </div>
          )}

          <Section label={t('decks.verbs')}>
            <div class="group">
              {verbs.map((verb) => (
                <div class="row step-row" key={verb}>
                  <span class="row-text">
                    <span class="row-label">{verb}</span>
                    <span class="row-sub">{t('decks.usedBy', { n: usedByVerb(verb) })}</span>
                  </span>
                  <Stepper value={deck.verbs[verb] ?? 0} min={0} max={MAX_COPIES} label={verb} onChange={(n) => set({ verbs: { ...deck.verbs, [verb]: n } })} />
                </div>
              ))}
            </div>
          </Section>

          <Section label={t('decks.particles')}>
            {(['adverb', 'preposition'] as const).map((type) => (
              <div class="group" key={type}>
                <div class="row group-head">
                  <span class="row-label">{type === 'adverb' ? t('decks.adverbs') : t('decks.prepositions')}</span>
                </div>
                {parts(type).map((p) => (
                  <div class="row step-row" key={p}>
                    <span class="row-text">
                      <span class="row-label">{p}</span>
                      <span class="row-sub">{t('decks.share', { river: pct(partTotal ? (deck.particles[p] ?? 0) / partTotal : 0), demand: pct(dTot ? (demand[p] ?? 0) / dTot : 0) })}</span>
                    </span>
                    <Stepper value={deck.particles[p] ?? 0} min={0} max={MAX_COPIES} label={p} onChange={(n) => set({ particles: { ...deck.particles, [p]: n } })} />
                  </div>
                ))}
              </div>
            ))}
          </Section>

          <Section label={t('decks.wildcards')}>
            <div class="group">
              <div class="row step-row">
                <span class="row-text">
                  <span class="row-label">{t('decks.wildcards')}</span>
                </span>
                <Stepper value={deck.wildcards} min={0} max={MAX_WILDCARDS} label={t('decks.wildcards')} onChange={(n) => set({ wildcards: n })} />
              </div>
            </div>
          </Section>

          <Section label={t('decks.meanings')}>
            <div class="m-all">
              <span class="muted tabnum">{t('decks.chosen', { n: live.length })}</span>
              <button class="ba-btn ba-btn-quiet" onClick={() => setMeanings([...deck.meanings, ...avail.keys()])}>
                {t('decks.all')}
              </button>
              <button class="ba-btn ba-btn-quiet" onClick={() => setMeanings([])}>
                {t('decks.none')}
              </button>
            </div>
            {groups.map((g) => (
              <div class="group m-group" key={g.verb}>
                <div class="row group-head">
                  <span class="row-label">{g.verb}</span>
                  <button class="ba-btn ba-btn-quiet" onClick={() => setMeanings([...deck.meanings, ...g.comps.map((c) => c.meaning).filter((m) => avail.has(m))])}>
                    {t('decks.all')}
                  </button>
                  <button class="ba-btn ba-btn-quiet" onClick={() => setMeanings(deck.meanings.filter((m) => !g.comps.some((c) => c.meaning === m)))}>
                    {t('decks.none')}
                  </button>
                </div>
                {g.comps.map((c) => {
                  const ok = avail.has(c.meaning);
                  const need = missing(c);
                  return (
                    <label class={'row m-check' + (ok ? '' : ' is-off')} key={c.id}>
                      <input type="checkbox" checked={ok && sel.has(c.meaning)} disabled={!ok} onChange={(e) => toggle(c.meaning, (e.target as HTMLInputElement).checked)} />
                      <span class="row-text">
                        <span class="row-label">{c.meaning}</span>
                        <span class="row-sub">
                          {compoundText({ id: c.id, v: c.verb, ps: c.particles, g: c.meaning })}
                          {!ok && need.length > 0 && ' · ' + t('decks.needs', { list: need.join(', ') })}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </Section>

          <Section label={t('decks.meaningCards')}>
            <div class="group">
              <div class="row step-row">
                <span class="row-text">
                  <span class="row-label">{t('decks.meaningCards')}</span>
                  <span class="row-sub">{live.length ? t('decks.appears', { n: (Math.round((30 * deck.meaningCards) / liveComps.length) / 10).toString() }) : ''}</span>
                </span>
                <Stepper value={deck.meaningCards} min={1} max={maxCards(BASE)} label={t('decks.meaningCards')} onChange={(n) => set({ meaningCards: n })} />
              </div>
            </div>
            <div class="m-all">
              <button class="ba-btn ba-btn-secondary" disabled={gen.impossible} onClick={() => setShowCards(!showCards)}>
                {showCards ? t('decks.hideCards') : t('decks.showCards', { n: gen.cards.length })}
              </button>
              <button class="ba-btn ba-btn-secondary" onClick={() => set({ seed: ((Math.random() * 2 ** 31) >>> 0) || 1 })}>
                {t('decks.reshuffle')}
              </button>
            </div>
            {showCards && !gen.impossible && (
              <ol class="card-preview">
                {gen.cards.map((c) => (
                  <li key={c.id}>{c.meanings.join(' · ')}</li>
                ))}
              </ol>
            )}
          </Section>

          <Section label={t('decks.test')}>
            <Seg
              label={t('decks.testFor')}
              value={String(testN) as '2' | '3' | '4'}
              onChange={(x) => setTestN(Number(x) as 2 | 3 | 4)}
              options={COUNTS.map((n) => ({ v: String(n) as '2' | '3' | '4', label: t('decks.nPlayers', { n }), disabled: !v.players[n].ok }))}
            />
            <button class="ba-btn ba-btn-secondary wide" disabled={!!v.errors.length || !v.players[testN].ok || !!testCurrent?.running} onClick={runTest}>
              {testCurrent?.running ? t('decks.testing') : t('decks.testRun')}
            </button>
            {testCurrent?.r && (
              <div class="panel deck-details" role="status">
                <p>{t('decks.testLines', { n: testCurrent.r.lines.toFixed(1) })}</p>
                <p>{t('decks.testOut', { n: pct(testCurrent.r.out) })}</p>
                <p>{t('decks.testStalls', { n: testCurrent.r.stalls.toFixed(1) })}</p>
                {testCurrent.r.lines < 12 && <p>! {t('decks.testShort')}</p>}
                {testCurrent.r.out < 0.15 && <p>! {t('decks.testCount')}</p>}
                {testCurrent.r.unfinished > 0 && <p class="ds-err">✗ {t('decks.testUnfinished', { n: testCurrent.r.unfinished })}</p>}
              </div>
            )}
            {test && !testCurrent && <Note>{t('decks.testStale')}</Note>}
          </Section>

          <button class="ba-btn ba-btn-primary wide" disabled={!canSave} onClick={save}>
            {t('decks.save')}
          </button>
          {!canSave && <Note>{t('decks.cantSave')}</Note>}
        </div>
      </Scroll>
    </Screen>
  );
}
