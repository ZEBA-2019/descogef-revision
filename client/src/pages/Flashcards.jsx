import { useCallback, useEffect, useRef, useState } from 'react';
import { get, post } from '../api.js';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, Empty, ProgressBar } from '../components/ui.jsx';
import { fmtDate } from '../format.js';

const GRADES = [
  { g: 0, label: 'À revoir', hint: '≈ 10 min', key: '1' },
  { g: 1, label: 'Difficile', hint: 'bientôt', key: '2' },
  { g: 2, label: 'Correct', hint: 'plus tard', key: '3' },
  { g: 3, label: 'Facile', hint: 'beaucoup plus tard', key: '4' },
];

function intervalLabel(days) {
  if (days < 1 / 24) return `${Math.round(days * 1440)} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  return `${Math.round(days)} j`;
}

export default function Flashcards() {
  useDocumentTitle('Flashcards');
  const { data: program } = useFetch('/program');
  const [subjectId, setSubjectId] = useState('');
  const [state, setState] = useState({ loading: true });
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState({ reviewed: 0, last: null });
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    setState({ loading: true });
    try {
      const data = await get(`/flashcards/queue?limit=20${subjectId ? `&subjectId=${subjectId}` : ''}`);
      setState({ data });
      setI(0);
      setFlipped(false);
      shownAt.current = Date.now();
    } catch (error) {
      setState({ error });
    }
  }, [subjectId]);
  useEffect(() => {
    load();
  }, [load]);

  const card = state.data?.queue[i];

  const grade = useCallback(
    async (g) => {
      if (!card || busy) return;
      setBusy(true);
      try {
        const { state: next } = await post(`/flashcards/${card.id}/review`, { grade: g, timeSec: Math.round((Date.now() - shownAt.current) / 1000) });
        setSession((s) => ({ reviewed: s.reviewed + 1, last: `Prochaine révision dans ${intervalLabel(next.interval)}` }));
        setFlipped(false);
        setI((x) => x + 1);
        shownAt.current = Date.now();
      } catch (error) {
        setState((s) => ({ ...s, error }));
      } finally {
        setBusy(false);
      }
    },
    [card, busy]
  );

  // Raccourcis clavier : Espace pour retourner, 1-4 pour noter
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName) && e.key === ' ') return;
      if (e.key === ' ' && card) {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, flipped, grade]);

  const totals = state.data?.totals;
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header">
        <div>
          <h1>Flashcards</h1>
          <p>Répétition espacée : les cartes oubliées ou fragiles reviennent en priorité.</p>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label htmlFor="fc-subject" className="small">Matière</label>
          <select id="fc-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Toutes</option>
            {program?.subjects.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
      </div>
      {totals && (
        <div className="grid grid-4 mb">
          <div className="card stat"><span className="stat-value">{totals.due}</span><span className="stat-label">À revoir</span></div>
          <div className="card stat"><span className="stat-value">{totals.fresh}</span><span className="stat-label">Nouvelles</span></div>
          <div className="card stat"><span className="stat-value">{totals.learned}</span><span className="stat-label">Acquises</span></div>
          <div className="card stat"><span className="stat-value">{session.reviewed}</span><span className="stat-label">Revues aujourd’hui</span></div>
        </div>
      )}
      {state.loading && <Loading />}
      <ErrorBox error={state.error} onRetry={load} />
      {state.data && !card && (
        <div className="card">
          <Empty
            title={session.reviewed ? 'Séance terminée, bravo !' : 'Aucune carte à réviser pour le moment'}
            action={<button className="btn btn-ghost" onClick={load}>Recharger la file</button>}
          >
            {state.data.nextDue ? `Prochaine carte à revoir : ${fmtDate(state.data.nextDue, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.` : 'Revenez plus tard.'}
          </Empty>
        </div>
      )}
      {card && (
        <div className="stack">
          <div className="quiz-progress">
            <span className="small muted">Carte {i + 1} / {state.data.queue.length}</span>
            <ProgressBar value={(i / state.data.queue.length) * 100} label="Avancement de la séance" />
          </div>
          <button type="button" className={`flashcard${flipped ? ' back' : ''}`} onClick={() => setFlipped((f) => !f)} aria-live="polite" aria-label={flipped ? `Verso : ${card.back}. Cliquer pour revoir le recto.` : `Recto : ${card.front}. Cliquer pour voir la réponse.`}>
            <div>
              <span className="side">{flipped ? 'Verso — réponse' : 'Recto — question'} · {card.chapter_title}</span>
              <div className="pre">{flipped ? card.back : card.front}</div>
              {!card.due_at && !flipped && <span className="badge badge-blue mt">Nouvelle</span>}
            </div>
          </button>
          {flipped ? (
            <div className="grade-buttons" role="group" aria-label="Évaluer votre rappel">
              {GRADES.map((g) => (
                <button key={g.g} type="button" className={`btn g${g.g}`} onClick={() => grade(g.g)} disabled={busy}>
                  {g.label}<small>{g.hint} · touche {g.key}</small>
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="btn btn-block" onClick={() => setFlipped(true)}>Afficher la réponse <span className="kbd">Espace</span></button>
          )}
          {session.last && <p className="small muted" aria-live="polite">{session.last}</p>}
        </div>
      )}
    </div>
  );
}
