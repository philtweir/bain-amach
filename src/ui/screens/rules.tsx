// Rules: one scrolling page, the plays as numbered sections with diagrams made from real cards.
import type { ComponentChildren } from 'preact';
import type { Card, Placed } from '../../engine/types';
import { t } from '../../i18n';
import { Face, MeaningCard } from '../cards';
import type { Use } from '../meaningUses';
import { Header, Screen, Scroll } from '../kit';

const P = 72;
const at = (k: Card['k'], word: string, x: number, y: number, extra: Partial<Placed> = {}): Placed => ({ id: -(x * 10 + y + 100), k, t: word, x, y, axis: null, owner: -1, ...extra });

function Diagram({ cards, w, h }: { cards: Placed[]; w: number; h: number }) {
  return (
    <div class="diagram" style={{ width: w * P, height: h * P }} aria-hidden="true">
      {cards.map((c) => (
        <div class="dg-cell" key={c.id} style={{ transform: `translate(${c.x * P}px, ${c.y * P}px)` }}>
          {c.k === 'M' ? (
            <div class="ba-card ba-table ba-meaning">
              <span class="ba-en">{c.used}</span>
            </div>
          ) : (
            <Face card={c} size="table" />
          )}
        </div>
      ))}
    </div>
  );
}

function Rule({ n, title, children, diagram }: { n?: number; title: string; children: ComponentChildren; diagram?: ComponentChildren }) {
  return (
    <section class="panel rule">
      <h2 class="panel-title">
        {n ? `${n} · ` : ''}
        {title}
      </h2>
      <p class="body muted">{children}</p>
      {diagram}
    </section>
  );
}

const m = (id: string, used: string): Placed => at('M', id, 0, 0, { used });
const SYMBOLS: { key: 'cross' | 'owner' | 'arrive' | 'split' | 'multi'; card: Placed; owner?: number; uses?: Use[] }[] = [
  { key: 'cross', card: at('P', 'le', 0, 0, { axis: 'h', cross: true }) },
  { key: 'owner', card: at('V', 'cuir', 0, 0), owner: 1 },
  { key: 'arrive', card: m('m04', 'PUT UP WITH'), uses: [{ g: 'PUT UP WITH', side: 'w' }] },
  { key: 'split', card: m('m04', 'PUT UP WITH'), uses: [{ g: 'PUT UP WITH', side: 'w' }, { g: 'LET OUT', side: 'n' }] },
  { key: 'multi', card: m('m04', 'PUT UP WITH'), uses: [{ g: 'PUT UP WITH', side: 'w' }, { g: 'LET OUT', side: 'n' }, { g: 'TAKE OFF (CLOTHES)', side: 'e' }] },
];

/** What each mark on the table's cards means, drawn with the real card faces. */
function SymbolKey() {
  return (
    <section class="panel rule">
      <h2 class="panel-title">{t('rules.symbols')}</h2>
      <p class="body muted">{t('rules.symbolsBody')}</p>
      <ul class="sym-list">
        <li class="sym-row is-wide">
          <div class="sym-glyph" aria-hidden="true">
            {[at('V', 'cuir', 0, 0), at('P', 'amach', 0, 0), at('P', 'le', 0, 0), at('W', '*', 0, 0), m('m04', 'PUT UP WITH')].map((c, i) => (
              <Face card={c} size="table" key={i} />
            ))}
          </div>
          <p class="body muted">{t('rules.sym.glyphs')}</p>
        </li>
        {SYMBOLS.map((x) => (
          <li class="sym-row" key={x.key}>
            <div aria-hidden="true">
              <Face card={x.card} size="table" owner={x.owner} showOwner={x.owner !== undefined} uses={x.uses} />
            </div>
            <p class="body muted">{t(`rules.sym.${x.key}`)}</p>
          </li>
        ))}
        <li class="sym-row is-wide">
          <div aria-hidden="true">
            <MeaningCard card={at('M', 'm01', 0, 0)} uses={[{ g: 'LISTEN TO', side: 'w' }, { g: 'PUT ON (CLOTHES)', side: 'n' }]} />
          </div>
          <p class="body muted">{t('rules.sym.peek')}</p>
        </li>
      </ul>
    </section>
  );
}

export function RulesScreen({ onTutorial }: { onTutorial: () => void }) {
  return (
    <Screen class="rules">
      <Scroll>
        <div class="pad">
          <Header title={t('rules.title')} />
          <p class="body">{t('rules.intro')}</p>
          <button class="ba-btn ba-btn-secondary wide" onClick={onTutorial}>
            {t('rules.replay')}
          </button>
          <Rule n={1} title={t('rules.line')} diagram={<Diagram w={4} h={1} cards={[at('V', 'cuir', 0, 0), at('P', 'síos', 1, 0, { axis: 'h' }), at('P', 'ar', 2, 0, { axis: 'h' }), at('M', 'm', 3, 0, { used: 'DESCRIBE' })]} />}>
            {t('rules.lineBody')}
          </Rule>
          <Rule
            n={2}
            title={t('rules.cross')}
            diagram={
              <Diagram
                w={4}
                h={3}
                cards={[at('V', 'éist', 2, 0), at('V', 'cuir', 0, 1), at('P', 'suas', 1, 1, { axis: 'h' }), at('P', 'le', 2, 1, { axis: 'h', cross: true }), at('M', 'm', 3, 1, { used: 'PUT UP WITH' }), at('M', 'm', 2, 2, { used: 'LISTEN TO' })]}
              />
            }
          >
            {t('rules.crossBody')}
          </Rule>
          <Rule
            n={3}
            title={t('rules.onto')}
            diagram={<Diagram w={4} h={3} cards={[at('V', 'cuir', 0, 0), at('P', 'suas', 1, 0, { axis: 'h' }), at('P', 'le', 2, 0, { axis: 'h' }), at('M', 'm04', 3, 0, { used: 'PUT UP WITH', cross: true }), at('P', 'amach', 3, 1, { axis: 'v' }), at('V', 'lig', 3, 2)]} />}
          >
            {t('rules.ontoBody')}
          </Rule>
          <Rule n={4} title={t('rules.lone')} diagram={<Diagram w={1} h={1} cards={[at('V', 'fan', 0, 0)]} />}>
            {t('rules.loneBody')}
          </Rule>
          <Rule n={5} title={t('rules.swap')}>
            {t('rules.swapBody')}
          </Rule>
          <Rule n={6} title={t('rules.pass')}>
            {t('rules.passBody')}
          </Rule>
          <Rule title={t('rules.fresh')}>{t('rules.freshBody')}</Rule>
          <Rule title={t('rules.refill')}>{t('rules.refillBody')}</Rule>
          <Rule title={t('rules.end')}>{t('rules.endBody')}</Rule>
          <Rule
            title={t('rules.cards')}
            diagram={<Diagram w={4} h={1} cards={[at('V', 'bain', 0, 0), at('P', 'amach', 1, 0, { axis: 'h' }), at('P', 'le', 2, 0, { axis: 'h' }), at('W', '*', 3, 0, { axis: 'h' })]} />}
          >
            {t('rules.cardsBody')}
          </Rule>
          <SymbolKey />
          <Rule title={t('rules.modes')}>{t('rules.modesBody')}</Rule>
          <Rule title={t('rules.hidden')}>{t('rules.hiddenBody')}</Rule>
        </div>
      </Scroll>
    </Screen>
  );
}
