import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { ImportProvider } from '@/lib/ImportContext'
import ImportProgressPill from '@/components/integrations/ImportProgressPill'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TrainingPlan from './pages/TrainingPlan';
import Analytics from './pages/Analytics';
import CoachChat from './pages/CoachChat';
import Settings from './pages/Settings';
import Today from './pages/Today';
import RaceHub from './pages/RaceHub';
import LogMetrics from './pages/LogMetrics';
import Integrations from './pages/Integrations';
import Nutrition from './pages/Nutrition';
import Strength from './pages/Strength';
import Recovery from './pages/Recovery';
import Journal from './pages/Journal';
import Onboarding from './pages/Onboarding';
import StravaCallback from './pages/StravaCallback';

const AuthenticatedApp = () => {
  const { currentUser, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Hard auth gate: no authenticated user means no access. Kick to the
  // Base44 login/signup flow rather than silently rendering the app.
  if (!isAuthenticated) {
    navigateToLogin();
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
  <Routes>
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/strava-callback" element={<StravaCallback />} />
    <Route element={<Layout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/today" element={<Today />} />
      <Route path="/plan" element={<TrainingPlan />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/coach" element={<CoachChat />} />
      <Route path="/race" element={<RaceHub />} />
      <Route path="/nutrition" element={<Nutrition />} />
      <Route path="/strength" element={<Strength />} />
      <Route path="/recovery" element={<Recovery />} />
      <Route path="/journal" element={<Journal />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/log" element={<LogMetrics />} />
      <Route path="/integrations" element={<Integrations />} />
      <Route path="*" element={<PageNotFound />} />
    </Route>
  </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ImportProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <ImportProgressPill />
        </ImportProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App