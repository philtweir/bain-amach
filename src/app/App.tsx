// Screen flow: language → welcome → (tutorial) → home → setup → table → recap → home.
import { effect } from '@preact/signals';
import { APP_RULES, type GameConfig, type GameState } from '../engine/types';
import type { Controller } from '../game/controller';
import { savedGame, settings, updateSettings } from '../storage';
import { Navigator, nav, stack, type Entry } from '../ui/nav';
import { TableView } from '../ui/table';
import { GlossaryScreen } from '../ui/screens/glossary';
import { HomeScreen } from '../ui/screens/home';
import { LanguageScreen, WelcomeScreen } from '../ui/screens/onboarding';
import { RecapScreen } from '../ui/screens/recap';
import { RulesScreen } from '../ui/screens/rules';
import { SettingsScreen } from '../ui/screens/settings';
import { SetupScreen } from '../ui/screens/setup';
import { Tutorial, tutorialConfig } from '../ui/tutorial';
import { configFrom, defaultSetup, endGame, game, learnerSetup, startGame } from './session';

function play(init: { config: GameConfig } | { state: GameState; elapsed?: number }, how: 'push' | 'fade' = 'push') {
  const c = startGame(init);
  nav.reset([{ id: 'home' }, { id: 'table', params: { c } }], how);
}

function startTutorial() {
  updateSettings({ onboarded: true });
  play({ config: tutorialConfig() });
}

// A game ends when its table leaves the stack.
effect(() => {
  const s = stack.value;
  const g = game.peek();
  if (g && !s.some((e) => e.id === 'table' && e.params?.c === g)) endGame();
});

export function initialStack() {
  nav.reset([{ id: settings.value.onboarded ? 'home' : 'language' }]);
}

function renderEntry(e: Entry) {
  switch (e.id) {
    case 'language':
      return <LanguageScreen onDone={() => nav.push('welcome')} />;
    case 'welcome':
      return (
        <WelcomeScreen
          onTutorial={startTutorial}
          onSkip={() => {
            updateSettings({ onboarded: true });
            nav.reset([{ id: 'home' }, { id: 'setup', params: { prefs: learnerSetup() } }], 'push');
          }}
        />
      );
    case 'home':
      return (
        <HomeScreen
          onContinue={() => {
            const sg = savedGame.value;
            // Games saved before a rule change pick the current rules up: they only add options.
            if (sg) play({ state: { ...sg.state, config: { ...sg.state.config, rules: { ...APP_RULES, ...sg.state.config.rules } } }, elapsed: sg.elapsed });
          }}
          onNew={() => nav.push('setup', { prefs: defaultSetup() })}
        />
      );
    case 'setup':
      return <SetupScreen initial={(e.params?.prefs as ReturnType<typeof defaultSetup>) ?? defaultSetup()} onPlay={(p) => play({ config: configFrom(p) })} />;
    case 'table': {
      const c = e.params?.c as Controller | undefined;
      if (!c) return null;
      return (
        <TableView
          c={c}
          onRecap={() => nav.replace('recap', { state: c.gs.value })}
          onRules={() => nav.push('rules')}
          onSettings={() => nav.push('settings')}
          onRestart={() => {
            c.pause(false);
            const cfg = { ...c.config, seed: (Math.random() * 2 ** 31) >>> 0 };
            const nc = startGame({ config: cfg });
            nav.reset([{ id: 'home' }, { id: 'table', params: { c: nc } }], 'fade');
          }}
          onQuit={() => {
            c.save();
            nav.backTo('home');
          }}
        >
          {c.config.tutorial ? <Tutorial c={c} /> : null}
        </TableView>
      );
    }
    case 'recap': {
      const st = e.params?.state as GameState;
      return (
        <RecapScreen
          state={st}
          onAgain={() => play({ config: { ...st.config, seed: (Math.random() * 2 ** 31) >>> 0, tutorial: false, firstPlayer: undefined, rules: APP_RULES } }, 'fade')}
          onReplay={() => play({ config: st.config }, 'fade')}
          onClose={() => nav.backTo('home')}
          onCompound={(id) => nav.push('glossary', { focus: id })}
        />
      );
    }
    case 'glossary':
      return <GlossaryScreen focus={e.params?.focus as string | undefined} draftsOnly={!!e.params?.drafts} />;
    case 'rules':
      return <RulesScreen onTutorial={startTutorial} />;
    case 'settings':
      return <SettingsScreen onTutorial={startTutorial} />;
  }
}

const SWIPE: Record<string, boolean> = { setup: true, glossary: true, rules: true, settings: true, welcome: true };

export function App() {
  return <Navigator render={renderEntry} swipeBack={(e) => !!SWIPE[e.id]} />;
}
