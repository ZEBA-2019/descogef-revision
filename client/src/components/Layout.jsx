import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import {
  IconHome, IconBook, IconSheet, IconQuiz, IconCase, IconCards, IconExam, IconCalendar, IconChart, IconSettings, IconAdmin, IconMenu, IconX,
} from './icons.jsx';

const NAV = [
  { to: '/tableau-de-bord', label: 'Accueil', icon: IconHome },
  { to: '/programme', label: 'Programme', icon: IconBook },
  { to: '/fiches', label: 'Fiches', icon: IconSheet },
  { to: '/quiz', label: 'Quiz', icon: IconQuiz },
  { to: '/cas-pratiques', label: 'Cas pratiques', icon: IconCase },
  { to: '/flashcards', label: 'Flashcards', icon: IconCards },
  { to: '/examens', label: 'Examens blancs', icon: IconExam },
  { to: '/planning', label: 'Planning', icon: IconCalendar },
  { to: '/statistiques', label: 'Statistiques', icon: IconChart },
];

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="22" height="22"><path d="M8 17l5 5 11-12" stroke="#16a34a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="app">
      <a href="#contenu" className="skip-link">Aller au contenu</a>
      <aside className={`sidebar${open ? ' open' : ''}`} id="menu-principal" aria-label="Menu principal">
        <div className="row-between">
          <Link to="/tableau-de-bord" className="brand">
            <BrandMark />
            <span>DESCOGEF<small>Révision</small></span>
          </Link>
          {open && (
            <button type="button" className="btn btn-sm btn-ghost" style={{ color: '#fff' }} onClick={() => setOpen(false)} aria-label="Fermer le menu">
              <IconX />
            </button>
          )}
        </div>
        <nav>
          <ul className="nav">
            {NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}><NavLink to={to}><Icon />{label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer stack">
          <ul className="nav">
            <li><NavLink to="/profil"><IconSettings />Profil et paramètres</NavLink></li>
            {user?.role === 'admin' && <li><NavLink to="/admin"><IconAdmin />Administration</NavLink></li>}
          </ul>
          <div className="row-between" style={{ padding: '0 12px' }}>
            <span className="small" style={{ color: '#d7e1f5', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</span>
            <button type="button" className="btn-link small" onClick={logout}>Déconnexion</button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Link to="/tableau-de-bord" className="brand"><BrandMark /><span>DESCOGEF</span></Link>
          <button type="button" className="btn btn-sm btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} aria-expanded={open} aria-controls="menu-principal" onClick={() => setOpen(true)}>
            <IconMenu /> Menu
          </button>
        </header>
        <main id="contenu" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
