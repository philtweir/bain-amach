// Settings: everything from the handoff's list. Reset asks once, inline.
import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { platform } from '../../platform';
import { resetProgress, settings, updateSettings } from '../../storage';
import { Group, Header, Row, Screen, Scroll, Section, Seg, Toggle } from '../kit';


export function SettingsScreen({ onTutorial }: { onTutorial: () => void }) {
  const s = settings.value;
  const [confirm, setConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);
  return (
    <Screen class="settings">
      <Scroll>
        <div class="pad">
          <Header title={t('settings.title')} />
          <Section label={t('settings.language')}>
            <Group>
              <Row label={t('settings.menus')}>
                <Seg small label={t('settings.menus')} value={s.lang} onChange={(lang) => updateSettings({ lang })} options={[{ v: 'ga', label: 'Gaeilge' }, { v: 'en', label: 'English' }]} />
              </Row>
            </Group>
          </Section>
          <Section label={t('settings.defaults')}>
            <Group>
              <Row label={t('settings.answers')}>
                <Seg small label={t('settings.answers')} value={s.answers} onChange={(answers) => updateSettings({ answers, lastSetup: s.lastSetup ? { ...s.lastSetup, answers } : null })} options={[{ v: 'shown', label: t('setup.shown') }, { v: 'hidden', label: t('setup.hidden') }]} />
              </Row>
              <Row label={t('settings.hints')}>
                <Seg
                  small
                  label={t('settings.hints')}
                  value={s.hints}
                  onChange={(hints) => updateSettings({ hints, lastSetup: s.lastSetup ? { ...s.lastSetup, hints } : null })}
                  options={[{ v: 'off', label: t('setup.hintsOff') }, { v: 'request', label: t('setup.hintsRequest') }, { v: 'auto', label: t('setup.hintsAuto') }]}
                />
              </Row>
              <Row label={t('settings.botSpeed')}>
                <Seg small label={t('settings.botSpeed')} value={s.botSpeed} onChange={(botSpeed) => updateSettings({ botSpeed })} options={[{ v: 'slow', label: t('settings.slow') }, { v: 'normal', label: t('settings.normal') }, { v: 'fast', label: t('settings.fast') }]} />
              </Row>
            </Group>
          </Section>
          <Section label={t('settings.feel')}>
            <Group>
              <Row label={t('settings.sound')} sub={t('settings.soundNote')}>
                <Toggle label={t('settings.sound')} on={s.sound} onChange={(sound) => updateSettings({ sound })} />
              </Row>
              <Row label={t('settings.haptics')} sub={platform.hapticsAvailable ? undefined : t('settings.hapticsNone')}>
                <Toggle label={t('settings.haptics')} on={s.haptics} onChange={(haptics) => updateSettings({ haptics })} />
              </Row>
              <Row label={t('settings.motion')}>
                <Seg small label={t('settings.motion')} value={s.reducedMotion} onChange={(reducedMotion) => updateSettings({ reducedMotion })} options={[{ v: 'system', label: t('settings.system') }, { v: 'always', label: t('settings.always') }]} />
              </Row>
              <Row label={t('settings.theme')}>
                <Seg small label={t('settings.theme')} value={s.theme} onChange={(theme) => updateSettings({ theme })} options={[{ v: 'system', label: t('settings.system') }, { v: 'light', label: t('settings.light') }, { v: 'dark', label: t('settings.dark') }]} />
              </Row>
            </Group>
          </Section>
          <Section label={t('settings.learning')}>
            <Group>
              <Row label={t('settings.replayTutorial')} onClick={onTutorial} chevron />
              {confirm ? (
                <div class="row confirm-row">
                  <span class="row-text">
                    <span class="row-label">{t('settings.resetQ')}</span>
                  </span>
                  <button class="ba-btn ba-btn-secondary" onClick={() => setConfirm(false)}>
                    {t('table.cancel')}
                  </button>
                  <button
                    class="ba-btn ba-btn-primary danger"
                    onClick={() => {
                      resetProgress();
                      setConfirm(false);
                      setCleared(true);
                    }}
                  >
                    {t('settings.resetYes')}
                  </button>
                </div>
              ) : (
                <Row label={t('settings.reset')} sub={cleared ? t('settings.resetDone') : t('settings.resetNote')} danger onClick={() => setConfirm(true)} chevron />
              )}
            </Group>
          </Section>
          <Section label={t('settings.credits')}>
            <Group>
              <div class="row">
                <span class="row-text">
                  <span class="row-sub">{t('settings.creditsBody')}</span>
                  <span class="row-sub">{t('settings.version', { v: __APP_VERSION__ })}</span>
                </span>
              </div>
            </Group>
          </Section>
        </div>
      </Scroll>
    </Screen>
  );
}
