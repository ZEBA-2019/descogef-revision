import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { post, patch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, ProgressBar, Ring, Empty } from '../components/ui.jsx';
import { IconClock, IconTarget, IconFlame, IconCards, IconArrowRight, IconLightbulb, IconCheck } from '../components/icons.jsx';
import { fmtDuration, fmtPercent, fmtDate, fmtNumber, daysUntil, KIND_LABELS } from '../format.js';

export default function Dashboard() {
  useDocumentTitle('Tableau de bord');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch('/dashboard');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  async function reviseNow() {
    const rec = data.recommendation;
    if (rec.type === 'diagnostic' || rec.type === 'flashcards' || rec.type === 'examen') return navigate(rec.to);
    let chapterId = rec.chapterId;
    if (rec.type === 'plan') {
      const it = rec.item;
      const routes = { fiche: `/fiches?chapitre=${it.chapter_id}`, flashcards: '/flashcards', cas: '/cas-pratiques', examen: '/examens' };
      if (routes[it.activity]) return navigate(routes[it.activity]);
      chapterId = it.chapter_id;
    }
    setStarting(true);
    setStartError(null);
    try {
      const body = chapterId ? { mode: 'adaptatif', chapterId, count: 5 } : { mode: 'adaptatif', count: 10 };
      const { attempt } = await post('/quiz/start', body);
      navigate(`/quiz/${attempt.id}`);
    } catch (e) {
      setStartError(e);
      setStarting(false);
    }
  }

  async function markDone(id) {
    await patch(`/planning/items/${id}`, { status: 'fait' });
    reload();
  }

  if (loading && !data) return <Loading lines={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const rec = data.recommendation;
  const days = daysUntil(data.examDate);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-header">
        <div>
          <h1>Bonjour {user.name.split(' ')[0]} 👋</h1>
          <p>{days != null && days >= 0 ? `Examen dans ${days} jour${days > 1 ? 's' : ''} (${fmtDate(data.examDate)}).` : 'Renseignez votre date d’examen dans le planning pour un programme sur mesure.'}</p>
        </div>
      </div>

      {!user.diagnosticDone && (
        <div className="alert alert-info">
          Commencez par le <Link to="/diagnostic">diagnostic initial</Link> : il personnalise vos séances et votre planning.
        </div>
      )}

      <section className="card hero-cta" aria-labelledby="reviser">
        <div className="row-between">
          <div>
            <p className="small muted" style={{ margin: 0 }}><IconLightbulb style={{ verticalAlign: 'middle' }} /> Séance recommandée</p>
            <h2 id="reviser" style={{ margin: '4px 0' }}>{rec.title}</h2>
            <p className="muted" style={{ margin: 0 }}>{rec.reason}</p>
          </div>
          <button className="btn btn-accent" onClick={reviseNow} disabled={starting}>
            {starting ? 'Préparation…' : 'Réviser maintenant'} <IconArrowRight />
          </button>
        </div>
        {startError && <div className="alert alert-error mt" role="alert">{startError.message}</div>}
      </section>

      <div className="grid grid-4">
        <div className="card stat"><IconClock /><span className="stat-value">{fmtDuration(data.timeTotalSec)}</span><span className="stat-label">Temps total · {fmtDuration(data.timeWeekSec)} cette semaine</span></div>
        <div className="card stat"><IconTarget /><span className="stat-value">{fmtPercent(data.successRate)}</span><span className="stat-label">Taux de réussite ({data.answered} réponses)</span></div>
        <div className="card stat"><IconFlame /><span className="stat-value">{data.streak} j</span><span className="stat-label">Jours consécutifs de révision</span></div>
        <div className="card stat"><IconCards /><span className="stat-value">{data.dueFlashcards}</span><span className="stat-label">Flashcards à revoir · {data.newFlashcards} nouvelles</span></div>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="prog">
          <div className="card-title"><h2 id="prog">Progression</h2><Link to="/programme" className="small">Programme</Link></div>
          <div className="row" style={{ gap: 24, alignItems: 'center' }}>
            <Ring value={data.overall} label="globale" />
            <ul className="list" style={{ flex: 1, minWidth: 200 }}>
              {data.subjects.map((s) => (
                <li key={s.subjectId} style={{ padding: '8px 0' }}>
                  <div className="row-between small"><span>{s.title}</span><strong>{fmtNumber(s.progress, 0)} %</strong></div>
                  <ProgressBar value={s.progress} label={`Progression ${s.title}`} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card" aria-labelledby="weak">
          <div className="card-title"><h2 id="weak">Notions à revoir</h2><Link to="/statistiques" className="small">Statistiques</Link></div>
          {data.weak.length ? (
            <ul className="list">
              {data.weak.map((w) => (
                <li key={w.chapterId} className="row-between">
                  <div>
                    <strong>{w.title}</strong>
                    <div className="small muted">Maîtrise estimée {fmtPercent(w.mastery)} · {w.count} réponses</div>
                  </div>
                  <Link className="btn btn-sm btn-ghost" to={`/quiz?chapitre=${w.chapterId}`}>S’entraîner</Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Aucune lacune détectée pour l’instant">Les notions fragiles apparaîtront ici après quelques séries.</Empty>
          )}
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="today">
          <div className="card-title"><h2 id="today">Aujourd’hui</h2><Link to="/planning" className="small">Planning</Link></div>
          {data.todayPlan.length ? (
            <ul className="list">
              {data.todayPlan.map((p) => (
                <li key={p.id} className="row-between">
                  <div>
                    <strong>{p.label}</strong>
                    <div className="small muted">{p.subject_title || 'Toutes matières'} · {p.duration_min} min</div>
                  </div>
                  {p.status === 'fait' ? <span className="badge badge-green"><IconCheck width={14} height={14} /> Fait</span> : <button className="btn btn-sm btn-ghost" onClick={() => markDone(p.id)}>Marquer fait</button>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Rien de prévu aujourd’hui" action={<Link to="/planning" className="btn btn-sm btn-ghost">Créer mon planning</Link>} />
          )}
        </section>

        <section className="card" aria-labelledby="recent">
          <div className="card-title"><h2 id="recent">Séries récentes</h2></div>
          {data.recent.length ? (
            <ul className="list">
              {data.recent.map((a) => (
                <li key={a.id} className="row-between">
                  <div>
                    <strong>{KIND_LABELS[a.kind]}</strong>{a.config?.title ? ` — ${a.config.title}` : ''}
                    <div className="small muted">{fmtDate(a.finished_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{a.answered ? ` · ${a.answered} questions` : ''}</div>
                  </div>
                  <span className={`badge ${a.percent >= 60 ? 'badge-green' : a.percent >= 40 ? 'badge-amber' : 'badge-red'}`}>{fmtNumber(a.score, 1)}/20</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Pas encore de série" action={<Link to="/quiz" className="btn btn-sm">Lancer un quiz</Link>} />
          )}
        </section>
      </div>
    </div>
  );
}
