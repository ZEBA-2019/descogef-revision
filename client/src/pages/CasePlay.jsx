import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { get, post } from '../api.js';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, DemoBanner, DifficultyBadge } from '../components/ui.jsx';
import { IconLightbulb, IconClock } from '../components/icons.jsx';
import { fmtClock, fmtNumber } from '../format.js';

const DRAFT_KEY = (id) => `dsg-case-draft-${id}`;

function Annex({ annex }) {
  return (
    <div className="annex">
      <h3>{annex.title}</h3>
      {annex.body && <p className="pre" style={{ margin: 0 }}>{annex.body}</p>}
      {annex.table && (
        <div className="table-wrap">
          <table>
            <thead><tr>{annex.table.head.map((h, i) => <th key={i} scope="col" className={i % 2 ? 'num' : ''}>{h}</th>)}</tr></thead>
            <tbody>{annex.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j % 2 ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Cas pratique : réponse libre question par question (étape par étape),
 * indices progressifs, corrigé + barème, autoévaluation. Mode chronométré optionnel.
 */
export default function CasePlay() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const timed = params.get('chrono') === '1';
  const { data, error, loading, reload } = useFetch(`/exercises/${id}`);
  useDocumentTitle(data?.exercise?.title || 'Cas pratique');
  const [phase, setPhase] = useState(timed ? 'consignes' : 'travail');
  const [answers, setAnswers] = useState([]);
  const [hints, setHints] = useState({}); // index -> [hint]
  const [solutions, setSolutions] = useState({});
  const [scores, setScores] = useState({});
  const [step, setStep] = useState(0);
  const [stepMode, setStepMode] = useState(true);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const startRef = useRef(Date.now());

  const ex = data?.exercise;
  const deadline = timed && phase === 'travail' ? startRef.current + (ex?.duration_min || 0) * 60_000 : null;

  // Brouillon sauvegardé localement (survit au rechargement)
  useEffect(() => {
    if (!ex) return;
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY(id)) || 'null');
      setAnswers(saved?.answers?.length === ex.items.length ? saved.answers : ex.items.map(() => ''));
    } catch {
      setAnswers(ex.items.map(() => ''));
    }
  }, [ex, id]);
  useEffect(() => {
    if (!ex || !answers.length) return;
    try {
      localStorage.setItem(DRAFT_KEY(id), JSON.stringify({ answers }));
    } catch {
      /* stockage indisponible */
    }
  }, [answers, ex, id]);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  useEffect(() => {
    if (deadline && now >= deadline && phase === 'travail') revealAll();
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  async function nextHint(i) {
    const n = hints[i]?.length || 0;
    try {
      const { hint } = await get(`/exercises/${id}/items/${i}/hint/${n}`);
      setHints((h) => ({ ...h, [i]: [...(h[i] || []), hint] }));
    } catch (e) {
      setErr(e);
    }
  }

  async function showSolution(i) {
    try {
      const s = await get(`/exercises/${id}/items/${i}/solution`);
      setSolutions((x) => ({ ...x, [i]: s }));
    } catch (e) {
      setErr(e);
    }
  }

  async function revealAll() {
    setPhase('correction');
    await Promise.all(ex.items.map((_, i) => (solutions[i] ? null : showSolution(i))));
    window.scrollTo(0, 0);
  }

  async function submit() {
    const selfScores = ex.items.map((_, i) => Number(scores[i] ?? NaN));
    if (selfScores.some((s, i) => Number.isNaN(s) || s < 0 || s > ex.items[i].points)) {
      setErr(new Error('Attribuez-vous une note (dans le barème) pour chaque question.'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await post(`/exercises/${id}/attempts`, {
        answers,
        selfScores,
        hintsUsed: ex.items.map((_, i) => hints[i]?.length || 0),
        durationSec: Math.round((Date.now() - startRef.current) / 1000),
        timed,
      });
      setResult(r);
      localStorage.removeItem(DRAFT_KEY(id));
      window.scrollTo(0, 0);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading lines={8} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  if (phase === 'consignes') {
    return (
      <div className="card" style={{ maxWidth: 700 }}>
        <h1>{ex.title}</h1>
        <p>Mode <strong>conditions d’examen</strong> : vous disposez de <strong>{ex.duration_min} minutes</strong>. Les indices sont désactivés ; le corrigé s’affiche à la fin du temps ou quand vous rendez votre copie.</p>
        <p className="muted small">Vos réponses sont sauvegardées automatiquement sur cet appareil.</p>
        <button className="btn btn-accent" onClick={() => { startRef.current = Date.now(); setPhase('travail'); }}>Démarrer le chronomètre</button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="card" style={{ maxWidth: 700 }}>
        <h1>Autoévaluation enregistrée</h1>
        <p className="stat-value">{fmtNumber(result.outOf20, 2)} / 20</p>
        <p>{result.points} point(s) sur {result.total} ({fmtNumber(result.percent)} %).</p>
        <div className="row">
          <Link to="/cas-pratiques" className="btn">Autres cas pratiques</Link>
          <Link to="/tableau-de-bord" className="btn btn-ghost">Tableau de bord</Link>
        </div>
      </div>
    );
  }

  const correction = phase === 'correction';
  const visible = stepMode && !correction ? ex.items.slice(0, step + 1) : ex.items;
  const remaining = deadline ? Math.max(0, (deadline - now) / 1000) : null;

  return (
    <div style={{ maxWidth: 900 }}>
      <nav className="small mb" aria-label="Fil d’Ariane"><Link to="/cas-pratiques">Cas pratiques</Link> › {ex.subject_title}</nav>
      <div className="page-header">
        <div>
          <h1>{ex.title}</h1>
          <div className="row"><DifficultyBadge level={ex.difficulty} /><span className="badge">Barème : {ex.totalPoints} points</span><span className="badge">{ex.duration_min} min conseillées</span></div>
        </div>
        {remaining != null && (
          <div className="card" style={{ padding: '10px 16px' }} role="timer" aria-live="off">
            <span className="small muted"><IconClock width={14} height={14} /> Temps restant</span>
            <div className={`timer${remaining < 300 ? ' low' : ''}`}>{fmtClock(remaining)}</div>
          </div>
        )}
      </div>
      <DemoBanner notice={data.demoNotice} />
      <section className="card">
        <h2>Énoncé</h2>
        <p className="pre">{ex.statement}</p>
        {ex.annexes.map((a, i) => <Annex key={i} annex={a} />)}
      </section>

      {!correction && (
        <div className="row mt">
          <label className="row small"><input type="checkbox" checked={stepMode} onChange={(e) => setStepMode(e.target.checked)} /> Afficher les questions une par une (étape par étape)</label>
        </div>
      )}

      {visible.map((it) => {
        const i = it.index;
        const sol = solutions[i];
        return (
          <section key={i} className="card" aria-labelledby={`q${i}`}>
            <div className="card-title">
              <h2 id={`q${i}`}>Question {i + 1}</h2>
              <span className="badge badge-blue">{it.points} pts</span>
            </div>
            <p className="prompt">{it.prompt}</p>
            <label htmlFor={`a${i}`} className="label">Votre réponse</label>
            <textarea id={`a${i}`} value={answers[i] || ''} readOnly={correction} onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))} placeholder="Rédigez votre réponse, vos calculs et votre raisonnement…" />
            {!timed && !correction && (
              <div className="mt">
                {(hints[i] || []).map((h, k) => (
                  <div key={k} className="alert alert-info small" style={{ marginBottom: 8 }}><IconLightbulb width={16} height={16} /> <strong>Indice {k + 1} :</strong> {h}</div>
                ))}
                <div className="row">
                  {(hints[i]?.length || 0) < it.hintsCount && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => nextHint(i)}>
                      {hints[i]?.length ? 'Indice suivant' : 'Afficher un indice'} ({(hints[i]?.length || 0)}/{it.hintsCount})
                    </button>
                  )}
                  {!sol && <button type="button" className="btn btn-sm btn-ghost" onClick={() => showSolution(i)}>Voir le corrigé de cette question</button>}
                </div>
              </div>
            )}
            {sol && (
              <div className="feedback ok mt">
                <h3>Corrigé</h3>
                <p className="pre">{sol.solution}</p>
                {sol.criteria.length > 0 && (
                  <>
                    <strong>Barème</strong>
                    <ul className="small">{sol.criteria.map((c) => <li key={c}>{c}</li>)}</ul>
                  </>
                )}
                {correction && (
                  <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
                    <label htmlFor={`s${i}`}>Ma note (sur {it.points})</label>
                    <input id={`s${i}`} type="number" min="0" max={it.points} step="0.5" value={scores[i] ?? ''} onChange={(e) => setScores((s) => ({ ...s, [i]: e.target.value }))} />
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      <ErrorBox error={err} />
      <div className="row mt">
        {!correction && stepMode && step < ex.items.length - 1 && <button className="btn" onClick={() => setStep(step + 1)}>Question suivante</button>}
        {!correction && (!stepMode || step >= ex.items.length - 1) && <button className="btn btn-accent" onClick={revealAll}>Rendre ma copie et voir le corrigé</button>}
        {correction && <button className="btn btn-accent" onClick={submit} disabled={busy}>{busy ? 'Enregistrement…' : 'Valider mon autoévaluation'}</button>}
      </div>
    </div>
  );
}
