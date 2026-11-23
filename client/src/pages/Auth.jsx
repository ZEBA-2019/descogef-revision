import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { fieldErrors } from '../api.js';
import { Field } from '../components/ui.jsx';
import { BrandMark } from '../components/Layout.jsx';
import { useDocumentTitle } from '../hooks.js';

function Shell({ title, children }) {
  return (
    <div className="public">
      <header className="public-header">
        <div className="inner">
          <Link to="/" className="brand" style={{ margin: 0 }}><BrandMark /><span>DESCOGEF<small>Révision</small></span></Link>
        </div>
      </header>
      <main className="auth-wrap">
        <div className="card auth-card">
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  useDocumentTitle('Connexion');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Saisissez une adresse e-mail valide.';
    if (!form.password) errs.password = 'Saisissez votre mot de passe.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email, form.password);
      navigate(user.diagnosticDone ? location.state?.from || '/tableau-de-bord' : '/diagnostic', { replace: true });
    } catch (err) {
      setError(err.message);
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Connexion">
      <p className="muted">Heureux de vous revoir. Reprenez là où vous vous étiez arrêté.</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit} noValidate>
        <Field id="email" label="Adresse e-mail" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={form.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field id="password" label="Mot de passe" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" value={form.password} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn btn-block" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <p className="mt small">Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></p>
    </Shell>
  );
}

export function Register() {
  useDocumentTitle('Inscription');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', consent: false });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  function validateForm() {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Indiquez votre nom (2 caractères minimum).';
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Saisissez une adresse e-mail valide.';
    if (form.password.length < 8) errs.password = 'Au moins 8 caractères.';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'Utilisez au moins une lettre et un chiffre.';
    if (form.confirm !== form.password) errs.confirm = 'Les mots de passe ne correspondent pas.';
    if (!form.consent) errs.consent = 'Veuillez accepter les conditions d’utilisation.';
    return errs;
  }

  async function submit(e) {
    e.preventDefault();
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/diagnostic', { replace: true });
    } catch (err) {
      setError(err.message);
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  const describe = (k) => (errors[k] ? `${k}-error` : undefined);
  return (
    <Shell title="Créer un compte">
      <p className="muted">Ensuite, un court diagnostic personnalisera vos révisions.</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit} noValidate>
        <Field id="name" label="Nom complet" error={errors.name}>
          <input id="name" type="text" autoComplete="name" value={form.name} aria-invalid={Boolean(errors.name)} aria-describedby={describe('name')} onChange={set('name')} />
        </Field>
        <Field id="email" label="Adresse e-mail" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={form.email} aria-invalid={Boolean(errors.email)} aria-describedby={describe('email')} onChange={set('email')} />
        </Field>
        <Field id="password" label="Mot de passe" error={errors.password} hint="8 caractères minimum, dont au moins une lettre et un chiffre.">
          <input id="password" type="password" autoComplete="new-password" value={form.password} aria-invalid={Boolean(errors.password)} aria-describedby={describe('password') || 'password-hint'} onChange={set('password')} />
        </Field>
        <Field id="confirm" label="Confirmer le mot de passe" error={errors.confirm}>
          <input id="confirm" type="password" autoComplete="new-password" value={form.confirm} aria-invalid={Boolean(errors.confirm)} aria-describedby={describe('confirm')} onChange={set('confirm')} />
        </Field>
        <div className="field">
          <label className="row" style={{ fontWeight: 400, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={form.consent} onChange={set('consent')} aria-invalid={Boolean(errors.consent)} style={{ width: 18, height: 18, marginTop: 3 }} />
            <span>J’accepte que mes données de progression soient conservées pour personnaliser mes révisions.</span>
          </label>
          {errors.consent && <span className="field-error" role="alert">{errors.consent}</span>}
        </div>
        <button className="btn btn-accent btn-block" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
      </form>
      <p className="mt small">Déjà inscrit ? <Link to="/connexion">Se connecter</Link></p>
    </Shell>
  );
}
