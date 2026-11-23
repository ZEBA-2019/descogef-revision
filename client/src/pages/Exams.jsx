import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../api.js';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, Empty } from '../components/ui.jsx';
import { fmtDate, fmtDuration, fmtNumber } from '../format.js';

export default function Exams() {
  useDocumentTitle('Examens blancs');
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch('/exams');
  const [busy, setBusy] = useState(null);
  const [startError, setStartError] = useState(null);

  async function start(examId) {
    setBusy(examId);
    setStartError(null);
    try {
      const { attempt } = await post(`/exams/${examId}/start`);
      navigate(`/examens/tentative/${attempt.id}`);
    } catch (e) {
      setStartError(e);
      setBusy(null);
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const ongoing = data.attempts.filter((a) => a.status === 'en_cours');
  const done = data.attempts.filter((a) => a.status === 'termine');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Examens blancs</h1>
          <p>Sujet équilibré entre les matières, chronométré, avec sauvegarde automatique.</p>
        </div>
      </div>
      <ErrorBox error={startError} />
      {ongoing.length > 0 && (
        <div className="alert alert-info">
          Vous avez un examen en cours. <Link to={`/examens/tentative/${ongoing[0].id}`}>Reprendre l’examen</Link>
        </div>
      )}
      <div className="grid grid-2">
        {data.exams.map((e) => (
          <article key={e.id} className="card" style={{ margin: 0 }}>
            <h2>{e.title} {e.is_demo ? <span className="badge badge-amber">Démo</span> : null}</h2>
            <p className="muted">{e.description}</p>
            <ul className="small">
              <li>Durée : <strong>{e.duration_min} minutes</strong></li>
              <li>{e.config.perSubject} questions par matière, difficultés variées</li>
              <li>Un nouveau sujet est tiré à chaque tentative</li>
              <li>Pas de correction pendant l’épreuve ; copie remise automatiquement à la fin du temps</li>
            </ul>
            <button className="btn btn-accent" onClick={() => start(e.id)} disabled={busy === e.id}>{busy === e.id ? 'Préparation…' : 'Commencer'}</button>
          </article>
        ))}
      </div>
      <section className="card mt" aria-labelledby="hist">
        <h2 id="hist">Historique des tentatives</h2>
        {done.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th className="num">Note</th><th className="num">Réussite</th><th className="num">Durée</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {done.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDate(a.finished_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="num"><strong>{fmtNumber(a.score, 2)}/20</strong></td>
                    <td className="num">{fmtNumber(a.percent)} %</td>
                    <td className="num">{fmtDuration(a.duration_sec)}</td>
                    <td><Link to={`/examens/corrige/${a.id}`}>Corrigé</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Aucune tentative terminée">Votre historique apparaîtra ici.</Empty>
        )}
      </section>
    </div>
  );
}
