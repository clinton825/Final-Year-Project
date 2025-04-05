import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, getDoc, setDoc, deleteDoc, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getDatabase, ref, set } from "firebase/database";
import { getAuth } from "firebase/auth";
import NotesList from '../components/notes/NotesList';
import GettingStartedWidget from '../components/onboarding/GettingStartedWidget';
import { useOnboarding } from '../contexts/OnboardingContext';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { FaCog, FaHome, FaTimes, FaUndo, FaChartBar, FaTable, FaThLarge, FaChartPie, FaHistory } from 'react-icons/fa';
import './Dashboard.css';
import './GettingStartedToggle.css';
import SpendingChartWidget from '../components/dashboard/widgets/SpendingChartWidget';
import ProjectStageWidget from '../components/dashboard/widgets/ProjectStageWidget';
import TrackedProjectsWidget from '../components/dashboard/widgets/TrackedProjectsWidget';
import RecentActivityWidget from '../components/dashboard/widgets/RecentActivityWidget';

// Export the updateDashboardCache function
export const updateDashboardCache = async (currentUser, trackedProjects, setDashboardCache) => {
  try {
    if (!currentUser) {
      return;
    }
    
    // Safety check for trackedProjects
    if (!trackedProjects || !Array.isArray(trackedProjects)) {
      if (setDashboardCache) {
        setDashboardCache({isLoading: false, totalTrackedProjects: 0});
      }
      return;
    }
    
    // Calculate project statistics
    const projectsByStatus = trackedProjects.reduce((acc, project) => {
      // Get status from any of several possible fields
      const status = 
        project.planning_stage || 
        project.status || 
        project.stage || 
        'Unknown';
      
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate value by category
    const valueByCategory = trackedProjects.reduce((acc, project) => {
      // Get category from any of several possible fields
      const category = 
        project.category || 
        project.planning_category || 
        project.type || 
        'Other';
      
      // Get value from any of several possible fields
      let value = 
        project.projectValue || 
        project.planning_value || 
        project.value || 
        0;
      
      // Handle string values (with currency symbols)
      if (typeof value === 'string') {
        value = parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
      }
      
      acc[category] = (acc[category] || 0) + Number(value);
      return acc;
    }, {});
    
    // Create cache object
    const cacheData = {
      userId: currentUser.uid,
      totalTrackedProjects: trackedProjects.length,
      projectsByStatus,
      valueByCategory,
      lastUpdated: serverTimestamp()
    };
    
    console.log('Updating dashboard cache with data:', cacheData);
    
    if (setDashboardCache) {
      setDashboardCache({
        ...cacheData,
        isLoading: false
      });
    }
    
    // Store in Firestore
    try {
      const cacheDocRef = doc(db, 'dashboardCache', currentUser.uid);
      await setDoc(cacheDocRef, cacheData);
      
      console.log('Dashboard cache updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating dashboard cache in Firestore:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in updateDashboardCache:', error);
    return false;
  }
};

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { completedTasks, checkTaskCompleted } = useOnboarding();
  const navigate = useNavigate();
  const [trackedProjects, setTrackedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [userData, setUserData] = useState(null);
  const [showGettingStarted, setShowGettingStarted] = useState(false); // Always default to hidden
  const [dashboardSettings, setDashboardSettings] = useState({
    layout: 'grid', // grid, list, or map
    visibleWidgets: ['trackedProjects', 'visualizations', 'notes']
  });
  const [dashboardCache, setDashboardCache] = useState({
    isLoading: true,
    totalTrackedProjects: 0,
    projectsByStatus: {},
    valueByCategory: {}
  });
  const [projectNotes, setProjectNotes] = useState({});
  const [expandedNotes, setExpandedNotes] = useState({});
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [userRole, setUserRole] = useState('standard');

  // Function to toggle dashboard layout between grid and list
  const toggleDashboardLayout = async () => {
    const newLayout = dashboardSettings.layout === 'grid' ? 'list' : 
                      dashboardSettings.layout === 'list' ? 'map' : 'grid';
    
    console.log(`Toggling dashboard layout from ${dashboardSettings.layout} to ${newLayout}`);
    
    const updatedSettings = {
      ...dashboardSettings,
      layout: newLayout
    };
    
    setDashboardSettings(updatedSettings);
    
    // Save to Firestore if user is logged in
    if (currentUser) {
      try {
        const settingsDocRef = doc(db, 'userSettings', currentUser.uid);
        await setDoc(settingsDocRef, {
          dashboardSettings: updatedSettings
        }, { merge: true });
        
        console.log('Dashboard layout preference saved to Firestore');
      } catch (error) {
        console.error('Error saving dashboard layout preference:', error);
      }
    }
  };

  // Function to toggle widget visibility
  const toggleWidgetVisibility = async (widgetName) => {
    console.log(`Toggling visibility for widget: ${widgetName}`);
    
    const isCurrentlyVisible = dashboardSettings.visibleWidgets.includes(widgetName);
    let updatedVisibleWidgets;
    
    if (isCurrentlyVisible) {
      // Remove widget from visible list (except trackedProjects which should always be visible)
      if (widgetName === 'trackedProjects') {
        console.log('trackedProjects widget cannot be hidden');
        return;
      }
      
      updatedVisibleWidgets = dashboardSettings.visibleWidgets.filter(w => w !== widgetName);
    } else {
      // Add widget to visible list
      updatedVisibleWidgets = [...dashboardSettings.visibleWidgets, widgetName];
    }
    
    const updatedSettings = {
      ...dashboardSettings,
      visibleWidgets: updatedVisibleWidgets
    };
    
    setDashboardSettings(updatedSettings);
    
    // Save to Firestore if user is logged in
    if (currentUser) {
      try {
        const settingsDocRef = doc(db, 'userSettings', currentUser.uid);
        await setDoc(settingsDocRef, {
          dashboardSettings: updatedSettings
        }, { merge: true });
        
        console.log('Widget visibility settings saved to Firestore');
      } catch (error) {
        console.error('Error saving widget visibility settings:', error);
      }
    }
  };

  // Format currency helper function
  const formatCurrency = (value) => {
    if (!value) return '€0';
    
    // If it's already a string with a currency symbol, return it as is
    if (typeof value === 'string' && (value.includes('€') || value.includes('$') || value.includes('£'))) {
      return value;
    }
    
    // Otherwise format it
    try {
      return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
      }).format(value);
    } catch (error) {
      console.error('Error formatting currency:', error);
      return `€${value}`;
    }
  };

  // Function to refresh dashboard data
  const refreshDashboard = async () => {
    try {
      setDashboardCache(prev => ({ ...prev, isLoading: true }));
      await fetchTrackedProjects();
      updateDashboardCache(currentUser, trackedProjects, setDashboardCache);
      
      // Update notes and other data
      await fetchAllProjectNotes();
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    }
  };

  // Function to toggle notes visibility for a project
  const toggleNotesVisibility = (projectId) => {
    if (expandedNotes[projectId]) {
      setExpandedNotes(prev => ({ ...prev, [projectId]: !prev[projectId] }));
    } else {
      setExpandedNotes(prev => ({ ...prev, [projectId]: true }));
    }
  };

  // Fetch all tracked projects for the current user
  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) {
        setTrackedProjects([]);
        setLoading(false);
        setError(null);
        return [];
      }
      
      console.log('Fetching tracked projects for user:', currentUser.uid);
      setLoading(true);
      setError(null);
      
      const trackedRef = collection(db, 'trackedProjects');
      
      // Use a simpler query without the orderBy to avoid index requirements
      // Just get all projects that belong to the current user
      const trackedQuery = query(
        trackedRef,
        where('userId', '==', currentUser.uid)
      );
      
      try {
        const querySnapshot = await getDocs(trackedQuery);
        
        if (querySnapshot.empty) {
          console.log('No tracked projects found for user');
          setTrackedProjects([]);
          setDashboardCache({
            isLoading: false,
            totalTrackedProjects: 0,
            totalValue: 0,
            projectsByStatus: {},
            valueByCategory: {},
            timestamp: new Date()
          });
          setLoading(false);
          return [];
        }
        
        // Process tracked projects
        const tracked = [];
        const projectIdsSet = new Set(); // To avoid duplicates
        
        console.log(`Found ${querySnapshot.size} potential tracked projects, processing...`);
        
        querySnapshot.forEach((doc) => {
          const projectData = doc.data();
          
          // Skip placeholder documents
          if (projectData._placeholder) {
            console.log('Skipping placeholder document');
            return;
          }
          
          // Add docId to identify this record
          projectData.docId = doc.id;
          
          // Extract project ID - check all possible fields
          const projectId = 
            projectData.projectId || 
            projectData.planning_id || 
            projectData.id || 
            doc.id.split('_')[1]; // Extract from compound ID
          
          if (!projectId) {
            console.warn('Project missing ID, skipping:', doc.id);
            return;
          }
          
          // Check if we already have this project (deduplicate)
          if (!projectIdsSet.has(projectId)) {
            projectIdsSet.add(projectId);
            
            // Debug logging
            console.log('Processing project:', projectId, projectData.planning_title || projectData.planning_name || 'Unnamed');
            
            // Ensure we have complete project information
            const processedProject = {
              // Ensure all required fields exist
              planning_id: projectId,
              planning_name: projectData.planning_name || projectData.planning_title || projectData.title || 'Unnamed Project',
              planning_description: projectData.planning_description || projectData.description || 'No description available',
              planning_value: parseFloat(projectData.planning_value || projectData.projectValue || projectData.value || 0),
              planning_stage: projectData.planning_stage || projectData.status || 'Unknown',
              planning_category: projectData.planning_category || projectData.category || projectData.type || 'Uncategorized',
              planning_location: projectData.planning_location || projectData.location || projectData.planning_county || 'Unknown',
              
              // Include all original data 
              ...projectData,
              
              // Ensure these important fields are set
              docId: doc.id,
              projectId: projectId
            };
            
            tracked.push(processedProject);
          }
        });
        
        // Sort projects by trackedAt date (newest first)
        tracked.sort((a, b) => {
          const dateA = a.trackedAt?.toDate ? a.trackedAt.toDate() : new Date(0);
          const dateB = b.trackedAt?.toDate ? b.trackedAt.toDate() : new Date(0);
          return dateB - dateA;
        });
        
        console.log(`Successfully processed ${tracked.length} tracked projects`);
        setTrackedProjects(tracked);
        
        // Update the dashboard cache with project data
        if (tracked.length > 0) {
          console.log('Updating dashboard cache with tracked projects');
          updateDashboardCache(currentUser, tracked, setDashboardCache);
        } else {
          console.log('No valid tracked projects found for user');
          setDashboardCache({
            isLoading: false,
            totalTrackedProjects: 0,
            totalValue: 0,
            projectsByStatus: {},
            valueByCategory: {},
            timestamp: new Date()
          });
        }
        
        setLoading(false);
        return tracked;
      } catch (queryError) {
        console.error('Error in Firestore query:', queryError);
        
        // Attempt fallback method - get all trackedProjects and filter manually
        console.log('Falling back to get all trackedProjects');
        
        try {
          const allTrackedSnapshot = await getDocs(collection(db, 'trackedProjects'));
          
          if (allTrackedSnapshot.empty) {
            console.log('No tracked projects found in collection');
            setTrackedProjects([]);
            setLoading(false);
            return [];
          }
          
          const filtered = [];
          const projectIdsSet = new Set();
          
          allTrackedSnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Skip placeholder documents and check for current user
            if (data._placeholder || data.userId !== currentUser.uid) {
              return;
            }
            
            data.docId = doc.id;
            
            // Extract project ID from all possible fields
            const projectId = 
              data.projectId || 
              data.planning_id || 
              data.id || 
              doc.id.split('_')[1]; // Extract from compound ID
            
            if (!projectId) {
              console.warn('Project missing ID in fallback, skipping:', doc.id);
              return;
            }
            
            if (!projectIdsSet.has(projectId)) {
              projectIdsSet.add(projectId);
              
              // Ensure we have complete project information
              const processedProject = {
                // Ensure all required fields exist
                planning_id: projectId,
                planning_name: data.planning_name || data.planning_title || data.title || 'Unnamed Project',
                planning_description: data.planning_description || data.description || 'No description available',
                planning_value: parseFloat(data.planning_value || data.projectValue || data.value || 0),
                planning_stage: data.planning_stage || data.status || 'Unknown',
                planning_category: data.planning_category || data.category || data.type || 'Uncategorized',
                planning_location: data.planning_location || data.location || data.planning_county || 'Unknown',
                
                // Include all original data
                ...data,
                
                // Ensure these important fields are set
                docId: doc.id,
                projectId: projectId
              };
              
              filtered.push(processedProject);
            }
          });
          
          console.log(`Found ${filtered.length} tracked projects using fallback method`);
          setTrackedProjects(filtered);
          
          if (filtered.length > 0) {
            updateDashboardCache(currentUser, filtered, setDashboardCache);
          } else {
            setDashboardCache({
              isLoading: false,
              totalTrackedProjects: 0,
              totalValue: 0,
              projectsByStatus: {},
              valueByCategory: {},
              timestamp: new Date()
            });
          }
          
          setLoading(false);
          return filtered;
        } catch (fallbackError) {
          console.error('Fallback query failed:', fallbackError);
          throw fallbackError;
        }
      }
    } catch (error) {
      console.error('Error fetching tracked projects:', error);
      setError('Failed to load tracked projects. Please try again later.');
      setTrackedProjects([]);
      setLoading(false);
      return [];
    }
  };

  // Function to untrack a project
  const untrackProject = async (projectId) => {
    try {
      if (!currentUser) {
        console.error('Cannot untrack project: No user logged in');
        return;
      }
      
      console.log('Untracking project with ID:', projectId);
      
      // Find the documents to delete - we need to check multiple ways the ID might be stored
      const trackedRef = collection(db, 'trackedProjects');
      
      // Search for the project by its document ID first
      let foundDoc = null;
      try {
        const docRef = doc(db, 'trackedProjects', projectId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          foundDoc = { id: docSnap.id, ref: docSnap.ref };
          console.log('Found project by direct document ID');
        }
      } catch (error) {
        console.log('Not a valid document ID, trying other methods');
      }
      
      // If not found by direct ID, try querying by various ID fields
      if (!foundDoc) {
        // Try all possible ID fields without filtering by userId
        const querySnapshot = await getDocs(query(trackedRef));
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Check all possible ID fields
          const idFields = ['docId', 'projectId', 'id', 'planning_id', '_id'];
          for (const field of idFields) {
            if (data[field] === projectId) {
              foundDoc = { id: doc.id, ref: doc.ref };
              console.log(`Found project by ${field} field`);
              break;
            }
          }
        });
      }
      
      if (!foundDoc) {
        console.log('No tracked project found with ID:', projectId);
        return;
      }
      
      // Delete the found document
      console.log('Deleting tracked project document:', foundDoc.id);
      await deleteDoc(foundDoc.ref);
      
      // Log activity
      await addDoc(collection(db, 'activity'), {
        userId: currentUser.uid,
        projectId: projectId,
        type: 'untrack',
        timestamp: serverTimestamp()
      });
      
      // Update state to remove the project - consider all possible ID field names
      const updatedProjects = trackedProjects.filter(project => {
        const projectIdentifier = 
          project.docId || 
          project.projectId || 
          project.id || 
          project.planning_id || 
          project._id;
        return projectIdentifier !== projectId;
      });
      setTrackedProjects(updatedProjects);
      
      // Update dashboard cache
      updateDashboardCache(currentUser, updatedProjects, setDashboardCache);
      
      // Refresh the projects list
      fetchTrackedProjects();
      
      console.log('Project untracked successfully');
    } catch (error) {
      console.error('Error untracking project:', error);
      setError('Error removing project from tracked list. Please try again.');
    }
  };

  // Function to load user data
  useEffect(() => {
    // Function to load user data with enhanced error handling
    const loadUserData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        // First try to get user data from Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userDocData = userDocSnap.data();
          setUserData(userDocData);
          
          // Set user role for dashboard customization
          if (userDocData.role) {
            setUserRole(userDocData.role);
          }
          
          // Also store in localStorage for offline/Vercel usage
          try {
            localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify(userDocData));
          } catch (storageError) {
            console.error('Error storing user data in localStorage:', storageError);
          }
        } else {
          // Try localStorage as fallback
          try {
            const localData = localStorage.getItem(`userData_${currentUser.uid}`);
            if (localData) {
              const parsedData = JSON.parse(localData);
              setUserData(parsedData);
              
              // Set user role from localStorage
              if (parsedData.role) {
                setUserRole(parsedData.role);
              }
            } else {
              // Create minimal user data from Auth
              const minimalUserData = {
                firstName: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User',
                lastName: currentUser.displayName ? currentUser.displayName.split(' ').slice(1).join(' ') : '',
                email: currentUser.email,
                uid: currentUser.uid,
                role: 'standard'
              };
              setUserData(minimalUserData);
              setUserRole('standard');
            }
          } catch (localStorageError) {
            console.error('Error reading from localStorage:', localStorageError);
            
            // Fallback to Auth data if everything else fails
            const fallbackUserData = {
              firstName: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User',
              email: currentUser.email,
              uid: currentUser.uid,
              role: 'standard'
            };
            setUserData(fallbackUserData);
            setUserRole('standard');
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        
        // Always ensure we have some user data to display
        const emergencyUserData = {
          firstName: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User',
          email: currentUser.email,
          uid: currentUser.uid,
          role: 'standard'
        };
        setUserData(emergencyUserData);
        setUserRole('standard');
      }
    };
    
    loadUserData();
  }, [currentUser]);

  useEffect(() => {
    const initializeData = async () => {
      if (currentUser) {
        setLoading(true);
        try {
          // Load all data in parallel for maximum efficiency
          const [settingsLoaded, cacheLoaded, projectsLoaded] = await Promise.all([
            fetchDashboardSettings(),
            loadDashboardCache(),
            fetchTrackedProjects()
          ]);
          
          // If no cache was loaded, create it immediately with current projects
          if (!cacheLoaded && trackedProjects.length > 0) {
            console.log('No cache was loaded, creating one immediately...');
            updateDashboardCache(currentUser, trackedProjects, setDashboardCache);
          }
        } catch (error) {
          console.error('Error initializing dashboard data:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    initializeData();
  }, [currentUser]);

  // Update dashboard cache when tracked projects change
  useEffect(() => {
    if (currentUser && trackedProjects && trackedProjects.length > 0) {
      console.log('Projects changed, updating statistics');
      
      // Calculate statistics directly from tracked projects
      const projectsByStatus = {};
      const valueByCategory = {};
      
      trackedProjects.forEach(project => {
        // Count by status
        const status = project.status || project.planning_stage || project.stage || 'Unknown';
        projectsByStatus[status] = (projectsByStatus[status] || 0) + 1;
        
        // Sum by category
        const category = project.category || project.planning_category || 'Other';
        const rawValue = project.projectValue || project.planning_value || project.value || project.budget || 0;
        let numericValue = 0;
        
        if (rawValue) {
          if (typeof rawValue === 'string') {
            numericValue = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, '')) || 0;
          } else {
            numericValue = parseFloat(rawValue) || 0;
          }
        }
        
        valueByCategory[category] = (valueByCategory[category] || 0) + numericValue;
      });
      
      // Generate chart data
      const chartCategories = Object.keys(valueByCategory);
      const chartValues = Object.values(valueByCategory);
      
      // Update dashboard cache
      if (Object.keys(projectsByStatus).length > 0 || Object.keys(valueByCategory).length > 0) {
        updateDashboardCache(currentUser, trackedProjects, setDashboardCache);
      }
    }
  }, [trackedProjects, currentUser]);

  // Fetch project notes
  const fetchAllProjectNotes = async () => {
    try {
      if (!currentUser || !trackedProjects || trackedProjects.length === 0) {
        return;
      }
      
      console.log('Fetching notes for all tracked projects');
      
      const notesObj = {};
      
      // Fetch notes in parallel for all projects
      const fetchPromises = trackedProjects.map(async (project) => {
        const projectId = project.planning_id || project.id;
        
        const notesQuery = query(
          collection(db, 'projectNotes'),
          where('projectId', '==', projectId),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        const notesSnapshot = await getDocs(notesQuery);
        const notes = [];
        
        notesSnapshot.forEach(doc => {
          notes.push({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || new Date()
          });
        });
        
        notesObj[projectId] = notes;
      });
      
      await Promise.all(fetchPromises);
      
      setProjectNotes(notesObj);
      console.log('All project notes loaded:', notesObj);
    } catch (error) {
      console.error('Error fetching project notes:', error);
    }
  };

  // Fetch dashboard settings
  const fetchDashboardSettings = async () => {
    try {
      if (!currentUser) return false;
      
      const settingsDocRef = doc(db, 'userSettings', currentUser.uid);
      const settingsSnapshot = await getDoc(settingsDocRef);
      
      if (settingsSnapshot.exists()) {
        console.log('Dashboard settings loaded from DB:', settingsSnapshot.data());
        const loadedSettings = settingsSnapshot.data().dashboardSettings || {};
        
        // Ensure trackedProjects is always visible
        if (!loadedSettings.visibleWidgets || !loadedSettings.visibleWidgets.includes('trackedProjects')) {
          console.log('trackedProjects was not in visibleWidgets, adding it');
          loadedSettings.visibleWidgets = [...(loadedSettings.visibleWidgets || []), 'trackedProjects'];
        }
        
        setDashboardSettings({
          ...dashboardSettings,
          ...loadedSettings
        });
        console.log('Dashboard settings after merge:', {...dashboardSettings, ...loadedSettings});
        return true;
      }
      
      console.log('No dashboard settings found, using defaults');
      return false;
    } catch (error) {
      console.error('Error fetching dashboard settings:', error);
      return false;
    }
  };

  // Load dashboard cache
  const loadDashboardCache = async () => {
    try {
      if (!currentUser) {
        console.log('No current user, skipping dashboard cache load');
        return;
      }
      
      console.log('Loading dashboard cache for user:', currentUser.uid);
      const cacheDocRef = doc(db, 'dashboardCache', currentUser.uid);
      const cacheSnapshot = await getDoc(cacheDocRef);
      
      if (cacheSnapshot.exists()) {
        const cacheData = cacheSnapshot.data();
        console.log('Dashboard cache loaded:', cacheData);
        setDashboardCache(cacheData);
        return true;
      } else {
        console.log('No dashboard cache found for user');
        return false;
      }
    } catch (error) {
      console.error('Error loading dashboard cache:', error);
      return false;
    }
  };

  // Project note functions
  const addProjectNote = async (projectId, projectTitle, noteText) => {
    try {
      if (!currentUser) {
        return null;
      }
      
      const newNote = {
        userId: currentUser.uid,
        projectId,
        projectTitle,
        text: noteText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'projectNotes'), newNote);
      
      // Log activity
      await addDoc(collection(db, 'activity'), {
        userId: currentUser.uid,
        projectId,
        noteId: docRef.id,
        type: 'note_add',
        timestamp: serverTimestamp()
      });
      
      // Update local state
      const newNoteWithId = {
        id: docRef.id,
        ...newNote,
        createdAt: new Date()
      };
      
      setProjectNotes(prev => {
        const updatedNotes = { ...prev };
        updatedNotes[projectId] = [newNoteWithId, ...(updatedNotes[projectId] || [])];
        return updatedNotes;
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding note:', error);
      return null;
    }
  };

  const updateProjectNote = async (noteId, projectId, updatedText) => {
    try {
      if (!currentUser) {
        return false;
      }
      
      const noteRef = doc(db, 'projectNotes', noteId);
      
      await updateDoc(noteRef, {
        text: updatedText,
        updatedAt: serverTimestamp()
      });
      
      // Log activity
      await addDoc(collection(db, 'activity'), {
        userId: currentUser.uid,
        projectId,
        noteId,
        type: 'note_edit',
        timestamp: serverTimestamp()
      });
      
      // Update local state
      setProjectNotes(prev => {
        const updatedNotes = { ...prev };
        if (updatedNotes[projectId]) {
          updatedNotes[projectId] = updatedNotes[projectId].map(note => 
            note.id === noteId ? { ...note, text: updatedText, updatedAt: new Date() } : note
          );
        }
        return updatedNotes;
      });
      
      return true;
    } catch (error) {
      console.error('Error updating note:', error);
      return false;
    }
  };

  const deleteProjectNote = async (noteId, projectId) => {
    try {
      if (!currentUser) {
        return false;
      }
      
      const noteRef = doc(db, 'projectNotes', noteId);
      await deleteDoc(noteRef);
      
      // Log activity
      await addDoc(collection(db, 'activity'), {
        userId: currentUser.uid,
        projectId,
        noteId,
        type: 'note_delete',
        timestamp: serverTimestamp()
      });
      
      // Update local state
      setProjectNotes(prev => {
        const updatedNotes = { ...prev };
        if (updatedNotes[projectId]) {
          updatedNotes[projectId] = updatedNotes[projectId].filter(note => note.id !== noteId);
        }
        return updatedNotes;
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      return false;
    }
  };

  // Update online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      {/* Welcome Header Section */}
      <div style={{
        backgroundColor: '#f8f9fa',
        borderRadius: '10px',
        padding: '25px',
        marginBottom: '25px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{flex: '1'}}>
          <h1 style={{margin: '0 0 8px 0', fontSize: '1.75rem', color: '#333'}}>
            Welcome, {userData?.firstName || currentUser?.displayName?.split(' ')[0] || 'User'}!
          </h1>
          <p style={{margin: '0', color: '#666'}}>Your personalized infrastructure project tracker dashboard</p>
        </div>
        
        {/* Dashboard Controls */}
        <div style={{display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap'}}>
          {isCustomizing ? (
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                onClick={() => setIsCustomizing(false)} 
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f8f9fa',
                  color: '#666',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <FaTimes /> Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsCustomizing(true)} 
              style={{
                padding: '8px 16px',
                backgroundColor: '#4e73df',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <FaCog /> Customize Dashboard
            </button>
          )}
          
          {/* Getting Started Widget */}
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={showGettingStarted} 
                onChange={() => setShowGettingStarted(!showGettingStarted)} 
              />
              <span className="slider round"></span>
            </label>
            <span style={{color: '#666', fontSize: '0.9rem'}}>Show Getting Started Guide</span>
          </div>
        </div>
      </div>

      {isOffline && (
        <div style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '10px 15px',
          borderRadius: '6px',
          marginBottom: '20px',
          border: '1px solid #ffeeba',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <p style={{margin: '0'}}>You are currently offline. Some features may be limited.</p>
        </div>
      )}

      {showGettingStarted && (
        <GettingStartedWidget 
          completedTasks={completedTasks} 
          checkTaskCompleted={checkTaskCompleted} 
        />
      )}

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '10px 15px',
          borderRadius: '6px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}
      
      {/* Customizable Dashboard Layout */}
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '50px 20px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
          margin: '20px 0'
        }}>
          <div className="loading-spinner"></div>
          <p style={{marginTop: '15px', color: '#666'}}>Loading your personalized dashboard...</p>
        </div>
      ) : (
        <div style={{width: '100%'}}>
          {/* Summary Stats Section */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '25px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '1.2rem',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '10px'
            }}>
              <FaThLarge style={{color: '#4e73df'}} /> Summary Statistics
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '20px'
            }}>
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{fontSize: '2rem', color: '#4e73df', marginBottom: '10px'}}>
                  {trackedProjects.length}
                </div>
                <div style={{color: '#666', fontSize: '0.9rem'}}>Tracked Projects</div>
              </div>
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{fontSize: '2rem', color: '#4e73df', marginBottom: '10px'}}>
                  €{(dashboardCache?.valueByCategory ? 
                    Object.values(dashboardCache.valueByCategory).reduce((sum, value) => sum + value, 0) : 0)
                    .toLocaleString()}
                </div>
                <div style={{color: '#666', fontSize: '0.9rem'}}>Total Value</div>
              </div>
            </div>
          </div>
          
          {/* Spending Distribution & Project Stages - Two Column Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
            gap: '25px',
            marginBottom: '25px'
          }}>
            {/* Spending Chart */}
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '1.2rem',
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: '1px solid #e0e0e0',
                paddingBottom: '10px'
              }}>
                <FaChartBar style={{color: '#4e73df'}} /> Spending Distribution
              </h3>
              <SpendingChartWidget 
                data={{ 
                  valueByCategory: dashboardCache?.valueByCategory || {},
                  loading: dashboardCache?.isLoading || false
                }} 
              />
            </div>
            
            {/* Project Stages */}
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '1.2rem',
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: '1px solid #e0e0e0',
                paddingBottom: '10px'
              }}>
                <FaChartPie style={{color: '#4e73df'}} /> Project Stages
              </h3>
              <ProjectStageWidget 
                data={{
                  projectsByStatus: dashboardCache?.projectsByStatus || {},
                  loading: dashboardCache?.isLoading || false
                }}
              />
            </div>
          </div>
          
          {/* Tracked Projects Section */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '25px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '1.2rem',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '10px'
            }}>
              <FaTable style={{color: '#4e73df'}} /> Tracked Projects
            </h3>
            <TrackedProjectsWidget 
              data={{
                trackedProjects: trackedProjects || [],
                untrackProject: untrackProject,
                loading: loading,
                showNotes: expandedNotes,
                projectNotes: projectNotes,
                onToggleNotes: toggleNotesVisibility,
                onAddNote: addProjectNote,
                onUpdateNote: updateProjectNote,
                onDeleteNote: deleteProjectNote
              }}
            />
          </div>
          
          {/* Recent Activity Section */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '1.2rem',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '10px'
            }}>
              <FaHistory style={{color: '#4e73df'}} /> Recent Activity
            </h3>
            <RecentActivityWidget 
              data={{
                userId: currentUser?.uid,
                limit: 5
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
