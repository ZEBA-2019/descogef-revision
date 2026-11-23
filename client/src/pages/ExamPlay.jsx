import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post, put } from '../api.js';
import { useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading } from '../components/ui.jsx';
import { QuestionView, isAnswered } from '../components/QuestionView.jsx';
import AttemptSummary from '../components/AttemptSummary.jsx';
import { fmtClock } from '../format.js';
import { IconClock } from '../components/icons.jsx';

/** Épreuve chronométrée : navigation libre, sauvegarde automatique, remise automatique. */
export default function ExamPlay() {
  useDocumentTitle('Examen blanc');
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState('');
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const latest = useRef({ answers: {}, index: 0 });
  latest.current = { answers, index };

  useEffect(() => {
    get(`/attempts/${id}`)
      .then(({ attempt }) => {
        if (attempt.status === 'termine') return navigate(`/examens/corrige/${id}`, { replace: true });
        setAttempt(attempt);
        setAnswers(attempt.state.answers || {});
        setIndex(attempt.state.currentIndex || 0);
      })
      .catch(setError);
  }, [id, navigate]);

  const save = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState('Enregistrement…');
    try {
      await put(`/attempts/${id}/autosave`, { answers: latest.current.answers, currentIndex: latest.current.index });
      setSaveState(`Sauvegardé à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) {
      dirty.current = true;
      setSaveState(e.status === 409 ? 'Temps écoulé' : 'Échec de la sauvegarde — nouvel essai…');
      if (e.status === 409) navigate(`/examens/corrige/${id}`, { replace: true });
    }
  }, [id, navigate]);

  // Sauvegarde automatique toutes les 10 s + à la fermeture de l'onglet
  useEffect(() => {
    const t = setInterval(save, 10_000);
    const onHide = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [save]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { summary } = await post(`/attempts/${id}/submit`, { answers: latest.current.answers });
      setSummary(summary);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }, [id]);

  const remaining = attempt ? (new Date(attempt.state.deadline).getTime() - now) / 1000 : null;
  useEffect(() => {
    if (attempt && remaining <= 0 && !summary && !busy) submit();
  }, [remaining <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (summary) {
    return (
      <AttemptSummary summary={summary} title="Résultat de l’examen blanc">
        <button className="btn mt" onClick={() => navigate(`/examens/corrige/${id}`)}>Voir le corrigé détaillé</button>
      </AttemptSummary>
    );
  }
  if (error && !attempt) return <ErrorBox error={error} />;
  if (!attempt) return <Loading />;

  const q = attempt.questions[index];
  const answeredCount = attempt.questions.filter((x) => isAnswered(x, answers[x.id])).length;
  const setAnswer = (v) => {
    dirty.current = true;
    setAnswers((a) => ({ ...a, [q.id]: v }));
  };
  const go = (i) => {
    dirty.current = true;
    setIndex(i);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{attempt.config.title}</h1>
          <p>{answeredCount} / {attempt.questions.length} questions répondues · <span aria-live="polite">{saveState}</span></p>
        </div>
      </div>
      <div className="exam-layout">
        <div className="card">
          <QuestionView key={q.id} question={q} value={answers[q.id]} onChange={setAnswer} onSubmit={() => index < attempt.questions.length - 1 && go(index + 1)} />
          <div className="row-between mt">
            <button className="btn btn-ghost" disabled={index === 0} onClick={() => go(index - 1)}>Précédente</button>
            {index < attempt.questions.length - 1 ? (
              <button className="btn" onClick={() => go(index + 1)}>Suivante</button>
            ) : (
              <button className="btn btn-accent" onClick={() => setConfirming(true)}>Remettre ma copie</button>
            )}
          </div>
        </div>
        <aside className="card sticky" aria-label="Chronomètre et navigation">
          <div className="small muted"><IconClock width={14} height={14} /> Temps restant</div>
          <div className={`timer${remaining < 300 ? ' low' : ''}`} role="timer">{fmtClock(remaining)}</div>
          {remaining < 300 && remaining > 0 && <p className="small field-error">Moins de 5 minutes !</p>}
          <h2 className="small mt">Questions</h2>
          <div className="qnav">
            {attempt.questions.map((x, i) => (
              <button key={x.id} type="button" className={`${isAnswered(x, answers[x.id]) ? 'answered' : ''} ${i === index ? 'current' : ''}`} onClick={() => go(i)} aria-current={i === index ? 'step' : undefined} aria-label={`Question ${i + 1}${isAnswered(x, answers[x.id]) ? ', répondue' : ''}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <button className="btn btn-accent btn-block mt" onClick={() => setConfirming(true)}>Remettre ma copie</button>
        </aside>
      </div>
      <ErrorBox error={error} />
      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="card" style={{ position: 'fixed', inset: 'auto 16px 16px 16px', maxWidth: 520, margin: '0 auto', zIndex: 60, boxShadow: '0 0 0 100vmax rgba(0,0,0,.45)' }}>
          <h2 id="confirm-title">Remettre votre copie ?</h2>
          <p>{attempt.questions.length - answeredCount > 0 ? `${attempt.questions.length - answeredCount} question(s) sans réponse seront comptées fausses.` : 'Toutes les questions ont une réponse.'}</p>
          <div className="row">
            <button className="btn btn-accent" onClick={submit} disabled={busy} autoFocus>{busy ? 'Correction…' : 'Oui, remettre'}</button>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Continuer l’épreuve</button>
          </div>
        </div>
      )}
    </div>
  );
}
