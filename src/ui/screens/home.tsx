// Home: continue a saved game, start a new one, glossary progress, install nudge, update banner.
import { botName } from '../../game/critters';
import { canInstall, installEvent, restartForUpdate, updateReady } from '../../app/session';
import { BASE as DECK, BASE_COMPOUND_BY_ID as COMPOUND_BY_ID, BASE_COMPOUNDS as COMPOUNDS, DRAFT_COMPOUNDS, compoundText } from '../../engine/deck';
import type { Card } from '../../engine/types';
import { ago, t } from '../../i18n';
import { platform } from '../../platform';
import { madeCount, progress, savedGame, saveError, settings, updateSettings, writeGame, sfProgress } from '../../storage';
import { SF, SF_WORD, ownedCount } from '../../engine/storfhocail';
import { SfMini } from '../storfhocal';
import { useState } from 'preact/hooks';
import { Avatar, Face, MeaningCard, initialOf } from '../cards';
import { IconChevron, IconDecks, IconRules, IconSettings, IconShare } from '../icons';
import { Screen, Scroll } from '../kit';
import { nav } from '../nav';
import { gameAbandoned, tilesAtStake } from '../../app/storfhocail';

// A real meaning card from the deck with GIVE UP on it, for the sample at the top.
const sampleMeaning: Card = { id: -10, k: 'M', t: DECK.meaningCards.find((m) => m.meanings.includes('GIVE UP'))?.id ?? 'm01' };

export function UpdateBanner() {
  if (!updateReady.value) return null;
  return (
    <div class="update-banner" role="status">
      <span>{t('update.ready')}</span>
      <button class="ba-btn ba-btn-secondary ub-btn" onClick={restartForUpdate}>
        {t('update.restart')}
      </button>
    </div>
  );
}

function InstallNudge() {
  const s = settings.value;
  if (s.installNudge !== 'due' || !canInstall()) return null;
  const ev = installEvent.value;
  const dismiss = () => updateSettings({ installNudge: 'dismissed' });
  const install = async () => {
    if (!ev) return;
    await ev.prompt();
    const r = await ev.userChoice.catch(() => null);
    installEvent.value = null;
    if (r) dismiss();
  };
  return (
    <div class="panel nudge">
      <h2 class="panel-title">{t('install.title')}</h2>
      <p class="body muted">
        {t('install.body')}{' '}
        {platform.isIOS && (
          <>
            {t('install.ios', { share: '\u0001', add: '\u0002' })
              .split(/(\u0001|\u0002)/)
              .map((part, i) =>
                part === '\u0001' ? (
                  <b key={i}>
                    {t('install.share')} <IconShare size={16} />
                  </b>
                ) : part === '\u0002' ? (
                  <b key={i}>{t('install.add')}</b>
                ) : (
                  part
                ),
              )}
          </>
        )}
      </p>
      <div class="nudge-actions">
        {!platform.isIOS && ev && (
          <button class="ba-btn ba-btn-primary" onClick={install}>
            {t('install.go')}
          </button>
        )}
        <button class="ba-btn ba-btn-quiet" onClick={dismiss}>
          {t('install.later')}
        </button>
      </div>
    </div>
  );
}

export function HomeScreen({ onContinue, onNew }: { onContinue: () => void; onNew: () => void }) {
  const [discarding, setDiscarding] = useState(false);
  const saved = savedGame.value;
  const made = madeCount();
  const last = progress.value.lastMadeId ? COMPOUND_BY_ID[progress.value.lastMadeId] : null;
  const s = settings.value;
  let savedInfo: { title: string; sub: string; you: { color: number; initial: string; n: number } } | null = null;
  if (saved) {
    const cfg = saved.state.config;
    const humans = cfg.players.filter((p) => p.kind === 'human');
    const bots = cfg.players.map((p, i) => (p.kind === 'bot' ? botName(cfg.players, i) : '')).filter(Boolean);
    const youIdx = cfg.players.findIndex((p) => p.kind === 'human');
    savedInfo = {
      title: humans.length > 1 ? t('home.passPlay', { who: humans.map((h) => h.name).join(', ') }) : t('home.vsBots', { mode: cfg.mode === 'race' ? t('home.race') : t('home.turns'), who: bots.join(', ') }),
      sub: t('home.saved', { answers: cfg.answers === 'shown' ? t('setup.shown') : t('setup.hidden'), ago: ago(saved.savedAt) }),
      you: { color: cfg.players[youIdx]?.color ?? 0, initial: initialOf(humans.length > 1 ? humans[0].name : t('table.you')), n: saved.state.hands[youIdx]?.length ?? 0 },
    };
  }
  return (
    <Screen class="home">
      <Scroll>
        <div class="pad top-pad">
          <UpdateBanner />
          {saveError.value && (
            <div class="ba-toast ba-toast-alert inline-alert" role="alert">
              <span class="ba-msg">{t('error.save')}</span>
            </div>
          )}
          <div class="home-head">
            <h1 class="wordmark">{t('app.name')}</h1>
            <button class="ba-icon-btn" aria-label={t('home.rules')} onClick={() => nav.push('rules')}>
              <IconRules size={26} />
            </button>
            <button class="ba-icon-btn" aria-label={t('home.decks')} onClick={() => nav.push('decks')}>
              <IconDecks size={26} />
            </button>
            <button class="ba-icon-btn" aria-label={t('home.settings')} onClick={() => nav.push('settings')}>
              <IconSettings size={26} />
            </button>
          </div>
          <div class="home-sample" aria-hidden="true">
            <div class="hs-line">
              <Face card={{ id: -11, k: 'V', t: 'tabhair' }} size="hand" />
              <Face card={{ id: -12, k: 'P', t: 'suas' }} size="hand" />
            </div>
            <div class="hs-meaning">
              <MeaningCard card={sampleMeaning} used="GIVE UP" />
            </div>
          </div>
          <p class="caption muted">{t('home.sampleEq')}</p>

          {savedInfo && (
            <div class="panel saved">
              <div class="saved-top">
                <div>
                  <div class="eyebrow">{t('home.inProgress')}</div>
                  <div class="panel-title">{savedInfo.title}</div>
                  <div class="caption muted">{savedInfo.sub}</div>
                </div>
                <Avatar player={savedInfo.you.color} initial={savedInfo.you.initial} count={savedInfo.you.n} />
              </div>
              {discarding ? (
                <div class="discard-confirm">
                  <p class="confirm-q">{t('home.discardQ')}</p>
                  {tilesAtStake(saved!.state).length > 0 && <p class="caption">{t('sf.discardWarn', { list: tilesAtStake(saved!.state).map((w) => SF_WORD[w]?.word ?? w).join(', ') })}</p>}
                  <div class="row2">
                    <button class="ba-btn ba-btn-secondary" onClick={() => setDiscarding(false)}>
                      {t('home.keep')}
                    </button>
                    <button
                      class="ba-btn ba-btn-primary danger"
                      onClick={() => {
                        // Discarding counts as quitting: a tile of yours already laid is lost.
                        gameAbandoned(saved!.state);
                        writeGame(null);
                        setDiscarding(false);
                      }}
                    >
                      {t('home.discard')}
                    </button>
                  </div>
                </div>
              ) : (
                <div class="saved-actions">
                  <button class="ba-btn ba-btn-primary" onClick={onContinue}>
                    {t('home.continue')}
                  </button>
                  <button class="ba-btn ba-btn-quiet" onClick={() => setDiscarding(true)}>
                    {t('home.discard')}
                  </button>
                </div>
              )}
            </div>
          )}
          <InstallNudge />
          {DRAFT_COMPOUNDS.size > 0 && (
            <button class="panel draft-note" onClick={() => nav.push('glossary', { drafts: true })}>
              <span class="draft-chip">{t('glossary.draft')}</span>
              <span class="caption">{t('home.draftNote', { n: DRAFT_COMPOUNDS.size })}</span>
            </button>
          )}
          <button class={'ba-btn wide ' + (savedInfo ? 'ba-btn-secondary' : 'ba-btn-primary')} onClick={onNew}>
            {t('home.newGame')}
          </button>
          <button class="panel glossary-card" onClick={() => nav.push('glossary')}>
            <div class="gc-top">
              <span class="panel-title">{t('home.glossary')}</span>
              <span class="caption muted tabnum">{t('home.made', { n: made, total: COMPOUNDS.length })}</span>
            </div>
            <div class="progress" role="progressbar" aria-label={t('home.made', { n: made, total: COMPOUNDS.length })} aria-valuemin={0} aria-valuemax={COMPOUNDS.length} aria-valuenow={made}>
              <span style={{ width: `${(made / COMPOUNDS.length) * 100}%` }} />
            </div>
            <div class="caption muted">{last ? t('home.lastMade', { compound: compoundText(last), meaning: last.g.toLowerCase() }) : t('home.glossaryEmpty')}</div>
          </button>
          {sfProgress.value.bagRevealed && (
            <button class="panel bag-card" onClick={() => nav.push('bag')}>
              <span class="bag-fan" aria-hidden="true">
                <SfMini size={44} glyph />
                <SfMini size={44} glyph />
                <SfMini size={44} glyph />
              </span>
              <span class="lr-text">
                <span class="panel-title">{t('bag.title')}</span>
                <span class="caption muted tabnum">{t('bag.homeSub', { n: ownedCount(sfProgress.value), total: SF.words.length })}</span>
              </span>
              <IconChevron size={22} />
            </button>
          )}
          {s.lastResult && !saved && <p class="caption muted center">{t('home.lastGame', { text: s.lastResult })}</p>}
        </div>
      </Scroll>
    </Screen>
  );
}
