import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TrainingPlan from './pages/TrainingPlan';
import Analytics from './pages/Analytics';
import RacePlanner from './pages/RacePlanner';
import WorkoutLibrary from './pages/WorkoutLibrary';
import CoachChat from './pages/CoachChat';
import Settings from './pages/Settings';
import LogMetrics from './pages/LogMetrics';
import Onboarding from './pages/Onboarding';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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

  // Render the main app
  return (
  <Routes>
    <Route path="/onboarding" element={<Onboarding />} />
    <Route element={<Layout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/plan" element={<TrainingPlan />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/race" element={<RacePlanner />} />
      <Route path="/library" element={<WorkoutLibrary />} />
      <Route path="/coach" element={<CoachChat />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/log" element={<LogMetrics />} />
      <Route path="*" element={<PageNotFound />} />
    </Route>
  </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App