import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { get } from '../api.js';
import { ErrorBox, Loading, ProgressBar, DemoBanner, Empty } from '../components/ui.jsx';
import { fmtNumber } from '../format.js';

/** Catalogue des matières et chapitres. */
export default function Program() {
  useDocumentTitle('Programme');
  const { data, error, loading, reload } = useFetch('/program');
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState({});

  async function toggle(chapterId) {
    const next = open === chapterId ? null : chapterId;
    setOpen(next);
    if (next && !detail[next]) {
      try {
        const d = await get(`/chapters/${next}`);
        setDetail((s) => ({ ...s, [next]: d }));
      } catch (e) {
        setDetail((s) => ({ ...s, [next]: { error: e } }));
      }
    }
  }

  if (loading && !data) return <Loading lines={5} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data.subjects.length) return <Empty title="Aucune matière pour l’instant">L’administrateur n’a pas encore publié de contenu.</Empty>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Programme</h1>
          <p>Matières et chapitres, avec votre progression.</p>
        </div>
      </div>
      <DemoBanner notice={data.demoNotice} />
      <div className="stack">
        {data.subjects.map((s) => (
          <section className="card" key={s.id} aria-labelledby={`s-${s.id}`}>
            <div className="row-between">
              <div>
                <h2 id={`s-${s.id}`} style={{ marginBottom: 2 }}>{s.title} {s.is_demo ? <span className="badge badge-amber">Démo</span> : null}</h2>
                <p className="muted small" style={{ margin: 0 }}>{s.description}</p>
              </div>
              <strong>{fmtNumber(s.progress)} %</strong>
            </div>
            <div className="mt"><ProgressBar value={s.progress} label={`Progression ${s.title}`} /></div>
            <ul className="list mt">
              {s.chapters.map((c, i) => (
                <li key={c.id}>
                  <div className="row-between">
                    <button type="button" className="btn-link" style={{ textDecoration: 'none', color: 'inherit', textAlign: 'left' }} aria-expanded={open === c.id} onClick={() => toggle(c.id)}>
                      <strong>Chapitre {i + 1}. {c.title}</strong>
                      <div className="small muted">{c.sheets_count} fiche(s) · {c.questions_count} question(s) · {c.flashcards_count} flashcard(s) · {c.exercises_count} cas</div>
                    </button>
                    <div className="row" style={{ minWidth: 160 }}>
                      <div style={{ flex: 1 }}><ProgressBar value={c.progress} label={`Progression ${c.title}`} /></div>
                      <span className="small">{fmtNumber(c.progress)} %</span>
                    </div>
                  </div>
                  {open === c.id && <ChapterDetail d={detail[c.id]} chapter={c} />}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function ChapterDetail({ d, chapter }) {
  if (!d) return <p className="small muted mt">Chargement…</p>;
  if (d.error) return <ErrorBox error={d.error} />;
  return (
    <div className="mt" style={{ paddingLeft: 12, borderLeft: '3px solid var(--border)' }}>
      {chapter.description && <p className="small">{chapter.description}</p>}
      {d.lessons.map((l) => (
        <details key={l.id} className="mb">
          <summary>Leçon : {l.title}</summary>
          <p className="pre small mt">{l.content}</p>
        </details>
      ))}
      <div className="row">
        {d.sheets.map((sh) => <Link key={sh.id} to={`/fiches/${sh.id}`} className="btn btn-sm btn-ghost">Fiche : {sh.title}</Link>)}
        {d.counts.questions > 0 && <Link to={`/quiz?chapitre=${chapter.id}`} className="btn btn-sm">Quiz sur ce chapitre</Link>}
        {d.exercises.map((x) => <Link key={x.id} to={`/cas-pratiques/${x.id}`} className="btn btn-sm btn-ghost">Cas : {x.title}</Link>)}
      </div>
    </div>
  );
}
