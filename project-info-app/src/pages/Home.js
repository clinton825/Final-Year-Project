import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.svg';
import './LandingPage.css';
import { FaSearch, FaChartLine, FaRegCalendarAlt, FaStickyNote, FaTags, FaRegCheckCircle } from 'react-icons/fa';

const Home = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();



  return (
    <div className="landing-container">
      <div className="hero-section">
        <div className="logo-container">
          <img src={logo} alt="InfraTrack Logo" className="app-logo" />
        </div>
        <h1>Infrastructure Project Tracking</h1>
        <p className="tagline">Transparent Insights into Local Infrastructure Development</p>
        <div className="cta-buttons">
          {!currentUser ? (
            <>
              <button onClick={() => navigate('/login')} className="cta-button primary">
                Log In
              </button>
              <button onClick={() => navigate('/signup')} className="cta-button secondary">
                Sign Up
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/projects')} className="cta-button primary">
                Explore Projects
              </button>
              <button onClick={() => navigate('/dashboard')} className="cta-button secondary">
                Go to Dashboard
              </button>
            </>
          )}
        </div>
      </div>

      <div className="about-section">
        <h2>About the Application</h2>
        <p>
          The Infrastructure Project Tracking Web Application provides comprehensive information about infrastructure projects across the country. 
          Our platform allows you to explore details about residential, commercial, and industrial development projects, 
          track projects of interest, and stay updated on their progress.
        </p>
      </div>

      <div className="features-section">
        <h2>Key Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <FaSearch />
            </div>
            <h3>Advanced Search</h3>
            <p>Find projects based on location, category, value range, and more with our powerful search tools.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaRegCheckCircle />
            </div>
            <h3>Project Tracking</h3>
            <p>Monitor projects important to you by adding them to your personal tracking dashboard.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaChartLine />
            </div>
            <h3>Data Visualization</h3>
            <p>Gain insights through interactive charts and graphs showing project distributions and trends.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaRegCalendarAlt />
            </div>
            <h3>Timeline View</h3>
            <p>View project milestones on an interactive timeline to understand project schedules and progress.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaStickyNote />
            </div>
            <h3>Project Notes</h3>
            <p>Add personal notes to tracked projects to keep your observations organized.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaTags />
            </div>
            <h3>Categorisation</h3>
            <p>Browse projects by category including residential, commercial & retail, and industrial developments.</p>
          </div>
        </div>
      </div>

      <div className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Sign Up</h3>
            <p>Create your account to access all features of the application.</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Explore Projects</h3>
            <p>Browse through infrastructure projects using our search and filter tools.</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Track Projects</h3>
            <p>Add projects to your personal dashboard to monitor their progress.</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Stay Updated</h3>
            <p>Receive updates on tracked projects and view them on your interactive dashboard.</p>
          </div>
        </div>
      </div>

      <div className="get-started-section">
        <h2>Ready to Get Started?</h2>
        <p>Join our platform today to gain insights into infrastructure development projects.</p>
        {!currentUser ? (
          <button onClick={() => navigate('/signup')} className="cta-button primary large">
            Create an Account
          </button>
        ) : (
          <button onClick={() => navigate('/projects')} className="cta-button primary large">
            Explore Projects Now
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;
