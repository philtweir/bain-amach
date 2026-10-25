// First launch: choose language, then welcome.
import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { settings, updateSettings } from '../../storage';
import type { Card } from '../../engine/types';
import { Face } from '../cards';
import { Screen } from '../kit';

const card = (id: number, k: Card['k'], word: string): Card => ({ id: -id, k, t: word });

export function LanguageScreen({ onDone }: { onDone: () => void }) {
  const [lang, setLang] = useState(settings.value.lang);
  const choose = (l: 'ga' | 'en') => {
    setLang(l);
    updateSettings({ lang: l });
  };
  return (
    <Screen class="onb">
      <div class="onb-body">
        <div class="onb-cards" aria-hidden="true">
          <Face card={card(1, 'V', 'bain')} size="hand" />
          <Face card={card(2, 'P', 'amach')} size="hand" />
        </div>
        <h1 class="display">{t('lang.title')}</h1>
        <p class="lede-sub">{t('lang.sub')}</p>
        <p class="body muted">{t('lang.desc')}</p>
        <div class="radio-list" role="radiogroup" aria-label={t('lang.sub')}>
          {(['ga', 'en'] as const).map((l) => (
            <button key={l} class={'radio-card' + (lang === l ? ' is-on' : '')} role="radio" aria-checked={lang === l ? 'true' : 'false'} onClick={() => choose(l)}>
              <span>
                <span class="rc-title">{t(l === 'ga' ? 'lang.ga' : 'lang.en')}</span>
                <span class="rc-sub">{t(l === 'ga' ? 'lang.gaSub' : 'lang.enSub')}</span>
              </span>
              <span class="radio-dot" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <div class="onb-foot">
        <button class="ba-btn ba-btn-primary wide" onClick={onDone}>
          {t('lang.continue')}
        </button>
      </div>
    </Screen>
  );
}

export function WelcomeScreen({ onTutorial, onSkip }: { onTutorial: () => void; onSkip: () => void }) {
  return (
    <Screen class="onb">
      <div class="onb-body">
        <h1 class="wordmark-xl">{t('app.name')}</h1>
        <p class="lede">{t('welcome.lede')}</p>
        <div class="sample">
          <div class="sample-title">cuir suas le</div>
          <div class="sample-cards" aria-label="cuir suas le, put up with">
            <Face card={card(3, 'V', 'cuir')} size="table" />
            <Face card={card(4, 'P', 'suas')} size="table" />
            <Face card={card(5, 'P', 'le')} size="table" />
            <div class="ba-card ba-table ba-meaning" aria-hidden="true">
              <span class="ba-en">PUT UP WITH</span>
            </div>
          </div>
          <p class="caption muted">{t('welcome.sample')}</p>
        </div>
      </div>
      <div class="onb-foot">
        <button class="ba-btn ba-btn-primary wide" onClick={onTutorial}>
          {t('welcome.tutorial')}
        </button>
        <button class="ba-btn ba-btn-secondary wide" onClick={onSkip}>
          {t('welcome.skip')}
        </button>
        <p class="caption muted center">{t('welcome.note')}</p>
      </div>
    </Screen>
  );
}
