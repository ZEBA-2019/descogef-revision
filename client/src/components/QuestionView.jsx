import { useId } from 'react';
import { TYPE_LABELS } from '../format.js';
import { DifficultyBadge } from './ui.jsx';
import { IconCheck, IconX } from './icons.jsx';

/** Indique si une réponse est suffisamment complète pour être validée. */
export function isAnswered(question, value) {
  if (value === undefined || value === null) return false;
  switch (question.type) {
    case 'mcq': return Array.isArray(value) ? value.length > 0 : value !== '';
    case 'truefalse': return typeof value === 'boolean';
    case 'short':
    case 'calc': return String(value).trim() !== '';
    case 'match': return Object.keys(value).length === question.match.left.length && Object.values(value).every((v) => v !== '' && v != null);
    default: return false;
  }
}

/**
 * Affiche une question et sa zone de réponse.
 * @param {object} props.question  question publique (sans réponse)
 * @param {*} props.value / props.onChange  réponse courante
 * @param {object} [props.correction]  si fourni, la question est verrouillée et corrigée
 */
export function QuestionView({ question, value, onChange, correction, showMeta = true, onSubmit }) {
  const uid = useId();
  const locked = Boolean(correction);
  const promptId = `${uid}-prompt`;

  let input = null;
  if (question.type === 'mcq') {
    const multiple = question.multiple;
    const selected = new Set((Array.isArray(value) ? value : value != null ? [value] : []).map(Number));
    input = (
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }} aria-labelledby={promptId}>
        <legend className="sr-only">{multiple ? 'Plusieurs réponses possibles' : 'Une seule réponse'}</legend>
        {multiple && !locked && <p className="hint">Plusieurs réponses sont attendues.</p>}
        <div className="stack">
          {question.choices.map((c) => {
            const corr = correction?.choices?.find((x) => x.id === c.id);
            const cls = corr ? (corr.isCorrect ? 'correct' : corr.selected ? 'wrong' : '') : '';
            return (
              <div key={c.id}>
                <label className={`option ${cls} ${locked ? 'disabled' : ''}`}>
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={`${uid}-choice`}
                    checked={selected.has(c.id)}
                    disabled={locked}
                    onChange={() => {
                      if (multiple) {
                        const next = new Set(selected);
                        next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                        onChange([...next]);
                      } else onChange(c.id);
                    }}
                  />
                  <span style={{ flex: 1 }}>{c.label}</span>
                  {corr?.isCorrect && <IconCheck aria-label="Bonne réponse" role="img" />}
                  {corr && !corr.isCorrect && corr.selected && <IconX aria-label="Réponse choisie, incorrecte" role="img" />}
                </label>
                {corr?.feedback && (corr.selected || corr.isCorrect) && <p className="small muted" style={{ margin: '4px 0 0 40px' }}>{corr.feedback}</p>}
              </div>
            );
          })}
        </div>
      </fieldset>
    );
  } else if (question.type === 'truefalse') {
    input = (
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }} aria-labelledby={promptId}>
        <legend className="sr-only">Vrai ou faux</legend>
        <div className="grid grid-2">
          {[true, false].map((v) => {
            const cls = correction ? (correction.expected === v ? 'correct' : value === v ? 'wrong' : '') : '';
            return (
              <label key={String(v)} className={`option ${cls} ${locked ? 'disabled' : ''}`}>
                <input type="radio" name={`${uid}-tf`} checked={value === v} disabled={locked} onChange={() => onChange(v)} />
                <span>{v ? 'Vrai' : 'Faux'}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  } else if (question.type === 'short' || question.type === 'calc') {
    const isCalc = question.type === 'calc';
    input = (
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        <label htmlFor={`${uid}-input`}>{isCalc ? `Votre résultat${question.unit ? ` (${question.unit})` : ''}` : 'Votre réponse'}</label>
        <input
          id={`${uid}-input`}
          type="text"
          inputMode={isCalc ? 'decimal' : 'text'}
          autoComplete="off"
          value={value ?? ''}
          disabled={locked}
          aria-invalid={correction ? !correction.correct : undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isCalc ? 'ex. 1 250 000 ou 12,5' : ''}
        />
        {isCalc && !locked && <span className="hint">Espaces, virgule ou point acceptés. Indiquez le signe « − » pour une valeur négative.</span>}
      </form>
    );
  } else if (question.type === 'match') {
    const current = value || {};
    input = (
      <div aria-labelledby={promptId} role="group">
        {question.match.left.map((left, i) => {
          const expected = correction?.expected?.find(([l]) => l === i)?.[1];
          const ok = correction ? Number(current[i]) === expected : null;
          return (
            <div className="match-row" key={i}>
              <label htmlFor={`${uid}-m${i}`} style={{ fontWeight: 600 }}>{left}</label>
              <div>
                <select
                  id={`${uid}-m${i}`}
                  value={current[i] ?? ''}
                  disabled={locked}
                  aria-invalid={correction ? !ok : undefined}
                  onChange={(e) => onChange({ ...current, [i]: e.target.value === '' ? '' : Number(e.target.value) })}
                >
                  <option value="">— Choisir —</option>
                  {question.match.right.map((r, j) => <option key={j} value={j}>{r}</option>)}
                </select>
                {correction && !ok && <span className="small field-error">Attendu : {question.match.right[expected]}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {showMeta && (
        <div className="row small muted mb" style={{ marginBottom: 10 }}>
          <span className="badge badge-blue">{TYPE_LABELS[question.type]}</span>
          <DifficultyBadge level={question.difficulty} />
          <span>{question.subjectTitle} · {question.chapterTitle}</span>
        </div>
      )}
      <p className="prompt" id={promptId}>{question.prompt}</p>
      {input}
      {correction && <CorrectionBox correction={correction} />}
    </div>
  );
}

export function CorrectionBox({ correction }) {
  const partial = !correction.correct && correction.score > 0;
  return (
    <div className={`feedback ${correction.correct ? 'ok' : 'ko'}`} role="status" aria-live="polite" tabIndex={-1}>
      <h3>{correction.correct ? 'Bonne réponse' : partial ? `Réponse partiellement juste (${Math.round(correction.score * 100)} %)` : 'Réponse incorrecte'}</h3>
      {!correction.correct && correction.expectedLabel && (
        <p><strong>Réponse attendue :</strong> {correction.expectedLabel}</p>
      )}
      {correction.explanation && <p style={{ margin: 0 }}><strong>Pourquoi :</strong> {correction.explanation}</p>}
    </div>
  );
}
