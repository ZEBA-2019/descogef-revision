import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, Empty } from '../components/ui.jsx';
import { LineChart, BarList } from '../components/charts.jsx';
import { fmtDate, fmtDateShort, fmtDuration, fmtNumber, fmtPercent, KIND_LABELS, DIFFICULTY_LABELS } from '../format.js';
import { IconLightbulb, IconArrowRight } from '../components/icons.jsx';

const ACTIVITY_LABELS = { quiz: 'Quiz', diagnostic: 'Diagnostic', examen: 'Examens blancs', cas: 'Cas pratiques', flashcards: 'Flashcards', fiche: 'Lecture de fiches', lecture: 'Lecture' };

export default function Stats() {
  useDocumentTitle('Statistiques');
  const { data, error, loading, reload } = useFetch('/stats');
  if (loading && !data) return <Loading lines={8} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const points = data.timeline.map((a) => ({ value: a.percent, label: `${fmtDate(a.finished_at)} — ${KIND_LABELS[a.kind]}`, short: fmtDateShort(a.finished_at) }));
  const rec = data.recommendation;
  const bySubject = new Map(data.subjects.map((s) => [s.subjectId, s]));
  const chaptersBySubject = data.chapters.reduce((m, c) => ((m[c.subjectId] ??= []).push(c), m), {});
  const totalTime = data.timeByActivity.reduce((s, a) => s + a.seconds, 0);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-header">
        <div>
          <h1>Statistiques</h1>
          <p>Progression générale : <strong>{fmtNumber(data.overall, 1)} %</strong></p>
        </div>
      </div>

      <section className="card hero-cta">
        <div className="row-between">
          <div>
            <p className="small muted" style={{ margin: 0 }}><IconLightbulb style={{ verticalAlign: 'middle' }} /> Prochaine activité la plus utile</p>
            <h2 style={{ margin: '4px 0' }}>{rec.title}</h2>
            <p className="muted" style={{ margin: 0 }}>{rec.reason}</p>
          </div>
          <Link to={rec.to} className="btn btn-accent">Y aller <IconArrowRight /></Link>
        </div>
      </section>

      <section className="card" aria-labelledby="evo">
        <h2 id="evo">Évolution des scores</h2>
        {points.length ? <LineChart points={points} title="Pourcentage de réussite par série dans le temps" /> : <Empty title="Pas encore de données">Terminez une série pour voir votre courbe.</Empty>}
        {points.length > 0 && <p className="small muted">La ligne pointillée marque 50 %. Survolez ou parcourez les points pour le détail.</p>}
      </section>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="subj">
          <h2 id="subj">Comparaison par matière</h2>
          <BarList title="Progression par matière" items={data.subjects.map((s) => ({ label: s.title, value: s.progress }))} />
          <h3 className="mt">Taux de réussite</h3>
          <BarList title="Taux de réussite par matière" items={data.subjects.map((s) => ({ label: `${s.title} (${s.count} rép.)`, value: s.count ? s.accuracy * 100 : null, color: 'var(--navy-600)' }))} />
        </section>
        <section className="card" aria-labelledby="err">
          <h2 id="err">Erreurs récurrentes</h2>
          {data.errors.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Compétence</th><th className="num">Erreurs</th><th className="num">Taux</th></tr></thead>
                <tbody>{data.errors.map((e) => <tr key={e.competency}><td>{e.competency}</td><td className="num">{e.errors}/{e.total}</td><td className="num"><span className={`badge ${e.errorRate >= 0.5 ? 'badge-red' : 'badge-amber'}`}>{fmtPercent(e.errorRate)}</span></td></tr>)}</tbody>
              </table>
            </div>
          ) : <Empty title="Aucune erreur récurrente détectée" />}
          {data.missed.length > 0 && (
            <>
              <h3 className="mt">Questions les plus manquées</h3>
              <ul className="list small">{data.missed.map((m) => <li key={m.id}><div>{m.prompt.length > 120 ? m.prompt.slice(0, 120) + '…' : m.prompt}</div><span className="muted">{m.chapter_title} · {m.errors} erreur(s) sur {m.attempts}</span></li>)}</ul>
            </>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="chap">
        <h2 id="chap">Détail par chapitre</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Chapitre</th><th className="num">Réponses</th><th className="num">Réussite</th><th className="num">Maîtrise</th><th className="num">Progression</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {Object.entries(chaptersBySubject).map(([sid, chs]) => (
                <Fragment key={sid}>
                  <tr><th colSpan={6} scope="colgroup" style={{ color: 'var(--text)', background: 'var(--surface-2)' }}>{bySubject.get(Number(sid))?.title}</th></tr>
                  {chs.map((c) => (
                    <tr key={c.chapterId}>
                      <td>{c.title}</td>
                      <td className="num">{c.count}</td>
                      <td className="num">{c.count ? fmtPercent(c.accuracy) : '—'}</td>
                      <td className="num">{c.count ? <span className={`badge ${c.mastery >= 0.8 ? 'badge-green' : c.mastery >= 0.6 ? 'badge-amber' : 'badge-red'}`}>{fmtPercent(c.mastery)}</span> : '—'}</td>
                      <td className="num">{fmtNumber(c.progress)} %</td>
                      <td><Link className="small" to={`/quiz?chapitre=${c.chapterId}`}>S’entraîner</Link></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">La maîtrise pondère davantage les réponses récentes et les questions difficiles ; la progression combine maîtrise (75 %) et fiches maîtrisées (25 %).</p>
      </section>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="diff">
          <h2 id="diff">Réussite par difficulté</h2>
          <BarList title="Réussite par difficulté" items={data.byDifficulty.map((d) => ({ label: `${DIFFICULTY_LABELS[d.difficulty]} (${d.count} rép.)`, value: d.accuracy == null ? null : d.accuracy * 100 }))} />
        </section>
        <section className="card" aria-labelledby="time">
          <h2 id="time">Temps de révision · {fmtDuration(totalTime)}</h2>
          {data.timeByActivity.length ? (
            <BarList title="Temps par activité" unit="min" max={Math.max(...data.timeByActivity.map((a) => a.seconds / 60), 1)} items={data.timeByActivity.map((a) => ({ label: ACTIVITY_LABELS[a.activity] || a.activity, value: a.seconds / 60, color: 'var(--navy-600)' }))} />
          ) : <Empty title="Aucun temps enregistré" />}
        </section>
      </div>
    </div>
  );
}
