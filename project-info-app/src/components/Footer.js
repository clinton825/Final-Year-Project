import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = ({ compact }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`footer ${compact ? 'compact-footer' : ''}`}>
      <div className="footer-content">
        <div className="footer-section">
          <div className="footer-logo">
            <Link to="/">
              <i className="fas fa-building"></i>
              Infrastructure Tracker
            </Link>
          </div>
          <p style={{ fontSize: '0.85rem', marginTop: '5px' }}>Tracking infrastructure development across Carlow and surrounding areas.</p>
        </div>
        
        <div className="footer-section">
          <h3>Quick Links</h3>
          <ul className="footer-links">
            <li><Link to="/"><i className="fas fa-angle-right"></i> Home</Link></li>
            <li><Link to="/dashboard"><i className="fas fa-angle-right"></i> Dashboard</Link></li>
            <li><Link to="/compare"><i className="fas fa-angle-right"></i> Compare</Link></li>
          </ul>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} Infrastructure Project Tracker</p>
        <p style={{ marginTop: '3px' }}>Designed by <a href="https://clinton825.github.io/">Clinton Bempah</a></p>
      </div>
    </footer>
  );
};

export default Footer;
