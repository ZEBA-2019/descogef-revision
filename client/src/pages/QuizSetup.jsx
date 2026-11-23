import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../api.js';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, Segmented, DemoBanner } from '../components/ui.jsx';
import { TYPE_LABELS } from '../format.js';

export default function QuizSetup() {
  useDocumentTitle('Quiz');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useFetch('/program');
  const [opts, setOpts] = useState({ mode: 'personnalise', subjectId: '', chapterId: params.get('chapitre') || '', difficulty: '', types: [], count: 10 });
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState(null);

  useEffect(() => {
    if (!data || !opts.chapterId) return;
    const s = data.subjects.find((s) => s.chapters.some((c) => String(c.id) === String(opts.chapterId)));
    if (s && String(opts.subjectId) !== String(s.id)) setOpts((o) => ({ ...o, subjectId: String(s.id) }));
  }, [data, opts.chapterId, opts.subjectId]);

  async function start(e) {
    e.preventDefault();
    setBusy(true);
    setStartError(null);
    try {
      const body = {
        mode: opts.mode,
        count: opts.count,
        subjectId: opts.subjectId ? Number(opts.subjectId) : null,
        chapterId: opts.chapterId ? Number(opts.chapterId) : null,
        difficulty: opts.difficulty ? Number(opts.difficulty) : null,
        types: opts.types.length ? opts.types : undefined,
      };
      const { attempt } = await post('/quiz/start', body);
      navigate(`/quiz/${attempt.id}`);
    } catch (err) {
      setStartError(err);
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const subject = data.subjects.find((s) => String(s.id) === String(opts.subjectId));
  const toggleType = (t) => setOpts((o) => ({ ...o, types: o.types.includes(t) ? o.types.filter((x) => x !== t) : [...o.types, t] }));

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header">
        <div>
          <h1>Quiz interactifs</h1>
          <p>Correction et explication immédiates après chaque réponse.</p>
        </div>
      </div>
      <DemoBanner notice={data.demoNotice} />
      <form className="card" onSubmit={start}>
        <div className="field">
          <span className="label" id="mode-label">Type de série</span>
          <Segmented
            label="Type de série"
            value={opts.mode}
            onChange={(mode) => setOpts({ ...opts, mode })}
            options={[{ value: 'personnalise', label: 'Personnalisée' }, { value: 'adaptatif', label: 'Adaptative (mes lacunes)' }]}
          />
          <span className="hint">{opts.mode === 'adaptatif' ? 'Les questions sont choisies selon vos chapitres faibles et vos erreurs passées.' : 'Les questions peu vues sont privilégiées.'}</span>
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="subject">Matière</label>
            <select id="subject" value={opts.subjectId} onChange={(e) => setOpts({ ...opts, subjectId: e.target.value, chapterId: '' })}>
              <option value="">Toutes les matières</option>
              {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="chapter">Chapitre</label>
            <select id="chapter" value={opts.chapterId} disabled={!subject} onChange={(e) => setOpts({ ...opts, chapterId: e.target.value })}>
              <option value="">{subject ? 'Tous les chapitres' : 'Choisissez d’abord une matière'}</option>
              {subject?.chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="difficulty">Difficulté</label>
          <select id="difficulty" value={opts.difficulty} onChange={(e) => setOpts({ ...opts, difficulty: e.target.value })} style={{ maxWidth: 260 }}>
            <option value="">Toutes</option>
            <option value="1">Facile</option>
            <option value="2">Moyen</option>
            <option value="3">Difficile</option>
          </select>
        </div>
        <fieldset>
          <legend>Types de questions <span className="muted small">(aucun = tous)</span></legend>
          <div className="row">
            {Object.entries(TYPE_LABELS).map(([t, label]) => (
              <label key={t} className="option" style={{ padding: '8px 12px' }}>
                <input type="checkbox" checked={opts.types.includes(t)} onChange={() => toggleType(t)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <span className="label">Nombre de questions</span>
          <Segmented label="Nombre de questions" value={opts.count} onChange={(count) => setOpts({ ...opts, count })} options={[5, 10, 20, 40].map((n) => ({ value: n, label: String(n) }))} />
          <span className="hint">Si la banque contient moins de questions correspondantes, la série sera plus courte.</span>
        </div>
        <ErrorBox error={startError} />
        <button className="btn btn-accent" disabled={busy}>{busy ? 'Préparation…' : 'Lancer la série'}</button>
      </form>
    </div>
  );
}
