import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Login from './components/auth/Login';
import SignUp from './components/auth/SignUp';
import ProjectDetails from './pages/ProjectDetails';
import ProjectComparison from './pages/ProjectComparison';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import OnboardingProvider, { useOnboarding } from './contexts/OnboardingContext';
import PreferencesProvider from './contexts/PreferencesContext';
import WelcomeGuide from './components/onboarding/WelcomeGuide';
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
  const location = window.location;
  
  // Determine if we should use compact footer for certain pages
  const isComparisonPage = location.pathname === '/compare';

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }
  
  return (
    <div className="App">
      <Navbar />
      <main className="main-content">
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
