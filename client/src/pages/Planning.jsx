import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { post, patch, del } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, Segmented, Empty, ProgressBar, useToast } from '../components/ui.jsx';
import { fmtDate, isoDate, daysUntil } from '../format.js';
import { IconCheck } from '../components/icons.jsx';

const DAYS = [
  { k: '1', label: 'Lundi' }, { k: '2', label: 'Mardi' }, { k: '3', label: 'Mercredi' }, { k: '4', label: 'Jeudi' },
  { k: '5', label: 'Vendredi' }, { k: '6', label: 'Samedi' }, { k: '0', label: 'Dimanche' },
];
const LEVEL_LABELS = ['', 'Débutant', 'Notions', 'Intermédiaire', 'Bon niveau', 'Maîtrise'];
const ACTIVITY_LINK = { fiche: (it) => `/fiches?chapitre=${it.chapter_id}`, quiz: (it) => `/quiz?chapitre=${it.chapter_id}`, flashcards: () => '/flashcards', cas: () => '/cas-pratiques', examen: () => '/examens' };

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(12, 0, 0, 0); return x; };

function rangeFor(view, anchor) {
  if (view === 'jour') return [anchor, anchor];
  if (view === 'semaine') { const s = startOfWeek(anchor); return [s, addDays(s, 6)]; }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const s = startOfWeek(first);
  return [s, addDays(s, 41)];
}

export default function Planning() {
  useDocumentTitle('Planning');
  const [view, setView] = useState('semaine');
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; });
  const [editing, setEditing] = useState(false);
  const [from, to] = rangeFor(view, anchor);
  const { data, error, loading, reload, setData } = useFetch(`/planning?from=${isoDate(from)}&to=${isoDate(to)}`);
  const [toast, showToast] = useToast();

  async function toggle(item) {
    const status = item.status === 'fait' ? 'prevu' : 'fait';
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, status } : x)) }));
    try {
      await patch(`/planning/items/${item.id}`, { status });
    } catch (e) {
      showToast(e.message);
      reload();
    }
  }

  if (loading && !data) return <Loading lines={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data.plan || editing) return <PlanForm plan={data.plan} onDone={() => { setEditing(false); reload(); }} onCancel={data.plan ? () => setEditing(false) : null} />;

  const step = view === 'jour' ? 1 : view === 'semaine' ? 7 : null;
  const move = (dir) => setAnchor((a) => (step ? addDays(a, dir * step) : new Date(a.getFullYear(), a.getMonth() + dir, 1, 12)));
  const title = view === 'jour' ? fmtDate(isoDate(anchor), { weekday: 'long', day: 'numeric', month: 'long' }) : view === 'semaine' ? `Semaine du ${fmtDate(isoDate(from), { day: 'numeric', month: 'long' })}` : anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const totals = data.totals || {};
  const days = daysUntil(data.plan.exam_date);

  return (
    <div>
      {toast}
      <div className="page-header">
        <div>
          <h1>Planning de révision</h1>
          <p>Examen le {fmtDate(data.plan.exam_date)} {days >= 0 ? `(J-${days})` : ''}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>Modifier mes paramètres</button>
      </div>
      {data.rescheduled > 0 && <div className="alert alert-info">{data.rescheduled} séance(s) manquée(s) ont été automatiquement replanifiée(s).</div>}
      <div className="card mb">
        <div className="row-between">
          <div className="small">
            <strong>{totals.done || 0}</strong> séance(s) faite(s) sur {totals.total || 0} · {totals.missed || 0} manquée(s)
          </div>
          <div style={{ flex: '0 1 300px' }}><ProgressBar value={totals.total ? (totals.done / totals.total) * 100 : 0} label="Séances réalisées" /></div>
        </div>
      </div>
      <div className="row-between mb">
        <Segmented label="Vue" value={view} onChange={setView} options={[{ value: 'jour', label: 'Jour' }, { value: 'semaine', label: 'Semaine' }, { value: 'mois', label: 'Mois' }]} />
        <div className="row">
          <button className="btn btn-sm btn-ghost" onClick={() => move(-1)} aria-label="Période précédente">‹</button>
          <strong style={{ minWidth: 180, textAlign: 'center', textTransform: view === 'semaine' ? 'none' : 'capitalize' }} aria-live="polite">{title}</strong>
          <button className="btn btn-sm btn-ghost" onClick={() => move(1)} aria-label="Période suivante">›</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setAnchor(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })}>Aujourd’hui</button>
        </div>
      </div>
      {loading && <p className="small muted">Mise à jour…</p>}
      {view === 'jour' && <DayList items={data.items} onToggle={toggle} />}
      {view === 'semaine' && <Week from={from} items={data.items} onToggle={toggle} />}
      {view === 'mois' && <Month anchor={anchor} from={from} items={data.items} onPick={(d) => { setAnchor(d); setView('jour'); }} />}
    </div>
  );
}

function SessionItem({ it, onToggle, compact }) {
  const link = ACTIVITY_LINK[it.activity]?.(it);
  return (
    <div className={`session ${it.status}`}>
      <span><strong>{it.label}</strong></span>
      {!compact && <span className="muted">{it.subject_title || 'Toutes matières'} · {it.duration_min} min{it.rescheduled_from ? ' · reportée' : ''}</span>}
      {it.status !== 'manque' && (
        <span className="row" style={{ gap: 6 }}>
          {link && it.status === 'prevu' && <Link to={link} className="small">Commencer</Link>}
          <button type="button" className="btn-link small" onClick={() => onToggle(it)} aria-pressed={it.status === 'fait'}>
            {it.status === 'fait' ? <><IconCheck width={12} height={12} /> Fait (annuler)</> : 'Marquer fait'}
          </button>
        </span>
      )}
      {it.status === 'manque' && <span className="small">Manquée — replanifiée</span>}
    </div>
  );
}

function DayList({ items, onToggle }) {
  if (!items.length) return <div className="card"><Empty title="Aucune séance ce jour-là">Profitez-en pour vous reposer ou faire quelques flashcards.</Empty></div>;
  return <div className="card stack">{items.map((it) => <SessionItem key={it.id} it={it} onToggle={onToggle} />)}</div>;
}

function Week({ from, items, onToggle }) {
  const today = isoDate();
  return (
    <div className="week">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(from, i);
        const key = isoDate(d);
        const list = items.filter((it) => it.date === key);
        return (
          <section key={key} className={`day${key === today ? ' today' : ''}`} aria-label={fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' })}>
            <h3 style={{ textTransform: 'capitalize' }}>{fmtDate(key, { weekday: 'short', day: 'numeric' })}</h3>
            {list.length ? list.map((it) => <SessionItem key={it.id} it={it} onToggle={onToggle} />) : <p className="small muted">Repos</p>}
          </section>
        );
      })}
    </div>
  );
}

function Month({ anchor, from, items, onPick }) {
  const today = isoDate();
  const byDate = useMemo(() => items.reduce((m, it) => ((m[it.date] ??= []).push(it), m), {}), [items]);
  return (
    <div className="card">
      <div className="month" role="grid" aria-label="Vue mensuelle">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d} className="head" role="columnheader">{d}</div>)}
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(from, i);
          const key = isoDate(d);
          const list = byDate[key] || [];
          const min = list.filter((x) => x.status !== 'manque').reduce((s, x) => s + x.duration_min, 0);
          const done = list.filter((x) => x.status === 'fait').length;
          return (
            <button key={key} type="button" role="gridcell" className={`cell${d.getMonth() !== anchor.getMonth() ? ' out' : ''}${key === today ? ' today' : ''}`} onClick={() => onPick(d)} style={{ textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }} aria-label={`${fmtDate(key)} : ${list.length} séance(s)`}>
              <strong>{d.getDate()}</strong>
              {min > 0 && <div>{min} min</div>}
              {list.length > 0 && <div className="muted">{done}/{list.length} faites</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanForm({ plan, onDone, onCancel }) {
  const { user } = useAuth();
  const { data: program } = useFetch('/program');
  const [examDate, setExamDate] = useState(plan?.exam_date || user.examDate || '');
  const [availability, setAvailability] = useState(plan?.availability || { 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 120, 0: 0 });
  const [levels, setLevels] = useState(plan?.levels || user.levels || {});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const weekly = Object.values(availability).reduce((a, b) => a + Number(b || 0), 0);

  async function submit(e) {
    e.preventDefault();
    if (!examDate) return setError(new Error('Indiquez la date de l’examen.'));
    if (examDate <= isoDate()) return setError(new Error('La date d’examen doit être dans le futur.'));
    if (weekly < 30) return setError(new Error('Indiquez au moins 30 minutes de disponibilité par semaine.'));
    setBusy(true);
    setError(null);
    try {
      const lv = Object.fromEntries(Object.entries(levels).filter(([, v]) => v));
      await post('/planning', { examDate, availability: Object.fromEntries(Object.entries(availability).map(([k, v]) => [k, Number(v) || 0])), levels: lv });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Supprimer le planning et toutes ses séances ?')) return;
    await del('/planning');
    onDone();
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 760 }} noValidate>
      <h1>{plan ? 'Modifier mon planning' : 'Créer mon planning'}</h1>
      <p className="muted">Le programme répartit vos séances selon votre niveau : plus de temps sur les matières fragiles, examens blancs dans les deux dernières semaines. Les séances manquées sont automatiquement reportées.</p>
      <div className="field">
        <label htmlFor="exam">Date prévue de l’examen</label>
        <input id="exam" type="date" min={isoDate(addDays(new Date(), 1))} value={examDate} onChange={(e) => setExamDate(e.target.value)} style={{ maxWidth: 240 }} required />
      </div>
      <fieldset>
        <legend>Disponibilités hebdomadaires (minutes par jour)</legend>
        <div className="grid grid-4">
          {DAYS.map((d) => (
            <div className="field" key={d.k} style={{ marginBottom: 6 }}>
              <label htmlFor={`d${d.k}`}>{d.label}</label>
              <input id={`d${d.k}`} type="number" min="0" max="600" step="15" value={availability[d.k] ?? 0} onChange={(e) => setAvailability({ ...availability, [d.k]: e.target.value })} />
            </div>
          ))}
        </div>
        <p className="hint" style={{ margin: 0 }}>Total : {Math.floor(weekly / 60)} h {String(weekly % 60).padStart(2, '0')} par semaine. Les créneaux de moins de 25 minutes ne sont pas planifiés.</p>
      </fieldset>
      <fieldset>
        <legend>Niveau dans chaque matière</legend>
        {!program ? <p className="small muted">Chargement des matières…</p> : program.subjects.map((s) => (
          <div className="field" key={s.id}>
            <label htmlFor={`l${s.id}`}>{s.title}</label>
            <select id={`l${s.id}`} value={levels[s.id] || ''} onChange={(e) => setLevels({ ...levels, [s.id]: Number(e.target.value) || undefined })} style={{ maxWidth: 260 }}>
              <option value="">Non renseigné (intermédiaire)</option>
              {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
            </select>
          </div>
        ))}
      </fieldset>
      <ErrorBox error={error} />
      <div className="row">
        <button className="btn btn-accent" disabled={busy}>{busy ? 'Génération…' : plan ? 'Regénérer le planning' : 'Générer mon planning'}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>}
        {plan && <button type="button" className="btn btn-ghost" onClick={remove}>Supprimer le planning</button>}
      </div>
      {plan && <p className="hint mt">Les séances déjà réalisées sont conservées ; les séances futures sont recalculées.</p>}
    </form>
  );
}
