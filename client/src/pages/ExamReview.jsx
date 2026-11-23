import { Link, useParams } from 'react-router-dom';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading } from '../components/ui.jsx';
import { QuestionView } from '../components/QuestionView.jsx';
import { fmtDuration, fmtNumber, KIND_LABELS } from '../format.js';

export default function ExamReview() {
  useDocumentTitle('Corrigé');
  const { id } = useParams();
  const { data, error, loading, reload } = useFetch(`/attempts/${id}/review`);
  if (loading && !data) return <Loading lines={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { attempt, items } = data;
  const wrong = items.filter((i) => !i.correction.correct);
  return (
    <div style={{ maxWidth: 820 }}>
      <nav className="small mb"><Link to="/examens">Examens blancs</Link> › Corrigé</nav>
      <div className="page-header">
        <div>
          <h1>Corrigé — {attempt.config?.title || KIND_LABELS[attempt.kind]}</h1>
          <p>Note : <strong>{fmtNumber(attempt.score, 2)}/20</strong> · {fmtNumber(attempt.percent)} % · durée {fmtDuration(attempt.durationSec)} · {wrong.length} erreur(s) ou absence(s) de réponse</p>
        </div>
      </div>
      <div className="stack">
        {items.map((it, i) => (
          <section className="card" key={it.question.id} aria-label={`Question ${i + 1}`}>
            <div className="row-between small mb">
              <strong>Question {i + 1}</strong>
              {it.unanswered ? <span className="badge badge-amber">Sans réponse</span> : it.correction.correct ? <span className="badge badge-green">Juste</span> : <span className="badge badge-red">Fausse</span>}
            </div>
            <QuestionView question={it.question} value={it.answer} onChange={() => {}} correction={it.correction} />
          </section>
        ))}
      </div>
    </div>
  );
}
