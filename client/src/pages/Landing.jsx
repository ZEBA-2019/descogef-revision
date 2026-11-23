import { Link } from 'react-router-dom';
import { BrandMark } from '../components/Layout.jsx';
import { useDocumentTitle } from '../hooks.js';
import { IconSheet, IconQuiz, IconCards, IconExam, IconCalendar, IconChart, IconAlert } from '../components/icons.jsx';

const FEATURES = [
  { icon: IconSheet, title: 'Fiches structurées', text: 'Définitions, règles, formules, méthodes, exemples et erreurs fréquentes, avec un mode mémorisation.' },
  { icon: IconQuiz, title: 'Quiz corrigés', text: 'QCM, vrai/faux, calculs, associations : correction expliquée immédiatement après chaque réponse.' },
  { icon: IconCards, title: 'Répétition espacée', text: 'Les flashcards reviennent au bon moment, en priorité sur les notions fragiles.' },
  { icon: IconExam, title: 'Examens blancs', text: 'Sujets équilibrés, chronomètre, sauvegarde automatique et corrigé détaillé.' },
  { icon: IconCalendar, title: 'Planning réaliste', text: 'Un programme adapté à votre date d’examen et à vos disponibilités, réorganisé si vous manquez une séance.' },
  { icon: IconChart, title: 'Suivi des lacunes', text: 'Progression par matière et chapitre, erreurs récurrentes et prochaine activité recommandée.' },
];

export default function Landing() {
  useDocumentTitle('Accueil');
  return (
    <div className="public">
      <header className="public-header">
        <div className="inner">
          <Link to="/" className="brand" style={{ margin: 0 }}><BrandMark /><span>DESCOGEF<small>Révision</small></span></Link>
          <nav className="row" aria-label="Compte">
            <Link to="/connexion" className="btn btn-ghost btn-sm">Se connecter</Link>
            <Link to="/inscription" className="btn btn-accent btn-sm">Créer un compte</Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="inner">
            <p className="badge badge-green" style={{ marginBottom: 16 }}>Espace OHADA / UEMOA</p>
            <h1>Préparez le DESCOGEF avec méthode, à votre rythme.</h1>
            <p>Un diagnostic pour savoir où vous en êtes, des séances personnalisées pour progresser, des examens blancs pour vous entraîner dans les conditions de l’épreuve.</p>
            <div className="row mt">
              <Link to="/inscription" className="btn btn-accent">Commencer gratuitement</Link>
              <Link to="/connexion" className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>J’ai déjà un compte</Link>
            </div>
          </div>
        </section>
        <section className="landing-section" aria-labelledby="features">
          <h2 id="features">Tout pour réviser efficacement</h2>
          <div className="grid grid-3 mt">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div className="card feature" key={title}>
                <Icon />
                <h3 className="mt">{title}</h3>
                <p className="muted" style={{ margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="landing-section" aria-labelledby="parcours">
          <h2 id="parcours">Comment ça marche</h2>
          <ol className="grid grid-4 mt" style={{ paddingLeft: 18 }}>
            <li><strong>Inscrivez-vous</strong><br /><span className="muted">En moins d’une minute.</span></li>
            <li><strong>Faites le diagnostic</strong><br /><span className="muted">9 questions et votre niveau ressenti.</span></li>
            <li><strong>Suivez vos séances</strong><br /><span className="muted">« Réviser maintenant » choisit pour vous.</span></li>
            <li><strong>Mesurez vos progrès</strong><br /><span className="muted">Par matière, chapitre et compétence.</span></li>
          </ol>
          <div className="alert alert-warning demo-banner mt" role="note">
            <IconAlert />
            <div>Le contenu actuellement chargé est <strong>démonstratif</strong> : il doit être validé par un enseignant ou remplacé par le référentiel officiel du DESCOGEF.</div>
          </div>
        </section>
      </main>
      <footer className="footer">DESCOGEF Révision — outil d’entraînement indépendant, non affilié aux organismes certificateurs.</footer>
    </div>
  );
}
