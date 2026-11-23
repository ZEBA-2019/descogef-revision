import { Link } from 'react-router-dom';
import { ProgressBar, Ring } from './ui.jsx';
import { fmtNumber } from '../format.js';
import { IconArrowRight } from './icons.jsx';

/** Bilan de fin de série : note, évolution de la progression, compétences à renforcer. */
export default function AttemptSummary({ summary, title = 'Bilan de la série', children }) {
  const { score } = summary;
  const touched = summary.subjects.filter((s) => s.answeredHere > 0);
  const delta = Math.round((summary.overallAfter - summary.overallBefore) * 10) / 10;
  return (
    <div className="stack">
      <div className="card">
        <h1>{title}</h1>
        <div className="row" style={{ gap: 28 }}>
          <Ring value={score.percent} label="de réussite" />
          <div className="stack" style={{ gap: 6 }}>
            <div className="stat"><span className="stat-value">{fmtNumber(score.outOf20, 2)} / 20</span><span className="stat-label">Note pondérée par la difficulté — {score.mention}</span></div>
            <div><strong>{score.correctCount}</strong> bonne{score.correctCount > 1 ? 's' : ''} réponse{score.correctCount > 1 ? 's' : ''} sur {score.total}</div>
            <div className="small">
              Progression générale : {fmtNumber(summary.overallBefore, 1)} % → <strong>{fmtNumber(summary.overallAfter, 1)} %</strong>{' '}
              {delta !== 0 && <span className={`badge ${delta > 0 ? 'badge-green' : 'badge-red'}`}>{delta > 0 ? '+' : ''}{fmtNumber(delta, 1)} pt</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Mise à jour de votre progression</h2>
          <ul className="list">
            {touched.map((s) => (
              <li key={s.subjectId}>
                <div className="row-between small">
                  <strong>{s.title}</strong>
                  <span>{s.correctHere}/{s.answeredHere} juste{s.correctHere > 1 ? 's' : ''}</span>
                </div>
                <ProgressBar value={s.progress} label={`Progression ${s.title}`} />
                <div className="small muted">
                  {fmtNumber(s.before, 1)} % → {fmtNumber(s.progress, 1)} %{' '}
                  {s.delta !== 0 && <span className={s.delta > 0 ? '' : 'field-error'}>({s.delta > 0 ? '+' : ''}{fmtNumber(s.delta, 1)} pt)</span>}
                </div>
              </li>
            ))}
          </ul>
          {summary.chapters.length > 0 && (
            <details className="mt">
              <summary>Détail par chapitre</summary>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Chapitre</th><th className="num">Avant</th><th className="num">Après</th></tr></thead>
                  <tbody>
                    {summary.chapters.map((c) => (
                      <tr key={c.chapterId}><td>{c.title}</td><td className="num">{fmtNumber(c.before, 1)} %</td><td className="num">{fmtNumber(c.progress, 1)} %</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
        <div className="card">
          <h2>Compétences à renforcer</h2>
          {summary.toReinforce.length ? (
            <ul className="list">
              {summary.toReinforce.map((c) => (
                <li key={c.competency} className="row-between">
                  <span>{c.competency}</span>
                  <span className="badge badge-red">{c.correct}/{c.total}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Aucune compétence en difficulté sur cette série. Bravo !</p>
          )}
          {children}
        </div>
      </div>
      <div className="row">
        <Link to="/tableau-de-bord" className="btn">Retour au tableau de bord <IconArrowRight /></Link>
        <Link to="/quiz" className="btn btn-ghost">Nouvelle série</Link>
        <Link to="/statistiques" className="btn btn-ghost">Voir mes statistiques</Link>
      </div>
    </div>
  );
}
