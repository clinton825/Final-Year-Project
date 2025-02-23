import React, { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import Home from './pages/Home';
import ProjectComparison from './pages/ProjectComparison';
import ProjectDetails from './pages/ProjectDetails';
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

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setShowLogoutModal(false);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <UserProvider>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-content">
            <Link to="/" className="nav-brand">
              <i className="fas fa-building-columns"></i>
              Infrastructure Project Tracker
            </Link>
            <div className="nav-links">
              <Link to="/">
                <i className="fas fa-home"></i> Home
              </Link>
              {currentUser ? (
                <>
                  <Link to="/compare">
                    <i className="fas fa-chart-bar"></i> Compare Projects
                  </Link>
                  <button onClick={handleLogoutClick} className="nav-button">
                    <i className="fas fa-sign-out-alt"></i>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <i className="fas fa-sign-in-alt"></i> Login
                  </Link>
                  <Link to="/signup">
                    <i className="fas fa-user-plus"></i> Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {showLogoutModal && (
          <LogoutModal
            onConfirm={handleLogoutConfirm}
            onCancel={handleLogoutCancel}
            isLoading={isLoggingOut}
          />
        )}

        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={!currentUser ? <Login /> : <Navigate to="/" />} />
            <Route path="/signup" element={!currentUser ? <SignUp /> : <Navigate to="/" />} />
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
        </main>
      </div>
    </UserProvider>
  );
}

export default App;
