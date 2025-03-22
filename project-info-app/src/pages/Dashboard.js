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
import { FaCog, FaHome, FaSave, FaTimes, FaUndo } from 'react-icons/fa';
import './Dashboard.css';
import './GettingStartedToggle.css';

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
  const [showGettingStarted, setShowGettingStarted] = useState(false); // Default to hidden
  const [dashboardSettings, setDashboardSettings] = useState({
    layout: 'grid', // grid, list, or map
    visibleWidgets: ['trackedProjects', 'visualizations', 'notes']
  });
  const [dashboardCache, setDashboardCache] = useState(null);
  const [expandedNotesProjects, setExpandedNotesProjects] = useState([]);
  const [chartData, setChartData] = useState({
    categories: [],
    values: []
  });
  const [projectNotes, setProjectNotes] = useState({});
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
    if (expandedNotesProjects.includes(projectId)) {
      setExpandedNotesProjects(expandedNotesProjects.filter(id => id !== projectId));
    } else {
      setExpandedNotesProjects([...expandedNotesProjects, projectId]);
    }
  };

  // Fetch all tracked projects for the current user
  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) {
        setTrackedProjects([]);
        setLoading(false);
        return;
      }
      
      console.log('Fetching tracked projects for user:', currentUser.uid);
      
      const trackedRef = collection(db, 'trackedProjects');
      const trackedQuery = query(
        trackedRef,
        where('userId', '==', currentUser.uid),
        orderBy('trackedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(trackedQuery);
      
      // Process tracked projects
      const tracked = [];
      const projectIdsSet = new Set();
      
      querySnapshot.forEach((doc) => {
        const projectData = doc.data();
        
        // Add docId to identify this record
        projectData.docId = doc.id;
        
        // Check if we already have this project (deduplicate)
        const projectId = projectData.projectId || projectData.planning_id || projectData.id;
        
        if (!projectIdsSet.has(projectId)) {
          projectIdsSet.add(projectId);
          tracked.push(projectData);
        }
      });
      
      console.log(`Found ${tracked.length} tracked projects`);
      setTrackedProjects(tracked);
      
      // If there are tracked projects, update the dashboard cache
      if (tracked.length > 0) {
        console.log('Updating dashboard cache with tracked projects');
        updateDashboardCache(currentUser, tracked, setDashboardCache);
      }
      
      return tracked;
    } catch (error) {
      console.error('Error fetching tracked projects:', error);
      setError('Error loading your tracked projects. Please try again later.');
      return [];
    } finally {
      setLoading(false);
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
      
      // First try to find by docId which is the most reliable
      let querySnapshot = await getDocs(query(
        trackedRef,
        where('userId', '==', currentUser.uid),
        where('docId', '==', projectId)
      ));
      
      // If not found, try other potential ID fields
      if (querySnapshot.empty) {
        console.log('Trying to find project by other ID fields...');
        
        // Try 'projectId' field
        querySnapshot = await getDocs(query(
          trackedRef,
          where('userId', '==', currentUser.uid),
          where('projectId', '==', projectId)
        ));
      }
      
      // Try 'id' field if still not found
      if (querySnapshot.empty) {
        querySnapshot = await getDocs(query(
          trackedRef,
          where('userId', '==', currentUser.uid),
          where('id', '==', projectId)
        ));
      }
      
      // Try 'planning_id' field if still not found
      if (querySnapshot.empty) {
        querySnapshot = await getDocs(query(
          trackedRef,
          where('userId', '==', currentUser.uid),
          where('planning_id', '==', projectId)
        ));
      }
      
      if (querySnapshot.empty) {
        console.log('No tracked project found with ID:', projectId);
        return;
      }
      
      // Delete all matching documents (should be only one)
      const deletePromises = [];
      querySnapshot.forEach((doc) => {
        console.log('Deleting tracked project document:', doc.id);
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      
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
      
      setChartData({
        categories: chartCategories,
        values: chartValues
      });
      
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
    <div className="dashboard-container">
      {/* Welcome Header Section */}
      <div className="dashboard-header">
        <div className="welcome-message">
          <h1>Welcome, {userData?.firstName || currentUser?.displayName?.split(' ')[0] || 'User'}!</h1>
          <p>Your personalized infrastructure project tracker dashboard</p>
        </div>
        
        {/* Dashboard Controls */}
        <div className="dashboard-actions">
          {isCustomizing ? (
            <div className="customization-controls">
              <button onClick={() => setIsCustomizing(false)} className="cancel-customize-btn">
                <FaTimes /> Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setIsCustomizing(true)} className="customize-dashboard-btn">
              <FaCog /> Customize Dashboard
            </button>
          )}
          
          {/* Getting Started Widget */}
          <div className="getting-started-toggle-container">
            <label className="switch">
              <input 
                type="checkbox" 
                checked={showGettingStarted} 
                onChange={() => setShowGettingStarted(!showGettingStarted)} 
              />
              <span className="slider round"></span>
            </label>
            <span className="toggle-label">Show Getting Started Guide</span>
          </div>
        </div>
      </div>

      {isOffline && (
        <div className="offline-warning">
          <p>You are currently offline. Some features may be limited.</p>
        </div>
      )}

      {showGettingStarted && (
        <GettingStartedWidget 
          completedTasks={completedTasks} 
          checkTaskCompleted={checkTaskCompleted} 
        />
      )}

      {error && <div className="error-message">{error}</div>}
      
      {/* Customizable Dashboard Layout */}
      {loading ? (
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
          <p>Loading your personalized dashboard...</p>
        </div>
      ) : (
        <DashboardLayout
          trackedProjects={trackedProjects}
          projectsByStatus={dashboardCache?.projectsByStatus || {}}
          valueByCategory={dashboardCache?.valueByCategory || {}}
          userRole={userRole}
          userData={userData}
          untrackProject={untrackProject}
          loading={loading || (dashboardCache && dashboardCache.isLoading)}
          isEditMode={isCustomizing}
          onLayoutSave={() => setIsCustomizing(false)}
          onEditModeToggle={() => setIsCustomizing(!isCustomizing)}
        />
      )}
    </div>
  );
};

export default Dashboard;
