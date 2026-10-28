// Small shared pieces for the shell screens.
import type { ComponentChildren, JSX } from 'preact';
import { t } from '../i18n';
import { IconBack, IconClose } from './icons';
import { nav } from './nav';

export function Screen({ children, class: cls, felt = true }: { children: ComponentChildren; class?: string; felt?: boolean }) {
  return <div class={'screen' + (felt ? ' ba-felt' : '') + (cls ? ' ' + cls : '')}>{children}</div>;
}

export function Scroll({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  return <div class={'scroll' + (cls ? ' ' + cls : '')}>{children}</div>;
}

export function Header({ title, back = true, close, right, onBack }: { title: string; back?: boolean; close?: boolean; right?: ComponentChildren; onBack?: () => void }) {
  return (
    <div class="hdr">
      {back && (
        <button class="ba-icon-btn hdr-back" aria-label={close ? t('a11y.close') : t('a11y.back')} onClick={() => (onBack ? onBack() : nav.back())}>
          {close ? <IconClose size={26} /> : <IconBack size={26} />}
        </button>
      )}
      <h1 class="hdr-title">{title}</h1>
      {right && <div class="hdr-right">{right}</div>}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label, small }: { value: T; options: { v: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void; label: string; small?: boolean }) {
  return (
    <div class={'ba-seg seg' + (small ? ' seg-sm' : '')} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v ? 'true' : 'false'} disabled={o.disabled} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button class={'toggle' + (on ? ' is-on' : '')} role="switch" aria-checked={on ? 'true' : 'false'} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}>
      <span class="knob" />
    </button>
  );
}

export function Section({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <section class="sec">
      <h2 class="sec-label">{label}</h2>
      {children}
    </section>
  );
}

export function Note({ children }: { children: ComponentChildren }) {
  return <p class="note">{children}</p>;
}

export function Group({ children }: { children: ComponentChildren }) {
  return <div class="group">{children}</div>;
}

export function Row({ label, sub, children, onClick, danger, chevron }: { label: string; sub?: string; children?: ComponentChildren; onClick?: () => void; danger?: boolean; chevron?: boolean }) {
  const inner = (
    <>
      <span class="row-text">
        <span class={'row-label' + (danger ? ' is-danger' : '')}>{label}</span>
        {sub && <span class="row-sub">{sub}</span>}
      </span>
      {children}
      {chevron && (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </>
  );
  if (onClick)
    return (
      <button class="row row-btn" onClick={onClick}>
        {inner}
      </button>
    );
  return <div class="row">{inner}</div>;
}

export function CardRow({ children, class: cls, style }: { children: ComponentChildren; class?: string; style?: JSX.CSSProperties }) {
  return (
    <div class={'card-row' + (cls ? ' ' + cls : '')} style={style}>
      {children}
    </div>
  );
}
