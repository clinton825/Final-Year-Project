import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Login from './components/auth/Login';
import SignUp from './components/auth/SignUp';
import ProjectDetails from './pages/ProjectDetails';
import ProjectComparison from './pages/ProjectComparison';
import ProjectUpdates from './pages/ProjectUpdates';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import OnboardingProvider, { useOnboarding } from './contexts/OnboardingContext';
import PreferencesProvider from './contexts/PreferencesContext';
import WelcomeGuide from './components/onboarding/WelcomeGuide';
import registerThemeOverride from './utils/applyThemeOverride';
import './App.css';

// Protected route component
const ProtectedRoute = ({ element }) => {
  const { currentUser } = useAuth();
  return currentUser ? element : <Navigate to="/login" />;
};

// Public route component that redirects if user is logged in
const PublicRoute = ({ element }) => {
  const { currentUser } = useAuth();
  return !currentUser ? element : <Navigate to="/dashboard" />;
};

const AppContent = () => {
  const { currentUser, loading } = useAuth();
  const { showWelcomeGuide } = useOnboarding();
  const { theme, themeReady } = useTheme();
  const location = window.location;
  
  // Determine if we should use compact footer for certain pages
  const isComparisonPage = location.pathname === '/compare';

  // Register theme override to ensure universal theming
  useEffect(() => {
    // Apply theme override when theme is ready
    if (themeReady) {
      const cleanupThemeOverride = registerThemeOverride();
      
      // Dispatch custom event to notify theme change
      const themeChangedEvent = new CustomEvent('themeChanged', { detail: { theme } });
      document.dispatchEvent(themeChangedEvent);
      
      return cleanupThemeOverride;
    }
  }, [theme, themeReady]);

  if (loading) {
    return <div className="loading-spinner theme-aware">Loading...</div>;
  }
  
  return (
    <div className="App theme-aware" data-theme={theme}>
      <Navbar />
      <main className="main-content theme-bg-primary">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<PublicRoute element={<Login />} />} />
          <Route path="/signup" element={<PublicRoute element={<SignUp />} />} />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} />} />
          <Route path="/projects" element={<ProtectedRoute element={<Projects />} />} />
          <Route path="/compare" element={<ProtectedRoute element={<ProjectComparison />} />} />
          <Route path="/project/:planning_id" element={<ProtectedRoute element={<ProjectDetails />} />} />
          <Route path="/updates" element={<ProtectedRoute element={<ProjectUpdates />} />} />
          <Route path="/profile" element={<ProtectedRoute element={<Profile />} />} />
          <Route path="/analytics" element={<ProtectedRoute element={<Analytics />} />} />
        </Routes>
      </main>
      <Footer compact={isComparisonPage} />
      
      {/* Welcome Guide */}
      {currentUser && showWelcomeGuide && <WelcomeGuide />}
    </div>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OnboardingProvider>
          <PreferencesProvider>
            <AppContent />
          </PreferencesProvider>
        </OnboardingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
