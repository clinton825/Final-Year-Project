import React from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  // TODO: Replace with actual user data once authentication is implemented
  const mockUser = {
    name: 'User',
    joinDate: new Date().toLocaleDateString()
  };

  return (
    <>
      <div className="app-background">
        <div className="shape"></div>
        <div className="shape"></div>
      </div>
      <div className="dashboard-container">
        <h1 className="dashboard-title">
          <span className="icon">👋</span> Welcome, {mockUser.name}!
        </h1>
        <p className="dashboard-subtitle">
          Your personal space to manage and track local housing developments
        </p>

        <div className="dashboard-content">
          <div className="dashboard-card">
            <h2><span className="icon">🚀</span> Getting Started</h2>
            <p>Welcome to your dashboard! Here you can:</p>
            <ul>
              <li>View and track local housing projects</li>
              <li>Receive updates about developments in your area</li>
              <li>Manage your notification preferences</li>
            </ul>
            <Link to="/" className="primary-button">
              <span className="icon">🔍</span> Browse Projects
            </Link>
          </div>

          <div className="dashboard-card">
            <h2><span className="icon">📊</span> Quick Stats</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Member Since</span>
                <span className="stat-value">
                  <span className="icon">📅</span> {mockUser.joinDate}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Account Status</span>
                <span className="stat-value">
                  <span className="icon">✨</span> Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
