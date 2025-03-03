import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import './Navbar.css';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { forceShowWelcomeGuide } = useOnboarding();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const handleShowGuide = () => {
    forceShowWelcomeGuide();
  };

  // Helper function to check if a path is active
  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <i className="fas fa-building"></i> Infrastructure Tracking
        </Link>
        
        <div className="navbar-links">
          <Link to="/" className={`nav-link ${isActive('/')}`}>
            <i className="fas fa-home"></i> Home
          </Link>
          
          {currentUser && (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
                <i className="fas fa-tachometer-alt"></i> Dashboard
              </Link>
              <Link to="/compare" className={`nav-link ${isActive('/compare')}`}>
                <i className="fas fa-chart-bar"></i> Compare
              </Link>
              <Link to="/profile" className={`nav-link ${isActive('/profile')}`}>
                <i className="fas fa-user-circle"></i> Profile
              </Link>
              <button 
                onClick={handleShowGuide} 
                className="help-button"
                title="Show app guide"
              >
                <i className="fas fa-question-circle"></i>
                <span>Help</span>
              </button>
            </>
          )}
          
          <div className="action-area">
            <button 
              onClick={toggleTheme} 
              className="theme-toggle-button"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
              <span className="sr-only">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
            
            {currentUser && (
              <button 
                onClick={handleLogout} 
                className="logout-button"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt"></i>
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
