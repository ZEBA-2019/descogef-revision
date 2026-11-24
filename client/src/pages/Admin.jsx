import { useEffect, useMemo, useState } from 'react';
import { get, post, put, del } from '../api.js';
import { useFetch, useDocumentTitle } from '../hooks.js';
import { ErrorBox, Loading, Empty, useToast } from '../components/ui.jsx';
import { TYPE_LABELS, DIFFICULTY_LABELS } from '../format.js';

/**
 * Espace d'administration des contenus.
 * Chaque entité dispose d'un formulaire dédié ; la validation finale est faite par le serveur.
 */
const TABS = [
  { key: 'subjects', label: 'Matières' },
  { key: 'chapters', label: 'Chapitres' },
  { key: 'lessons', label: 'Leçons' },
  { key: 'sheets', label: 'Fiches' },
  { key: 'questions', label: 'Questions' },
  { key: 'exercises', label: 'Exercices / cas' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'exams', label: 'Examens blancs' },
];
const SECTION_KINDS = { definition: 'Définition', regle: 'Règle', formule: 'Formule', methode: 'Méthode', exemple: 'Exemple', erreur: 'Erreurs fréquentes' };

const EMPTY = {
  subjects: { code: '', title: '', description: '', is_demo: false },
  chapters: { subject_id: '', title: '', description: '', is_demo: false },
  lessons: { chapter_id: '', title: '', content: '', is_demo: false },
  sheets: { chapter_id: '', title: '', summary: '', sections: [{ kind: 'definition', title: '', body: '' }], refs: [], is_demo: false },
  questions: { chapter_id: '', type: 'mcq', prompt: '', difficulty: 1, competency: '', explanation: '', answer: {}, is_diagnostic: false, is_demo: false, choices: [{ label: '', is_correct: true, feedback: '' }, { label: '', is_correct: false, feedback: '' }] },
  exercises: { chapter_id: '', kind: 'cas', title: '', statement: '', annexes: [], items: [{ prompt: '', hints: [], solution: '', points: 5, criteria: [] }], duration_min: 60, difficulty: 2, is_demo: false },
  flashcards: { chapter_id: '', front: '', back: '', is_demo: false },
  exams: { title: '', description: '', duration_min: 60, config: { perSubject: 4, difficultyMix: { 1: 2, 2: 1, 3: 1 } }, is_demo: false },
};

function itemLabel(entity, it) {
  switch (entity) {
    case 'subjects': return `${it.code} — ${it.title}`;
    case 'flashcards': return it.front;
    case 'questions': return `[${TYPE_LABELS[it.type]} · ${DIFFICULTY_LABELS[it.difficulty]}] ${it.prompt}`;
    default: return it.title;
  }
}

export default function Admin() {
  useDocumentTitle('Administration');
  const [tab, setTab] = useState('questions');
  const { data: overview, reload: reloadOverview } = useFetch('/admin/overview');
  const { data: subjects } = useFetch('/admin/subjects', [tab]);
  const { data: chapters } = useFetch('/admin/chapters', [tab]);
  const [parent, setParent] = useState('');
  const listPath = tab === 'import' ? null : `/admin/${tab}${parent && tab !== 'subjects' && tab !== 'exams' ? `?parent=${parent}` : ''}`;
  const { data, error, loading, reload } = useFetch(listPath);
  const [editing, setEditing] = useState(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    setParent('');
    setEditing(null);
  }, [tab]);

  const chapterOptions = useMemo(
    () => (chapters?.items || []).map((c) => ({ id: c.id, label: `${subjects?.items.find((s) => s.id === c.subject_id)?.code ?? ''} · ${c.title}` })),
    [chapters, subjects]
  );
  const parentOptions = tab === 'chapters' ? (subjects?.items || []).map((s) => ({ id: s.id, label: s.title })) : chapterOptions;
  const hasParent = !['subjects', 'exams'].includes(tab);

  async function move(it, direction) {
    try {
      await post(`/admin/${tab}/${it.id}/move`, { direction });
      reload();
    } catch (e) {
      showToast(e.message);
    }
  }
  async function remove(it) {
    const warn = tab === 'subjects' || tab === 'chapters' ? '\nAttention : tous les contenus rattachés seront supprimés.' : '';
    if (!confirm(`Supprimer « ${itemLabel(tab, it).slice(0, 80)} » ?${warn}`)) return;
    try {
      await del(`/admin/${tab}/${it.id}`);
      showToast('Élément supprimé');
      reload();
      reloadOverview();
    } catch (e) {
      showToast(e.message);
    }
  }

  return (
    <div>
      {toast}
      <div className="page-header">
        <div>
          <h1>Administration des contenus</h1>
          <p>Créez, modifiez et classez les matières, chapitres, fiches, questions, exercices et références.</p>
        </div>
      </div>
      {overview && overview.counts.demo > 0 && (
        <div className="alert alert-warning small" role="note">
          {overview.counts.demo} élément(s) sont marqués « démonstration ». Remplacez-les par le référentiel officiel validé, puis décochez « Contenu de démonstration ».
        </div>
      )}
      <div className="segmented mb" role="tablist" aria-label="Type de contenu">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}{overview ? ` (${overview.counts[t.key]})` : ''}
          </button>
        ))}
        <button type="button" role="tab" aria-selected={tab === 'import'} aria-pressed={tab === 'import'} onClick={() => setTab('import')}>
          ⬆ Importer
        </button>
      </div>

      {tab === 'import' ? (
        <ImportPanel onImported={() => { reloadOverview(); showToast('Import terminé'); }} />
      ) : editing ? (
        <EntityForm
          entity={tab}
          initial={editing}
          subjects={subjects?.items || []}
          chapterOptions={chapterOptions}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            showToast('Enregistré');
            reload();
            reloadOverview();
          }}
        />
      ) : (
        <div className="card">
          <div className="row-between mb">
            {hasParent ? (
              <div className="field" style={{ margin: 0, minWidth: 260 }}>
                <label htmlFor="parent" className="small">{tab === 'chapters' ? 'Matière' : 'Chapitre'}</label>
                <select id="parent" value={parent} onChange={(e) => setParent(e.target.value)}>
                  <option value="">Tous</option>
                  {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            ) : <span />}
            <button className="btn btn-accent" onClick={() => setEditing({ ...structuredClone(EMPTY[tab]), ...(parent && hasParent ? { [tab === 'chapters' ? 'subject_id' : 'chapter_id']: Number(parent) } : {}) })}>+ Ajouter</button>
          </div>
          {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data.items.length ? (
            <Empty title="Aucun élément" />
          ) : (
            <ul className="list">
              {data.items.map((it, i) => (
                <li key={it.id} className="row-between">
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div>{itemLabel(tab, it).slice(0, 160)}</div>
                    <div className="row small">
                      {it.is_demo ? <span className="badge badge-amber">Démo</span> : <span className="badge badge-green">Validé</span>}
                      {it.is_diagnostic ? <span className="badge badge-blue">Diagnostic</span> : null}
                      {it.chapter_id && <span className="muted">{chapterOptions.find((c) => c.id === it.chapter_id)?.label}</span>}
                    </div>
                  </div>
                  <div className="row">
                    {tab !== 'exams' && (
                      <>
                        <button className="btn btn-sm btn-ghost" onClick={() => move(it, 'up')} disabled={i === 0} aria-label="Monter">↑</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => move(it, 'down')} disabled={i === data.items.length - 1} aria-label="Descendre">↓</button>
                      </>
                    )}
                    <button className="btn btn-sm btn-ghost" onClick={async () => setEditing((await get(`/admin/${tab}/${it.id}`)).item)}>Modifier</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => remove(it)}>Supprimer</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {parent && hasParent && <p className="small muted mt">Le classement (↑ ↓) s’applique au sein du parent sélectionné.</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Formulaires ------------------------------ */

function TextInput({ id, label, value, onChange, textarea, rows, ...rest }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {textarea ? <textarea id={id} rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} /> : <input id={id} type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />}
    </div>
  );
}

function ChapterSelect({ value, onChange, options }) {
  return (
    <div className="field">
      <label htmlFor="f-chapter">Chapitre</label>
      <select id="f-chapter" value={value || ''} onChange={(e) => onChange(Number(e.target.value))} required>
        <option value="">— Choisir —</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Éditeur JSON avec validation de syntaxe (pour les structures avancées). */
function JsonEditor({ id, label, value, onChange, hint }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [err, setErr] = useState(null);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={10}
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
        value={text}
        aria-invalid={Boolean(err)}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setErr(null);
          } catch {
            setErr('JSON invalide : vérifiez les guillemets, virgules et crochets.');
          }
        }}
      />
      {hint && <span className="hint">{hint}</span>}
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}

function EntityForm({ entity, initial, subjects, chapterOptions, onCancel, onSaved }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...f };
      for (const k of ['id', 'position', 'created_at']) delete body[k];
      if (entity === 'questions') Object.assign(body, buildAnswer(f));
      if (f.id) await put(`/admin/${entity}/${f.id}`, body);
      else await post(`/admin/${entity}`, body);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>{f.id ? 'Modifier' : 'Ajouter'} — {TABS.find((t) => t.key === entity).label}</h2>

      {entity === 'subjects' && (
        <>
          <TextInput id="f-code" label="Code (ex. CF)" value={f.code} onChange={set('code')} maxLength={20} />
          <TextInput id="f-title" label="Intitulé" value={f.title} onChange={set('title')} />
          <TextInput id="f-desc" label="Description" value={f.description} onChange={set('description')} textarea rows={3} />
        </>
      )}
      {entity === 'chapters' && (
        <>
          <div className="field">
            <label htmlFor="f-subject">Matière</label>
            <select id="f-subject" value={f.subject_id || ''} onChange={(e) => set('subject_id')(Number(e.target.value))}>
              <option value="">— Choisir —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <TextInput id="f-title" label="Intitulé" value={f.title} onChange={set('title')} />
          <TextInput id="f-desc" label="Description" value={f.description} onChange={set('description')} textarea rows={3} />
        </>
      )}
      {entity === 'lessons' && (
        <>
          <ChapterSelect value={f.chapter_id} onChange={set('chapter_id')} options={chapterOptions} />
          <TextInput id="f-title" label="Titre" value={f.title} onChange={set('title')} />
          <TextInput id="f-content" label="Contenu" value={f.content} onChange={set('content')} textarea rows={10} />
        </>
      )}
      {entity === 'flashcards' && (
        <>
          <ChapterSelect value={f.chapter_id} onChange={set('chapter_id')} options={chapterOptions} />
          <TextInput id="f-front" label="Recto (question)" value={f.front} onChange={set('front')} textarea rows={3} />
          <TextInput id="f-back" label="Verso (réponse)" value={f.back} onChange={set('back')} textarea rows={4} />
        </>
      )}
      {entity === 'sheets' && <SheetFields f={f} set={set} chapterOptions={chapterOptions} />}
      {entity === 'questions' && <QuestionFields f={f} setF={setF} set={set} chapterOptions={chapterOptions} />}
      {entity === 'exercises' && (
        <>
          <ChapterSelect value={f.chapter_id} onChange={set('chapter_id')} options={chapterOptions} />
          <div className="grid grid-3">
            <div className="field"><label htmlFor="f-kind">Type</label><select id="f-kind" value={f.kind} onChange={(e) => set('kind')(e.target.value)}><option value="cas">Cas pratique</option><option value="exercice">Exercice</option></select></div>
            <div className="field"><label htmlFor="f-dur">Durée (min)</label><input id="f-dur" type="number" min="5" max="480" value={f.duration_min} onChange={(e) => set('duration_min')(Number(e.target.value))} /></div>
            <div className="field"><label htmlFor="f-diff">Difficulté</label><select id="f-diff" value={f.difficulty} onChange={(e) => set('difficulty')(Number(e.target.value))}>{[1, 2, 3].map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}</select></div>
          </div>
          <TextInput id="f-title" label="Titre" value={f.title} onChange={set('title')} />
          <TextInput id="f-statement" label="Énoncé" value={f.statement} onChange={set('statement')} textarea rows={6} />
          <JsonEditor id="f-annexes" label="Annexes (JSON)" value={f.annexes} onChange={set('annexes')} hint='Liste de { "title": "...", "body": "..." } ou { "title": "...", "table": { "head": [...], "rows": [[...]] } }' />
          <JsonEditor id="f-items" label="Questions, indices, corrigé et barème (JSON)" value={f.items} onChange={set('items')} hint='Liste de { "prompt", "hints": [...], "solution", "points", "criteria": [...] }' />
        </>
      )}
      {entity === 'exams' && (
        <>
          <TextInput id="f-title" label="Titre" value={f.title} onChange={set('title')} />
          <TextInput id="f-desc" label="Description" value={f.description} onChange={set('description')} textarea rows={3} />
          <div className="grid grid-4">
            <div className="field"><label htmlFor="f-dur">Durée (min)</label><input id="f-dur" type="number" min="5" value={f.duration_min} onChange={(e) => set('duration_min')(Number(e.target.value))} /></div>
            <div className="field"><label htmlFor="f-per">Questions / matière</label><input id="f-per" type="number" min="1" value={f.config.perSubject} onChange={(e) => set('config')({ ...f.config, perSubject: Number(e.target.value) })} /></div>
            {[1, 2, 3].map((d) => (
              <div className="field" key={d}><label htmlFor={`f-mix${d}`}>dont {DIFFICULTY_LABELS[d].toLowerCase()}</label><input id={`f-mix${d}`} type="number" min="0" value={f.config.difficultyMix?.[d] ?? 0} onChange={(e) => set('config')({ ...f.config, difficultyMix: { ...f.config.difficultyMix, [d]: Number(e.target.value) } })} /></div>
            ))}
          </div>
        </>
      )}

      <label className="row mb">
        <input type="checkbox" checked={Boolean(f.is_demo)} onChange={(e) => set('is_demo')(e.target.checked)} />
        <span>Contenu de démonstration (non validé par un enseignant)</span>
      </label>
      <ErrorBox error={error} />
      {error?.details?.length > 1 && <ul className="small field-error">{error.details.map((d, i) => <li key={i}>{d.field ? `${d.field} : ` : ''}{d.message}</li>)}</ul>}
      <div className="row">
        <button className="btn btn-accent" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function SheetFields({ f, set, chapterOptions }) {
  const sections = f.sections || [];
  const update = (i, patch) => set('sections')(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const moveSection = (i, d) => {
    const next = [...sections];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set('sections')(next);
  };
  return (
    <>
      <ChapterSelect value={f.chapter_id} onChange={set('chapter_id')} options={chapterOptions} />
      <TextInput id="f-title" label="Titre" value={f.title} onChange={set('title')} />
      <TextInput id="f-summary" label="Résumé" value={f.summary} onChange={set('summary')} textarea rows={2} />
      <h3>Sections</h3>
      {sections.map((s, i) => (
        <fieldset key={i}>
          <legend>Section {i + 1}</legend>
          <div className="grid grid-2">
            <div className="field"><label htmlFor={`sk${i}`}>Type</label><select id={`sk${i}`} value={s.kind} onChange={(e) => update(i, { kind: e.target.value })}>{Object.entries(SECTION_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <TextInput id={`st${i}`} label="Titre" value={s.title} onChange={(v) => update(i, { title: v })} />
          </div>
          <TextInput id={`sb${i}`} label="Contenu" value={s.body} onChange={(v) => update(i, { body: v })} textarea rows={4} />
          <div className="row">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => moveSection(i, -1)}>↑</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => moveSection(i, 1)}>↓</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => set('sections')(sections.filter((_, j) => j !== i))}>Retirer</button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn btn-sm btn-ghost mb" onClick={() => set('sections')([...sections, { kind: 'definition', title: '', body: '' }])}>+ Ajouter une section</button>
      <TextInput id="f-refs" label="Références (une par ligne)" value={(f.refs || []).join('\n')} onChange={(v) => set('refs')(v.split('\n').map((x) => x.trim()).filter(Boolean))} textarea rows={3} />
    </>
  );
}

/** Transforme les champs du formulaire en { answer, choices } attendus par l'API. */
function buildAnswer(f) {
  const a = f.answer || {};
  switch (f.type) {
    case 'mcq': return { answer: {}, choices: f.choices };
    case 'truefalse': return { answer: { value: a.value === true || a.value === 'true' }, choices: [] };
    case 'short': return { answer: { accepted: a.accepted || [] }, choices: [] };
    case 'calc': return { answer: { value: Number(String(a.value ?? '').replace(',', '.')), tolerance: Number(a.tolerance || 0), relTolerance: Number(a.relTolerance || 0) || undefined, unit: a.unit || '' }, choices: [] };
    case 'match': return { answer: { left: a.left || [], right: a.right || [], pairs: a.pairs || [] }, choices: [] };
    default: return {};
  }
}

function QuestionFields({ f, setF, set, chapterOptions }) {
  const a = f.answer || {};
  const setA = (patch) => setF((x) => ({ ...x, answer: { ...x.answer, ...patch } }));
  // Associations saisies sous la forme « gauche => droite »
  const matchText = (a.pairs || []).map(([l, r]) => `${a.left?.[l] ?? ''} => ${a.right?.[r] ?? ''}`).join('\n');
  const parseMatch = (text) => {
    const lines = text.split('\n').map((l) => l.split('=>').map((x) => x.trim())).filter((p) => p.length === 2 && p[0] && p[1]);
    const left = lines.map((p) => p[0]);
    const right = [...new Set(lines.map((p) => p[1]))].sort((x, y) => x.localeCompare(y, 'fr'));
    setA({ left, right, pairs: lines.map((p, i) => [i, right.indexOf(p[1])]) });
  };
  const [matchDraft, setMatchDraft] = useState(matchText);

  return (
    <>
      <ChapterSelect value={f.chapter_id} onChange={set('chapter_id')} options={chapterOptions} />
      <div className="grid grid-3">
        <div className="field"><label htmlFor="f-type">Type</label><select id="f-type" value={f.type} onChange={(e) => setF((x) => ({ ...x, type: e.target.value, answer: {} }))}>{Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="field"><label htmlFor="f-diff">Difficulté</label><select id="f-diff" value={f.difficulty} onChange={(e) => set('difficulty')(Number(e.target.value))}>{[1, 2, 3].map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}</select></div>
        <TextInput id="f-comp" label="Compétence" value={f.competency} onChange={set('competency')} placeholder="ex. Seuil de rentabilité" />
      </div>
      <TextInput id="f-prompt" label="Énoncé" value={f.prompt} onChange={set('prompt')} textarea rows={3} />

      {f.type === 'mcq' && (
        <fieldset>
          <legend>Choix de réponse (cochez la ou les bonnes réponses)</legend>
          {f.choices.map((c, i) => (
            <div key={i} className="grid grid-2" style={{ alignItems: 'end', marginBottom: 8 }}>
              <div className="row" style={{ alignItems: 'end' }}>
                <input type="checkbox" aria-label={`Choix ${i + 1} correct`} checked={Boolean(c.is_correct)} onChange={(e) => set('choices')(f.choices.map((x, j) => (j === i ? { ...x, is_correct: e.target.checked } : x)))} style={{ width: 20, height: 20, marginBottom: 12 }} />
                <div style={{ flex: 1 }}><TextInput id={`c${i}`} label={`Choix ${i + 1}`} value={c.label} onChange={(v) => set('choices')(f.choices.map((x, j) => (j === i ? { ...x, label: v } : x)))} /></div>
              </div>
              <div className="row" style={{ alignItems: 'end' }}>
                <div style={{ flex: 1 }}><TextInput id={`cf${i}`} label="Explication si choisi (facultatif)" value={c.feedback} onChange={(v) => set('choices')(f.choices.map((x, j) => (j === i ? { ...x, feedback: v } : x)))} /></div>
                <button type="button" className="btn btn-sm btn-ghost" style={{ marginBottom: 14 }} onClick={() => set('choices')(f.choices.filter((_, j) => j !== i))} aria-label={`Retirer le choix ${i + 1}`}>✕</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => set('choices')([...f.choices, { label: '', is_correct: false, feedback: '' }])}>+ Ajouter un choix</button>
        </fieldset>
      )}
      {f.type === 'truefalse' && (
        <div className="field"><label htmlFor="f-tf">Bonne réponse</label><select id="f-tf" value={String(a.value ?? '')} onChange={(e) => setA({ value: e.target.value === 'true' })} style={{ maxWidth: 200 }}><option value="">— Choisir —</option><option value="true">Vrai</option><option value="false">Faux</option></select></div>
      )}
      {f.type === 'short' && (
        <TextInput id="f-acc" label="Réponses acceptées (une par ligne ; casse et accents ignorés)" value={(a.accepted || []).join('\n')} onChange={(v) => setA({ accepted: v.split('\n').map((x) => x.trim()).filter(Boolean) })} textarea rows={3} />
      )}
      {f.type === 'calc' && (
        <div className="grid grid-4">
          <TextInput id="f-val" label="Valeur attendue" value={a.value ?? ''} onChange={(v) => setA({ value: v })} inputMode="decimal" />
          <TextInput id="f-tol" label="Tolérance absolue" value={a.tolerance ?? ''} onChange={(v) => setA({ tolerance: v })} inputMode="decimal" />
          <TextInput id="f-rtol" label="Tolérance relative (ex. 0,01)" value={a.relTolerance ?? ''} onChange={(v) => setA({ relTolerance: v.replace(',', '.') })} inputMode="decimal" />
          <TextInput id="f-unit" label="Unité" value={a.unit ?? ''} onChange={(v) => setA({ unit: v })} />
        </div>
      )}
      {f.type === 'match' && (
        <div className="field">
          <label htmlFor="f-match">Paires (une par ligne, au format « élément {"=>"} correspondance »)</label>
          <textarea id="f-match" rows={5} value={matchDraft} onChange={(e) => { setMatchDraft(e.target.value); parseMatch(e.target.value); }} placeholder={'Classe 1 => Ressources durables\nClasse 2 => Actif immobilisé'} />
        </div>
      )}
      <TextInput id="f-expl" label="Explication (affichée après la réponse)" value={f.explanation} onChange={set('explanation')} textarea rows={3} />
      <label className="row mb">
        <input type="checkbox" checked={Boolean(f.is_diagnostic)} onChange={(e) => set('is_diagnostic')(e.target.checked)} />
        <span>Utiliser dans le diagnostic initial</span>
      </label>
    </>
  );
}

/* ------------------------------ Import JSON ------------------------------ */

const SUMMARY_LABELS = {
  matieres: 'Matières', chapitres: 'Chapitres', lecons: 'Leçons', fiches: 'Fiches', questions: 'Questions',
  questionsDiagnostic: 'dont diagnostic', casPratiques: 'Cas pratiques', flashcards: 'Flashcards', examens: 'Examens blancs',
};

function ImportPanel({ onImported }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('ajouter');
  const [isDemo, setIsDemo] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  function parse() {
    try {
      return { content: JSON.parse(text.trim().replace(/^```(json)?|```$/g, '')) };
    } catch (e) {
      return { error: `JSON illisible : ${e.message}` };
    }
  }

  async function submit(m) {
    const { content, error } = parse();
    if (error) return setResult({ ok: false, errors: [error] });
    setBusy(true);
    setResult(null);
    try {
      const r = await post('/admin/import', { mode: m, isDemo, content, confirm: confirmText });
      setResult(r);
      if (r.imported) {
        onImported();
        setConfirmText('');
      }
    } catch (e) {
      setResult({ ok: false, errors: e.details?.length ? e.details.map((d) => d.message) : [e.message] });
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return setResult({ ok: false, errors: ['Fichier trop volumineux (4 Mo maximum) : découpez-le par matière.'] });
    setText(await file.text());
    setResult(null);
  }

  // Erreurs renvoyées par le serveur : tableau `errors` (validation du contenu)
  const errors = result && !result.ok ? result.errors || [result.error] : [];

  return (
    <div className="card">
      <h2>Importer un référentiel (JSON)</h2>
      <p className="small muted">
        Format décrit dans <code>docs/import-format.md</code> du dépôt (avec une consigne prête à coller dans NotebookLM) ;
        modèle : <code>docs/modele-import.json</code>. Importez de préférence une matière ou un chapitre à la fois.
      </p>
      <div className="field">
        <label htmlFor="imp-file">Fichier JSON</label>
        <input id="imp-file" type="file" accept=".json,application/json" onChange={(e) => loadFile(e.target.files?.[0])} />
      </div>
      <div className="field">
        <label htmlFor="imp-text">… ou collez le JSON (par exemple la réponse de NotebookLM)</label>
        <textarea id="imp-text" rows={12} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} placeholder='{"subjects": [ … ], "questions": [ … ] }' />
      </div>
      <fieldset>
        <legend>Mode d’import</legend>
        <label className="row"><input type="radio" name="imp-mode" checked={mode === 'ajouter'} onChange={() => setMode('ajouter')} /> <span><strong>Ajouter</strong> au contenu existant (une matière au même code est complétée)</span></label>
        <label className="row mt"><input type="radio" name="imp-mode" checked={mode === 'remplacer'} onChange={() => setMode('remplacer')} /> <span><strong>Remplacer</strong> tout le contenu (supprime aussi la démonstration et la progression des étudiants)</span></label>
        {mode === 'remplacer' && (
          <div className="field mt" style={{ maxWidth: 320 }}>
            <label htmlFor="imp-confirm">Tapez REMPLACER pour confirmer</label>
            <input id="imp-confirm" type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
        )}
      </fieldset>
      <label className="row mb"><input type="checkbox" checked={isDemo} onChange={(e) => setIsDemo(e.target.checked)} /> <span>Marquer ce contenu comme « démonstration » (non encore validé par un enseignant)</span></label>

      {errors.length > 0 && (
        <div className="alert alert-error" role="alert">
          <strong>Le contenu n’a pas été importé :</strong>
          <ul className="small" style={{ margin: '6px 0 0' }}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {result?.ok && (
        <div className={`alert ${result.imported ? 'alert-success' : 'alert-info'}`} role="status">
          <strong>{result.imported ? 'Import réussi.' : 'Fichier valide — rien n’a encore été importé.'}</strong>
          <div className="row small mt">
            {Object.entries(result.summary).map(([k, v]) => <span key={k} className="badge">{SUMMARY_LABELS[k] || k} : {v}</span>)}
          </div>
        </div>
      )}
      <div className="row">
        <button className="btn btn-ghost" disabled={busy || !text.trim()} onClick={() => submit('verifier')}>Vérifier</button>
        <button className="btn btn-accent" disabled={busy || !text.trim() || (mode === 'remplacer' && confirmText !== 'REMPLACER')} onClick={() => submit(mode)}>
          {busy ? 'Import…' : mode === 'remplacer' ? 'Remplacer le contenu' : 'Importer'}
        </button>
      </div>
    </div>
  );
}
