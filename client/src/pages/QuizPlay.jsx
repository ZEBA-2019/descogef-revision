import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../api.js';
import { useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, ProgressBar } from '../components/ui.jsx';
import { QuestionView, isAnswered } from '../components/QuestionView.jsx';
import AttemptSummary from '../components/AttemptSummary.jsx';

/** Déroulé d'une série : une question à la fois, correction immédiate, bilan final. */
export default function QuizPlay() {
  useDocumentTitle('Série en cours');
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({});
  const [corrections, setCorrections] = useState({});
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const startedAt = useRef(Date.now());
  const feedbackRef = useRef(null);

  useEffect(() => {
    let alive = true;
    get(`/attempts/${id}`)
      .then(async ({ attempt }) => {
        if (!alive) return;
        setAttempt(attempt);
        const done = attempt.answered || {};
        setCorrections(done);
        setValues(Object.fromEntries(Object.entries(done).map(([k, v]) => [k, v.answer])));
        if (attempt.status === 'termine') {
          const { summary } = await get(`/attempts/${id}/summary`);
          if (alive) setSummary(summary);
        } else {
          const firstOpen = attempt.questions.findIndex((q) => !done[q.id]);
          setIndex(firstOpen === -1 ? attempt.questions.length - 1 : firstOpen);
        }
      })
      .catch(setError);
    return () => {
      alive = false;
    };
  }, [id]);

  if (error && !attempt) return <ErrorBox error={error} />;
  if (!attempt) return <Loading />;
  if (summary) return <AttemptSummary summary={summary} />;

  const q = attempt.questions[index];
  const correction = corrections[q.id];
  const answeredCount = Object.keys(corrections).length;
  const isLast = index === attempt.questions.length - 1;

  async function validateAnswer() {
    if (!isAnswered(q, values[q.id]) || correction) return;
    setBusy(true);
    setError(null);
    try {
      const { correction } = await post(`/attempts/${attempt.id}/answer`, {
        questionId: q.id,
        answer: values[q.id],
        timeSec: Math.round((Date.now() - startedAt.current) / 1000),
      });
      setCorrections((c) => ({ ...c, [q.id]: correction }));
      setTimeout(() => feedbackRef.current?.querySelector('.feedback')?.focus(), 30);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const { summary } = await post(`/attempts/${attempt.id}/finish`);
      setSummary(summary);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    startedAt.current = Date.now();
    setIndex(index + 1);
  }

  const requested = attempt.config?.requested;
  return (
    <div className="stack" style={{ maxWidth: 780 }}>
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{attempt.kind === 'diagnostic' ? 'Diagnostic' : 'Quiz'}</h1>
        <Link to="/quiz" className="small">Quitter (progression sauvegardée)</Link>
      </div>
      {requested && requested > attempt.questions.length && index === 0 && !correction && (
        <div className="alert alert-info small">Seules {attempt.questions.length} questions correspondent à vos critères (sur {requested} demandées).</div>
      )}
      <div className="quiz-progress">
        <span className="small muted">Question {index + 1} / {attempt.questions.length}</span>
        <ProgressBar value={(answeredCount / attempt.questions.length) * 100} label="Avancement de la série" />
        <span className="small muted">{Object.values(corrections).filter((c) => c.correct).length} juste(s)</span>
      </div>
      <div className="card" ref={feedbackRef}>
        <QuestionView
          key={q.id}
          question={q}
          value={values[q.id]}
          onChange={(v) => setValues((s) => ({ ...s, [q.id]: v }))}
          correction={correction}
          onSubmit={validateAnswer}
        />
        <ErrorBox error={error} />
        <div className="row-between mt">
          <button className="btn btn-ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>Précédente</button>
          {!correction ? (
            <button className="btn" onClick={validateAnswer} disabled={busy || !isAnswered(q, values[q.id])}>{busy ? 'Correction…' : 'Valider ma réponse'}</button>
          ) : isLast || answeredCount === attempt.questions.length ? (
            <button className="btn btn-accent" onClick={finish} disabled={busy}>{busy ? 'Calcul…' : 'Voir mon bilan'}</button>
          ) : (
            <button className="btn" onClick={goNext}>Question suivante</button>
          )}
        </div>
      </div>
      {answeredCount > 0 && answeredCount < attempt.questions.length && (
        <div className="row-between small muted">
          <span>Vous pouvez arrêter et obtenir le bilan des {answeredCount} réponses données.</span>
          <button className="btn-link" onClick={finish}>Terminer maintenant</button>
        </div>
      )}
    </div>
  );
}
