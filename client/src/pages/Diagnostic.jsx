import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, ProgressBar, DemoBanner } from '../components/ui.jsx';
import { QuestionView, isAnswered } from '../components/QuestionView.jsx';
import AttemptSummary from '../components/AttemptSummary.jsx';
import { isoDate } from '../format.js';

const LEVELS = [
  { v: 1, label: 'Débutant' },
  { v: 2, label: 'Notions' },
  { v: 3, label: 'Intermédiaire' },
  { v: 4, label: 'Bon niveau' },
  { v: 5, label: 'Maîtrise' },
];

/**
 * Questionnaire d'évaluation initiale :
 * 1) date d'examen + niveau ressenti par matière ; 2) 9 questions sans correction ; 3) bilan.
 */
export default function Diagnostic() {
  useDocumentTitle('Diagnostic initial');
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('profil');
  const [program, setProgram] = useState(null);
  const [error, setError] = useState(null);
  const [levels, setLevels] = useState({});
  const [examDate, setExamDate] = useState(user?.examDate || '');
  const [formError, setFormError] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    get('/program').then(setProgram).catch(setError);
  }, []);

  async function begin(e) {
    e.preventDefault();
    if (!program) return;
    if (program.subjects.some((s) => !levels[s.id])) return setFormError('Indiquez votre niveau pour chaque matière.');
    if (examDate && examDate <= isoDate()) return setFormError('La date d’examen doit être dans le futur.');
    setFormError(null);
    setBusy(true);
    try {
      const { attempt } = await post('/diagnostic/start');
      const answered = new Set(Object.keys(attempt.answered).map(Number));
      const firstOpen = attempt.questions.findIndex((q) => !answered.has(q.id));
      setAttempt(attempt);
      setIndex(firstOpen === -1 ? attempt.questions.length - 1 : firstOpen);
      setStep('questions');
      startedAt.current = Date.now();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function next(skip = false) {
    const q = attempt.questions[index];
    setBusy(true);
    setError(null);
    try {
      await post(`/attempts/${attempt.id}/answer`, {
        questionId: q.id,
        answer: skip ? null : value,
        timeSec: Math.round((Date.now() - startedAt.current) / 1000),
      });
      startedAt.current = Date.now();
      setValue(undefined);
      if (index + 1 < attempt.questions.length) setIndex(index + 1);
      else await finish();
    } catch (err) {
      if (err.status === 409) {
        if (index + 1 < attempt.questions.length) setIndex(index + 1);
        else await finish();
      } else setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    const { summary } = await post(`/attempts/${attempt.id}/finish`, { levels, examDate: examDate || null });
    await refresh();
    setSummary(summary);
    setStep('bilan');
    window.scrollTo(0, 0);
  }

  if (error && !program) return <ErrorBox error={error} onRetry={() => location.reload()} />;
  if (!program) return <Loading />;

  if (step === 'bilan' && summary) {
    return (
      <AttemptSummary summary={summary} title="Résultat de votre diagnostic">
        <p className="mt">Votre tableau de bord et vos recommandations tiennent désormais compte de ce diagnostic.</p>
        <button className="btn btn-accent" onClick={() => navigate('/tableau-de-bord')}>Accéder à mon tableau de bord</button>
      </AttemptSummary>
    );
  }

  if (step === 'questions' && attempt) {
    const q = attempt.questions[index];
    return (
      <div className="stack" style={{ maxWidth: 760 }}>
        <div className="quiz-progress">
          <span className="small muted">Question {index + 1} / {attempt.questions.length}</span>
          <ProgressBar value={(index / attempt.questions.length) * 100} label="Avancement du diagnostic" />
        </div>
        <div className="card">
          <QuestionView key={q.id} question={q} value={value} onChange={setValue} onSubmit={() => isAnswered(q, value) && next()} />
          <ErrorBox error={error} />
          <div className="row-between mt">
            <button className="btn btn-ghost" onClick={() => next(true)} disabled={busy}>Je ne sais pas</button>
            <button className="btn" onClick={() => next()} disabled={busy || !isAnswered(q, value)}>
              {index + 1 === attempt.questions.length ? 'Terminer le diagnostic' : 'Question suivante'}
            </button>
          </div>
        </div>
        <p className="small muted">Les corrections détaillées seront consultables dans le bilan. Répondez spontanément : l’objectif est de mesurer votre niveau actuel.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header">
        <div>
          <h1>Diagnostic initial</h1>
          <p>Environ 10 minutes pour personnaliser vos révisions.</p>
        </div>
      </div>
      <DemoBanner notice={program.demoNotice} />
      <form className="card" onSubmit={begin} noValidate>
        <h2>1. Votre examen</h2>
        <div className="field">
          <label htmlFor="examDate">Date prévue de l’examen <span className="muted">(facultatif)</span></label>
          <input id="examDate" type="date" min={isoDate()} value={examDate} onChange={(e) => setExamDate(e.target.value)} style={{ maxWidth: 240 }} />
        </div>
        <h2 className="mt">2. Votre niveau ressenti</h2>
        {program.subjects.map((s) => (
          <fieldset key={s.id}>
            <legend>{s.title}</legend>
            <div className="row" role="radiogroup">
              {LEVELS.map((l) => (
                <label key={l.v} className="option" style={{ padding: '8px 12px' }}>
                  <input type="radio" name={`lvl-${s.id}`} checked={levels[s.id] === l.v} onChange={() => setLevels({ ...levels, [s.id]: l.v })} />
                  <span>{l.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {formError && <div className="alert alert-error" role="alert">{formError}</div>}
        <ErrorBox error={error} />
        <div className="row-between mt">
          <span className="small muted">3. Puis 9 questions couvrant les 3 matières.</span>
          <button className="btn btn-accent" disabled={busy}>{busy ? 'Préparation…' : 'Commencer les questions'}</button>
        </div>
      </form>
    </div>
  );
}
