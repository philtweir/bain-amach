// Game setup: one screen, no wizard. Defaults are always valid; Play is always enabled.
import { useState } from "preact/hooks";
import { BOT_LETTERS } from "../../app/session";
import { botName, speciesOf } from "../../game/critters";
import { BASE } from "../../engine/deck";
import { validateDeck } from "../../engine/deckTools";
import { cardTotal, deckById, deckFit } from "../../app/decks";
import { customDecks } from "../../storage";
import type { Level } from "../../engine/types";
import { t } from "../../i18n";
import {
  updateSettings,
  type SetupPlayer,
  type SetupPrefs,
} from "../../storage";
import { Disc, initialOf } from "../cards";
import { IconClose, IconPlus } from "../icons";
import { Header, Note, Screen, Scroll, Section, Seg } from "../kit";

export function SetupScreen({
  initial,
  onPlay,
}: {
  initial: SetupPrefs;
  onPlay: (p: SetupPrefs) => void;
}) {
  const [p, setP] = useState<SetupPrefs>(initial);
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

  const right = (
    <>
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
      <Section label={t("setup.deck")}>
        <select
          class="deck-select"
          aria-label={t("setup.deck")}
          value={custom ? custom.id : ""}
          onChange={(e) => set({ deck: (e.target as HTMLSelectElement).value || undefined })}
        >
          <option value="">{t("decks.default")}</option>
          {customDecks.value.map((d) => (
            <option value={d.id} key={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Section>
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
