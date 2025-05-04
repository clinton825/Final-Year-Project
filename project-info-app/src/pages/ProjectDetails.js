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

const API_BASE_URL = config.API_URL || 'http://localhost:8080';
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
    
    let idToUse = planning_id;
    if (typeof planning_id === 'string' && planning_id.includes('_')) {
      idToUse = planning_id.split('_')[1]; 
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
      
      const timer = setTimeout(() => {
        checkIfProjectIsTracked(projectId);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [project, currentUser]);
  
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        
        if (retries < maxRetries - 1) {
          console.warn(`Fetch attempt ${retries + 1} failed with status ${response.status}. Retrying...`);
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          continue;
        }
        
        return response;
      } catch (error) {
        if (retries < maxRetries - 1) {
          console.warn(`Fetch attempt ${retries + 1} failed with error: ${error.message}. Retrying...`);
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          continue;
        }
        
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
      
      let apiData = null;
      let firestoreData = null;
      let isProjectTracked = false;
      
      try {
        if (currentUser) {
          const docId = `${currentUser.uid}_${idToUse}`;
          const trackedProjectRef = doc(db, 'trackedProjects', docId);
          
          try {
            const trackedProjectDoc = await getDoc(trackedProjectRef);
            
            if (trackedProjectDoc.exists()) {
              console.log('✅ Found project in trackedProjects collection');
              const data = trackedProjectDoc.data();
              
              if (data.projectData) {
                firestoreData = data.projectData;
                isProjectTracked = true;
                console.log('Using complete project data from trackedProjects');
              } else {
                console.log('Project found in trackedProjects but missing complete data');
              }
            } else {
              console.log('No matching project found in trackedProjects by ID:', docId);
              
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
          } catch (firestoreDocError) {
            console.error('Error accessing Firestore document:', firestoreDocError);
          }
        } else {
          try {
            const projectRef = doc(db, 'projects', idToUse);
            const projectDoc = await getDoc(projectRef);
            
            if (projectDoc.exists()) {
              console.log('✅ Found project in projects collection (anonymous user)');
              firestoreData = projectDoc.data();
            } else {
              console.log('No matching project found in Firestore (anonymous user)');
            }
          } catch (anonError) {
            console.error('Error accessing Firestore for anonymous user:', anonError);
          }
        }
      } catch (firestoreError) {
        console.error('Error fetching from Firestore:', firestoreError);
      }
      
      try {
        console.log(`Fetching from configured API: ${config.API_URL}/api/project/${idToUse}`);
        const response = await fetchWithRetry(`${config.API_URL}/api/project/${idToUse}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.project) {
            console.log('✅ Successfully fetched API data');
            apiData = data.project;
          } else {
            console.warn('API response missing project data structure:', data);
          }
        } else {
          console.warn(`API returned status: ${response.status}`);
        }
      } catch (apiError) {
        console.error('Error fetching from API:', apiError);
      }
      
      setIsTracked(isProjectTracked);
      
      let finalData;
      
      if (apiData && firestoreData) {
        const trackingMetadata = {
          docId: firestoreData.docId,
          trackedAt: firestoreData.trackedAt,
          userId: firestoreData.userId,
          notes: firestoreData.notes
        };
        
        finalData = { 
          ...firestoreData,  
          ...apiData,        
          ...trackingMetadata 
        };
        
        console.log('Merged data from both Firestore and API');
      } else if (apiData) {
        finalData = apiData;
        console.log('Using API data only');
      } else if (firestoreData) {
        finalData = firestoreData;
        console.log('Using Firestore data only (API unavailable)');
        
        setSuccess('API is currently unavailable. Showing saved project data.');
      } else {
        throw new Error('Could not fetch project data from any source');
      }
      
      finalData.planning_id = finalData.planning_id || idToUse;
      
      finalData.dataSource = apiData ? (firestoreData ? 'both' : 'api') : 'firestore';
      
      console.log('Final normalized project data:', finalData);
      setProject(finalData);
      
      if (finalData.stakeholders) {
        setStakeholders(finalData.stakeholders);
      } else if (finalData.companies && finalData.companies.length > 0) {
        setStakeholders(finalData.companies.map(company => ({
          name: company.company_name || 'Unknown',
          organization: company.planning_company_type_name?.company_type_name || 'Company',
          role: company.company_role || 'Stakeholder'
        })));
      } else {
        setStakeholders([]);
      }
      
      setLoading(false);
      
      if (currentUser) {
        try {
          await addDoc(collection(db, 'userActivity'), {
            userId: currentUser.uid,
            type: 'view',
            projectId: idToUse,
            projectTitle: finalData.planning_title || finalData.planning_name || 'Unnamed Project',
            timestamp: serverTimestamp()
          }).catch(err => {
            console.warn('Failed to log view activity but continuing:', err);
          });
        } catch (activityError) {
          console.warn('Error logging activity but continuing:', activityError);
        }
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
      setError(`Failed to load project: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const storeTrackedProjectLocally = (projectId, isTracked) => {
    try {
      if (!currentUser) return;
      
      const userId = currentUser.uid;
      const trackedProjects = JSON.parse(localStorage.getItem('trackedProjects') || '{}');
      
      if (!trackedProjects[userId]) {
        trackedProjects[userId] = {};
      }
      
      if (isTracked) {
        trackedProjects[userId][projectId] = {
          tracked: true,
          timestamp: new Date().toISOString()
        };
      } else {
        delete trackedProjects[userId][projectId];
      }
      
      localStorage.setItem('trackedProjects', JSON.stringify(trackedProjects));
      console.log(`Project ${projectId} tracking status stored locally: ${isTracked}`);
    } catch (error) {
      console.error('Error storing tracked project in localStorage:', error);
    }
  };
  
  const getLocalTrackedStatus = (projectId) => {
    try {
      if (!currentUser) return false;
      
      const userId = currentUser.uid;
      const trackedProjects = JSON.parse(localStorage.getItem('trackedProjects') || '{}');
      
      return trackedProjects[userId]?.[projectId]?.tracked || false;
    } catch (error) {
      console.error('Error getting tracked status from localStorage:', error);
      return false;
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
      
      const locallyTracked = getLocalTrackedStatus(projectId);
      console.log('LocalStorage tracking status:', locallyTracked ? 'Tracked' : 'Not tracked');
      
      setIsTracked(locallyTracked);
      
      try {
        const trackedProjectsQuery = query(
          collection(db, 'trackedProjects'),
          where('userId', '==', currentUser.uid),
          where('projectId', '==', projectId)
        );
        
        const querySnapshot = await getDocs(trackedProjectsQuery);
        
        if (!querySnapshot.empty) {
          console.log('Project is tracked (found by query)');
          setIsTracked(true);
          storeTrackedProjectLocally(projectId, true);
          return;
        }
        
        console.log('Project not found by query, trying compound ID...');
        const compoundId = `${currentUser.uid}_${projectId}`;
        const trackedProjectRef = doc(db, 'trackedProjects', compoundId);
        console.log('Checking document with ID:', compoundId);
        
        const trackedProjectDoc = await getDoc(trackedProjectRef);
        
        if (trackedProjectDoc.exists()) {
          console.log('Project is tracked (found by compound ID)');
          setIsTracked(true);
          storeTrackedProjectLocally(projectId, true);
        } else {
          console.log('Project is not tracked (not found by either method)');
          setIsTracked(false);
          storeTrackedProjectLocally(projectId, false);
        }
      } catch (queryError) {
        console.error('Error querying tracked projects:', queryError);
        
        if (queryError.code === 'unavailable' || queryError.message?.includes('offline')) {
          console.log('Firebase unavailable, using localStorage tracking status:', locallyTracked);
          setIsTracked(locallyTracked);
        } else {
          try {
            console.log('Query failed, trying direct document access...');
            const compoundId = `${currentUser.uid}_${projectId}`;
            const trackedProjectRef = doc(db, 'trackedProjects', compoundId);
            
            const trackedProjectDoc = await getDoc(trackedProjectRef);
            
            if (trackedProjectDoc.exists()) {
              console.log('Project is tracked (found by direct document access)');
              setIsTracked(true);
              storeTrackedProjectLocally(projectId, true);
            } else {
              console.log('Project is not tracked (confirmed by direct document access)');
              setIsTracked(false);
              storeTrackedProjectLocally(projectId, false);
            }
          } catch (docError) {
            console.error('Direct document access also failed:', docError);
            
            console.log('Using localStorage as final fallback, status:', locallyTracked);
            setIsTracked(locallyTracked);
          }
        }
      }
    } catch (error) {
      console.error('Error checking if project is tracked:', error);
      
      const locallyTracked = getLocalTrackedStatus(projectId);
      console.log('Using localStorage as error fallback, status:', locallyTracked);
      setIsTracked(locallyTracked);
    }
  };

  const handleTrackToggle = async () => {
    if (!currentUser) {
      navigate('/login'); 
      return;
    }

    setIsUpdatingTrackStatus(true);

    try {
      if (!navigator.onLine) {
        throw new Error('You appear to be offline. Please check your internet connection and try again.');
      }

      const projectToStore = { ...project };
      
      const planningIdToUse = project?.planning_id || planning_id;
      
      if (!planningIdToUse) {
        console.error('No valid planning ID found');
        setError('Could not identify project ID. Please try again.');
        setIsUpdatingTrackStatus(false);
        return;
      }

      console.log('Toggling tracking for project:', planningIdToUse);
      
      const documentId = `${currentUser.uid}_${planningIdToUse}`;
      console.log('Using document ID:', documentId);
      
      const trackedProjectRef = doc(db, 'trackedProjects', documentId);
      
      if (isTracked) {
        console.log('Untracking project...');
        
        setIsTracked(false);
        
        storeTrackedProjectLocally(planningIdToUse, false);
        
        try {
          const trackedProjectsQuery = query(
            collection(db, 'trackedProjects'),
            where('userId', '==', currentUser.uid),
            where('projectId', '==', planningIdToUse)
          );
          
          const querySnapshot = await getDocs(trackedProjectsQuery);
          
          if (!querySnapshot.empty) {
            const deletePromises = [];
            querySnapshot.forEach(doc => {
              console.log('Deleting document with ID:', doc.id);
              deletePromises.push(deleteDoc(doc.ref));
            });
            
            await Promise.all(deletePromises);
          } else {
            console.log('No documents found by query, trying direct delete...');
            await deleteDoc(trackedProjectRef);
          }
          
          try {
            await addDoc(collection(db, 'userActivity'), {
              userId: currentUser.uid,
              type: 'untrack',
              projectId: planningIdToUse,
              projectTitle: project.planning_title || project.planning_name || 'Unnamed Project',
              timestamp: serverTimestamp()
            });
          } catch (activityError) {
            console.warn('Could not log activity, but untracking succeeded:', activityError);
          }

          console.log('Project untracked successfully');
          setSuccess('Project removed from tracked projects.');
        } catch (error) {
          console.error('Error untracking project:', error);
          
          if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.log('Firestore unavailable, but localStorage updated successfully');
            setSuccess('Project removed from tracked projects (offline mode).');
          } else {
            setIsTracked(true);
            storeTrackedProjectLocally(planningIdToUse, true);
            throw error;
          }
        }
      } else {
        console.log('Tracking project...');
        
        setIsTracked(true);
        
        storeTrackedProjectLocally(planningIdToUse, true);
        
        try {
          const normalizedProject = {
            userId: currentUser.uid,
            projectId: planningIdToUse,
            dateTracked: serverTimestamp(),
            
            title: project.planning_title || project.planning_name || project.title || project.name || 'Unnamed Project',
            description: project.planning_description || project.description || '',
            value: project.planning_value || project.projectValue || project.value || 0,
            location: project.planning_county || project.county || project.location || '',
            category: project.planning_category || project.category || project.type || 'Uncategorized',
            date: project.planning_date || project.date || serverTimestamp(),
          };
          
          const cleanProjectData = {};
          Object.keys(projectToStore).forEach(key => {
            if (projectToStore[key] !== undefined && projectToStore[key] !== null) {
              cleanProjectData[key] = projectToStore[key];
            }
          });
          
          normalizedProject.projectData = cleanProjectData;
          
          await setDoc(trackedProjectRef, normalizedProject);

          try {
            await addDoc(collection(db, 'userActivity'), {
              userId: currentUser.uid,
              type: 'track',
              projectId: planningIdToUse,
              projectTitle: project.planning_title || project.planning_name || 'Unnamed Project',
              timestamp: serverTimestamp()
            });
          } catch (activityError) {
            console.warn('Could not log activity, but tracking succeeded:', activityError);
          }

          console.log('Project tracked successfully');
          setSuccess('Project added to tracked projects.');
        } catch (error) {
          console.error('Error tracking project:', error);
          
          if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.log('Firestore unavailable, but localStorage updated successfully');
            setSuccess('Project added to tracked projects (offline mode).');
          } else {
            setIsTracked(false);
            storeTrackedProjectLocally(planningIdToUse, false);
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error updating project tracking status:', error);
      
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
          {currentUser && (
            <p className="empty-state-tip">When stakeholder information becomes available, it will appear here.</p>
          )}
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
