// Custom decks (feature plan, deck editor): the list of decks, and the editor for one. Changes save as
// you go; a game already started keeps its own copy of its deck.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cardTotal, deckById, deckFit, deleteDeck, duplicateDeck, exportDeck, importDeck, renameDeck, saveDeck, deckNotice } from '../../app/decks';
import { saveFile } from '../../app/backup';
import { BASE, PARTICLE_TYPE, VERBS, type DeckCompound, type DeckData } from '../../engine/deck';
import { availableMeanings, buildDeck, defaultCustom, generateMeaningCards, maxCards, MAX_COPIES, MAX_WILDCARDS, validateDeck, type CustomDeck } from '../../engine/deckTools';
import type { DeckTestResult } from '../../engine/deckTest';
import { t } from '../../i18n';
import { customDecks, savedGame } from '../../storage';
import { Face } from '../cards';
import { Header, Screen, Scroll, Seg } from '../kit';
import { nav } from '../nav';
import { playersText } from './setup';
import { IconTaken } from '../icons';

const COUNTS = [2, 3, 4] as const;
const byIrish = (a: string, b: string) => a.localeCompare(b, 'ga');
/** Standard as the editor sees it: one set of counts, the verb pack included, so it serves 2 to 4. */
const STANDARD = defaultCustom(BASE, 4);
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const compoundsOn = (d: CustomDeck) => {
  const avail = availableMeanings(BASE, d);
  return d.meanings.filter((m) => avail.has(m)).reduce((a, m) => a + avail.get(m)!.length, 0);
};
const inUse = (id: string) => savedGame.value?.state.config.deck?.custom?.id === id && !savedGame.value.state.over;

// ---------- the list ----------

export function DecksScreen() {
  const list = customDecks.value;
  const [msg, setMsg] = useState<{ text: string; alert?: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const edit = (id: string) => nav.push('deckEdit', { id });
  const fromStandard = () => edit(duplicateDeck(4, t('decks.newName', { n: list.length + 1 })).id);

  const onImport = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const r = importDeck(await f.text());
    if (!r.deck) setMsg({ text: t('decks.importFailed', { why: r.error ?? '' }), alert: true });
    else setMsg({ text: r.dropped.length ? t('decks.importedDropped', { name: r.deck.name, list: r.dropped.join(', ') }) : t('decks.imported', { name: r.deck.name }) });
  };

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
          <div class="panel deck-card is-builtin" data-deck="standard">
            <span class="deck-chip deck-stack" aria-hidden="true" />
            <div class="dc-body">
              <div class="dc-name">
                {t('decks.standard')} <span class="lock-chip">{t('decks.builtIn')}</span>
              </div>
              <div class="caption muted">{t('decks.standardLine', { a: cardTotal(undefined, 2), b: cardTotal(undefined, 3) })}</div>
              <div class="dc-actions">
                <button class="ba-btn ba-btn-secondary" onClick={fromStandard}>
                  {t('decks.duplicate')}
                </button>
              </div>
            </div>
          </div>
          {list.map((d) => {
            const fit = deckFit(d);
            const counts = COUNTS.filter((k) => fit[k] !== null);
            return (
              <div class="panel deck-card" key={d.id} data-deck={d.id}>
                <span class="deck-chip deck-stack" aria-hidden="true" />
                <div class="dc-body">
                  <div class="dc-name">{d.name}</div>
                  <div class="caption muted">
                    {t('decks.cards', { n: cardTotal(d) })} · {counts.length ? playersText(counts) : t('decks.servesNone')} · {t('decks.compoundsN', { n: compoundsOn(d) })}
                  </div>
                  {inUse(d.id) && <div class="caption">{t('decks.inUse')}</div>}
                  <div class="dc-actions">
                    <button class="ba-btn ba-btn-quiet" onClick={() => duplicateDeck(d, t('decks.copyName', { name: d.name }))}>
                      {t('decks.duplicate')}
                    </button>
                    <button class="ba-btn ba-btn-secondary" onClick={() => edit(d.id)} aria-label={t('decks.editNamed', { name: d.name })}>
                      {t('decks.edit')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button class={'ba-btn wide ' + (list.length ? 'ba-btn-secondary' : 'ba-btn-primary')} onClick={fromStandard}>
            {t('decks.new')}
          </button>
          <button class="ba-btn ba-btn-quiet wide" onClick={() => file.current?.click()}>
            {t('decks.import')}
          </button>
          <input ref={file} type="file" accept="application/json,.json" class="sr-only" tabIndex={-1} aria-hidden="true" onChange={onImport} />
        </div>
      </Scroll>
    </Screen>
  );
}

// ---------- the editor ----------

/** A count with − and + (design system Stepper). Holding a button repeats after 400ms. */
function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cur = useRef(value);
  cur.current = value;
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const hold = (step: number) => {
    stop();
    const tick = (delay: number) => {
      timer.current = setTimeout(() => {
        const n = cur.current + step;
        if (n < min || n > max) return stop();
        onChange(n);
        tick(90);
      }, delay);
    };
    tick(400);
  };
  const btn = (cls: string, step: number, lbl: string, disabled: boolean) => (
    <button class={cls} type="button" aria-label={lbl} disabled={disabled} onClick={() => onChange(value + step)} onPointerDown={() => hold(step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} />
  );
  return (
    <div class="ba-stepper" role="group" aria-label={label}>
      {btn('ba-dec', -1, t('decks.less', { what: label }), value <= min)}
      <output aria-live="polite">{value}</output>
      {btn('ba-inc', 1, t('decks.more', { what: label }), value >= max)}
    </div>
  );
}

function CountRow({ face, value, std, min, max, label, onChange }: { face: preact.JSX.Element; value: number; std: number; min: number; max: number; label: string; onChange: (n: number) => void }) {
  return (
    <div class="step-row">
      <span class="step-face" aria-hidden="true">
        {face}
      </span>
      <span class="step-std caption muted">{value !== std ? t('decks.stdN', { n: std }) : ''}</span>
      <Stepper value={value} min={min} max={max} label={label} onChange={onChange} />
    </div>
  );
}

type Tab = 'tiles' | 'compounds' | 'meanings';

export function DeckEditScreen({ id }: { id: string }) {
  const deck = deckById(id);
  const [tab, setTab] = useState<Tab>('tiles');
  const [menu, setMenu] = useState<'menu' | 'rename' | 'delete' | null>(null);
  const [name, setName] = useState('');
  const [testing, setTesting] = useState(false);
  const v = useMemo(() => (deck ? validateDeck(BASE, deck) : null), [deck]);
  const avail = useMemo(() => (deck ? availableMeanings(BASE, deck) : new Map<string, DeckCompound[]>()), [deck]);
  const gen = useMemo(() => (deck ? generateMeaningCards(BASE, deck) : null), [deck]);
  if (!deck || !v || !gen) return null;
  // Changes save as you go: every edit is stored at once.
  const set = (patch: Partial<CustomDeck>) => saveDeck({ ...deck, ...patch });

  const sel = new Set(deck.meanings);
  const live = deck.meanings.filter((m) => avail.has(m));
  const verbs = [...new Set([...VERBS, ...Object.keys(deck.verbs)])].sort(byIrish);
  const parts = (type: 'adverb' | 'preposition') => BASE.particles.filter((p) => PARTICLE_TYPE[p.word] === type).map((p) => p.word);
  const missing = (c: DeckCompound) => [c.verb, ...c.particles].filter((w) => !((c.verb === w ? deck.verbs[w] : deck.particles[w]) > 0));
  const groups = verbs.map((verb) => ({ verb, comps: BASE.compounds.filter((c) => c.verb === verb) })).filter((g) => g.comps.length);
  const setMeanings = (ms: string[]) => set({ meanings: [...new Set(ms)] });
  const toggle = (m: string, on: boolean) => setMeanings(on ? [...deck.meanings, m] : deck.meanings.filter((x) => x !== m));
  const hand = sum(deck.verbs) + deck.wildcards;
  const river = sum(deck.particles);
  const total = hand + river + deck.meaningCards;
  const fails = COUNTS.filter((n) => !v.players[n].ok);
  const oks = COUNTS.filter((n) => v.players[n].ok);
  const comps = BASE.compounds.length;
  const onCards = BASE.compounds.filter((c) => sel.has(c.meaning) && avail.has(c.meaning)).length;
  // A compound ticked but off the cards because a count it needs is 0.
  const knocked = BASE.compounds.find((c) => sel.has(c.meaning) && missing(c).length > 0);

  // How the meaning slots fall: "12 appear 3 times, 18 appear twice".
  const appear = new Map<string, number>();
  for (const c of gen.cards) for (const m of c.meanings) appear.set(m, (appear.get(m) ?? 0) + 1);
  const byTimes = new Map<number, number>();
  for (const k of appear.values()) byTimes.set(k, (byTimes.get(k) ?? 0) + 1);
  const spread = [...byTimes.entries()].sort((a, b) => b[0] - a[0]).map(([k, n]) => (n === 1 ? (k === 1 ? t('decks.appearOnce1') : k === 2 ? t('decks.appearTwice1') : t('decks.appearN1', { k })) : k === 1 ? t('decks.appearOnce', { n }) : k === 2 ? t('decks.appearTwice', { n }) : t('decks.appearN', { n, k })));
  const need = { 2: 7, 3: 10, 4: 13 } as const;
  const enough = COUNTS.filter((n) => deck.meaningCards >= need[n]);

  const tiles = (
    <section class="de-sec" data-sec="tiles">
      <h2 class="de-h wide-only">{t('decks.tiles')}</h2>
      <div class="list-head">
        <h3 class="sec-label">{t('decks.verbs')}</h3>
        <span class="caption muted tabnum">{t('decks.handDeckN', { n: sum(deck.verbs) })}</span>
      </div>
      <div class="step-list">
        {verbs.map((verb) => (
          <CountRow key={verb} face={<Face card={{ id: -1, k: 'V', t: verb }} size="table" />} value={deck.verbs[verb] ?? 0} std={STANDARD.verbs[verb] ?? 0} min={0} max={MAX_COPIES} label={verb} onChange={(n) => set({ verbs: { ...deck.verbs, [verb]: n } })} />
        ))}
      </div>
      {(['adverb', 'preposition'] as const).map((type) => (
        <div key={type}>
          <div class="list-head">
            <h3 class="sec-label">{type === 'adverb' ? t('decks.adverbs') : t('decks.prepositions')}</h3>
            <span class="caption muted tabnum">{t('decks.riverN', { n: parts(type).reduce((a, p) => a + (deck.particles[p] ?? 0), 0) })}</span>
          </div>
          <div class="step-list">
            {parts(type).map((p) => (
              <CountRow key={p} face={<Face card={{ id: -1, k: 'P', t: p }} size="table" />} value={deck.particles[p] ?? 0} std={STANDARD.particles[p] ?? 0} min={0} max={MAX_COPIES} label={p} onChange={(n) => set({ particles: { ...deck.particles, [p]: n } })} />
            ))}
          </div>
        </div>
      ))}
      <div class="list-head">
        <h3 class="sec-label">{t('decks.wildcards')}</h3>
        <span class="caption muted tabnum">{t('decks.handDeckN', { n: deck.wildcards })}</span>
      </div>
      <div class="step-list">
        <CountRow face={<Face card={{ id: -1, k: 'W', t: '*' }} size="table" />} value={deck.wildcards} std={STANDARD.wildcards} min={0} max={MAX_WILDCARDS} label={t('decks.wildcards')} onChange={(n) => set({ wildcards: n })} />
      </div>
    </section>
  );

  const compounds = (
    <section class="de-sec" data-sec="compounds">
      <h2 class="de-h wide-only">{t('decks.compounds')}</h2>
      <div class="list-head">
        <span class="body tabnum">{t('decks.onCards', { n: onCards, total: comps })}</span>
        <button class="ba-btn ba-btn-quiet link-btn" onClick={() => setMeanings([...deck.meanings, ...avail.keys()])}>
          {t('decks.tickAll')}
        </button>
      </div>
      {groups.map((g) => (
        <div class="m-group" key={g.verb}>
          <div class="m-head">
            <span aria-hidden="true">
              <Face card={{ id: -1, k: 'V', t: g.verb }} size="table" extraClass="m-chip" />
            </span>
            <span class="sec-label">{g.verb}</span>
          </div>
          {g.comps.map((c) => {
            const ok = avail.has(c.meaning);
            const need = missing(c);
            return (
              <label class={'m-check' + (ok ? '' : ' is-off')} key={c.id}>
                <input type="checkbox" checked={ok && sel.has(c.meaning)} disabled={!ok} onChange={(e) => toggle(c.meaning, (e.target as HTMLInputElement).checked)} />
                <span class="lr-text">
                  <span class="lr-ga">{[c.verb, ...c.particles].join(' ')}</span>
                  <span class="lr-en">{!ok && need.length ? t('decks.needs', { list: need.join(', ') }) : c.meaning.toLowerCase()}</span>
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </section>
  );

  const meanings = (
    <section class="de-sec" data-sec="meanings">
      <h2 class="de-h wide-only">{t('decks.meaningCards')}</h2>
      <div class="panel mc-row">
        <span class="lr-text">
          <span class="panel-title">{t('decks.meaningCards')}</span>
          <span class="caption muted">{t('decks.threeEach')}</span>
        </span>
        <Stepper value={deck.meaningCards} min={1} max={maxCards(BASE)} label={t('decks.meaningCards')} onChange={(n) => set({ meaningCards: n })} />
      </div>
      {gen.impossible ? (
        <p class="body">{live.length < 3 ? t('decks.tickThree') : t('decks.tooFewCards', { n: deck.meaningCards, m: live.length, need: Math.ceil(live.length / 3) })}</p>
      ) : (
        <p class="body">{t('decks.spread', { k: onCards, n: deck.meaningCards, list: spread.join(', ') })}</p>
      )}
      <p class="caption muted">{enough.length === 3 ? t('decks.enoughAll') : enough.length ? t('decks.enoughFor', { list: playersText([...enough]) }) : t('decks.enoughNone')}</p>
      <div class="list-head">
        <h3 class="sec-label">{t('decks.dealtFrom', { seed: deck.seed })}</h3>
        <button class="ba-btn ba-btn-quiet link-btn" onClick={() => set({ seed: Math.floor(Math.random() * 9000) + 1000 })}>
          {t('decks.shuffle')}
        </button>
      </div>
      <div class="mc-strip" role="list" aria-label={t('decks.meaningCards')} tabIndex={0}>
        {gen.cards.map((c) => (
          <div class="ba-card ba-meaning mc-card" role="listitem" key={c.id}>
            {c.meanings.map((m) => {
              const cmp = avail.get(m)?.[0];
              return (
                <div class="ba-m" key={m}>
                  <span class="ba-en">{m}</span>
                  <span class="ba-ga">{cmp ? [cmp.verb, ...cmp.particles].join(' ') : ''}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p class="caption muted">{t('decks.giveUpNote')}</p>
    </section>
  );

  return (
    <Screen class="deck-edit">
      <Scroll>
        <div class="pad">
          <Header title={deck.name} right={<button class="ba-icon-btn de-more" aria-label={t('decks.more3')} onClick={() => setMenu('menu')}>⋯</button>} />
          <div class="panel de-summary" role="status">
            <div class="ds-top">
              <span class="ds-total tabnum">{t('decks.cards', { n: total })}</span>
              <span class="caption muted tabnum">{t('decks.piles', { hand, river, m: deck.meaningCards })}</span>
            </div>
            <div class="ds-fit" role="list">
              {COUNTS.map((n) => (
                <span key={n} role="listitem" class={'ba-fit ' + (v.players[n].ok ? 'is-ok' : 'is-no')}>
                  {t('decks.nPlayers', { n })}
                </span>
              ))}
            </div>
            {fails.length > 0 && (
              <p class="body ds-why">
                {fails.map((n) => t('decks.failFor', { n, why: (v.players[n] as { reason: string }).reason })).join('; ')}.{' '}
                {oks.length ? t('decks.setupOffers', { list: playersText([...oks]) }) : t('decks.setupNone')}
              </p>
            )}
            {v.errors.map((e) => (
              <p class="caption ds-err" key={e.code}>
                {e.text}
              </p>
            ))}
            {knocked && <p class="caption muted">{t('decks.knocked', { word: missing(knocked)[0], compound: [knocked.verb, ...knocked.particles].join(' ') })}</p>}
            {v.warnings.map((w, i) => (
              <p class="caption muted" key={w.code + i}>
                {w.text}
              </p>
            ))}
          </div>
          <div class="de-tabs narrow-only">
            <Seg
              label={t('decks.sections')}
              value={tab}
              onChange={setTab}
              options={[
                { v: 'tiles', label: t('decks.tiles') },
                { v: 'compounds', label: t('decks.compounds') },
                { v: 'meanings', label: t('decks.meaningsTab') },
              ]}
            />
          </div>
          <div class={'de-cols tab-' + tab}>
            {tiles}
            {compounds}
            {meanings}
          </div>
          <div class="bottom-space" />
        </div>
      </Scroll>
      <div class="bottom-bar de-bar">
        <span class="caption muted">{t('decks.savesAsYouGo')}</span>
        <button class="ba-btn ba-btn-primary" onClick={() => setTesting(true)} disabled={!oks.length}>
          {t('decks.testWithBots')}
        </button>
      </div>
      {testing && <TestSheet deck={deck} ok={(n) => v.players[n].ok} onClose={() => setTesting(false)} />}
      {menu && (
        <div class="sheet-wrap" onPointerDown={(e) => e.target === e.currentTarget && setMenu(null)}>
          <div class="ba-scrim scrim-in" aria-hidden="true" />
          <div class="ba-sheet sheet sheet-in" role="dialog" aria-modal="true" aria-label={deck.name}>
            <div class="grabber" aria-hidden="true" />
            {menu === 'rename' ? (
              <>
                <h2 class="sheet-title">{t('decks.rename')}</h2>
                <input class="name-input" value={name} maxLength={40} aria-label={t('decks.name')} onInput={(e) => setName((e.target as HTMLInputElement).value)} ref={(el) => el?.focus()} />
                <button
                  class="ba-btn ba-btn-primary wide"
                  onClick={() => {
                    renameDeck(deck.id, name);
                    setMenu(null);
                  }}
                >
                  {t('decks.save')}
                </button>
              </>
            ) : menu === 'delete' ? (
              <>
                <h2 class="sheet-title">{t('decks.deleteQ', { name: deck.name })}</h2>
                {inUse(deck.id) && <p class="sheet-sub">{t('decks.inUse')}</p>}
                <div class="row2">
                  <button class="ba-btn ba-btn-secondary" onClick={() => setMenu(null)}>
                    {t('decks.keep')}
                  </button>
                  <button
                    class="ba-btn ba-btn-primary danger"
                    onClick={() => {
                      deleteDeck(deck.id);
                      nav.back();
                    }}
                  >
                    {t('decks.delete')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 class="sheet-title">{deck.name}</h2>
                <button
                  class="ba-btn ba-btn-secondary wide"
                  onClick={() => {
                    setName(deck.name);
                    setMenu('rename');
                  }}
                >
                  {t('decks.rename')}
                </button>
                <button
                  class="ba-btn ba-btn-secondary wide"
                  onClick={() => {
                    const d = duplicateDeck(deck, t('decks.copyName', { name: deck.name }));
                    setMenu(null);
                    nav.replace('deckEdit', { id: d.id });
                  }}
                >
                  {t('decks.duplicate')}
                </button>
                <button
                  class="ba-btn ba-btn-secondary wide"
                  onClick={() => {
                    setMenu(null);
                    void saveFile((deck.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'deck') + '.json', exportDeck(deck));
                  }}
                >
                  {t('decks.export')}
                </button>
                <button class="ba-btn ba-btn-quiet wide danger-text" onClick={() => setMenu('delete')}>
                  {t('decks.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}

// ---------- test with bots ----------

const STANDARD_RESULTS = new Map<number, DeckTestResult>();
const GAMES = 100;

function TestSheet({ deck, ok, onClose }: { deck: CustomDeck; ok: (n: 2 | 3 | 4) => boolean; onClose: () => void }) {
  const [n, setN] = useState<2 | 3 | 4>(COUNTS.find((k) => ok(k)) ?? 2);
  const [res, setRes] = useState<{ n: number; r: DeckTestResult } | null>(null);
  useEffect(() => {
    setRes(null);
    const w = new Worker(new URL('../../app/deckTest.worker.ts', import.meta.url), { type: 'module' });
    const std = STANDARD_RESULTS.get(n);
    w.onmessage = (e: MessageEvent<{ r: DeckTestResult; standard?: DeckTestResult }>) => {
      if (e.data.standard) STANDARD_RESULTS.set(n, e.data.standard);
      setRes({ n, r: e.data.r });
      w.terminate();
    };
    w.postMessage({ deck: buildDeck(BASE, deck), n, games: GAMES, ...(std ? {} : { standard: BASE as DeckData }) });
    return () => w.terminate();
  }, [n, deck]);
  const std = STANDARD_RESULTS.get(n);
  const r = res?.n === n ? res.r : null;
  // Outliers against Standard at the same table: ringed, and the verdict says what to change.
  const bad = r && std ? { lines: r.lines < std.lines * 0.6, out: r.out < std.out * 0.4, stalls: r.stalls > Math.max(2, std.stalls * 2), never: r.never.length > Math.max(3, compoundsOn(deck) * 0.2) } : null;
  const anyBad = !!bad && (bad.lines || bad.out || bad.stalls || bad.never || r!.unfinished > 0);
  const verdict = !r || !bad ? '' : r.unfinished ? t('decks.vUnfinished', { n: r.unfinished }) : bad.stalls ? t('decks.vStalls', { list: scarce(deck).join(t('decks.and')) }) : bad.lines ? t('decks.vShort') : bad.out ? t('decks.vCount') : bad.never ? t('decks.vNever', { n: r.never.length }) : t('decks.vClose') + (r.never.length ? ' ' + (r.never.length === 1 ? t('decks.vNeverOne') : t('decks.vNeverSome', { n: r.never.length })) : '');
  const pct = (x: number) => Math.round(100 * x) + '%';
  const stat = (key: keyof NonNullable<typeof bad>, big: string, label: string, sub: string) => (
    <div class={'panel ts-stat' + (bad?.[key] ? ' is-out' : '')}>
      <span class="ts-big tabnum">{big}</span>
      <span class="ts-label">{label}</span>
      <span class="caption muted">{sub}</span>
    </div>
  );
  return (
    <div class="sheet-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="ba-scrim scrim-in" aria-hidden="true" />
      <div class="ba-sheet sheet sheet-in test-sheet" role="dialog" aria-modal="true" aria-label={t('decks.testWithBots')}>
        <div class="grabber" aria-hidden="true" />
        <h2 class="sheet-title">{t('decks.testWithBots')}</h2>
        <Seg label={t('decks.testFor')} value={String(n) as '2' | '3' | '4'} onChange={(x) => setN(Number(x) as 2 | 3 | 4)} options={COUNTS.map((k) => ({ v: String(k) as '2' | '3' | '4', label: t('decks.nPlayers', { n: k }), disabled: !ok(k) }))} />
        <p class="sheet-sub">{t('decks.testAbout', { n: GAMES })}</p>
        {!r || !std ? (
          <p class="body ts-running" role="status">
            {t('decks.testing')}
          </p>
        ) : (
          <>
            <div class="ts-grid" role="status">
              {stat('lines', r.lines.toFixed(1), t('decks.tsLines'), t('decks.tsStd', { v: std.lines.toFixed(1) }))}
              {stat('out', pct(r.out), t('decks.tsOut'), t('decks.tsStd', { v: pct(std.out) }))}
              {stat('stalls', r.stalls.toFixed(1), t('decks.tsStalls'), t('decks.tsStd', { v: std.stalls.toFixed(1) }))}
              {stat('never', String(r.never.length), r.never.length === 1 ? t('decks.tsNeverOne') : t('decks.tsNever'), r.never.length && r.never.length <= 2 ? r.never.join(', ') : t('decks.tsOf', { n: compoundsOn(deck) }))}
            </div>
            <div class={'ts-verdict' + (anyBad ? ' is-bad' : '')}>
              <IconTaken size={22} />
              <span>{verdict}</span>
            </div>
          </>
        )}
        <button class="ba-btn ba-btn-primary wide" onClick={onClose}>
          {t('decks.done')}
        </button>
      </div>
    </div>
  );
}

/** The particles the deck's lines want most against what the river holds: what to add. */
function scarce(d: CustomDeck): string[] {
  const avail = availableMeanings(BASE, d);
  const want: Record<string, number> = {};
  for (const m of d.meanings) for (const c of avail.get(m) ?? []) for (const p of c.particles) want[p] = (want[p] ?? 0) + 1;
  return Object.keys(want)
    .sort((a, b) => want[b] / ((d.particles[b] ?? 0) + 0.5) - want[a] / ((d.particles[a] ?? 0) + 0.5))
    .slice(0, 2);
}
