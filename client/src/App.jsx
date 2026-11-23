import { Component, lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register } from './pages/Auth.jsx';

const Diagnostic = lazy(() => import('./pages/Diagnostic.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Program = lazy(() => import('./pages/Program.jsx'));
const Sheets = lazy(() => import('./pages/Sheets.jsx'));
const SheetPage = lazy(() => import('./pages/SheetPage.jsx'));
const QuizSetup = lazy(() => import('./pages/QuizSetup.jsx'));
const QuizPlay = lazy(() => import('./pages/QuizPlay.jsx'));
const Cases = lazy(() => import('./pages/Cases.jsx'));
const CasePlay = lazy(() => import('./pages/CasePlay.jsx'));
const Flashcards = lazy(() => import('./pages/Flashcards.jsx'));
const Exams = lazy(() => import('./pages/Exams.jsx'));
const ExamPlay = lazy(() => import('./pages/ExamPlay.jsx'));
const ExamReview = lazy(() => import('./pages/ExamReview.jsx'));
const Planning = lazy(() => import('./pages/Planning.jsx'));
const Stats = lazy(() => import('./pages/Stats.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="alert alert-error" role="alert">
          <p><strong>Un problème d’affichage est survenu.</strong> Votre progression est sauvegardée.</p>
          <button className="btn btn-sm" onClick={() => location.reload()}>Recharger la page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RequireAuth({ children, admin }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <div className="content"><Loading /></div>;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/tableau-de-bord" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <div className="content"><Loading /></div>;
  if (user) return <Navigate to={user.diagnosticDone ? '/tableau-de-bord' : '/diagnostic'} replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="content"><Loading /></div>}>
        <Routes>
          <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
          <Route path="/connexion" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/inscription" element={<PublicOnly><Register /></PublicOnly>} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/diagnostic" element={<Diagnostic />} />
            <Route path="/tableau-de-bord" element={<Dashboard />} />
            <Route path="/programme" element={<Program />} />
            <Route path="/fiches" element={<Sheets />} />
            <Route path="/fiches/:id" element={<SheetPage />} />
            <Route path="/quiz" element={<QuizSetup />} />
            <Route path="/quiz/:id" element={<QuizPlay />} />
            <Route path="/cas-pratiques" element={<Cases />} />
            <Route path="/cas-pratiques/:id" element={<CasePlay />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/examens" element={<Exams />} />
            <Route path="/examens/tentative/:id" element={<ExamPlay />} />
            <Route path="/examens/corrige/:id" element={<ExamReview />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/statistiques" element={<Stats />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          </Route>
          <Route path="*" element={<div className="content"><h1>Page introuvable</h1><a href="/">Retour à l’accueil</a></div>} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
