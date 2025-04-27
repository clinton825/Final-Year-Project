import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import logoImage from '../assets/logo.svg';
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

  // Apply theme class to ensure navbar follows theme consistently
  useEffect(() => {
    // This runs whenever theme changes
    const navElement = document.querySelector('.navbar');
    if (navElement) {
      navElement.setAttribute('data-theme', theme);
      navElement.classList.add('theme-aware');
    }
  }, [theme]);

  return (
    <nav className={`navbar theme-aware`} data-theme={theme}>
      <div className="navbar-content">
        <Link to="/" className="navbar-brand theme-text-primary">
          <img src={logoImage} alt="Infrastructure Tracking" className="navbar-logo" />
          <span className="navbar-brand-text">Infrastructure Tracking</span>
        </Link>
        
        <div className="navbar-links theme-aware">
          {!currentUser && (
            <Link to="/" className={`nav-link ${isActive('/')}`}>
              <i className="fas fa-home"></i> Home
            </Link>
          )}
          
          {currentUser && (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
                <i className="fas fa-tachometer-alt"></i> Dashboard
              </Link>
              <Link to="/projects" className={`nav-link ${isActive('/projects')}`}>
                <i className="fas fa-project-diagram"></i> Projects
              </Link>
              <Link to="/updates" className={`nav-link ${isActive('/updates')}`}>
                <i className="fas fa-bell"></i> Updates
              </Link>
              <Link to="/analytics" className={`nav-link ${isActive('/analytics')}`}>
                <i className="fas fa-chart-pie"></i> Analytics
              </Link>
              <Link to="/compare" className={`nav-link ${isActive('/compare')}`}>
                <i className="fas fa-chart-bar"></i> Compare
              </Link>
              <Link to="/profile" className={`nav-link ${isActive('/profile')}`}>
                <i className="fas fa-user-circle"></i> Profile
              </Link>
              <button 
                onClick={handleShowGuide} 
                className="help-button theme-aware"
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
              className="theme-toggle-button theme-aware"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
              <span className="sr-only">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
            
            {currentUser && (
              <button 
                onClick={handleLogout} 
                className="logout-button theme-aware"
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
