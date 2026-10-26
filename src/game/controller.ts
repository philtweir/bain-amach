// Game controller: the turn loop, the race loop (timers, bot reaction delays), pass-and-play,
// and the line builder's selection. The engine decides every rule; this file only sequences it.
import { batch, computed, signal } from '@preact/signals';
import { botMove, reactionDelay } from '../engine/bot';
import {
  distinctCompounds,
  emptySelection,
  hint as engineHint,
  judge,
  lit,
  placements,
  preferredWay,
  ways,
  wayToMove,
  type Attempt,
  type Placement,
  type Selection,
  type Way,
} from '../engine/builder';
import { COMPOUND_BY_ID, COMPOUNDS_BY_VERB, compoundText } from '../engine/deck';
import { apply, canDraw, FINAL_STALLS, meaningsOf, newGame, pass, raceStall, setStuck, useHint, view, wrongLine } from '../engine/game';
import type { GameConfig, GameEvent, GameState, LineMove, Move, Rejection, VerbSrc } from '../engine/types';
import { t } from '../i18n';
import { platform } from '../platform';
import { madeCount, recordLine, settings, updateSettings, writeGame } from '../storage';
import { dur, haptic } from '../ui/motion';
import { COMPOUNDS } from '../engine/deck';

/** Hidden-mode picks in order. River picks remember the card, so a race can tell when it went. */
export type Pick = { river: number; cid: number } | { wild: number } | { cross: { x: number; y: number } };

export interface Toast {
  id: number;
  kind: 'made' | 'soft' | 'quiet' | 'alert';
  ga?: string;
  en?: string;
  msg?: string;
  sub?: string;
  player?: number;
  icon?: 'retry' | 'taken' | 'no' | 'turns';
}

export interface Made {
  compound: string;
  meaning: string;
  isNew: boolean;
  count: number;
  at: number;
}

/** An action the board animates: which cards are new and where they flew from. */
export interface Action {
  seq: number;
  kind: 'line' | 'lone' | 'swap' | 'pass' | 'stall' | 'wrong';
  p: number;
  bot: boolean;
  cells: [number, number][];
  /** card id → screen rect it flies from */
  from: Map<number, DOMRect>;
  stagger: number;
}

export interface SpotChoice {
  /** Line ways (one compound) or a lone verb. */
  way?: Way;
  lone?: number;
  options: Placement[];
  chosen: number;
}

const SPEED: Record<string, number> = { slow: 0.6, normal: 1, fast: 1.6 };
const LOCKOUT_MS = 3000;
const AUTO_HINT_MS = 20000;

let toastId = 1;
let actionSeq = 1;

export class Controller {
  gs = signal<GameState>(null as unknown as GameState);
  /** Index of the player whose hand the tray shows. */
  viewer = signal(0);
  sel = signal<Selection>(emptySelection());
  /** Hidden mode: particle picks in order. */
  picks = signal<Pick[]>([]);
  phase = signal<'play' | 'handover' | 'over' | 'board'>('play');
  paused = signal(false);
  toasts = signal<Toast[]>([]);
  made = signal<Made | null>(null);
  action = signal<Action | null>(null);
  spot = signal<SpotChoice | null>(null);
  lockUntil = signal(0);
  now = signal(Date.now());
  hintVerb = signal<VerbSrc | null>(null);
  shake = signal<{ key: string; at: number } | null>(null);
  taken = signal<{ river?: number; cell?: string; at: number } | null>(null);
  botPlaying = signal<number | null>(null);
  plus = signal<Record<number, number>>({});
  stallMark = signal(0);
  announce = signal('');
  headerNote = signal<string | null>(null);
  elapsed = signal(0);
  /** World-space point the camera looks at; set by the board, used to place lines near the view. */
  focus: { x: number; y: number } | undefined;
  /** Whether the board should follow the next play (the board sets this from user panning). */
  lastUserPan = 0;
  tutorialHook: ((ev: string, data?: unknown) => boolean | void) | null = null;

  private timers = new Set<ReturnType<typeof setTimeout>>();
  private botTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private botIdle = new Set<number>();
  private busyUntil = 0;
  private clockStart = 0;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private lastPlayAt = Date.now();
  private autoHintTimer: ReturnType<typeof setTimeout> | null = null;
  private lastViewer = -1;
  private riverIds = new Map<number, number>();
  private disposed = false;

  readonly config: GameConfig;

  constructor(init: { config: GameConfig } | { state: GameState; elapsed?: number }) {
    const s = 'state' in init ? init.state : newGame(init.config);
    this.config = s.config;
    this.gs.value = s;
    this.elapsed.value = 'state' in init ? init.elapsed ?? 0 : 0;
    const humans = this.humans();
    this.viewer.value = s.config.mode === 'turns' && this.isHuman(s.turn) ? s.turn : humans[0] ?? 0;
    this.lastViewer = this.passAndPlay ? -1 : this.viewer.value;
    if (s.over) this.phase.value = 'over';
  }

  // ---------- derived ----------

  get passAndPlay() {
    return this.humans().length > 1;
  }
  get race() {
    return this.config.mode === 'race';
  }
  get hidden() {
    return this.config.answers === 'hidden';
  }
  humans(s = this.gs.value) {
    return s.config.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  }
  isHuman(p: number) {
    return this.gs.value.config.players[p]?.kind === 'human';
  }
  name(p: number): string {
    const pl = this.gs.value.config.players[p];
    if (!pl) return '';
    if (pl.kind === 'human' && !this.passAndPlay) return t('table.you');
    return pl.name;
  }
  /** True when the viewer may act now. */
  canAct = computed(() => {
    const s = this.gs.value;
    if (s.over || this.paused.value || this.phase.value !== 'play') return false;
    if (this.config.mode === 'race') return true;
    return s.turn === this.viewer.value && this.botPlaying.value === null;
  });
  ways = computed(() => {
    const s = this.gs.value;
    if (this.hidden) return [] as Way[];
    return ways(s, this.viewer.value, this.sel.value);
  });
  lit = computed(() => {
    const sel = this.sel.value;
    const empty = sel.meaning === undefined && !sel.verb && !sel.river.length && !sel.wild.length && !sel.cross;
    if (this.hidden || empty || !this.canAct.value) return null;
    return lit(this.gs.value, this.viewer.value, sel, this.ways.value);
  });
  /** Distinct compounds once a meaning and a verb are both chosen ("two ways to finish"). */
  choices = computed(() => {
    const sel = this.sel.value;
    if (this.hidden || sel.meaning === undefined || (!sel.verb && !sel.cross)) return [] as string[];
    return distinctCompounds(this.ways.value);
  });
  locked = computed(() => this.lockUntil.value > this.now.value);

  // ---------- lifecycle ----------

  start() {
    platform.keepAwake(true);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (this.race) this.startClock();
    this.save();
    this.kick();
  }

  dispose() {
    this.disposed = true;
    platform.keepAwake(false);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.stopTimers();
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      this.save();
      if (!this.gs.value.over && this.phase.value === 'play') this.pause(true);
    }
  };

  pause(on: boolean) {
    if (this.paused.value === on) return;
    this.paused.value = on;
    if (on) {
      this.stopTimers();
      this.stopClock();
      this.save();
    } else {
      if (this.race) this.startClock();
      this.kick();
    }
  }

  private stopTimers() {
    for (const tm of this.timers) clearTimeout(tm);
    this.timers.clear();
    for (const tm of this.botTimers.values()) clearTimeout(tm);
    this.botTimers.clear();
    if (this.autoHintTimer) clearTimeout(this.autoHintTimer);
    this.autoHintTimer = null;
  }

  private later(ms: number, fn: () => void) {
    const tm = setTimeout(() => {
      this.timers.delete(tm);
      if (!this.disposed) fn();
    }, ms);
    this.timers.add(tm);
    return tm;
  }

  private startClock() {
    this.clockStart = performance.now() - this.elapsed.value;
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = setInterval(() => {
      this.elapsed.value = performance.now() - this.clockStart;
      this.now.value = Date.now();
    }, 250);
  }
  private stopClock() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }

  save() {
    const s = this.gs.value;
    if (s.config.tutorial) return;
    if (s.over) writeGame(null);
    else writeGame({ state: s, elapsed: this.elapsed.value, savedAt: Date.now() });
  }

  // ---------- the loop ----------

  /** Let the loop carry on (the tutorial holds the bot between steps). */
  resume() {
    this.kick();
  }

  /** After any state change: schedule whoever acts next. */
  private kick() {
    const s = this.gs.value;
    if (this.paused.value || this.disposed) return;
    if (s.over) {
      this.finish();
      return;
    }
    const wait = Math.max(0, this.busyUntil - performance.now());
    if (this.race) {
      this.later(wait, () => this.raceSchedule());
    } else {
      this.later(wait, () => this.turnStep());
    }
    this.armAutoHint();
  }

  private turnStep() {
    const s = this.gs.value;
    if (s.over || this.paused.value) return;
    const p = s.turn;
    if (!this.isHuman(p)) {
      if (this.tutorialHook?.('botTurn', p) === false) return;
      this.botPlaying.value = p;
      this.later(dur(650 + Math.random() * 450), () => this.botTurnAct(p));
      return;
    }
    this.botPlaying.value = null;
    if (this.passAndPlay && p !== this.lastViewer) {
      this.viewer.value = p;
      this.clearSelection();
      this.phase.value = 'handover';
      return;
    }
    this.viewer.value = p;
  }

  private botTurnAct(p: number) {
    const s = this.gs.value;
    if (s.over || this.paused.value || s.turn !== p) return;
    const { move, rng } = botMove(s, p);
    const s1 = { ...s, rng };
    if (move) {
      const r = apply(s1, p, move);
      if (r.ok) {
        this.commit(r.state, p, move, true);
        return;
      }
    }
    const r = pass(s1, p);
    if (r.ok) this.commit(r.state, p, null, true);
  }

  private raceSchedule() {
    const s = this.gs.value;
    if (s.over || this.paused.value) return;
    this.botPlaying.value = null;
    s.config.players.forEach((pl, p) => {
      if (pl.kind !== 'bot' || this.botTimers.has(p) || this.botIdle.has(p)) return;
      const { ms, rng } = reactionDelay(this.gs.value, p, SPEED[settings.value.botSpeed] ?? 1);
      this.gs.value = { ...this.gs.value, rng };
      const tm = setTimeout(() => {
        this.botTimers.delete(p);
        this.raceBotAct(p);
      }, ms);
      this.botTimers.set(p, tm);
    });
    this.checkRaceStall();
  }

  private raceBotAct(p: number) {
    const s = this.gs.value;
    if (s.over || this.paused.value || this.disposed) return;
    if (performance.now() < this.busyUntil) {
      // let the last play land first
      const tm = setTimeout(() => {
        this.botTimers.delete(p);
        this.raceBotAct(p);
      }, this.busyUntil - performance.now() + 50);
      this.botTimers.set(p, tm);
      return;
    }
    const { move, rng } = botMove(s, p);
    const s1 = { ...s, rng };
    if (move) {
      const r = apply(s1, p, move);
      if (r.ok) {
        this.commit(r.state, p, move, true);
        return;
      }
    }
    this.gs.value = s1;
    this.botIdle.add(p);
    this.checkRaceStall();
  }

  private checkRaceStall() {
    const s = this.gs.value;
    if (s.over || this.paused.value) return;
    const humans = this.humans();
    if (!humans.every((h) => s.stuck[h])) return;
    const bots = s.config.players.map((_, i) => i).filter((i) => !this.isHuman(i));
    if (bots.some((b) => botMove(s, b).move)) {
      // a bot can still play: make sure it is scheduled
      for (const b of bots) this.botIdle.delete(b);
      for (const b of bots)
        if (!this.botTimers.has(b)) {
          const tm = setTimeout(() => {
            this.botTimers.delete(b);
            this.raceBotAct(b);
          }, 600);
          this.botTimers.set(b, tm);
        }
      return;
    }
    this.later(dur(500), () => {
      const cur = this.gs.value;
      if (cur !== s || cur.over || this.paused.value) return;
      this.commit(raceStall(cur), -1, null, false);
    });
  }

  /** Install a new state after a move (or pass, stall) and run its feedback. */
  commit(next: GameState, p: number, move: Move | null, bot: boolean, from?: Map<number, DOMRect>) {
    const prev = this.gs.value;
    const newEvents = next.log.slice(prev.log.length);
    batch(() => {
      this.gs.value = next;
      if (!bot && p === this.viewer.value) this.clearSelection();
      this.spot.value = null;
      this.hintVerb.value = null;
    });
    this.botIdle.clear();
    this.lastPlayAt = Date.now();
    let busy = 0;
    for (const ev of newEvents) busy = Math.max(busy, this.feedback(ev, prev, next, bot, from));
    this.busyUntil = performance.now() + busy;
    if (this.passAndPlay && !bot && p >= 0) this.lastViewer = p;
    if (!this.passAndPlay && !bot) this.lastViewer = this.viewer.value;
    this.save();
    this.validateSelection();
    this.tutorialHook?.('commit', { move, p });
    this.kick();
  }

  private feedback(ev: GameEvent, prev: GameState, next: GameState, bot: boolean, from?: Map<number, DOMRect>): number {
    switch (ev.e) {
      case 'line': {
        const c = COMPOUND_BY_ID[ev.c];
        const text = compoundText(c);
        const byHuman = this.isHuman(ev.p);
        const isNew = recordLine(ev.c, byHuman);
        const n = ev.cells.length;
        const stagger = bot ? dur(420) : dur(60);
        const flight = (n - 1) * stagger + dur(200);
        this.action.value = { seq: actionSeq++, kind: 'line', p: ev.p, bot, cells: ev.cells, from: from ?? this.botSources(prev, ev), stagger };
        this.say(t('table.lays', { name: this.name(ev.p), compound: text, meaning: ev.g.toLowerCase() }));
        if (byHuman && !bot) {
          haptic('light');
          this.later(flight, () => {
            haptic('strong');
            this.made.value = { compound: text, meaning: ev.g, isNew, count: madeCount(), at: Date.now() };
            this.later(dur(640) + 900, () => this.settleMade());
          });
          return flight + dur(640);
        }
        if (bot) this.botPlaying.value = ev.p;
        this.later(flight, () => {
          this.toast({ kind: 'made', ga: text, en: ev.g.toLowerCase() + ' · ' + this.name(ev.p), player: ev.p });
          if (this.botPlaying.value === ev.p) this.botPlaying.value = null;
        });
        return flight + 250;
      }
      case 'lone': {
        this.action.value = { seq: actionSeq++, kind: 'lone', p: ev.p, bot, cells: [[ev.x, ev.y]], from: from ?? this.botSources(prev, ev), stagger: 0 };
        this.say(t('table.laysAlone', { name: this.name(ev.p), word: ev.word }));
        if (ev.p === this.viewer.value) this.noteDraw(ev.drew, next);
        else this.bumpPlus(ev.p, ev.drew.length);
        return dur(bot ? 520 : 260);
      }
      case 'swap':
        this.action.value = { seq: actionSeq++, kind: 'swap', p: ev.p, bot, cells: [], from: new Map(), stagger: 0 };
        this.say(t('table.swapped', { name: this.name(ev.p) }));
        if (bot) this.toast({ kind: 'quiet', msg: t('table.swapped', { name: this.name(ev.p) }) });
        return dur(bot ? 600 : 200);
      case 'pass': {
        this.say(ev.drew !== null ? t('table.passed', { name: this.name(ev.p) }) : t('table.passedNoDraw', { name: this.name(ev.p) }));
        if (ev.p === this.viewer.value && !bot) this.noteDraw(ev.drew === null ? [] : [ev.drew], next);
        else if (ev.drew !== null) this.bumpPlus(ev.p, 1);
        return dur(bot ? 450 : 150);
      }
      case 'wrong':
        return 0;
      case 'stuck':
        return 0;
      case 'stall': {
        this.stallMark.value = Date.now();
        haptic('light');
        const drewAny = ev.drew.some((d) => d !== null);
        this.toast({ kind: 'quiet', icon: 'turns', msg: t('table.stall'), sub: drewAny ? t('table.stallSub') : t('table.stallSubEmpty') });
        if (drewAny) {
          ev.drew.forEach((d, p) => {
            if (d === null) return;
            if (p === this.viewer.value) this.noteDraw([d], next);
            else this.bumpPlus(p, 1);
          });
        }
        this.say(t('table.stall'));
        return dur(900);
      }
      case 'end':
        return 0;
    }
  }

  private noteDraw(ids: number[], s: GameState) {
    const hand = s.hands[this.viewer.value];
    const cards = ids.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
    if (!cards.length) this.headerNote.value = canDraw(s) ? null : t('table.drewNothing');
    else if (cards.length === 1) this.headerNote.value = cards[0]!.k === 'M' ? t('table.drewMeaning') : t('table.youDrew', { word: cards[0]!.k === 'W' ? t('a11y.wild').toLowerCase() : cards[0]!.t });
    else this.headerNote.value = cards.map((c) => (c!.k === 'M' ? t('table.drewMeaning') : t('table.youDrew', { word: c!.k === 'W' ? t('a11y.wild').toLowerCase() : c!.t }))).join(' · ');
  }

  private bumpPlus(p: number, n: number) {
    if (!n) return;
    this.plus.value = { ...this.plus.value, [p]: (this.plus.value[p] ?? 0) + n };
    this.later(2000, () => {
      const next = { ...this.plus.value };
      delete next[p];
      this.plus.value = next;
    });
  }

  /** Where a bot's cards fly from: river piles for particles, the bot's avatar for hand cards. */
  private botSources(prev: GameState, ev: GameEvent): Map<number, DOMRect> {
    const m = new Map<number, DOMRect>();
    if (ev.e !== 'line' && ev.e !== 'lone') return m;
    const avatar = document.querySelector(`[data-avatar="${ev.p}"]`)?.getBoundingClientRect();
    const next = this.gs.value;
    const g = view(next);
    const cells = ev.e === 'line' ? ev.cells : [[ev.x, ev.y] as [number, number]];
    let r = 0;
    for (const [x, y] of cells) {
      const c = g.at(x, y);
      if (!c || prev.board.some((b) => b.id === c.id)) continue;
      if (c.k === 'P' && ev.e === 'line') {
        const pile = ev.river[r++];
        const el = document.querySelector(`[data-pile="${pile}"]`)?.getBoundingClientRect();
        if (el) m.set(c.id, el);
      } else if (avatar) m.set(c.id, avatar);
    }
    return m;
  }

  private settleMade() {
    const m = this.made.value;
    if (!m) return;
    this.made.value = null;
    this.toast({ kind: 'made', ga: m.compound, en: m.meaning.toLowerCase() + ' · ' + this.name(this.viewer.value), player: this.viewer.value });
  }

  dismissMade() {
    if (this.made.value) this.settleMade();
  }

  toast(tt: Omit<Toast, 'id'>) {
    const item = { ...tt, id: toastId++ };
    const list = [...this.toasts.value, item].slice(-2);
    this.toasts.value = list;
    const ms = tt.kind === 'soft' ? 3200 : tt.kind === 'alert' ? 5000 : 2500;
    this.later(ms, () => (this.toasts.value = this.toasts.value.filter((x) => x.id !== item.id)));
  }

  say(text: string) {
    this.announce.value = '';
    queueMicrotask(() => (this.announce.value = text));
  }

  private finish() {
    if (this.phase.value === 'over' || this.phase.value === 'board') return;
    const wait = Math.max(0, this.busyUntil - performance.now()) + dur(300);
    this.stopClock();
    this.later(wait, () => {
      this.made.value = null;
      this.botPlaying.value = null;
      haptic('strong');
      this.phase.value = 'over';
      const s = this.gs.value;
      if (s.config.tutorial) {
        updateSettings({ tutorialDone: true });
        return;
      }
      const first = settings.value.gamesFinished === 0;
      updateSettings({
        gamesFinished: settings.value.gamesFinished + 1,
        installNudge: first && settings.value.installNudge === 'waiting' && !platform.standalone ? 'due' : settings.value.installNudge,
        lastResult: this.resultLine(s),
      });
      writeGame(null);
    });
  }

  resultLine(s = this.gs.value): string {
    const o = s.over;
    if (!o) return '';
    const counts = o.counts;
    const winner = o.winners[0];
    if (o.how === 'out') {
      const others = counts.map((n, i) => (i === winner ? '' : `${this.name(i)} ${n}`)).filter(Boolean).join(', ');
      return `${this.name(winner)} · ${t('end.theyOut', { name: this.name(winner) })} · ${others}`;
    }
    return o.winners.map((w) => this.name(w)).join(', ') + ' · ' + t('end.fewest').toLowerCase();
  }

  // ---------- human actions ----------

  private hand() {
    return this.gs.value.hands[this.viewer.value];
  }

  clearSelection() {
    batch(() => {
      this.sel.value = emptySelection();
      this.picks.value = [];
      this.spot.value = null;
      this.hintVerb.value = null;
    });
  }

  showHand() {
    this.phase.value = 'play';
    this.lastViewer = this.viewer.value;
    this.headerNote.value = null;
    this.kick();
  }

  lookAtBoard() {
    this.phase.value = 'board';
  }

  private touch() {
    // RULES §5.2: touching any card or pile clears Stuck.
    const s = this.gs.value;
    if (this.race && s.stuck[this.viewer.value]) this.gs.value = setStuck(s, this.viewer.value, false);
    this.headerNote.value = null;
    this.lastPlayAt = Date.now();
    this.armAutoHint();
  }

  private bad(key: string, msg?: string) {
    this.shake.value = { key, at: Date.now() };
    haptic('light');
    if (msg) this.toast({ kind: 'soft', icon: 'no', msg });
  }

  tapMeaning(id: number) {
    if (!this.canAct.value) return;
    if (this.tutorialHook?.('tapMeaning', id) === false) return;
    this.touch();
    if (this.hidden) {
      this.sel.value = { ...this.sel.value, meaning: this.sel.value.meaning === id ? undefined : id };
      return;
    }
    const sel = this.sel.value;
    if (sel.meaning === id) {
      this.sel.value = { ...sel, meaning: undefined };
      this.hintVerb.value = null;
      return;
    }
    this.hintVerb.value = null;
    const next = { ...sel, meaning: id };
    if (ways(this.gs.value, this.viewer.value, next).length) this.sel.value = next;
    else this.sel.value = { ...emptySelection(), meaning: id };
    this.afterPick(`m:${id}`);
  }

  tapHandVerb(id: number, long = false) {
    if (!this.canAct.value) return;
    if (this.tutorialHook?.('tapHandVerb', id) === false) return;
    this.touch();
    this.pickVerb({ hand: id }, `v:${id}`, long);
  }

  tapWild(id: number) {
    if (!this.canAct.value) return;
    this.touch();
    if (this.hidden) {
      const has = this.picks.value.some((p) => 'wild' in p && p.wild === id);
      this.picks.value = has ? this.picks.value.filter((p) => !('wild' in p && p.wild === id)) : [...this.picks.value, { wild: id }];
      return;
    }
    const sel = this.sel.value;
    const has = sel.wild.includes(id);
    const next = { ...sel, wild: has ? sel.wild.filter((w) => w !== id) : [...sel.wild, id] };
    if (!has && !ways(this.gs.value, this.viewer.value, next).length) return this.bad(`w:${id}`);
    this.sel.value = next;
    this.afterPick(`w:${id}`);
  }

  tapRiver(i: number, long = false) {
    if (!this.canAct.value) return;
    if (this.tutorialHook?.('tapRiver', i) === false) return;
    this.touch();
    const s = this.gs.value;
    if (this.hidden) {
      const taken = this.picks.value.filter((p) => 'river' in p && p.river === i).length;
      if (taken >= s.piles[i].length) return this.bad(`r:${i}`);
      const pl = s.piles[i];
      this.picks.value = [...this.picks.value, { river: i, cid: pl[pl.length - 1 - taken].id }];
      return;
    }
    const sel = this.sel.value;
    if (sel.river.includes(i)) {
      this.sel.value = { ...sel, river: sel.river.filter((r) => r !== i) };
      return;
    }
    if (!s.piles[i].length) return this.bad(`r:${i}`);
    this.riverIds.set(i, s.piles[i][s.piles[i].length - 1].id);
    const next = { ...sel, river: [...sel.river, i] };
    if (!ways(s, this.viewer.value, next).length) {
      const fresh = { ...emptySelection(), river: [i] };
      if (!ways(s, this.viewer.value, fresh).length) return this.bad(`r:${i}`);
      this.sel.value = fresh;
    } else this.sel.value = next;
    this.afterPick(`r:${i}`, long);
  }

  tapTable(x: number, y: number, long = false) {
    if (!this.canAct.value) return;
    const c = view(this.gs.value).at(x, y);
    if (!c) return;
    if (this.tutorialHook?.('tapTable', { x, y }) === false) return;
    this.touch();
    if (c.k === 'V') return this.pickVerb({ table: { x, y } }, `t:${x},${y}`, long);
    if (c.k === 'P') {
      if (this.hidden) {
        const has = this.picks.value.some((p) => 'cross' in p && p.cross.x === x && p.cross.y === y);
        this.picks.value = has ? this.picks.value.filter((p) => !('cross' in p && p.cross.x === x && p.cross.y === y)) : [...this.picks.value, { cross: { x, y } }];
        return;
      }
      const sel = this.sel.value;
      if (sel.cross && sel.cross.x === x && sel.cross.y === y) {
        this.sel.value = { ...sel, cross: undefined };
        return;
      }
      const next = { ...sel, cross: { x, y }, verb: sel.verb && 'table' in sel.verb ? undefined : sel.verb };
      if (!ways(this.gs.value, this.viewer.value, next).length) return this.bad(`t:${x},${y}`);
      this.sel.value = next;
      this.afterPick(`t:${x},${y}`, long);
    }
  }

  tapFaceUp() {
    if (!this.canAct.value) return;
    this.touch();
    const sel = this.sel.value;
    if (sel.meaning === undefined) return this.bad('faceup', t('table.swapFirst'));
    this.play({ type: 'swap', m: sel.meaning });
  }

  private pickVerb(v: VerbSrc, key: string, long: boolean) {
    const s = this.gs.value;
    const sel = this.sel.value;
    const same = sel.verb && JSON.stringify(sel.verb) === JSON.stringify(v);
    if (this.hidden) {
      this.sel.value = { ...sel, verb: same ? undefined : v };
      return;
    }
    if (same) {
      this.sel.value = { ...sel, verb: undefined };
      return;
    }
    const next = { ...sel, verb: v, cross: 'table' in v ? undefined : sel.cross };
    if (ways(s, this.viewer.value, next).length) {
      this.sel.value = next;
      this.afterPick(key, long);
      return;
    }
    // Not part of the current line: explain, or start a new one from this verb.
    if (sel.meaning !== undefined) {
      const m = this.hand().find((c) => c.id === sel.meaning);
      const word = 'table' in v ? view(s).at(v.table.x, v.table.y)!.t : this.hand().find((c) => c.id === (v as { hand: number }).hand)!.t;
      const fits = (COMPOUNDS_BY_VERB[word] ?? []).filter((c) => m && meaningsOf(m).includes(c.g));
      if (fits.length) {
        const missing = fits[0].ps.find((w) => !s.piles.some((pl) => pl.length && pl[pl.length - 1].t === w));
        if (missing && !this.hand().some((c) => c.k === 'W')) return this.bad(key, t('table.noParticle', { word: missing }));
        return this.bad(key, t('table.noRoom'));
      }
    }
    this.sel.value = { ...emptySelection(), verb: v };
    this.afterPick(key, long);
  }

  /** After a pick: lay the line if it is complete and unambiguous. */
  private afterPick(key: string, long = false) {
    const sel = this.sel.value;
    if (this.tutorialHook?.('afterPick', sel) === false) return;
    if (sel.meaning === undefined || (!sel.verb && !sel.cross)) return;
    const ws = ways(this.gs.value, this.viewer.value, sel);
    if (!ws.length) return this.bad(key);
    const cs = distinctCompounds(ws);
    if (cs.length !== 1) return; // the tray offers the choice
    const way = preferredWay(ws)!;
    const pls = placements(this.gs.value, way, this.focus);
    if (!pls.length) return this.bad(key, t('table.noRoom'));
    if (long) {
      this.spot.value = { way, options: pls.slice(0, 14), chosen: 0 };
      return;
    }
    this.layWay(way, pls[0]);
  }

  /** Two ways to finish: the player picked one compound. */
  chooseCompound(cid: string) {
    const ws = this.ways.value.filter((w) => w.c === cid);
    const way = preferredWay(ws);
    if (!way) return;
    const pls = placements(this.gs.value, way, this.focus);
    if (!pls.length) return this.bad('choice', t('table.noRoom'));
    this.layWay(way, pls[0]);
  }

  chooseSpot(i: number) {
    const sp = this.spot.value;
    if (!sp) return;
    if (i === sp.chosen) return this.confirmSpot();
    this.spot.value = { ...sp, chosen: i };
  }

  confirmSpot() {
    const sp = this.spot.value;
    if (!sp) return;
    const pl = sp.options[sp.chosen];
    if (sp.way) this.layWay(sp.way, pl);
    else if (sp.lone !== undefined) this.play({ type: 'lone', v: sp.lone, x: pl.x, y: pl.y });
  }

  private layWay(way: Way, pl: Placement) {
    this.play(wayToMove(way, pl));
  }

  /** Lone verb: the tray asks; this lays it at the chosen (or best) spot. */
  loneOptions(): Placement[] {
    const s = this.gs.value;
    const g = view(s);
    const f = this.focus ?? { x: 0, y: 0 };
    const seen = new Set<string>();
    const out: Placement[] = [];
    for (const sp of [...g.spots(2)].sort((a, b) => Math.abs(a.x - f.x) + Math.abs(a.y - f.y) - (Math.abs(b.x - f.x) + Math.abs(b.y - f.y)))) {
      const k = sp.x + ',' + sp.y;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ x: sp.x, y: sp.y, d: [1, 0] });
      if (out.length >= 6) break;
    }
    return out;
  }

  startLone() {
    const v = this.sel.value.verb;
    if (!v || !('hand' in v)) return;
    const opts = this.loneOptions();
    if (!opts.length) return;
    this.spot.value = { lone: v.hand, options: opts, chosen: 0 };
  }

  layAlone() {
    const sp = this.spot.value;
    if (sp?.lone !== undefined) return this.confirmSpot();
    const v = this.sel.value.verb;
    if (!v || !('hand' in v)) return;
    const pl = this.loneOptions()[0];
    if (pl) this.play({ type: 'lone', v: v.hand, x: pl.x, y: pl.y });
  }

  drawAndPass() {
    if (!this.canAct.value || this.race) return;
    if (this.tutorialHook?.('pass') === false) return;
    const r = pass(this.gs.value, this.viewer.value);
    if (r.ok) this.commit(r.state, this.viewer.value, null, false);
  }

  toggleStuck() {
    const s = this.gs.value;
    if (!this.race || s.over || this.paused.value) return;
    const on = !s.stuck[this.viewer.value];
    this.clearSelection();
    this.gs.value = setStuck(s, this.viewer.value, on);
    if (on) this.say(t('table.isStuck', { name: this.name(this.viewer.value) }));
    this.save();
    this.checkRaceStall();
  }

  /** Hidden mode: commit the assembled line. */
  layIt() {
    if (!this.canAct.value || this.locked.value) return;
    const sel = this.sel.value;
    if (!this.hidden) return;
    if (sel.meaning === undefined || !sel.verb || !this.picks.value.length) return this.bad('lay', t('table.buildingSub'));
    const a: Attempt = { meaning: sel.meaning, verb: sel.verb, parts: this.picks.value };
    const j = judge(this.gs.value, this.viewer.value, a, this.focus);
    if (j.ok) return this.play(j.move);
    this.refuse(j.reason);
  }

  private refuse(r: Rejection, mv?: Move) {
    if (r.why === 'Taken') return this.onTaken(r, mv);
    if (r.why === 'NotLegal') return this.bad('lay', r.detail === 'No room for that line' ? t('table.noRoom') : r.detail);
    const msg = r.kind === 'NoSuchCompound' ? t('table.noSuch', { verb: r.verb, parts: r.parts.join(' ') }) : t('table.notOnCard', { text: r.text });
    this.shake.value = { key: 'line', at: Date.now() };
    haptic('light');
    if (this.race) {
      this.lockUntil.value = Date.now() + LOCKOUT_MS;
      this.now.value = Date.now();
      this.toast({ kind: 'soft', icon: 'retry', msg: t('table.notQuite') + ': ' + msg, sub: t('table.lockout') });
      const res = wrongLine(this.gs.value, this.viewer.value);
      if (res.ok) this.gs.value = res.state;
      this.later(dur(320), () => this.clearSelection());
      return;
    }
    this.toast({ kind: 'soft', icon: 'retry', msg: t('table.notQuite') + ': ' + msg, sub: t('table.turnOver') });
    this.later(dur(340), () => {
      const res = wrongLine(this.gs.value, this.viewer.value);
      if (res.ok) this.commit(res.state, this.viewer.value, null, false);
    });
  }

  private onTaken(r: Extract<Rejection, { why: 'Taken' }>, mv?: Move) {
    const s = this.gs.value;
    let word = '';
    if (r.card && 'river' in r.card) {
      const pile = r.card.river;
      this.taken.value = { river: pile, at: Date.now() };
      if (mv?.type === 'line') {
        const i = mv.src.findIndex((x) => 'river' in x && x.river === pile);
        word = i >= 0 ? COMPOUND_BY_ID[mv.c].ps[i] : '';
      }
    } else if (r.card) {
      this.taken.value = { cell: r.card.x + ',' + r.card.y, at: Date.now() };
      word = view(s).at(r.card.x, r.card.y)?.t ?? '';
    }
    haptic('light');
    this.toast({
      kind: 'quiet',
      icon: 'taken',
      msg: t('table.taken'),
      sub: r.by !== null && r.by !== undefined && word ? t('table.takenBy', { name: this.name(r.by), word }) : t('table.takenAnon'),
    });
    this.clearSelection();
  }

  /** Commit a human move, capturing where its cards fly from. */
  play(mv: Move) {
    const p = this.viewer.value;
    if (this.tutorialHook?.('play', mv) === false) return;
    const s = this.gs.value;
    const from = this.captureSources(mv);
    const r = apply(s, p, mv);
    if (!r.ok) return this.refuse(r.reason, mv);
    this.commit(r.state, p, mv, false, from);
  }

  private captureSources(mv: Move): Map<number, DOMRect> {
    const m = new Map<number, DOMRect>();
    const rect = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
    if (mv.type === 'lone') {
      const r = rect(`.tray [data-card="${mv.v}"]`);
      if (r) m.set(mv.v, r);
      return m;
    }
    if (mv.type !== 'line') return m;
    const s = this.gs.value;
    const add = (id: number) => {
      const r = rect(`.tray [data-card="${id}"], .yourline [data-card="${id}"]`);
      if (r) m.set(id, r);
    };
    add(mv.m);
    if ('hand' in mv.verb) add(mv.verb.hand);
    const tops = s.piles.map((p) => p.length);
    for (const src of mv.src) {
      if ('wild' in src) add(src.wild);
      if ('river' in src) {
        const card = s.piles[src.river][--tops[src.river]];
        const r = rect(`[data-pile="${src.river}"]`);
        if (card && r) m.set(card.id, r);
      }
    }
    return m;
  }

  /** In a race the state can change under a half-built line: clear it if a card it needs went. */
  private validateSelection() {
    const sel = this.sel.value;
    const s = this.gs.value;
    const p = this.viewer.value;
    const hand = s.hands[p];
    const takenPile = (pile: number) => {
      this.taken.value = { river: pile, at: Date.now() };
      const last = [...s.log].reverse().find((e) => e.e === 'line') as Extract<GameEvent, { e: 'line' }> | undefined;
      const by = last && last.river.includes(pile) ? last.p : null;
      const word = last ? COMPOUND_BY_ID[last.c].ps.find((_, i) => last.river[i] === pile) : undefined;
      this.toast({ kind: 'quiet', icon: 'taken', msg: t('table.taken'), sub: by !== null && word ? t('table.takenBy', { name: this.name(by), word }) : t('table.takenAnon') });
      haptic('light');
      this.clearSelection();
    };
    if (this.hidden) {
      const tops = s.piles.map((pl) => pl.length);
      for (const pk of this.picks.value)
        if ('river' in pk) {
          const top = --tops[pk.river];
          if (top < 0 || s.piles[pk.river][top].id !== pk.cid) return takenPile(pk.river);
        }
      if (sel.meaning !== undefined && !hand.some((c) => c.id === sel.meaning)) this.clearSelection();
      return;
    }
    for (const r of sel.river) {
      const pl = s.piles[r];
      if (!pl.length || pl[pl.length - 1].id !== this.riverIds.get(r)) return takenPile(r);
    }
    const empty = sel.meaning === undefined && !sel.verb && !sel.river.length && !sel.wild.length && !sel.cross;
    if (empty) return;
    if (sel.meaning !== undefined && !hand.some((c) => c.id === sel.meaning)) return this.clearSelection();
    if (!ways(s, p, sel).length) {
      if (this.race) {
        const r = sel.river[0];
        if (r !== undefined) this.taken.value = { river: r, at: Date.now() };
        this.toast({ kind: 'quiet', icon: 'taken', msg: t('table.taken'), sub: t('table.takenAnon') });
      }
      this.clearSelection();
    }
  }

  // ---------- hints ----------

  hint() {
    const sel = this.sel.value;
    const s = this.gs.value;
    if (this.config.hints === 'off' || sel.meaning === undefined) return;
    const v = engineHint(s, this.viewer.value, sel.meaning);
    if (!v) {
      this.toast({ kind: 'quiet', icon: 'no', msg: t('table.noHint') });
      return;
    }
    this.gs.value = useHint(s, this.viewer.value);
    this.hintVerb.value = v;
    this.save();
  }

  private armAutoHint() {
    if (this.autoHintTimer) clearTimeout(this.autoHintTimer);
    this.autoHintTimer = null;
    if (this.config.hints !== 'auto') return;
    this.autoHintTimer = setTimeout(() => {
      if (!this.canAct.value || this.hintVerb.value || Date.now() - this.lastPlayAt < AUTO_HINT_MS - 50) return;
      const s = this.gs.value;
      const p = this.viewer.value;
      let m = this.sel.value.meaning;
      if (m === undefined) m = s.hands[p].find((c) => c.k === 'M' && engineHint(s, p, c.id))?.id;
      if (m === undefined) return;
      if (this.sel.value.meaning !== m) this.sel.value = { ...emptySelection(), meaning: m };
      this.hint();
    }, AUTO_HINT_MS);
  }

  // ---------- helpers for the UI ----------

  finalStalls(): { n: number; total: number } | null {
    const s = this.gs.value;
    if (canDraw(s)) return null;
    return { n: s.stalls, total: FINAL_STALLS };
  }

  lineDescription(cid: string): string {
    const ws = this.ways.value.filter((w) => w.c === cid);
    const w = preferredWay(ws);
    if (!w) return '';
    const s = this.gs.value;
    const tops = s.piles.map((p) => p.length);
    const parts = w.src.map((x) => ('river' in x ? t('table.wayRiver', { word: s.piles[x.river][--tops[x.river]].t }) : 'wild' in x ? t('table.wayWild') : ''));
    return COMPOUND_BY_ID[cid].g.toLowerCase() + (parts.filter(Boolean).length ? ' · ' + parts.filter(Boolean).join(', ') : '');
  }

  missedText() {
    return this.gs.value.missed;
  }
}

/** A short list for the recap of compounds in deck order (used by tests and the glossary). */
export const ALL_COMPOUNDS = COMPOUNDS;

export function lineMoveText(mv: LineMove) {
  return compoundText(COMPOUND_BY_ID[mv.c]);
}
