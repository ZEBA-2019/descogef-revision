import { Link } from 'react-router-dom';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, Empty, DifficultyBadge } from '../components/ui.jsx';
import { IconClock } from '../components/icons.jsx';
import { fmtNumber } from '../format.js';

export default function Cases() {
  useDocumentTitle('Cas pratiques');
  const { data, error, loading, reload } = useFetch('/exercises');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Exercices et cas pratiques</h1>
          <p>Énoncé, annexes, indices progressifs, corrigé détaillé et barème pour vous autoévaluer.</p>
        </div>
      </div>
      {!data.exercises.length ? (
        <Empty title="Aucun cas pratique disponible" />
      ) : (
        <div className="grid grid-2">
          {data.exercises.map((x) => (
            <article key={x.id} className="card" style={{ margin: 0 }}>
              <div className="row small muted">
                <span>{x.subject_title} · {x.chapter_title}</span>
              </div>
              <h2 style={{ margin: '6px 0' }}>{x.title}</h2>
              <div className="row mb">
                <DifficultyBadge level={x.difficulty} />
                <span className="badge"><IconClock width={14} height={14} style={{ verticalAlign: '-2px' }} /> {x.duration_min} min</span>
                {x.is_demo ? <span className="badge badge-amber">Démo</span> : null}
                {x.attempts_count > 0 && <span className="badge badge-green">Meilleur score {fmtNumber(x.best_percent)} %</span>}
              </div>
              <div className="row">
                <Link to={`/cas-pratiques/${x.id}`} className="btn btn-sm">S’entraîner</Link>
                <Link to={`/cas-pratiques/${x.id}?chrono=1`} className="btn btn-sm btn-ghost">Conditions d’examen (chronométré)</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
