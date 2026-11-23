import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, Empty, Segmented } from '../components/ui.jsx';
import { IconStar } from '../components/icons.jsx';
import { STATUS_LABELS } from '../format.js';

const STATUS_BADGE = { a_decouvrir: '', en_cours: 'badge-amber', maitrise: 'badge-green' };

export default function Sheets() {
  useDocumentTitle('Fiches de révision');
  const { data, error, loading, reload } = useFetch('/sheets');
  const [params] = useSearchParams();
  const [filter, setFilter] = useState('tous');
  const [query, setQuery] = useState('');
  const chapter = params.get('chapitre');

  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.sheets.filter(
      (s) =>
        (!chapter || String(s.chapter_id) === chapter) &&
        (filter === 'tous' || (filter === 'favoris' ? s.favorite : s.status === filter)) &&
        (!q || `${s.title} ${s.summary} ${s.chapter_title}`.toLowerCase().includes(q))
    );
  }, [data, filter, query, chapter]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const groups = list.reduce((acc, s) => ((acc[s.subject_title] ??= []).push(s), acc), {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Fiches de révision</h1>
          <p>{data.sheets.filter((s) => s.status === 'maitrise').length} / {data.sheets.length} fiches maîtrisées</p>
        </div>
      </div>
      <div className="card mb">
        <div className="row-between">
          <Segmented
            label="Filtrer les fiches"
            value={filter}
            onChange={setFilter}
            options={[{ value: 'tous', label: 'Toutes' }, { value: 'favoris', label: '★ Favoris' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
          />
          <div style={{ minWidth: 220, flex: '0 1 300px' }}>
            <label htmlFor="q" className="sr-only">Rechercher une fiche</label>
            <input id="q" type="text" placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {chapter && <p className="small mt" style={{ marginBottom: 0 }}>Filtré sur un chapitre · <Link to="/fiches">voir toutes les fiches</Link></p>}
      </div>
      {!list.length ? (
        <Empty title="Aucune fiche ne correspond">Modifiez les filtres ou la recherche.</Empty>
      ) : (
        Object.entries(groups).map(([subject, sheets]) => (
          <section key={subject} className="mb">
            <h2>{subject}</h2>
            <div className="grid grid-2">
              {sheets.map((s) => (
                <Link key={s.id} to={`/fiches/${s.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', margin: 0 }}>
                  <div className="row-between">
                    <span className="small muted">{s.chapter_title}</span>
                    {s.favorite ? <IconStar filled width={18} height={18} style={{ color: '#d97706' }} aria-label="Favori" role="img" /> : null}
                  </div>
                  <h3 style={{ margin: '6px 0' }}>{s.title}</h3>
                  <p className="small muted">{s.summary}</p>
                  <div className="row">
                    <span className={`badge ${STATUS_BADGE[s.status]}`}>{STATUS_LABELS[s.status]}</span>
                    {s.is_demo ? <span className="badge badge-amber">Démo</span> : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
