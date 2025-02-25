import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
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
          
          {currentUser && (
            <>
              <Link to="/compare" className="nav-link">
                <i className="fas fa-chart-bar"></i> Compare
              </Link>
              <button onClick={handleLogout} className="nav-button">
                <i className="fas fa-sign-out-alt"></i> Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
