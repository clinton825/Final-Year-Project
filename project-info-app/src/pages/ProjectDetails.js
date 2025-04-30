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
  const [debugInfo, setDebugInfo] = useState({
    apiDataAvailable: false,
    firestoreDataAvailable: false,
    isTracked: false,
    combinedSource: 'none',
    timestamp: null
  });
  const [stakeholders, setStakeholders] = useState([]);
  const [isUpdatingTrackStatus, setIsUpdatingTrackStatus] = useState(false);

  useEffect(() => {
    // When component mounts or planning_id changes, fetch project details
    if (planning_id) {
      console.log('Planning ID changed, fetching details:', planning_id);
      setLoading(true);
      setError(null);
      
      // Clean the ID if needed
      const cleanId = extractProjectId(planning_id);
      if (cleanId) {
        fetchProjectDetails(cleanId);
      } else {
        setError('Invalid project ID');
        setLoading(false);
      }
    }
    
    // Cleanup function
    return () => {
      // Reset state on unmount
      setProject(null);
      setStakeholders([]);
      setIsTracked(false);
      setError(null);
      setSuccess(null);
    };
  }, [planning_id]); // Only re-run if planning_id changes

  useEffect(() => {
    // Check tracking status whenever the user or planning_id changes
    if (currentUser && planning_id) {
      console.log('User or planning ID changed, checking tracking status');
      checkIfProjectIsTracked(planning_id);
    } else {
      // Reset tracking state if user is not logged in
      setIsTracked(false);
    }
  }, [currentUser, planning_id]);

  // Effect for success message timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [success]);

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

  // Function to normalize and combine data from API and Firestore
  const combineSources = (apiData, firestoreData) => {
    console.log('Combining data sources...');
    
    // Start with Firestore data if available, otherwise empty object
    let combined = firestoreData ? { ...firestoreData } : {};
    
    // Add API data if available
    if (apiData) {
      // Assign API data properties, being careful not to overwrite existing Firestore data
      Object.keys(apiData).forEach(key => {
        // Don't overwrite existing data unless API value is more substantive
        if (!combined[key] || (combined[key] === 'Unknown' && apiData[key])) {
          combined[key] = apiData[key];
        }
      });
      
      // Ensure we have standard field names for critical fields
      combined.planning_id = combined.planning_id || apiData.planning_id || apiData.id;
      combined.planning_title = combined.planning_title || apiData.planning_title || apiData.planning_name || apiData.title;
      combined.planning_description = combined.planning_description || apiData.planning_description || apiData.description;
      combined.planning_value = combined.planning_value || apiData.planning_value || apiData.value || apiData.projectValue;
      combined.planning_county = combined.planning_county || apiData.planning_county || apiData.county || apiData.location;
      combined.planning_category = combined.planning_category || apiData.planning_category || apiData.category || apiData.type;
    }
    
    // Ensure all critical fields have default values
    combined.planning_id = combined.planning_id || planning_id;
    combined.planning_title = combined.planning_title || 'Unnamed Project';
    combined.planning_description = combined.planning_description || 'No description available';
    combined.planning_value = combined.planning_value || 0;
    combined.planning_county = combined.planning_county || 'Unknown';
    combined.planning_category = combined.planning_category || 'Uncategorized';
    
    // Add data source tracking for debugging
    combined.dataSource = firestoreData ? (apiData ? 'both' : 'firestore') : 'api';
    
    // Add timestamp
    combined.timestamp = new Date().toISOString();
    
    return combined;
  };

  // Function to extract ID from potentially compound IDs
  const extractProjectId = (id) => {
    if (!id) return null;
    
    // Clean up any whitespace first
    let cleanId = id.trim();
    
    // If it's a compound ID (e.g., "userId_projectId"), extract the projectId part
    if (cleanId.includes('_')) {
      cleanId = cleanId.split('_')[1];
      console.log('Extracted project ID from compound ID:', cleanId);
    }
    
    return cleanId;
  };

  // Centralized function to get the tracking document ID
  const getTrackingDocId = (userId, projectId) => {
    if (!userId || !projectId) return null;
    return `${userId}_${projectId}`;
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
        console.log('Checking Firestore for project data...');
        
        // First check the trackedProjects collection (for logged-in users)
        if (currentUser) {
          // Try to get project from trackedProjects collection
          const docId = getTrackingDocId(currentUser.uid, idToUse);
          const trackedProjectRef = doc(db, 'trackedProjects', docId);
          const trackedProjectDoc = await getDoc(trackedProjectRef);
          
          if (trackedProjectDoc.exists()) {
            console.log('Found project in user tracked projects');
            
            // Extract data
            const data = trackedProjectDoc.data();
            
            // Handle different data structures
            if (data.projectData) {
              // If stored in projectData field
              firestoreData = { ...data.projectData };
            } else {
              // If stored at root level
              firestoreData = { ...data };
            }
            
            // Add the ID to the project data
            firestoreData.planning_id = idToUse;
            
            // Set tracked flag
            isProjectTracked = true;
          } else {
            // Try an alternative query approach
            const trackedProjectsQuery = query(
              collection(db, 'trackedProjects'),
              where('userId', '==', currentUser.uid),
              where('projectId', '==', idToUse)
            );
            
            const querySnapshot = await getDocs(trackedProjectsQuery);
            if (!querySnapshot.empty) {
              console.log('Found project via query');
              const data = querySnapshot.docs[0].data();
              
              if (data.projectData) {
                firestoreData = { ...data.projectData };
              } else {
                firestoreData = { ...data };
              }
              
              firestoreData.planning_id = idToUse;
              isProjectTracked = true;
            }
          }
        }
        
        // Next check the projects collection (for all users)
        if (!firestoreData) {
          console.log('Checking projects collection...');
          const projectRef = doc(db, 'projects', idToUse);
          const projectDoc = await getDoc(projectRef);
          
          if (projectDoc.exists()) {
            console.log('Found project in projects collection');
            firestoreData = projectDoc.data();
            firestoreData.planning_id = idToUse;
          }
        }
        
        if (firestoreData) {
          console.log('Firestore data found:', firestoreData);
        } else {
          console.log('No Firestore data found for project');
        }
      } catch (firestoreError) {
        console.error('Error fetching from Firestore:', firestoreError);
      }
      
      // STEP 2: Try to fetch from the API (even if we already have Firestore data)
      try {
        // Check if we should try the API
        if ((config.PRODUCTION || !firestoreData) && config.API_ENABLED) {
          console.log('Fetching from standard API...');
          const apiUrl = `${config.API_URL}/projects/${idToUse}`;
          const response = await fetch(apiUrl);
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.data) {
              apiData = data.data;
              console.log('API data found:', apiData);
            }
          }
        }
        
        // Try direct API as backup
        if ((config.PRODUCTION || !firestoreData) && config.DIRECT_API_ENABLED && !apiData) {
          console.log('Fetching from direct API...');
          
          // Get API keys from config
          const apiKey = config.BUILDINGINFO_API_KEY;
          const uKey = config.BUILDINGINFO_UKEY;
          
          // Ensure we have the API keys
          if (!apiKey || !uKey) {
            console.error('Missing API keys for direct API');
            throw new Error('API configuration is incomplete');
          }
          
          const directApiUrl = `${config.DIRECT_API_URL}/projects/t-projects?api_key=${apiKey}&ukey=${uKey}&planning_id=${idToUse}`;
          const directResponse = await fetch(directApiUrl);
          
          if (directResponse.ok) {
            const directData = await directResponse.json();
            
            // Handle different API response formats
            if (directData && directData.data && directData.data.length > 0) {
              apiData = directData.data[0];
              console.log('Direct API data found (data array):', apiData);
            } else if (directData && directData.projects && directData.projects.length > 0) {
              apiData = directData.projects[0];
              console.log('Direct API data found (projects array):', apiData);
            } else if (directData && Object.keys(directData).length > 0) {
              // If the API returns the project directly
              apiData = directData;
              console.log('Direct API data found (direct object):', apiData);
            }
          }
        }
      } catch (apiError) {
        console.error('Error fetching from API:', apiError);
      }
      
      // STEP 3: Generate mock data if nothing found and we're in development
      if (!apiData && !firestoreData && !config.PRODUCTION) {
        console.log('Generating mock data for development');
        firestoreData = {
          planning_id: idToUse,
          planning_title: 'Demo Project',
          planning_description: 'This is a demo project for development purposes',
          planning_value: 1500000,
          planning_county: 'Dublin',
          planning_category: 'Residential',
          planning_status: 'Planning',
          date: new Date().toISOString()
        };
      }
      
      // STEP 4: Set the project in state with proper error handling
      if (apiData || firestoreData) {
        // Combine data from both sources if available
        const combinedData = combineSources(apiData, firestoreData);
        console.log('Final normalized project data:', combinedData);
        
        // Update state with combined data
        setProject(combinedData);
        
        // Extract stakeholders if available
        if (combinedData.stakeholders || combinedData.companies) {
          const stakeholdersData = combinedData.stakeholders || combinedData.companies || [];
          setStakeholders(stakeholdersData);
        } else if (!config.PRODUCTION) {
          // Add mock stakeholders in development mode
          setStakeholders([
            { name: 'Developer', organization: 'XYZ Development', role: 'Lead Developer' },
            { name: 'Architect', organization: 'ABC Architects', role: 'Design Lead' }
          ]);
        }
        
        // If this is a tracked project, update state
        if (isProjectTracked) {
          setIsTracked(true);
        }
        
        // Set debug info
        setDebugInfo({
          apiDataAvailable: !!apiData,
          firestoreDataAvailable: !!firestoreData,
          isTracked: isProjectTracked,
          combinedSource: combinedData.dataSource,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('No project data found from any source');
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
      setError(`Failed to load project details: ${error.message}`);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  const checkIfProjectIsTracked = async (projectId) => {
    if (!currentUser || !projectId) {
      console.log('No user or project ID, setting tracked to false');
      setIsTracked(false);
      return;
    }

    try {
      console.log('Checking if project is tracked:', projectId);
      
      // First try with compound ID
      const compoundId = getTrackingDocId(currentUser.uid, projectId);
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
        // One more attempt - try finding by planning_id field
        console.log('Trying one more attempt with planning_id field...');
        const planningIdQuery = query(
          collection(db, 'trackedProjects'),
          where('userId', '==', currentUser.uid),
          where('planning_id', '==', projectId)
        );
        
        const planningIdSnapshot = await getDocs(planningIdQuery);
        
        if (!planningIdSnapshot.empty) {
          console.log('Project is tracked (found by planning_id field)');
          setIsTracked(true);
        } else {
          console.log('Project is not tracked after all attempts');
          setIsTracked(false);
        }
      }
    } catch (error) {
      console.error('Error checking if project is tracked:', error);
      // Don't change tracking state on error
    }
  };

  const handleTrackToggle = async () => {
    if (!currentUser) {
      console.log('No user logged in, redirecting to login');
      navigate('/login'); 
      return;
    }

    if (!project || !project.planning_id) {
      console.error('Cannot track project: No valid project data available');
      setError('Cannot track this project. Missing project information.');
      return;
    }

    // Show loading state
    setLoading(true);
    
    try {
      // Safely get the planning ID from the project data
      const planningIdToUse = project.planning_id || planning_id;
      console.log('Using planning ID for tracking:', planningIdToUse);
      
      // Create a compound ID for the document
      const compoundId = getTrackingDocId(currentUser.uid, planningIdToUse);
      console.log('Document compound ID:', compoundId);
      
      // Reference to the tracked project document
      const trackedProjectRef = doc(db, 'trackedProjects', compoundId);
      
      // Create simplified project data to store
      const projectToStore = {
        planning_id: planningIdToUse,
        planning_title: project.planning_title || project.planning_name || project.title || 'Unnamed Project',
        planning_category: project.planning_category || project.category || 'Uncategorized',
        planning_county: project.planning_county || project.county || project.location || 'Unknown',
        planning_value: project.planning_value || project.value || 0,
        planning_status: project.planning_status || project.planning_stage || project.status || 'Unknown',
        planning_description: project.planning_description || project.description || 'No description available',
        tracked_date: new Date().toISOString()
      };
      
      // Check if we're tracking or untracking
      if (isTracked) {
        console.log('Untracking project:', planningIdToUse);
        
        // Check if document exists before attempting to delete
        const docSnap = await getDoc(trackedProjectRef);
        if (docSnap.exists()) {
          await deleteDoc(trackedProjectRef);
          console.log('Successfully untracked project');
          
          // Log untrack activity
          await addDoc(collection(db, 'userActivity'), {
            userId: currentUser.uid,
            type: 'untrack',
            projectId: planningIdToUse,
            projectTitle: projectToStore.planning_title,
            timestamp: serverTimestamp()
          });
          
          setSuccess('Project removed from tracked projects');
          setIsTracked(false); // Update state immediately
        } else {
          console.log('Document did not exist, trying alternative query');
          
          // Try alternative query to find and delete the document
          const q = query(
            collection(db, 'trackedProjects'),
            where('userId', '==', currentUser.uid),
            where('projectId', '==', planningIdToUse)
          );
          
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            // Delete all matching documents (should be only one)
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
              deletePromises.push(deleteDoc(doc.ref));
            });
            
            await Promise.all(deletePromises);
            console.log('Successfully untracked project via query');
            setSuccess('Project removed from tracked projects');
            setIsTracked(false); // Update state immediately
          } else {
            console.log('No tracked project found to untrack');
            setError('Project was not in your tracked list');
          }
        }
      } else {
        console.log('Tracking project:', planningIdToUse);
        
        // Set tracking document with compound ID
        await setDoc(trackedProjectRef, {
          userId: currentUser.uid,
          projectId: planningIdToUse,
          planning_id: planningIdToUse, // Store as separate field for queries
          trackedAt: serverTimestamp(),
          lastViewed: serverTimestamp(),
          projectData: projectToStore,
        });
        
        console.log('Successfully tracked project');
        
        // Log track activity
        await addDoc(collection(db, 'userActivity'), {
          userId: currentUser.uid,
          type: 'track',
          projectId: planningIdToUse,
          projectTitle: projectToStore.planning_title,
          timestamp: serverTimestamp()
        });
        
        setSuccess('Project added to your tracked projects');
        setIsTracked(true); // Update state immediately
      }
      
    } catch (error) {
      console.error('Error toggling project tracking:', error);
      setError(`Failed to ${isTracked ? 'untrack' : 'track'} project: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/projects');
  };

  const renderOverviewTab = () => {
    if (!project) return <div>Loading project details...</div>;
    
    // Extract project details with fallbacks
    const {
      planning_title = 'Unnamed Project',
      planning_description = 'No description available',
      planning_value = 0,
      planning_county = 'Unknown',
      planning_category = 'Uncategorized',
      planning_status = project.planning_stage || project.status || 'Unknown',
      planning_date = project.date || project.planning_date || 'Unknown',
      planning_development_address_1 = project.address || project.location || '',
      planning_development_address_2 = '',
      planning_development_town = project.town || '',
      planning_development_county = project.county || planning_county || '',
      planning_id: projectId = planning_id,
    } = project;
    
    // Format currency
    const formatCurrency = (value) => {
      if (!value || isNaN(parseFloat(value))) return 'Not Available';
      
      // Try to convert to number if it's a string
      let numValue = typeof value === 'string' 
        ? parseFloat(value.replace(/[^0-9.-]+/g, '')) 
        : value;
      
      if (isNaN(numValue)) return 'Not Available';
      
      return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
      }).format(numValue);
    };
    
    // Format date
    const formatDate = (dateStr) => {
      if (!dateStr || dateStr === 'Unknown') return 'Not Available';
      
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Not Available';
        
        return new Intl.DateTimeFormat('en-IE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).format(date);
      } catch (e) {
        return 'Not Available';
      }
    };
    
    // Construct full address
    const fullAddress = [
      planning_development_address_1,
      planning_development_address_2,
      planning_development_town,
      planning_development_county
    ].filter(Boolean).join(', ');
    
    return (
      <div className="project-overview">
        <div className="overview-section description-section">
          <h3>Project Description</h3>
          <p>{planning_description}</p>
        </div>
        
        <div className="overview-grid">
          <div className="overview-section details-section">
            <h3>Project Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Project ID:</span>
                <span className="detail-value">{projectId || 'Not Available'}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Category:</span>
                <span className="detail-value">{planning_category}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value status">{planning_status}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Value:</span>
                <span className="detail-value">{formatCurrency(planning_value)}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Application Date:</span>
                <span className="detail-value">{formatDate(planning_date)}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">County:</span>
                <span className="detail-value">{planning_county}</span>
              </div>
            </div>
          </div>
          
          <div className="overview-section location-section">
            <h3>Location</h3>
            <div className="location-details">
              <div className="location-icon">
                <i className="fas fa-map-marker-alt"></i>
              </div>
              <div className="location-address">
                {fullAddress || 'Location details not available'}
              </div>
            </div>
            
            {/* Placeholder for map - would be implemented with Google Maps or similar */}
            <div className="location-map-placeholder">
              <i className="fas fa-map"></i>
              <p>Map view would be displayed here</p>
            </div>
          </div>
        </div>
        
        {debugInfo.apiDataAvailable && (
          <div className="data-source-info">
            <p>Data Source: {debugInfo.combinedSource}</p>
            <p>API Data Available: {debugInfo.apiDataAvailable ? 'Yes' : 'No'}</p>
            <p>Firestore Data Available: {debugInfo.firestoreDataAvailable ? 'Yes' : 'No'}</p>
            <p>Is Tracked: {debugInfo.isTracked ? 'Yes' : 'No'}</p>
          </div>
        )}
      </div>
    );
  };

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

  const TrackingButton = () => {
    if (!currentUser) {
      return (
        <button className="track-button" onClick={() => navigate('/login')}>
          <i className="fas fa-user-lock"></i>
          Login to Track Project
        </button>
      );
    }
    
    return (
      <button 
        className={`track-button ${isTracked ? 'tracked' : ''}`}
        onClick={handleTrackToggle}
        disabled={loading}
      >
        {loading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            Loading...
          </>
        ) : isTracked ? (
          <>
            <i className="fas fa-times-circle"></i>
            Untrack Project
          </>
        ) : (
          <>
            <i className="fas fa-plus-circle"></i>
            Track Project
          </>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="project-details">
        <div className="loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading project details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-details">
        <div className="error-container">
          <div className="error">
            <i className="fas fa-exclamation-triangle"></i>
            <p>{error}</p>
          </div>
          <button className="back-button" onClick={handleBack}>
            <i className="fas fa-arrow-left"></i>
            Return to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-details">
        <div className="error-container">
          <div className="error">Project not found</div>
          <button className="back-button" onClick={handleBack}>
            <i className="fas fa-arrow-left"></i>
            Back to Projects
          </button>
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
        <i className="fas fa-arrow-left"></i>
        Back to Projects
      </button>

      <div className="project-header">
        <div className="project-title-section">
          <h1>{project.planning_title || project.planning_name || project.title || 'Unnamed Project'}</h1>
          <div className="project-meta">
            <span className="project-id-display">
              <i className="fas fa-hashtag"></i>
              {project.planning_id || planning_id}
            </span>
            
            {isTracked && (
              <span className="tracking-badge">
                <i className="fas fa-bookmark"></i>
                Tracked
              </span>
            )}
            
            {project.dataSource && (
              <span className={`data-source-badge ${project.dataSource !== 'api' ? 'cached' : ''}`}>
                <i className={project.dataSource === 'api' ? 'fas fa-cloud-download-alt' : 'fas fa-database'}></i>
                {project.dataSource === 'api' ? 'Live Data' : 
                 project.dataSource === 'both' ? 'Combined Data' : 'Cached Data'}
              </span>
            )}
          </div>
        </div>
        
        <TrackingButton />
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
