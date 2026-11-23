import { useState } from 'react';
import { patch, post, fieldErrors } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useDocumentTitle } from '../hooks.js';
import { Field, Segmented, ErrorBox, useToast } from '../components/ui.jsx';
import { applyTheme, currentTheme } from '../theme.js';
import { fmtDate } from '../format.js';

export default function Profile() {
  useDocumentTitle('Profil et paramètres');
  const { user, setUser, logout } = useAuth();
  const [toast, showToast] = useToast();
  const [profile, setProfile] = useState({ name: user.name, examDate: user.examDate || '' });
  const [profileErr, setProfileErr] = useState({});
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdErr, setPwdErr] = useState({});
  const [pwdError, setPwdError] = useState(null);
  const [theme, setTheme] = useState(user.settings?.theme || currentTheme());
  const [resetText, setResetText] = useState('');
  const [resetError, setResetError] = useState(null);

  async function saveProfile(e) {
    e.preventDefault();
    if (profile.name.trim().length < 2) return setProfileErr({ name: 'Le nom doit contenir au moins 2 caractères.' });
    setProfileErr({});
    try {
      const { user: u } = await patch('/auth/profile', { name: profile.name, examDate: profile.examDate || null });
      setUser(u);
      showToast('Profil enregistré');
    } catch (err) {
      setProfileErr({ ...fieldErrors(err), form: err.message });
    }
  }

  async function changeTheme(t) {
    setTheme(t);
    applyTheme(t);
    try {
      const { user: u } = await patch('/auth/profile', { settings: { theme: t } });
      setUser(u);
    } catch {
      /* le thème reste appliqué localement */
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    const errs = {};
    if (!pwd.current) errs.current = 'Saisissez votre mot de passe actuel.';
    if (pwd.next.length < 8 || !/[A-Za-z]/.test(pwd.next) || !/\d/.test(pwd.next)) errs.next = '8 caractères minimum, avec au moins une lettre et un chiffre.';
    if (pwd.confirm !== pwd.next) errs.confirm = 'Les mots de passe ne correspondent pas.';
    setPwdErr(errs);
    setPwdError(null);
    if (Object.keys(errs).length) return;
    try {
      await post('/auth/password', { current: pwd.current, next: pwd.next });
      setPwd({ current: '', next: '', confirm: '' });
      showToast('Mot de passe modifié');
    } catch (err) {
      setPwdError(err);
    }
  }

  async function resetProgress(e) {
    e.preventDefault();
    try {
      await post('/auth/reset-progress', { confirm: resetText });
      setUser({ ...user, diagnosticDone: false, levels: {} });
      setResetText('');
      showToast('Progression réinitialisée');
    } catch (err) {
      setResetError(err);
    }
  }

  return (
    <div style={{ maxWidth: 760 }} className="stack">
      {toast}
      <h1>Profil et paramètres</h1>
      <form className="card" onSubmit={saveProfile} noValidate>
        <h2>Mon profil</h2>
        <p className="small muted">{user.email} · inscrit le {fmtDate(user.createdAt)} · {user.role === 'admin' ? 'Administrateur' : 'Étudiant'}</p>
        <Field id="pname" label="Nom" error={profileErr.name}>
          <input id="pname" type="text" value={profile.name} aria-invalid={Boolean(profileErr.name)} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </Field>
        <Field id="pexam" label="Date prévue de l’examen" error={profileErr.examDate}>
          <input id="pexam" type="date" value={profile.examDate} onChange={(e) => setProfile({ ...profile, examDate: e.target.value })} style={{ maxWidth: 240 }} />
        </Field>
        {profileErr.form && <div className="alert alert-error" role="alert">{profileErr.form}</div>}
        <button className="btn">Enregistrer</button>
      </form>

      <section className="card">
        <h2>Apparence</h2>
        <Segmented label="Thème" value={theme} onChange={changeTheme} options={[{ value: 'clair', label: 'Clair' }, { value: 'sombre', label: 'Sombre' }, { value: 'systeme', label: 'Selon le système' }]} />
      </section>

      <form className="card" onSubmit={changePassword} noValidate>
        <h2>Mot de passe</h2>
        <Field id="cur" label="Mot de passe actuel" error={pwdErr.current}><input id="cur" type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></Field>
        <Field id="new" label="Nouveau mot de passe" error={pwdErr.next}><input id="new" type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></Field>
        <Field id="conf" label="Confirmer" error={pwdErr.confirm}><input id="conf" type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
        <ErrorBox error={pwdError} />
        <button className="btn">Changer le mot de passe</button>
      </form>

      <section className="card">
        <h2>Mes données</h2>
        <p className="small">Votre progression est sauvegardée automatiquement sur le serveur.</p>
        <div className="row">
          <a className="btn btn-ghost" href="/api/auth/export" download>Exporter mes données (JSON)</a>
          <button className="btn btn-ghost" onClick={logout}>Se déconnecter</button>
        </div>
        <form onSubmit={resetProgress} className="mt">
          <h3>Réinitialiser ma progression</h3>
          <p className="small muted">Supprime tentatives, statistiques, flashcards, planning, notes et favoris. Action irréversible.</p>
          <Field id="reset" label="Tapez REINITIALISER pour confirmer"><input id="reset" type="text" value={resetText} onChange={(e) => setResetText(e.target.value)} style={{ maxWidth: 260 }} /></Field>
          <ErrorBox error={resetError} />
          <button className="btn btn-danger" disabled={resetText !== 'REINITIALISER'}>Réinitialiser</button>
        </form>
      </section>
    </div>
  );
}
