import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc, deleteDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import config from '../config';
import './ProjectDetails.css';

// For debugging
const API_BASE_URL = config.API_URL || 'http://localhost:8080';

const ProjectDetails = () => {
  const { planning_id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [project, setProject] = useState(null);
  const [isTracked, setIsTracked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [actualPlanningId, setActualPlanningId] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [stakeholders, setStakeholders] = useState([]);

  useEffect(() => {
    console.log('ProjectDetails mounted with planning_id:', planning_id);
    // Always log the raw planning_id for debugging
    setDebugInfo(prev => ({ ...prev, rawPlanningId: planning_id }));
    
    // Use the planning_id directly - this is what's passed from Projects.js
    // No need to extract from compound ID as we're now using the direct ID
    setActualPlanningId(planning_id);
  }, [planning_id]);

  useEffect(() => {
    if (actualPlanningId) {
      fetchProjectDetails();
      if (currentUser) {
        checkIfTracked();
      }
    }
  }, [actualPlanningId, currentUser]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      // Log for debugging
      console.log(`Fetching project details from: ${API_BASE_URL}/api/project/${actualPlanningId}`);
      setDebugInfo(prev => ({ ...prev, apiUrl: `${API_BASE_URL}/api/project/${actualPlanningId}` }));
      
      // Check if we have a valid ID before making the API call
      if (!actualPlanningId) {
        throw new Error('No project ID available');
      }
      
      // Make the API call
      const response = await fetch(`${API_BASE_URL}/api/project/${actualPlanningId}`);
      
      // Log the response status for debugging
      console.log('API response status:', response.status);
      setDebugInfo(prev => ({ ...prev, apiResponseStatus: response.status }));
      
      if (!response.ok) {
        throw new Error(`Failed to fetch project details. Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched project data:', data);
      setDebugInfo(prev => ({ ...prev, projectData: data }));
      
      // Set the project data
      if (data.project) {
        setProject(data.project);
        
        // If we have stakeholders data, set it
        if (data.project.stakeholders) {
          setStakeholders(data.project.stakeholders);
        } else {
          // Mock stakeholders data for demo/testing
          setStakeholders([
            { name: 'Developer', organization: 'XYZ Development Ltd', role: 'Primary Developer' },
            { name: 'Local Council', organization: 'City Planning Department', role: 'Approval Authority' },
            { name: 'Community Representative', organization: 'Local Community Board', role: 'Community Liaison' }
          ]);
        }
      } else {
        // If no project data is returned
        setProject({
          planning_id: actualPlanningId,
          planning_development_address_1: 'Project Address',
          planning_category: 'Category not available',
          planning_stage: 'Stage not available',
          planning_value: 'Value not available',
          planning_description: 'No description available for this project.'
        });
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
      setError(`Failed to load project details: ${error.message}`);
      
      // Set fallback data for display purposes
      setProject({
        planning_id: actualPlanningId,
        planning_development_address_1: 'Project Address',
        planning_category: 'Category not available',
        planning_stage: 'Stage not available',
        planning_value: 'Value not available',
        planning_description: 'No description available for this project.'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkIfTracked = async () => {
    try {
      if (!currentUser) return;
      
      // Check in Firestore if project is tracked
      // First try with the document ID format userId_planningId
      const trackedProjectRef = doc(db, 'trackedProjects', `${currentUser.uid}_${actualPlanningId}`);
      const trackedProjectDoc = await getDoc(trackedProjectRef);
      
      // If not found, try checking with the original ID (for backward compatibility)
      if (!trackedProjectDoc.exists() && planning_id !== actualPlanningId) {
        const altTrackedProjectRef = doc(db, 'trackedProjects', planning_id);
        const altTrackedProjectDoc = await getDoc(altTrackedProjectRef);
        setIsTracked(altTrackedProjectDoc.exists());
      } else {
        setIsTracked(trackedProjectDoc.exists());
      }
    } catch (error) {
      console.error('Error checking if project is tracked:', error);
    }
  };

  const handleTrackToggle = async () => {
    try {
      if (!currentUser) {
        setError('You must be logged in to track projects');
        return;
      }
      
      console.log('Tracking project:', actualPlanningId);
      console.log('Current user:', currentUser.uid);
      console.log('Project data:', project);
      
      // Create document ID with consistent format
      const docId = `${currentUser.uid}_${actualPlanningId}`;
      console.log('Document ID for tracked project:', docId);
      
      const trackedProjectRef = doc(db, 'trackedProjects', docId);
      
      if (isTracked) {
        console.log('Untracking project...');
        
        // Untrack project
        await deleteDoc(trackedProjectRef);
        console.log('Project untracked successfully');
        
        // Log activity
        await addDoc(collection(db, 'activity'), {
          userId: currentUser.uid,
          type: 'untrack',
          projectId: actualPlanningId,
          projectName: project?.planning_name || project?.planning_title || 'Unknown Project',
          description: `Untracked project: ${project?.planning_name || project?.planning_title || 'Unknown Project'}`,
          timestamp: serverTimestamp()
        });
        console.log('Activity logged successfully');
        setSuccess('Project untracked successfully');
      } else {
        console.log('Tracking project...');
        
        // Create a complete project object for Firestore
        const projectData = {
          userId: currentUser.uid,
          projectId: actualPlanningId,
          trackedAt: serverTimestamp(),
          
          // Store both specific and common fields to make it compatible with Dashboard
          projectName: project?.planning_name || project?.planning_title || 'Unknown Project',
          projectDescription: project?.planning_description || '',
          projectStatus: project?.planning_stage || '',
          projectAddress1: project?.planning_development_address_1 || '',
          projectAddress2: project?.planning_development_address_2 || '',
          projectValue: project?.planning_value || '',
          
          // Explicitly store the raw planning_id for future use
          planning_id: actualPlanningId,
          
          // Store all the important project fields (original format)
          planning_name: project.planning_name || project.planning_title || 'Unknown Project',
          planning_description: project.planning_description || '',
          planning_stage: project.planning_stage || '',
          planning_category: project.planning_category || '',
          planning_subcategory: project.planning_subcategory || '',
          planning_type: project.planning_type || '',
          planning_value: project.planning_value || '',
          planning_region: project.planning_region || '',
          planning_county: project.planning_county || '',
          planning_development_address_1: project.planning_development_address_1 || '',
          planning_development_address_2: project.planning_development_address_2 || '',
          planning_application_date: project.planning_application_date || null,
          planning_decision_date: project.planning_decision_date || null,
          planning_start_date: project.planning_start_date || null,
          planning_est_completion_date: project.planning_est_completion_date || null,
        };
        
        // Make multiple attempts to ensure data persists
        try {
          // Track project with complete data
          await setDoc(trackedProjectRef, projectData);
          console.log('Project tracked successfully');
          
          // Double-check the document was written
          const verifyDoc = await getDoc(trackedProjectRef);
          if (verifyDoc.exists()) {
            console.log('Verified tracked project was saved correctly');
          } else {
            console.warn('Project tracking verification failed - retrying...');
            // Try one more time
            await setDoc(trackedProjectRef, projectData);
          }
          
          // Log activity
          await addDoc(collection(db, 'activity'), {
            userId: currentUser.uid,
            type: 'track',
            projectId: actualPlanningId,
            projectName: project?.planning_name || project?.planning_title || 'Unknown Project',
            description: `Started tracking project: ${project?.planning_name || project?.planning_title || 'Unknown Project'}`,
            timestamp: serverTimestamp()
          });
          console.log('Activity logged successfully');
          setSuccess('Project tracked successfully');
        } catch (innerError) {
          console.error('Error in tracking operation:', innerError);
          throw innerError;
        }
      }
      
      setIsTracked(!isTracked);
      console.log('isTracked state updated to:', !isTracked);
    } catch (error) {
      console.error(`Error ${isTracked ? 'untracking' : 'tracking'} project:`, error);
      setError(`Failed to ${isTracked ? 'untrack' : 'track'} project. Please try again later.`);
    }
  };

  const handleBack = () => {
    navigate('/projects');
  };

  const renderOverviewTab = () => (
    <>
      <div className="details-grid">
        <div className="detail-item">
          <h3>Planning ID</h3>
          <p>{project.planning_id || actualPlanningId || 'N/A'}</p>
        </div>
        <div className="detail-item">
          <h3>Name</h3>
          <p>{project.planning_name}</p>
        </div>
        <div className="detail-item">
          <h3>Category</h3>
          <p>{project.planning_category} - {project.planning_subcategory}</p>
        </div>
        <div className="detail-item">
          <h3>Type</h3>
          <p>{project.planning_type}</p>
        </div>
        <div className="detail-item">
          <h3>Stage</h3>
          <p>{project.planning_stage}</p>
        </div>
        <div className="detail-item">
          <h3>Value</h3>
          <p>€{Number(project.planning_value).toLocaleString()}</p>
        </div>
        <div className="detail-item">
          <h3>Location</h3>
          <p>{[
            project.planning_development_address_1,
            project.planning_development_address_2,
            project.planning_development_address_3,
            project.planning_development_address_4,
          ].filter(Boolean).join(', ')}</p>
        </div>
        <div className="detail-item">
          <h3>Region</h3>
          <p>{project.planning_county}, {project.planning_region}</p>
        </div>
        <div className="detail-item">
          <h3>Site Area</h3>
          <p>{project.planning_siteha} hectares</p>
        </div>
        <div className="detail-item">
          <h3>Building Size</h3>
          <p>{project.planning_sizesqmt} sq.mt</p>
        </div>
      </div>

      <div className="dates-section">
        <h3>Important Dates</h3>
        <div className="dates-grid">
          <div className="date-item">
            <span>Application Date:</span>
            <p>{new Date(project.planning_application_date).toLocaleDateString()}</p>
          </div>
          <div className="date-item">
            <span>Decision Date:</span>
            <p>{project.planning_decision_date ? new Date(project.planning_decision_date).toLocaleDateString() : 'Not available'}</p>
          </div>
          <div className="date-item">
            <span>Start Date:</span>
            <p>{project.planning_start_date ? new Date(project.planning_start_date).toLocaleDateString() : 'Not available'}</p>
          </div>
          <div className="date-item">
            <span>Estimated Completion:</span>
            <p>{project.planning_est_completion_date ? new Date(project.planning_est_completion_date).toLocaleDateString() : 'Not available'}</p>
          </div>
        </div>
      </div>

      <div className="description-section">
        <h3>Project Description</h3>
        <p>{project.planning_description}</p>
      </div>

      {project.planning_tags && (
        <div className="tags-section">
          <h3>Project Tags</h3>
          <div className="tags-container">
            {project.planning_tags.split(',').map((tag, index) => (
              <span key={index} className="tag">{tag.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {project.planning_url && (
        <div className="url-section">
          <h3>Project URL</h3>
          <a href={project.planning_url} target="_blank" rel="noopener noreferrer">
            View External Resource
          </a>
        </div>
      )}
    </>
  );

  const renderStakeholdersTab = () => (
    <div className="stakeholders-section">
      {/* First check if we have companies data from the API */}
      {project.companies && project.companies.length > 0 ? (
        project.companies.map((company, index) => (
          <div key={index} className="stakeholder-group">
            <h3>{company.planning_company_type_name?.company_type_name || 'Company'}</h3>
            <div className="stakeholder-card">
              <div className="stakeholder-header">
                <h4>{company.company_name}</h4>
              </div>
              <div className="company-details">
                {company.company_contact_name && (
                  <p><strong>Contact:</strong> {company.company_contact_name}</p>
                )}
                <p><strong>Address:</strong> {[
                  company.company_address_1,
                  company.company_address_2,
                  company.company_address_3,
                  company.company_address_4
                ].filter(Boolean).join(', ')}</p>
                {company.company_phone && (
                  <p><strong>Phone:</strong> {company.company_phone}</p>
                )}
                {company.company_email && (
                  <p><strong>Email:</strong> {company.company_email}</p>
                )}
                {company.company_web && (
                  <p><strong>Website:</strong> <a href={company.company_web.startsWith('http') ? company.company_web : `http://${company.company_web}`} target="_blank" rel="noopener noreferrer">{company.company_web}</a></p>
                )}
              </div>
            </div>
          </div>
        ))
      ) : stakeholders && stakeholders.length > 0 ? (
        /* If no companies data but we have stakeholders from our fallback/mock data */
        <div className="stakeholders-list">
          {stakeholders.map((stakeholder, index) => (
            <div key={index} className="stakeholder-card">
              <div className="stakeholder-icon">
                <i className="fas fa-user-tie"></i>
              </div>
              <div className="stakeholder-details">
                <h3>{stakeholder.name || 'Unnamed Stakeholder'}</h3>
                <p className="stakeholder-org">{stakeholder.organization || 'Organization not specified'}</p>
                <p className="stakeholder-role">{stakeholder.role || 'Role not specified'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-stakeholders">
          <i className="fas fa-users-slash"></i>
          <p>No stakeholder information available for this project.</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="project-details">
        <div className="loading">Loading project details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-details">
        <div className="error-container">
          <div className="error">{error}</div>
          <button onClick={handleBack} className="back-button">Back to Projects</button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-details">
        <div className="error-container">
          <div className="error">Project not found</div>
          <button onClick={handleBack} className="back-button">Back to Projects</button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-details">
      {success && (
        <div className="success-notification">
          {success}
        </div>
      )}
      <button className="back-button" onClick={handleBack}>
        <i className="fas fa-arrow-left"></i> Back to Projects
      </button>

      <div className="project-header">
        <div className="project-title-section">
          <h1>{project.planning_name || project.planning_title || project.planning_development_address_1 || 'Unnamed Project'}</h1>
          <div className="project-id-display">Project ID: {project.planning_id || actualPlanningId || 'N/A'}</div>
        </div>
        <button 
          className={`track-button ${isTracked ? 'tracked' : ''}`}
          onClick={handleTrackToggle}
        >
          <i className={`fas ${isTracked ? 'fa-bell-slash' : 'fa-bell'}`}></i>
          {isTracked ? 'Untrack Project' : 'Track Project'}
        </button>
      </div>

      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span className="icon">📋</span> Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'stakeholders' ? 'active' : ''}`}
          onClick={() => setActiveTab('stakeholders')}
        >
          <span className="icon">👥</span> Stakeholders
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' ? renderOverviewTab() : renderStakeholdersTab()}
      </div>
    </div>
  );
};

export default ProjectDetails;
