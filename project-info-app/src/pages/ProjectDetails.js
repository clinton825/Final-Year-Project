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
      
      // Add a small delay to ensure auth is fully initialized in production
      const timer = setTimeout(() => {
        checkIfProjectIsTracked(projectId);
      }, 500);
      
      return () => clearTimeout(timer);
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
      
      // STEP 1: Try to find the project in Firestore first
      try {
        // First check the trackedProjects collection (for logged-in users)
        if (currentUser) {
          // Try to get project from trackedProjects collection
          const docId = `${currentUser.uid}_${idToUse}`;
          const trackedProjectRef = doc(db, 'trackedProjects', docId);
          const trackedProjectDoc = await getDoc(trackedProjectRef);
          
          if (trackedProjectDoc.exists()) {
            console.log('✅ Found project in trackedProjects collection');
            const data = trackedProjectDoc.data();
            
            // If we have complete project data stored, use it
            if (data.projectData) {
              firestoreData = data.projectData;
              isProjectTracked = true;
              console.log('Using complete project data from trackedProjects');
            } else {
              console.log('Project found in trackedProjects but missing complete data');
            }
          } else {
            console.log('No matching project found in trackedProjects by ID:', docId);
            
            // Second try: projects collection
            try {
              const projectRef = doc(db, 'projects', idToUse);
              const projectDoc = await getDoc(projectRef);
              
              if (projectDoc.exists()) {
                console.log('✅ Found project in projects collection');
                firestoreData = projectDoc.data();
              } else {
                console.log('No matching project found in Firestore');
              }
            } catch (projectsError) {
              console.error('Error querying projects collection:', projectsError);
            }
          }
        } else {
          // If user is not logged in, try to get from projects collection directly
          const projectRef = doc(db, 'projects', idToUse);
          const projectDoc = await getDoc(projectRef);
          
          if (projectDoc.exists()) {
            console.log('✅ Found project in projects collection (anonymous user)');
            firestoreData = projectDoc.data();
          } else {
            console.log('No matching project found in Firestore (anonymous user)');
          }
        }
      } catch (firestoreError) {
        console.error('Error fetching from Firestore:', firestoreError);
        // We'll continue and try the API
      }
      
      // STEP 2: Try to fetch from the configured API (even if we already have Firestore data)
      try {
        // Use the API URL from config, which now handles environment differences
        console.log(`Fetching from configured API: ${config.API_URL}/api/project/${idToUse}`);
        const response = await fetchWithRetry(`${config.API_URL}/api/project/${idToUse}`);
        
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
          
          // If we're in production and the API didn't work, try a direct API call as fallback
          if ((config.PRODUCTION || !firestoreData) && config.DIRECT_API_ENABLED) {
            try {
              console.log('Attempting direct BuildingInfo API call as fallback (production fallback)');
              const directApiUrl = `${config.DIRECT_API_URL}/projects/t-projects?api_key=${config.BUILDINGINFO_API_KEY}&ukey=${config.BUILDINGINFO_UKEY}&planning_id=${idToUse}`;
              
              console.log(`Attempting fallback direct API`);
              
              const directResponse = await fetch(directApiUrl);
              if (directResponse.ok) {
                const directData = await directResponse.json();
                if (directData && directData.projects && directData.projects.length > 0) {
                  console.log('✅ Successfully fetched direct BuildingInfo API data');
                  // Map API response to our expected structure
                  apiData = directData.projects[0];
                } else {
                  console.warn('Direct API response missing projects data structure:', directData);
                }
              } else {
                console.warn(`Direct API returned status: ${directResponse.status}`);
              }
            } catch (directApiError) {
              console.error('Error fetching from direct BuildingInfo API:', directApiError);
            }
          }
        }
      } catch (apiError) {
        console.error('Error fetching from API:', apiError);
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
      console.log('No authenticated user, project cannot be tracked');
      setIsTracked(false);
      return;
    }

    try {
      console.log('Checking if project is tracked:', projectId);
      console.log('Current user UID:', currentUser.uid);
      console.log('Environment:', window.location.hostname === 'localhost' ? 'Development' : 'Production');
      
      // Verify authentication state is fully initialized
      if (!currentUser.uid) {
        console.error('User UID is not available, cannot check tracked status');
        setIsTracked(false);
        return;
      }
      
      // Try query approach first - more reliable across environments
      try {
        console.log('Checking with query approach first...');
        const trackedProjectsQuery = query(
          collection(db, 'trackedProjects'),
          where('userId', '==', currentUser.uid),
          where('projectId', '==', projectId)
        );
        
        const querySnapshot = await getDocs(trackedProjectsQuery);
        
        if (!querySnapshot.empty) {
          console.log('Project is tracked (found by query)');
          setIsTracked(true);
          return;
        }
        
        // If not found by query, try with compound ID as fallback
        console.log('Project not found by query, trying compound ID...');
        const compoundId = `${currentUser.uid}_${projectId}`;
        const trackedProjectRef = doc(db, 'trackedProjects', compoundId);
        console.log('Checking document with ID:', compoundId);
        
        const trackedProjectDoc = await getDoc(trackedProjectRef);
        
        if (trackedProjectDoc.exists()) {
          console.log('Project is tracked (found by compound ID)');
          setIsTracked(true);
        } else {
          console.log('Project is not tracked (not found by either method)');
          setIsTracked(false);
        }
      } catch (queryError) {
        console.error('Error querying tracked projects:', queryError);
        console.log('Query error details:', queryError.code, queryError.message);
        
        // Try direct document access as last resort
        try {
          console.log('Query failed, trying direct document access...');
          const compoundId = `${currentUser.uid}_${projectId}`;
          const trackedProjectRef = doc(db, 'trackedProjects', compoundId);
          
          const trackedProjectDoc = await getDoc(trackedProjectRef);
          
          if (trackedProjectDoc.exists()) {
            console.log('Project is tracked (found by direct document access)');
            setIsTracked(true);
          } else {
            console.log('Project is not tracked (confirmed by direct document access)');
            setIsTracked(false);
          }
        } catch (docError) {
          console.error('Direct document access also failed:', docError);
          console.log('Document error details:', docError.code, docError.message);
          // Default to untracked on all errors
          setIsTracked(false);
        }
      }
    } catch (error) {
      console.error('Error checking if project is tracked:', error);
      console.log('Error details:', error.code, error.message);
      // Default to untracked on any error for safer operation
      setIsTracked(false);
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

      // Debug information for troubleshooting in Vercel environment
      console.log('Current user ID:', currentUser.uid);
      console.log('Auth state:', currentUser ? 'Logged in' : 'Not logged in');
      console.log('Environment:', window.location.hostname === 'localhost' ? 'Development' : 'Production');

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
          // First try to find the document by query to handle different ID formats
          const trackedProjectsQuery = query(
            collection(db, 'trackedProjects'),
            where('userId', '==', currentUser.uid),
            where('projectId', '==', planningIdToUse)
          );
          
          const querySnapshot = await getDocs(trackedProjectsQuery);
          
          if (!querySnapshot.empty) {
            // Delete all matching documents (should be just one)
            const deletePromises = [];
            querySnapshot.forEach(doc => {
              console.log('Deleting document with ID:', doc.id);
              deletePromises.push(deleteDoc(doc.ref));
            });
            
            await Promise.all(deletePromises);
          } else {
            // Fallback to direct document delete if query finds nothing
            console.log('No documents found by query, trying direct delete...');
            await deleteDoc(trackedProjectRef);
          }
          
          try {
            // Create activity entry for untracking
            await addDoc(collection(db, 'userActivity'), {
              userId: currentUser.uid,
              type: 'untrack',
              projectId: planningIdToUse,
              projectTitle: project.planning_title || project.planning_name || 'Unnamed Project',
              timestamp: serverTimestamp()
            });
          } catch (activityError) {
            // Don't fail the whole operation if activity logging fails
            console.warn('Could not log activity, but untracking succeeded:', activityError);
          }

          console.log('Project untracked successfully');
          setSuccess('Project removed from tracked projects.');
        } catch (error) {
          console.error('Error untracking project:', error);
          // Detailed error logging for Vercel troubleshooting
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          
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
          // Normalize the project data to avoid undefined fields
          const normalizedProject = {
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
          };
          
          // First ensure the project data is clean - remove any undefined or problematic values
          const cleanProjectData = {};
          Object.keys(projectToStore).forEach(key => {
            if (projectToStore[key] !== undefined && projectToStore[key] !== null) {
              cleanProjectData[key] = projectToStore[key];
            }
          });
          
          // Add the cleaned project data
          normalizedProject.projectData = cleanProjectData;
          
          // Store in Firestore
          await setDoc(trackedProjectRef, normalizedProject);

          try {
            // Create activity entry for tracking
            await addDoc(collection(db, 'userActivity'), {
              userId: currentUser.uid,
              type: 'track',
              projectId: planningIdToUse,
              projectTitle: project.planning_title || project.planning_name || 'Unnamed Project',
              timestamp: serverTimestamp()
            });
          } catch (activityError) {
            // Don't fail the whole operation if activity logging fails
            console.warn('Could not log activity, but tracking succeeded:', activityError);
          }

          console.log('Project tracked successfully');
          setSuccess('Project added to tracked projects.');
        } catch (error) {
          console.error('Error tracking project:', error);
          // Detailed error logging for Vercel troubleshooting
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          
          // Revert optimistic update on failure
          setIsTracked(false);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error updating project tracking status:', error);
      console.error('Error stack:', error.stack);
      
      // Provide more specific error messages based on error type
      if (error.code === 'permission-denied') {
        setError('You do not have permission to perform this action. Please check your account status.');
      } else if (error.code === 'unavailable' || error.message?.includes('offline')) {
        setError('Network error: Please check your internet connection and try again.');
      } else if (error.code === 'not-found') {
        setError('The project could not be found. It may have been deleted.');
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
