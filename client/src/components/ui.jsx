import { useEffect, useState } from 'react';
import { IconAlert, IconInbox } from './icons.jsx';

export function Loading({ label = 'Chargement…', lines = 3 }) {
  return (
    <div role="status" aria-live="polite" className="card">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      <div className="row">
        <IconAlert />
        <span>{error.message || String(error)}</span>
        {onRetry && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <IconInbox />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ProgressBar({ value, label, large }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={`progress${large ? ' lg' : ''}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function Ring({ value, label = 'progression', size = 120 }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v)} % de ${label}`}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={r} stroke="var(--surface-2)" strokeWidth="12" fill="none" />
        <circle cx="60" cy="60" r={r} stroke="var(--green-600)" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="ring-label" aria-hidden="true">
        <div>
          {Math.round(v)} %<small>{label}</small>
        </div>
      </div>
    </div>
  );
}

export function DemoBanner({ notice }) {
  if (!notice) return null;
  const rest = notice.replace(/^Contenu de démonstration\s*:\s*/i, '');
  return (
    <div className="alert alert-warning demo-banner" role="note">
      <IconAlert />
      <div>
        <strong>Contenu de démonstration.</strong> {rest.charAt(0).toUpperCase() + rest.slice(1)}
      </div>
    </div>
  );
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message, onDone, ms = 2500 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [message, onDone, ms]);
  if (!message) return null;
  return <div className="toast" role="status" aria-live="polite">{message}</div>;
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  return [<Toast key="toast" message={msg} onDone={() => setMsg(null)} />, setMsg];
}

export function DifficultyBadge({ level }) {
  const map = { 1: ['Facile', 'badge-green'], 2: ['Moyen', 'badge-amber'], 3: ['Difficile', 'badge-red'] };
  const [label, cls] = map[level] || ['—', ''];
  return <span className={`badge ${cls}`}>{label}</span>;
}
