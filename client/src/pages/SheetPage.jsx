import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { put } from '../api.js';
import { useFetch, useDocumentTitle, useTrackTime } from '../hooks.js';
import { ErrorBox, Loading, Segmented, DemoBanner, useToast } from '../components/ui.jsx';
import { IconStar } from '../components/icons.jsx';
import { STATUS_LABELS, fmtDate } from '../format.js';

const KIND_LABELS = { definition: 'Définition', regle: 'Règle', formule: 'Formule', methode: 'Méthode', exemple: 'Exemple', erreur: 'Erreurs fréquentes' };

export default function SheetPage() {
  const { id } = useParams();
  const { data, error, loading, reload, setData } = useFetch(`/sheets/${id}`);
  useDocumentTitle(data?.sheet?.title || 'Fiche');
  const [mode, setMode] = useState('lecture');
  const [level, setLevel] = useState(1); // mémorisation : 1 = masque le corps, 2 = masque aussi les titres
  const [revealed, setRevealed] = useState(new Set());
  const [note, setNote] = useState('');
  const [noteState, setNoteState] = useState('idle');
  const [toast, showToast] = useToast();
  const saveTimer = useRef();

  useEffect(() => {
    if (data) setNote(data.note.content || '');
  }, [data?.sheet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useTrackTime((sec) => {
    if (!data?.sheet) return;
    fetch('/api/study-sessions', {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity: 'fiche', subjectId: data.sheet.subject_id, chapterId: data.sheet.chapter_id, durationSec: sec }),
    }).catch(() => {});
  });

  // Sauvegarde automatique de la note (après 800 ms d'inactivité)
  function onNoteChange(v) {
    setNote(v);
    setNoteState('pending');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await put(`/sheets/${id}/note`, { content: v });
        setNoteState('saved');
      } catch {
        setNoteState('error');
      }
    }, 800);
  }

  async function setStatus(status) {
    const prev = data.status;
    setData((d) => ({ ...d, status }));
    try {
      await put(`/sheets/${id}/status`, { status });
      showToast(`Statut : ${STATUS_LABELS[status]}`);
    } catch (e) {
      setData((d) => ({ ...d, status: prev }));
      showToast(e.message);
    }
  }

  async function toggleFavorite() {
    const favorite = !data.favorite;
    setData((d) => ({ ...d, favorite }));
    try {
      await put(`/sheets/${id}/favorite`, { favorite });
      showToast(favorite ? 'Ajoutée aux favoris' : 'Retirée des favoris');
    } catch (e) {
      setData((d) => ({ ...d, favorite: !favorite }));
      showToast(e.message);
    }
  }

  if (loading && !data) return <Loading lines={8} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { sheet } = data;
  const memo = mode === 'memorisation';
  const reveal = (key) => setRevealed((s) => new Set(s).add(key));

  return (
    <div style={{ maxWidth: 860 }}>
      {toast}
      <nav className="small mb" aria-label="Fil d’Ariane"><Link to="/fiches">Fiches</Link> › {sheet.subject_title} › {sheet.chapter_title}</nav>
      <div className="page-header">
        <div>
          <h1>{sheet.title}</h1>
          <p>{sheet.summary}</p>
        </div>
        <button type="button" className="btn btn-ghost" aria-pressed={data.favorite} onClick={toggleFavorite}>
          <IconStar filled={data.favorite} style={{ color: data.favorite ? '#d97706' : undefined }} /> {data.favorite ? 'Favori' : 'Ajouter aux favoris'}
        </button>
      </div>
      <DemoBanner notice={data.demoNotice} />

      <div className="card mb">
        <div className="row-between">
          <Segmented label="Mode d’affichage" value={mode} onChange={(m) => { setMode(m); setRevealed(new Set()); }} options={[{ value: 'lecture', label: 'Mode lecture' }, { value: 'memorisation', label: 'Mode mémorisation' }]} />
          <div className="row">
            <span className="small muted">Statut :</span>
            <Segmented label="Statut de la fiche" value={data.status} onChange={setStatus} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          </div>
        </div>
        {memo && (
          <div className="row mt small">
            <span>Masquage :</span>
            <Segmented label="Niveau de masquage" value={level} onChange={(l) => { setLevel(l); setRevealed(new Set()); }} options={[{ value: 1, label: 'Contenus' }, { value: 2, label: 'Contenus et titres' }]} />
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRevealed(new Set(sheet.sections.flatMap((_, i) => [`b${i}`, `t${i}`])))}>Tout révéler</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRevealed(new Set())}>Tout masquer</button>
            <span className="muted">Essayez de restituer chaque bloc avant de le révéler (clic ou Entrée).</span>
          </div>
        )}
      </div>

      <article className="card">
        {sheet.sections.map((sec, i) => {
          const hideTitle = memo && level === 2 && !revealed.has(`t${i}`);
          const hideBody = memo && !revealed.has(`b${i}`);
          return (
            <section key={i} className={`section-block kind-${sec.kind}`}>
              <h3>
                <span className="badge">{KIND_LABELS[sec.kind] || sec.kind}</span>
                {hideTitle ? (
                  <button type="button" className="masked btn-link" style={{ width: 200, minHeight: 24 }} onClick={() => reveal(`t${i}`)} aria-label="Révéler le titre">…</button>
                ) : (
                  sec.title
                )}
              </h3>
              {hideBody ? (
                <button type="button" className="masked" style={{ width: '100%', border: 'none', display: 'block' }} onClick={() => reveal(`b${i}`)}>
                  <span className="sr-only">Révéler le contenu : {sec.title}</span>
                </button>
              ) : (
                <div className={sec.kind === 'formule' ? 'formula pre' : 'body'}>{sec.body}</div>
              )}
            </section>
          );
        })}
        {sheet.refs?.length > 0 && (
          <section className="mt">
            <h3>Références</h3>
            <ul className="small">{sheet.refs.map((r) => <li key={r}>{r}</li>)}</ul>
          </section>
        )}
      </article>

      <section className="card" aria-labelledby="notes">
        <div className="card-title">
          <h2 id="notes">Mes notes personnelles</h2>
          <span className="small muted" aria-live="polite">
            {noteState === 'pending' && 'Enregistrement…'}
            {noteState === 'saved' && 'Enregistré automatiquement'}
            {noteState === 'error' && <span className="field-error">Échec de l’enregistrement</span>}
            {noteState === 'idle' && data.note.updated_at && `Modifiée le ${fmtDate(data.note.updated_at)}`}
          </span>
        </div>
        <label htmlFor="note" className="sr-only">Notes personnelles</label>
        <textarea id="note" value={note} maxLength={10000} onChange={(e) => onNoteChange(e.target.value)} placeholder="Vos astuces, moyens mnémotechniques, questions à poser à l’enseignant…" />
      </section>

      <div className="row mt">
        <Link to={`/quiz?chapitre=${sheet.chapter_id}`} className="btn">S’entraîner sur ce chapitre</Link>
        <Link to="/flashcards" className="btn btn-ghost">Flashcards</Link>
      </div>
    </div>
  );
}
