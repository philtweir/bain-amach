// Game setup: one screen, no wizard. Defaults are always valid; Play is always enabled.
import { useRef, useState } from "preact/hooks";
import { BOT_LETTERS } from "../../app/session";
import { botName, speciesOf } from "../../game/critters";
import { BASE } from "../../engine/deck";
import { validateDeck } from "../../engine/deckTools";
import { cardTotal, deckById, deckFit } from "../../app/decks";
import { customDecks, savedGame, sfProgress } from "../../storage";
import { SF_SETTINGS, SF_WORD, ownedCount, sfUnlocked } from "../../engine/storfhocail";
import { tilesAtStake, unlockNow } from "../../app/storfhocail";
import { SfMini } from "../storfhocal";
import { nav } from "../nav";
import type { Level } from "../../engine/types";
import { t } from "../../i18n";
import {
  updateSettings,
  type SetupPlayer,
  type SetupPrefs,
} from "../../storage";
import { Disc, initialOf } from "../cards";
import { IconChevron, IconClose, IconPlus } from "../icons";
import { Header, Note, Screen, Scroll, Section, Seg } from "../kit";

export function SetupScreen({
  initial,
  onPlay,
}: {
  initial: SetupPrefs;
  onPlay: (p: SetupPrefs) => void;
}) {
  // The stórfhocal setting is remembered from the last game (off on a new install).
  const [p, setP] = useState<SetupPrefs>(initial);
  const [picking, setPicking] = useState(false);
  const secret = useRef<number[]>([]);
  const set = (patch: Partial<SetupPrefs>) => setP((x) => ({ ...x, ...patch }));
  const pass = p.who === "pass";
  const humans = pass ? p.humans : [];
  const nPlayers = (pass ? humans.length : 1) + p.bots.length;
  const n = Math.max(2, Math.min(4, nPlayers)) as 2 | 3 | 4;
  // The chosen deck (a deleted one falls back to the default): which player counts it deals, and hands.
  const custom = deckById(p.deck);
  const fit = deckFit(custom);
  const hand = fit[n] ?? BASE.setup[String(n)].handSize;
  const maxPlayers = ([4, 3, 2] as const).find((k) => fit[k] !== null) ?? 0;
  const dealable = fit[n] !== null;
  const canAddBot = nPlayers < Math.min(4, maxPlayers);
  const canAddHuman = pass && nPlayers < Math.min(4, maxPlayers);
  const pack = Object.values(BASE.verbs.pack3to4).reduce((a, b) => a + b, 0);
  const usedColors = new Set(humans.map((h) => h.color));
  const botCfgs = p.bots.map((level) => ({
    name: "",
    kind: "bot" as const,
    level,
    color: 0,
  }));
  const botNames = botCfgs.map((_, i) => botName(botCfgs, i));
  const bagN = ownedCount(sfProgress.value);
  // A new game over a saved one ends it: your tiles on its table count as lost.
  const atStake = savedGame.value ? tilesAtStake(savedGame.value.state) : [];

  const levels = (lv: Level, onChange: (l: Level) => void, label: string) => (
    <Seg
      small
      label={label}
      value={lv}
      onChange={onChange}
      options={[
        { v: "easy", label: t("setup.easy") },
        { v: "normal", label: t("setup.normal") },
        { v: "hard", label: t("setup.hard") },
      ]}
    />
  );

  const setHuman = (i: number, patch: Partial<SetupPlayer>) =>
    set({ humans: humans.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  const cycleColor = (i: number) => {
    const cur = humans[i].color;
    for (let k = 1; k <= 4; k++) {
      const c = (cur + k) % 4;
      if (!usedColors.has(c) || c === cur) return setHuman(i, { color: c });
    }
  };
  const addHuman = () => {
    let col = 0;
    while (usedColors.has(col)) col++;
    set({
      humans: [
        ...humans,
        { name: "", kind: "human", level: "normal", color: col },
      ],
    });
  };

  const play = () => {
    // Pass-and-play needs two players in all; solo needs a bot.
    let prefs = { ...p, mode: pass ? "turns" : p.mode } as SetupPrefs;
    if (!pass && !prefs.bots.length) prefs = { ...prefs, bots: ["easy"] };
    if (pass && prefs.humans.length + prefs.bots.length < 2)
      prefs = {
        ...prefs,
        humans: [
          ...prefs.humans,
          { name: "", kind: "human", level: "normal", color: 1 },
        ],
      };
    updateSettings({ lastSetup: prefs });
    onPlay(prefs);
  };

  const left = (
    <>
      <Section label={t("setup.players")}>
        <Seg
          label={t("setup.players")}
          value={p.who}
          onChange={(who) =>
            set({
              who,
              humans:
                who === "pass" && p.humans.length < 2
                  ? [
                      ...p.humans,
                      {
                        name: "",
                        kind: "human",
                        level: "normal",
                        color: 1,
                      } as SetupPlayer,
                    ].slice(0, 2)
                  : p.humans,
              bots: who === "pass" ? [] : p.bots.length ? p.bots : ["easy"],
            })
          }
          options={[
            { v: "solo", label: t("setup.solo") },
            { v: "pass", label: t("setup.pass") },
          ]}
        />
      </Section>
      <Section label={t("setup.mode")}>
        <Seg
          label={t("setup.mode")}
          value={pass ? "turns" : p.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { v: "race", label: t("setup.race"), disabled: pass },
            { v: "turns", label: t("setup.turns") },
          ]}
        />
        <Note>
          {pass
            ? t("setup.raceDisabled")
            : p.mode === "race"
              ? t("setup.raceNote")
              : t("setup.turnsNote")}
        </Note>
      </Section>
      <Section label={t("setup.answers")}>
        <Seg
          label={t("setup.answers")}
          value={p.answers}
          onChange={(answers) => set({ answers })}
          options={[
            { v: "shown", label: t("setup.shown") },
            { v: "hidden", label: t("setup.hidden") },
          ]}
        />
        <Note>{t("setup.hiddenNote")}</Note>
      </Section>
      <Section label={t("setup.hints")}>
        <Seg
          label={t("setup.hints")}
          value={p.hints}
          onChange={(hints) => set({ hints })}
          options={[
            { v: "off", label: t("setup.hintsOff") },
            { v: "request", label: t("setup.hintsRequest") },
            { v: "auto", label: t("setup.hintsAuto") },
          ]}
        />
      </Section>
    </>
  );

  const deckName = custom ? custom.name : t("decks.standard");
  const deckSize = cardTotal(custom, n);
  const right = (
    <>
      <Section label={t("setup.deck")}>
        <button class="list-row deck-row-btn" onClick={() => setPicking(true)} aria-label={t("setup.deckRow", { name: deckName, n: deckSize })}>
          <span class="deck-chip deck-stack" aria-hidden="true" />
          <span class="lr-text">
            <span class="lr-ga">{deckName}</span>
            <span class="lr-en">{t("setup.deckSize", { n: deckSize })}</span>
          </span>
          <IconChevron size={22} />
        </button>
      </Section>
      <Section label={pass ? t("setup.players") : t("setup.opponents")}>
        {humans.map((h, i) => (
          <div class="player-row" key={"h" + i}>
            <button
              class="disc-btn"
              aria-label={"Colour"}
              onClick={() => cycleColor(i)}
            >
              <Disc
                player={h.color}
                initial={initialOf(
                  h.name || t("setup.defaultName", { n: i + 1 }),
                )}
                size={44}
              />
            </button>
            <input
              class="name-input"
              value={h.name}
              placeholder={t("setup.defaultName", { n: i + 1 })}
              aria-label={t("setup.name", { n: i + 1 })}
              maxLength={16}
              autocomplete="off"
              autocapitalize="words"
              spellcheck={false}
              onInput={(e) =>
                setHuman(i, { name: (e.target as HTMLInputElement).value })
              }
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
            />
            {humans.length + p.bots.length > 2 ||
            (humans.length > 1 && p.bots.length) ? (
              <button
                class="ba-icon-btn"
                aria-label={t("setup.remove", {
                  name: h.name || t("setup.defaultName", { n: i + 1 }),
                })}
                onClick={() =>
                  set({ humans: humans.filter((_, j) => j !== i) })
                }
                disabled={humans.length <= 1}
              >
                <IconClose size={22} />
              </button>
            ) : (
              <span class="icon-spacer" />
            )}
          </div>
        ))}
        {p.bots.map((lv, i) => (
          <div class="player-row bot-row" key={"b" + i}>
            <div class="bot-row-in">
              <Disc
                player={
                  pass
                    ? botColor(
                        humans.map((h) => h.color),
                        i,
                      )
                    : i + 1
                }
                initial={BOT_LETTERS[i]}
                size={44}
                critter={{ species: speciesOf(lv) }}
              />
              <span class="bot-label">
                <span class="bot-name">{botNames[i]}</span>
                <span class="bot-kind">{t(`critter.${speciesOf(lv)}`)}</span>
              </span>
              {levels(
                lv,
                (l) => set({ bots: p.bots.map((b, j) => (j === i ? l : b)) }),
                botNames[i],
              )}
              <button
                class="ba-icon-btn"
                aria-label={t("setup.remove", { name: botNames[i] })}
                disabled={!pass && p.bots.length <= 1}
                onClick={() => set({ bots: p.bots.filter((_, j) => j !== i) })}
              >
                <IconClose size={22} />
              </button>
            </div>
          </div>
        ))}
        <div class="add-row">
          {pass && (
            <button
              class="ba-btn ba-btn-secondary add-btn"
              disabled={!canAddHuman}
              onClick={addHuman}
            >
              <IconPlus size={18} /> {t("setup.addPlayer")}
            </button>
          )}
          <button
            class="ba-btn ba-btn-secondary add-btn"
            disabled={!canAddBot}
            onClick={() => set({ bots: [...p.bots, "normal"] })}
          >
            <IconPlus size={18} /> {t("setup.addBot")}
          </button>
        </div>
      </Section>
      {!pass && (
        <section class="sec sf-sec">
          <h2 class="sec-label sf-label">
            <SfMini size={26} glyph />
            {t("sf.one")}
          </h2>
          {sfUnlocked(sfProgress.value) ? (
            <>
              <Seg
                label={t("sf.toggle")}
                value={p.sf ? "on" : "off"}
                onChange={(v) => set({ sf: v === "on" })}
                options={[
                  { v: "off", label: t("sf.off") },
                  { v: "on", label: t("sf.on") },
                ]}
              />
              <Note>
                {bagN ? t("sf.setupSub", { n: bagN }) : t("sf.setupSubEmpty")}
                {p.sf && !p.bots.includes("hard") ? " " + t("sf.needsHard") : ""}
              </Note>
            </>
          ) : (
            // Locked until enough finished games. The secret: seven quick taps on this row.
            <div
              class="group sf-locked"
              onClick={() => {
                const now = Date.now();
                secret.current = [...secret.current.filter((x) => now - x < 4000), now];
                if (secret.current.length >= 7) {
                  secret.current = [];
                  unlockNow();
                }
              }}
            >
              <div class="row">
                <span class="row-text">
                  <span class="row-label">{t("sf.lockedTitle")}</span>
                  <span class="row-sub">{t("sf.locked", { n: Math.min(sfProgress.value.finishedGames, SF_SETTINGS.unlockAfterGames), total: SF_SETTINGS.unlockAfterGames })}</span>
                </span>
                <span class="lock-chip">{t("decks.locked")}</span>
              </div>
            </div>
          )}
        </section>
      )}
      {atStake.length > 0 && <p class="note sf-overwrite" role="note">{t("sf.newOverSaved", { list: atStake.map((w) => SF_WORD[w]?.word ?? w).join(", ") })}</p>}
      <div class="deck-note">
        <span class="deck-chip" aria-hidden="true" />
        <span>
          {!dealable && custom
            ? t("setup.deckCant", { n, why: (validateDeck(BASE, custom).players[n] as { reason: string }).reason })
            : custom
              ? t("setup.deckCustom", { n: cardTotal(custom), hand })
              : n === 2
                ? t("setup.deck2", { n: cardTotal(undefined, 2), hand })
                : t("setup.deck34", { n: cardTotal(undefined, n), pack, hand })}
          {custom && dealable && maxPlayers < 4 ? " " + t("setup.deckMax", { n: maxPlayers }) : ""}
        </span>
      </div>
      <button class="ba-btn ba-btn-primary wide play-btn" disabled={!dealable} onClick={play}>
        {t("setup.play")}
      </button>
    </>
  );

  return (
    <Screen class="setup">
      {picking && <DeckPicker value={custom?.id} n={n} onPick={(id) => { set({ deck: id }); setPicking(false); }} onClose={() => setPicking(false)} />}
      <Scroll>
        <div class="pad">
          <Header title={t("setup.title")} />
          <div class="two-col">
            <div class="col">{left}</div>
            <div class="col">{right}</div>
          </div>
        </div>
      </Scroll>
    </Screen>
  );
}

function botColor(humanColors: number[], i: number) {
  const used = new Set(humanColors);
  let col = 0,
    k = -1;
  while (k < i) {
    if (!used.has(col)) k++;
    if (k < i) col++;
  }
  return col;
}

/** Choose the deck: decks that can't serve this table are disabled with the reason. */
function DeckPicker({ value, n, onPick, onClose }: { value?: string; n: 2 | 3 | 4; onPick: (id: string | undefined) => void; onClose: () => void }) {
  const std = { id: undefined as string | undefined, name: t("decks.standard"), sub: t("decks.standardSub", { a: cardTotal(undefined, 2), b: cardTotal(undefined, 3) }), ok: true };
  const rows = [
    std,
    ...customDecks.value.map((d) => {
      const fit = deckFit(d);
      const counts = ([2, 3, 4] as const).filter((k) => fit[k] !== null);
      const ok = fit[n] !== null;
      const sub = ok
        ? t("decks.sizeFor", { n: cardTotal(d, n), players: counts.length ? playersText(counts) : "" })
        : counts.length
          ? t("decks.servesOnly", { players: playersText(counts) })
          : t("decks.servesNone");
      return { id: d.id as string | undefined, name: d.name, sub, ok };
    }),
  ];
  return (
    <div class="sheet-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="ba-scrim scrim-in" aria-hidden="true" />
      <div class="ba-sheet sheet sheet-in deck-picker" role="dialog" aria-modal="true" aria-label={t("setup.deck")}>
        <div class="grabber" aria-hidden="true" />
        <h2 class="sheet-title">{t("setup.deck")}</h2>
        <div class="dp-rows" role="radiogroup" aria-label={t("setup.deck")}>
          {rows.map((r) => (
            <button key={r.id ?? "std"} class={"dp-row" + (r.id === value ? " is-on" : "")} role="radio" aria-checked={r.id === value ? "true" : "false"} disabled={!r.ok} onClick={() => onPick(r.id)}>
              <span class="lr-text">
                <span class="lr-ga">{r.name}</span>
                <span class="lr-en">{r.sub}</span>
              </span>
              <span class="dp-radio" aria-hidden="true" />
            </button>
          ))}
        </div>
        <button
          class="ba-btn ba-btn-quiet dp-edit"
          onClick={() => {
            onClose();
            nav.push("decks");
          }}
        >
          {t("setup.editDecks")}
        </button>
      </div>
    </div>
  );
}

/** "2 players", "2 to 4 players", "2 and 4 players". */
export function playersText(counts: number[]): string {
  if (counts.length === 1) return t("decks.nOnly", { n: counts[0] });
  const run = counts.every((k, i) => i === 0 || k === counts[i - 1] + 1);
  return run ? t("decks.range", { a: counts[0], b: counts[counts.length - 1] }) : t("decks.list", { list: counts.join(", ") });
}
