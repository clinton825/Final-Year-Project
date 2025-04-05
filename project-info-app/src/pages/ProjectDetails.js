import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
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
    
    // Extract planning_id from URL
    if (planning_id) {
      // Clean up the planning ID if needed
      const cleanedId = planning_id.replace(/[^a-zA-Z0-9_-]/g, '');
      setActualPlanningId(cleanedId);
      
      // Once we have the actual planning ID, fetch project details and check tracking status
      fetchProjectDetails(cleanedId);
    }
  }, [planning_id]);
  
  // Add a separate useEffect to check tracking when currentUser or actualPlanningId changes
  useEffect(() => {
    if (currentUser && actualPlanningId) {
      checkIfTracked();
    }
  }, [currentUser, actualPlanningId]);
  
  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchProjectDetails = async (planningId) => {
    try {
      setLoading(true);
      setError(null);
      
      const idToUse = planningId || actualPlanningId;
      console.log(`Fetching project details for ID: ${idToUse}`);
      
      if (!idToUse) {
        throw new Error('No project ID available');
      }
      
      // Initialize data variables
      let apiData = null;
      let firestoreData = null;
      let isProjectTracked = false;
      
      // STEP 1: First check if we have this project in Firestore (for tracked projects)
      if (currentUser) {
        try {
          console.log('Checking Firestore for tracked project data...');
          
          // Check for project with the compound ID format
          const compoundId = `${currentUser.uid}_${idToUse}`;
          console.log('Looking up compound ID:', compoundId);
          const trackedDoc = await getDoc(doc(db, 'trackedProjects', compoundId));
          
          if (trackedDoc.exists()) {
            console.log('✅ Found project in trackedProjects using compound ID');
            firestoreData = trackedDoc.data();
            firestoreData.docId = trackedDoc.id; // Store document ID
            isProjectTracked = true;
          } else {
            // If not found by compound ID, try various query approaches
            console.log('Project not found by compound ID, trying queries...');
            
            // Try query by userId and projectId fields
            const trackedProjectsRef = collection(db, 'trackedProjects');
            
            // Query approach 1: exact projectId match
            const q1 = query(
              trackedProjectsRef, 
              where('userId', '==', currentUser.uid),
              where('projectId', '==', idToUse)
            );
            
            let querySnapshot = await getDocs(q1);
            
            if (!querySnapshot.empty) {
              console.log('✅ Found project via projectId field query');
              firestoreData = querySnapshot.docs[0].data();
              firestoreData.docId = querySnapshot.docs[0].id;
              isProjectTracked = true;
            } else {
              // Try query approach 2: planning_id field
              const q2 = query(
                trackedProjectsRef, 
                where('userId', '==', currentUser.uid),
                where('planning_id', '==', idToUse)
              );
              
              querySnapshot = await getDocs(q2);
              
              if (!querySnapshot.empty) {
                console.log('✅ Found project via planning_id field query');
                firestoreData = querySnapshot.docs[0].data();
                firestoreData.docId = querySnapshot.docs[0].id;
                isProjectTracked = true;
              } else {
                // Last attempt: get all user's projects and check all possible ID fields
                console.log('Trying last resort: scan all user projects...');
                const userProjectsQuery = query(
                  trackedProjectsRef,
                  where('userId', '==', currentUser.uid)
                );
                
                const allUserProjects = await getDocs(userProjectsQuery);
                
                if (!allUserProjects.empty) {
                  for (const projectDoc of allUserProjects.docs) {
                    const data = projectDoc.data();
                    
                    // Check all possible ID fields
                    const possibleIds = [
                      data.projectId,
                      data.planning_id,
                      data.id,
                      data._id,
                      // Check if the document ID contains our target ID
                      projectDoc.id.includes(idToUse) ? idToUse : null
                    ];
                    
                    if (possibleIds.includes(idToUse)) {
                      console.log('✅ Found project by scanning all user projects');
                      firestoreData = data;
                      firestoreData.docId = projectDoc.id;
                      isProjectTracked = true;
                      break;
                    }
                  }
                }
              }
            }
          }
          
          if (firestoreData) {
            console.log('Firestore data found:', 
              firestoreData.planning_title || 
              firestoreData.planning_name || 
              firestoreData.title || 
              'Unnamed'
            );
          } else {
            console.log('No matching project found in Firestore');
          }
        } catch (firestoreError) {
          console.error('Error fetching from Firestore:', firestoreError);
        }
      }
      
      // STEP 2: Try to fetch from the API (even if we already have Firestore data)
      try {
        console.log(`Fetching from API: ${API_BASE_URL}/api/project/${idToUse}`);
        const response = await fetch(`${API_BASE_URL}/api/project/${idToUse}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.project) {
            console.log('✅ Successfully fetched API data');
            apiData = data.project;
          } else {
            console.warn('API response missing project data structure');
          }
        } else {
          console.warn(`API returned status: ${response.status}`);
        }
      } catch (apiError) {
        console.error('API fetch error:', apiError);
      }
      
      // Update the tracked state
      setIsTracked(isProjectTracked);
      
      // STEP 3: Merge and normalize the data
      let finalData;
      
      if (apiData && firestoreData) {
        // We have both sources - merge with API data taking precedence for most fields
        // But preserve tracking metadata from Firestore
        const trackingMetadata = {
          docId: firestoreData.docId,
          trackedAt: firestoreData.trackedAt,
          userId: firestoreData.userId,
          notes: firestoreData.notes
        };
        
        finalData = { 
          ...firestoreData,  // Base is Firestore data
          ...apiData,        // Override with fresh API data
          ...trackingMetadata // Ensure tracking metadata is preserved
        };
        
        console.log('Merged data from both API and Firestore');
      } else if (apiData) {
        // Only API data available
        finalData = apiData;
        console.log('Using API data only');
      } else if (firestoreData) {
        // Only Firestore data available
        finalData = firestoreData;
        console.log('Using Firestore data only');
      } else {
        // No data available from either source
        console.error('No data available from either source');
        finalData = {
          planning_id: idToUse,
          planning_title: 'Unnamed Project',
          planning_description: 'No description available for this project.',
          planning_category: 'Category not available',
          planning_stage: 'Stage not available',
          planning_value: 'Value not available'
        };
      }
      
      // STEP 4: Normalize fields to ensure we have consistent data
      const normalizedData = {
        // Ensure the planning_id is set to our target ID
        planning_id: idToUse,
        
        // Normalize title, using the first available
        planning_title: 
          finalData.planning_title || 
          finalData.planning_name || 
          finalData.title || 
          finalData.name || 
          'Unnamed Project',
        
        // Normalize description
        planning_description: 
          finalData.planning_description || 
          finalData.description || 
          'No description available',
        
        // Normalize category
        planning_category: 
          finalData.planning_category || 
          finalData.category || 
          finalData.type || 
          'Uncategorized',
        
        // Normalize stage
        planning_stage: 
          finalData.planning_stage || 
          finalData.status || 
          finalData.stage || 
          'Status not available',
        
        // Normalize value
        planning_value: 
          finalData.planning_value || 
          finalData.projectValue || 
          finalData.value || 
          'Value not available',
        
        // Normalize location
        planning_location: 
          finalData.planning_location || 
          finalData.location || 
          finalData.planning_county || 
          'Location not available',
        
        // Include all original data
        ...finalData
      };
      
      console.log('Final normalized project data:', normalizedData);
      setProject(normalizedData);
      
      // Set stakeholders
      if (normalizedData.stakeholders) {
        setStakeholders(normalizedData.stakeholders);
      } else {
        // Mock stakeholders data for demo/testing
        setStakeholders([
          { name: 'Developer', organization: 'XYZ Development Ltd', role: 'Primary Developer' },
          { name: 'Local Council', organization: 'City Planning Department', role: 'Approval Authority' },
          { name: 'Community Representative', organization: 'Local Community Board', role: 'Community Liaison' }
        ]);
      }
      
      // Log the view activity
      if (currentUser) {
        try {
          await addDoc(collection(db, 'activity'), {
            userId: currentUser.uid,
            type: 'view',
            projectId: idToUse,
            projectTitle: normalizedData.planning_title || 'Unknown Project',
            timestamp: serverTimestamp()
          });
        } catch (activityError) {
          console.error('Error logging activity:', activityError);
        }
      }
    } catch (error) {
      console.error('Error in fetchProjectDetails:', error);
      setError(`Error loading project: ${error.message}`);
      
      // Set minimal fallback data
      setProject({
        planning_id: planningId || actualPlanningId,
        planning_title: 'Error Loading Project',
        planning_description: 'Failed to load project details. Please try again later.',
        planning_category: 'Not Available',
        planning_stage: 'Not Available',
        planning_value: 'Not Available'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const checkIfTracked = async () => {
    if (!currentUser || !actualPlanningId) {
      console.log('Cannot check tracking status: missing user or planning ID');
      setIsTracked(false);
      return;
    }
    
    try {
      console.log('Checking if project is tracked...');
      
      // First try with compound ID
      const compoundId = `${currentUser.uid}_${actualPlanningId}`;
      const docSnap = await getDoc(doc(db, 'trackedProjects', compoundId));
      
      if (docSnap.exists()) {
        console.log('Project is tracked (found by compound ID)');
        setIsTracked(true);
        return;
      }
      
      // If not found, try with a query
      const q = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid),
        where('projectId', '==', actualPlanningId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        console.log('Project is tracked (found by query)');
        setIsTracked(true);
      } else {
        console.log('Project is not tracked');
        setIsTracked(false);
      }
    } catch (error) {
      console.error('Error checking if project is tracked:', error);
      setIsTracked(false);
    }
  };

  const handleTrackToggle = async () => {
    try {
      if (!currentUser) {
        setError('You must be logged in to track projects');
        return;
      }
      
      console.log('Track toggle for project:', actualPlanningId);
      
      // Create document ID with consistent format
      const docId = `${currentUser.uid}_${actualPlanningId}`;
      console.log('Document ID:', docId);
      
      if (isTracked) {
        // UNTRACK: Delete the document from Firestore
        console.log('Untracking project...');
        
        try {
          await deleteDoc(doc(db, 'trackedProjects', docId));
          
          // Log activity
          await addDoc(collection(db, 'activity'), {
            userId: currentUser.uid,
            type: 'untrack',
            projectId: actualPlanningId,
            projectTitle: project?.planning_title || project?.planning_name || 'Unknown Project',
            timestamp: serverTimestamp()
          });
          
          console.log('Project untracked successfully');
          setSuccess('Project removed from tracked projects');
          setIsTracked(false);
        } catch (untrackError) {
          console.error('Error untracking project:', untrackError);
          throw untrackError;
        }
      } else {
        // TRACK: Store the project in Firestore
        console.log('Tracking project...');
        
        // Get the most up-to-date project data first
        let projectToStore = { ...project };
        
        // Try to get fresh API data if possible
        try {
          const response = await fetch(`${API_BASE_URL}/api/project/${actualPlanningId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data && data.project) {
              // Update with the latest API data
              projectToStore = { ...projectToStore, ...data.project };
            }
          }
        } catch (refreshError) {
          console.warn('Could not refresh project data from API:', refreshError);
          // Continue with existing data
        }
        
        // Add tracking metadata
        const trackedProject = {
          // Tracking metadata
          userId: currentUser.uid,
          projectId: actualPlanningId,
          trackedAt: serverTimestamp(),
          
          // Store the complete project data
          ...projectToStore
        };
        
        try {
          // Save to Firestore
          await setDoc(doc(db, 'trackedProjects', docId), trackedProject);
          
          // Verify it was saved
          const docSnap = await getDoc(doc(db, 'trackedProjects', docId));
          
          if (!docSnap.exists()) {
            console.warn('Verification failed, trying again...');
            await setDoc(doc(db, 'trackedProjects', docId), trackedProject);
          }
          
          // Log activity
          await addDoc(collection(db, 'activity'), {
            userId: currentUser.uid,
            type: 'track',
            projectId: actualPlanningId,
            projectTitle: projectToStore?.planning_title || projectToStore?.planning_name || 'Unknown Project',
            timestamp: serverTimestamp()
          });
          
          console.log('Project tracked successfully');
          setSuccess('Project added to tracked projects');
          setIsTracked(true);
        } catch (trackError) {
          console.error('Error tracking project:', trackError);
          throw trackError;
        }
      }
    } catch (error) {
      console.error('Track toggle error:', error);
      setError(`Failed to ${isTracked ? 'untrack' : 'track'} project: ${error.message}`);
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
