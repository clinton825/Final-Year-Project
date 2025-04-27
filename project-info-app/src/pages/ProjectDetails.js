import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';
import config from '../config';
import './ProjectDetails.css';

// For debugging
const API_BASE_URL = config.API_URL || 'http://localhost:8080';

// Backend API URL 
const API_URL = process.env.REACT_APP_BACKEND_API_URL || 'http://localhost:5001/api';

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
  const [debugInfo, setDebugInfo] = useState({});
  const [stakeholders, setStakeholders] = useState([]);
  const [isUpdatingTrackStatus, setIsUpdatingTrackStatus] = useState(false);

  useEffect(() => {
    console.log('ProjectDetails mounted with planning_id:', planning_id);
    
    // Extract numeric ID if it's a compound ID
    let idToUse = planning_id;
    if (typeof planning_id === 'string' && planning_id.includes('_')) {
      idToUse = planning_id.split('_')[1]; // Get the part after the underscore
      console.log('Extracted numeric ID from compound ID:', idToUse);
    }
    
    if (idToUse) {
      fetchProjectDetails(idToUse);
    }
  }, [planning_id]);
  
  useEffect(() => {
    if (project?.planning_id) {
      const projectId = project.planning_id;
      console.log('Project data loaded with planning_id:', projectId);
      checkIfProjectIsTracked(projectId);
    }
  }, [project, currentUser]);
  
  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Add a retry mechanism for API fetches
  const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        
        // If response was not ok, and this is not the last retry,
        // log and continue to the next retry
        if (retries < maxRetries - 1) {
          console.warn(`Fetch attempt ${retries + 1} failed with status ${response.status}. Retrying...`);
          retries++;
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          continue;
        }
        
        // If this was the last retry, return the failed response
        return response;
      } catch (error) {
        // If there's a network error and this is not the last retry
        if (retries < maxRetries - 1) {
          console.warn(`Fetch attempt ${retries + 1} failed with error: ${error.message}. Retrying...`);
          retries++;
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          continue;
        }
        
        // If this was the last retry, throw the error
        throw error;
      }
    }
  };

  const fetchProjectDetails = async (idToUse) => {
    try {
      setLoading(true);
      setError(null);
      
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
        const response = await fetchWithRetry(`${API_BASE_URL}/api/project/${idToUse}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.project) {
            console.log('✅ Successfully fetched API data');
            apiData = data.project;
          } else {
            console.warn('API response missing project data structure:', data);
            
            // Add detailed logging for API errors
            if (data && data.status === 'ERROR') {
              console.warn('API returned ERROR status. This likely means the project ID is not found in the BuildingInfo database');
            }
          }
        } else {
          console.warn(`API returned status: ${response.status}`);
          
          // Try direct BuildingInfo API as fallback (if this was already attempted in the backend)
          if (firestoreData && !apiData) {
            try {
              console.log('Attempting direct BuildingInfo API call as fallback');
              const directApiUrl = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${config.BUILDINGINFO_API_KEY}&ukey=${config.BUILDINGINFO_UKEY}&planning_id=${idToUse}`;
              
              console.log(`Attempting fallback API: ${directApiUrl.substring(0, 60)}...`);
              
              const directResponse = await fetch(directApiUrl);
              if (directResponse.ok) {
                const directData = await directResponse.json();
                if (directData && directData.status === 'SUCCESS' && directData.data) {
                  console.log('✅ Successfully fetched data from direct BuildingInfo API');
                  apiData = directData.data;
                } else {
                  console.warn('Direct BuildingInfo API returned invalid data or error status', directData);
                }
              }
            } catch (directApiError) {
              console.error('Error in direct BuildingInfo API fallback:', directApiError);
            }
          }
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
          ...apiData,        // API data overrides duplicates
          ...trackingMetadata // Restore tracking metadata that might have been overwritten
        };
        
        console.log('Merged data from both Firestore and API');
      } else if (apiData) {
        // Only have API data
        finalData = apiData;
        console.log('Using API data only');
      } else if (firestoreData) {
        // Only have Firestore data (API failed)
        finalData = firestoreData;
        console.log('Using Firestore data only (API unavailable)');
        
        // Show a notification that we're using cached data
        setSuccess('API is currently unavailable. Showing saved project data.');
      } else {
        // No data from either source
        throw new Error('Could not fetch project data from any source');
      }
      
      // Normalize the planning_id field to ensure consistency
      finalData.planning_id = finalData.planning_id || idToUse;
      
      // Add a flag to indicate data source for UI elements
      finalData.dataSource = apiData ? (firestoreData ? 'both' : 'api') : 'firestore';
      
      console.log('Final normalized project data:', finalData);
      setProject(finalData);
      
      // Set stakeholders
      if (finalData.stakeholders) {
        setStakeholders(finalData.stakeholders);
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
          await addDoc(collection(db, 'userActivity'), {
            userId: currentUser.uid,
            type: 'view',
            projectId: idToUse,
            projectTitle: finalData.planning_title || finalData.planning_name || 'Unnamed Project',
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
        planning_id: idToUse,
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
  
  const checkIfProjectIsTracked = async (projectId) => {
    if (!currentUser) {
      setIsTracked(false);
      return;
    }

    try {
      console.log('Checking if project is tracked:', projectId);
      
      // First try with compound ID
      const compoundId = `${currentUser.uid}_${projectId}`;
      const trackedProjectRef = doc(db, 'trackedProjects', compoundId);
      console.log('Checking document with ID:', compoundId);
      
      const trackedProjectDoc = await getDoc(trackedProjectRef);
      
      if (trackedProjectDoc.exists()) {
        console.log('Project is tracked (found by compound ID)');
        setIsTracked(true);
        return;
      }
      
      // If not found by compound ID, try query
      console.log('Project not found by compound ID, trying query...');
      const trackedProjectsQuery = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid),
        where('projectId', '==', projectId)
      );
      
      const querySnapshot = await getDocs(trackedProjectsQuery);
      
      if (!querySnapshot.empty) {
        console.log('Project is tracked (found by query)');
        setIsTracked(true);
      } else {
        console.log('Project is not tracked');
        setIsTracked(false);
      }
    } catch (error) {
      console.error('Error checking if project is tracked:', error);
      // Don't change tracking state on error
    }
  };

  const handleTrackToggle = async () => {
    if (!currentUser) {
      navigate('/login'); 
      return;
    }

    setIsUpdatingTrackStatus(true);

    try {
      // Check if device is offline
      if (!navigator.onLine) {
        throw new Error('You appear to be offline. Please check your internet connection and try again.');
      }

      const projectToStore = { ...project };
      
      // Make sure we have a valid planning ID - use the one from state or URL params
      const planningIdToUse = project?.planning_id || planning_id;
      
      if (!planningIdToUse) {
        console.error('No valid planning ID found');
        setError('Could not identify project ID. Please try again.');
        setIsUpdatingTrackStatus(false);
        return;
      }

      console.log('Toggling tracking for project:', planningIdToUse);
      
      // Create a unique ID for the document that includes both user ID and project ID
      const documentId = `${currentUser.uid}_${planningIdToUse}`;
      console.log('Using document ID:', documentId);
      
      // Reference to the tracked project document
      const trackedProjectRef = doc(db, 'trackedProjects', documentId);
      
      // Check if user is tracking or untracking the project
      if (isTracked) {
        // User is untracking the project
        console.log('Untracking project...');
        
        // Optimistic UI update - update state before the operation completes
        setIsTracked(false);
        
        try {
          await deleteDoc(trackedProjectRef);
          
          // Create activity entry for untracking
          await addDoc(collection(db, 'userActivity'), {
            userId: currentUser.uid,
            type: 'untrack',
            projectId: planningIdToUse,
            projectTitle: project.planning_title || project.planning_name || 'Unnamed Project',
            timestamp: serverTimestamp()
          });

          console.log('Project untracked successfully');
          setSuccess('Project removed from tracked projects.');
        } catch (error) {
          console.error('Error untracking project:', error);
          // Revert optimistic update on failure
          setIsTracked(true);
          throw error;
        }
      } else {
        // User is tracking the project - store complete project data
        console.log('Tracking project...');
        
        // Optimistic UI update - update state before the operation completes
        setIsTracked(true);
        
        try {
          await setDoc(trackedProjectRef, {
            userId: currentUser.uid,
            projectId: planningIdToUse,
            dateTracked: serverTimestamp(),
            
            // Add essential fields at the root level for better retrieval
            title: project.planning_title || project.planning_name || project.title || project.name || 'Unnamed Project',
            description: project.planning_description || project.description || '',
            value: project.planning_value || project.projectValue || project.value || 0,
            location: project.planning_county || project.county || project.location || '',
            category: project.planning_category || project.category || project.type || 'Uncategorized',
            date: project.planning_date || project.date || serverTimestamp(),
            
            // Store complete project data as well
            projectData: projectToStore,
          });

          // Create activity entry for tracking
          await addDoc(collection(db, 'userActivity'), {
            userId: currentUser.uid,
            type: 'track',
            projectId: planningIdToUse,
            projectTitle: project.planning_title || project.planning_name || 'Unnamed Project',
            timestamp: serverTimestamp()
          });

          console.log('Project tracked successfully');
          setSuccess('Project added to tracked projects.');
        } catch (error) {
          console.error('Error tracking project:', error);
          // Revert optimistic update on failure
          setIsTracked(false);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error updating project tracking status:', error);
      
      // Provide more specific error messages based on error type
      if (error.code === 'permission-denied') {
        setError('You do not have permission to perform this action. Please check your account status.');
      } else if (error.code === 'unavailable' || error.message.includes('offline')) {
        setError('Network error: Please check your internet connection and try again.');
      } else {
        setError(`Failed to update tracking status: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsUpdatingTrackStatus(false);
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
          <p>{project.planning_id || planning_id || 'N/A'}</p>
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
          <div className="project-meta">
            <div className="project-id-display">Project ID: {project.planning_id || planning_id || 'N/A'}</div>
            {isTracked && (
              <div className="tracking-badge">
                <i className="fas fa-bookmark"></i> Tracked
              </div>
            )}
            {project.dataSource === 'firestore' && (
              <div className="data-source-badge cached">
                <i className="fas fa-database"></i> Cached Data
              </div>
            )}
          </div>
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
