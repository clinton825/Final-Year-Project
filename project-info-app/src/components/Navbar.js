import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './Navbar.css';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <i className="fas fa-building"></i>
          Infrastructure Tracking
        </Link>
        
        <div className="navbar-links">
          <Link to="/" className="nav-link">
            <i className="fas fa-home"></i> Home
          </Link>
          
          <div className="action-area">
            <button 
              onClick={toggleTheme} 
              className="theme-toggle-button"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <>
                  <i className="fas fa-moon"></i>
                </>
              ) : (
                <>
                  <i className="fas fa-sun"></i>
                </>
              )}
              <span className="sr-only">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
          </div>
          
          {currentUser && (
            <>
              <Link to="/dashboard" className="nav-link">
                <i className="fas fa-user-circle"></i> Dashboard
              </Link>
              <Link to="/compare" className="nav-link">
                <i className="fas fa-chart-bar"></i> Compare
              </Link>
              <button 
                onClick={handleLogout} 
                className="logout-button"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt"></i>
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
