import React, { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import ProjectComparison from './pages/ProjectComparison';
import ProjectDetails from './pages/ProjectDetails';
import Dashboard from './pages/Dashboard';
import Login from './components/auth/Login';
import SignUp from './components/auth/SignUp';
import LogoutModal from './components/auth/LogoutModal';
import ProtectedRoute from './components/auth/ProtectedRoute';
import './App.css';

function App() {
  const { currentUser, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      // Navigate will happen automatically due to auth state change
    } catch (error) {
      console.error('Failed to log out:', error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          Infrastructure Project Tracker
        </div>
        <div className="nav-links">
          <Link to="/">Home</Link>
          {currentUser ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/compare">Compare Projects</Link>
              <button onClick={handleLogoutClick} className="nav-button">
                <i className="fas fa-sign-out-alt"></i>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Sign Up</Link>
            </>
          )}
        </div>
      </nav>

      {showLogoutModal && (
        <LogoutModal
          onConfirm={handleLogoutConfirm}
          onCancel={handleLogoutCancel}
          isLoading={isLoggingOut}
        />
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={!currentUser ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/signup" element={!currentUser ? <SignUp /> : <Navigate to="/dashboard" />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compare"
          element={
            <ProtectedRoute>
              <ProjectComparison />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:planning_id"
          element={
            <ProtectedRoute>
              <ProjectDetails />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
