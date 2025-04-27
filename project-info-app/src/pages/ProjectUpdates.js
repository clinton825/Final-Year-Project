import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaClock, FaBuilding, FaInfoCircle, FaEuroSign, FaMapMarkerAlt, FaTag, FaSync, FaBell } from 'react-icons/fa';
import axios from 'axios';
import config from '../config';
import './ProjectUpdates.css';

const ProjectUpdates = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [updatePeriod, setUpdatePeriod] = useState('3'); // Default to today
  const [updatingFeed, setUpdatingFeed] = useState(false);
  const [trackedProjects, setTrackedProjects] = useState(new Set());
  
  // Load tracked projects on mount
  useEffect(() => {
    loadTrackedProjectIds();
  }, [currentUser]);
  
  // Load updates based on selected period
  useEffect(() => {
    fetchProjectUpdates();
  }, [updatePeriod]);
  
  // Get IDs of projects the user is already tracking
  const loadTrackedProjectIds = async () => {
    if (!currentUser) return;
    
    try {
      // Call your existing service to get tracked project IDs
      const response = await fetch(`${config.API_URL}/api/user/${currentUser.uid}/tracked-projects`);
      if (response.ok) {
        const data = await response.json();
        const projectIds = new Set(data.projects.map(p => p.projectId || p.planning_id || p.id));
        setTrackedProjects(projectIds);
        console.log(`Loaded ${projectIds.size} tracked project IDs`);
      }
    } catch (error) {
      console.error('Error loading tracked projects:', error);
      // Continue with empty set - user just won't see which ones are already tracked
    }
  };
  
  // Fetch recently updated projects from BuildingInfo API
  const fetchProjectUpdates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the backend API instead of direct API calls
      const apiEndpoint = `${config.API_URL}/api/project-updates`;
      
      // Add the update period as a query parameter
      const response = await fetch(`${apiEndpoint}?period=${updatePeriod}`);
      
      if (!response.ok) {
        throw new Error(`API returned status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.projects || !Array.isArray(data.projects)) {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format from API');
      }
      
      // Process the updates
      const updates = data.projects.map(project => ({
        ...project,
        updateType: project.is_major_update ? 'major' : 'minor',
        updateDate: new Date(project.api_date || project._updated || Date.now())
      }));
      
      // Sort by update date (newest first)
      const sortedUpdates = updates.sort((a, b) => b.updateDate - a.updateDate);
      
      setUpdates(sortedUpdates);
      console.log(`Loaded ${sortedUpdates.length} project updates`);
    } catch (error) {
      console.error('Error fetching project updates:', error);
      setError('Failed to load project updates. Please try again later.');
    } finally {
      setLoading(false);
      setUpdatingFeed(false);
    }
  };
  
  // Handle update period change
  const handlePeriodChange = (period) => {
    setUpdatePeriod(period);
  };
  
  // Refresh the feed
  const handleRefresh = () => {
    setUpdatingFeed(true);
    fetchProjectUpdates();
  };
  
  // Navigate to project details
  const handleViewProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };
  
  // Format update date
  const formatUpdateDate = (date) => {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 172800) return 'Yesterday';
    
    // Otherwise return formatted date
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };
  
  return (
    <div className="project-updates-container">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">
            <FaBell className="icon-margin-right" />
            Infrastructure Project Updates
          </h1>
          <button 
            className="refresh-button"
            onClick={handleRefresh}
            disabled={updatingFeed}
          >
            {updatingFeed ? (
              <>
                <div className="spinner small" />
                <span className="button-text">Updating...</span>
              </>
            ) : (
              <>
                <FaSync className="icon-margin-right" />
                Refresh
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="filter-card">
        <h3 className="filter-title">Show updates from:</h3>
        <div className="update-period-buttons">
          <button 
            className={`period-button ${updatePeriod === '3' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('3')}
          >
            Today
          </button>
          <button 
            className={`period-button ${updatePeriod === '-1.1' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('-1.1')}
          >
            Yesterday
          </button>
          <button 
            className={`period-button ${updatePeriod === '-7.1' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('-7.1')}
          >
            Last 7 Days
          </button>
          <button 
            className={`period-button ${updatePeriod === '-30.1' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('-30.1')}
          >
            Last 30 Days
          </button>
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading project updates...</p>
        </div>
      ) : updates.length === 0 ? (
        <div className="empty-state">
          <FaInfoCircle size={48} className="empty-icon" />
          <h2>No recent updates found</h2>
          <p className="empty-text">
            Try selecting a different time period or check back later.
          </p>
        </div>
      ) : (
        <div className="updates-list">
          {updates.map(project => (
            <div className={`update-card ${project.updateType === 'major' ? 'major-update' : ''}`} key={project.planning_id}>
              <div className="card-header">
                <div className="title-area">
                  <h3 className="project-title">
                    {project.planning_title || project.title || 'Unnamed Project'}
                  </h3>
                  <div className="badge-container">
                    {project.updateType === 'major' && (
                      <span className="badge major">Major Update</span>
                    )}
                    {trackedProjects.has(project.planning_id) && (
                      <span className="badge tracked">Tracked</span>
                    )}
                  </div>
                </div>
                <p className="update-time">
                  <FaClock className="icon-margin-right" /> 
                  Updated {formatUpdateDate(project.updateDate)}
                </p>
              </div>
              
              <div className="project-details">
                <div className="detail-row">
                  <div className="detail-item">
                    <FaBuilding className="icon-margin-right" />
                    <span className="detail-label">Stage:</span> 
                    <span className="detail-value">{project.planning_stage || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <FaEuroSign className="icon-margin-right" />
                    <span className="detail-label">Value:</span> 
                    <span className="detail-value">
                      {project.planning_value_eur || (project.planning_value ? `€${project.planning_value.toLocaleString()}` : 'Unknown')}
                    </span>
                  </div>
                  <div className="detail-item">
                    <FaMapMarkerAlt className="icon-margin-right" />
                    <span className="detail-label">Location:</span> 
                    <span className="detail-value">
                      {project.planning_town || project.planning_region || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="project-categories">
                {project.planning_sector && (
                  <span className="category-tag">
                    <FaTag className="icon-margin-right" />{project.planning_sector}
                  </span>
                )}
                {project.planning_type && (
                  <span className="category-tag secondary">{project.planning_type}</span>
                )}
              </div>

              <div className="card-actions">
                <button 
                  className="action-button primary"
                  onClick={() => handleViewProject(project.planning_id)}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectUpdates;
