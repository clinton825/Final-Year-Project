import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <div className="footer-logo">
            <Link to="/">
              <i className="fas fa-building"></i>
              Infrastructure Tracker
            </Link>
          </div>
          <p>Transparent insights into local infrastructure development across Carlow and surrounding areas.</p>
          <div className="social-icons">
            <a href="#" className="social-icon"><i className="fab fa-facebook"></i></a>
            <a href="#" className="social-icon"><i className="fab fa-twitter"></i></a>
            <a href="#" className="social-icon"><i className="fab fa-linkedin"></i></a>
            <a href="#" className="social-icon"><i className="fab fa-instagram"></i></a>
          </div>
        </div>
        
        <div className="footer-section">
          <h3>Quick Links</h3>
          <ul className="footer-links">
            <li><Link to="/"><i className="fas fa-angle-right"></i> Home</Link></li>
            <li><Link to="/dashboard"><i className="fas fa-angle-right"></i> Dashboard</Link></li>
            <li><Link to="/compare"><i className="fas fa-angle-right"></i> Compare</Link></li>
            <li><Link to="/about"><i className="fas fa-angle-right"></i> About</Link></li>
            <li><Link to="/contact"><i className="fas fa-angle-right"></i> Contact</Link></li>
            <li><Link to="/faq"><i className="fas fa-angle-right"></i> FAQ</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h3>Contact Us</h3>
          <ul className="footer-links">
            <li><i className="fas fa-envelope"></i> info@infrastructuretracker.ie</li>
            <li><i className="fas fa-phone"></i> (053) 123 4567</li>
            <li><i className="fas fa-map-marker-alt"></i> Carlow, Ireland</li>
            <li><i className="fas fa-clock"></i> Monday - Friday, 9am - 5pm</li>
          </ul>
        </div>

        <div className="footer-section">
          <h3>Newsletter</h3>
          <p>Stay up to date with the latest news and updates from Infrastructure Tracker.</p>
          <form>
            <input type="email" placeholder="Enter your email address" />
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} Infrastructure Project Tracker. All rights reserved.</p>
        <p>Designed and developed by <a href="https://clinton825.github.io/">Clinton Bempah</a></p>
      </div>
    </footer>
  );
};

export default Footer;
