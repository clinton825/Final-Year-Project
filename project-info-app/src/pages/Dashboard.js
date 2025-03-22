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
import DashboardVisualizations from '../components/visualization/DashboardVisualizations';
// import ProjectMap from '../components/map/ProjectMap'; // Temporarily commented out until component is available
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
        project.projectStatus || 
        'Unknown';
      
      // Clean up status name for display
      const cleanStatus = status.trim();
      
      // Increment counter for this status
      acc[cleanStatus] = (acc[cleanStatus] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate project values by category
    const valueByCategory = trackedProjects.reduce((acc, project) => {
      // Get category from any of several possible fields
      const category = 
        project.planning_category || 
        project.category || 
        project.type || 
        'Unknown';
      
      // Clean up category name for display
      const cleanCategory = category.trim();
      
      // Get value from any of several possible fields and convert to number
      const rawValue = 
        project.projectValue || 
        project.planning_value || 
        project.value || 
        project.budget || 
        0;
      
      // Convert string values to numbers, handle parsing errors
      let numericValue = 0;
      try {
        // Remove currency symbols, commas, etc
        const sanitized = String(rawValue).replace(/[^0-9.-]+/g, '');
        numericValue = parseFloat(sanitized) || 0;
      } catch (e) {
        console.warn('Value parsing error:', e);
        numericValue = 0;
      }
      
      // Add this value to the accumulator
      acc[cleanCategory] = (acc[cleanCategory] || 0) + numericValue;
      return acc;
    }, {});
    
    // Create dashboard cache
    const cacheData = {
      userId: currentUser.uid,
      totalTrackedProjects: trackedProjects.length,
      projectsByStatus,
      valueByCategory,
      lastUpdated: serverTimestamp()
    };
    
    console.log('Dashboard cache data prepared:', cacheData);
    
    // Store in Firestore
    const cacheDocRef = doc(db, 'dashboardCache', currentUser.uid);
    await setDoc(cacheDocRef, cacheData);
    
    // Update local state
    if (setDashboardCache) {
      setDashboardCache(cacheData);
    }
    console.log('Dashboard cache updated successfully');
    
  } catch (error) {
    console.error('Error updating dashboard cache:', error);
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
    layout: 'grid', // 'grid', 'list', or 'map'
    visibleWidgets: ['trackedProjects', 'visualizations'],
    theme: 'system',
    defaultView: 'all'
  });
  const [dashboardCache, setDashboardCache] = useState(null);
  const [chartData, setChartData] = useState({
    categories: [],
    values: []
  });
  const [projectNotes, setProjectNotes] = useState({});

  // Function to toggle dashboard layout between grid and list
  const toggleDashboardLayout = async () => {
    try {
      const newLayout = dashboardSettings.layout === 'grid' ? 'list' : dashboardSettings.layout === 'list' ? 'map' : 'grid';
      console.log('Toggling dashboard layout to:', newLayout);
      await saveDashboardSettings({ layout: newLayout });
    } catch (error) {
      console.error('Error toggling dashboard layout:', error);
    }
  };

  // Function to toggle widget visibility
  const toggleWidgetVisibility = async (widgetName) => {
    try {
      const currentVisibleWidgets = [...dashboardSettings.visibleWidgets];
      const widgetIndex = currentVisibleWidgets.indexOf(widgetName);
      
      // Don't allow hiding trackedProjects
      if (widgetName === 'trackedProjects') {
        console.log('Cannot hide trackedProjects widget');
        alert('The Projects section cannot be hidden');
        return;
      }
      
      if (widgetIndex > -1) {
        // Widget is currently visible, remove it
        currentVisibleWidgets.splice(widgetIndex, 1);
      } else {
        // Widget is currently hidden, add it
        currentVisibleWidgets.push(widgetName);
      }
      
      console.log('Toggling widget visibility for:', widgetName, 'New state:', currentVisibleWidgets);
      await saveDashboardSettings({ visibleWidgets: currentVisibleWidgets });
    } catch (error) {
      console.error('Error toggling widget visibility:', error);
    }
  };

  // Function to untrack a project
  const untrackProject = async (docId) => {
    try {
      if (!currentUser) return;
      
      // First confirm with the user
      if (!window.confirm('Are you sure you want to untrack this project?')) {
        return;
      }
      
      // Immediately show loading state for better UX
      setDashboardCache(prev => prev ? {...prev, isLoading: true} : {isLoading: true});
      
      // Delete from trackedProjects collection
      const projectRef = doc(db, 'trackedProjects', docId);
      await deleteDoc(projectRef);
      
      // Find the project in the tracked projects to get its ID for activity logging
      const projectToUntrack = trackedProjects.find(p => p.id === docId);
      const projectId = projectToUntrack?.projectId || projectToUntrack?.planning_id || docId.split('_')[1] || 'unknown';
      
      // Log activity (don't await this to keep UI responsive)
      addDoc(collection(db, 'activity'), {
        userId: currentUser.uid,
        type: 'untrack',
        projectId: projectId,
        description: 'Untracked a project',
        timestamp: serverTimestamp()
      }).catch(err => console.error('Error logging untrack activity:', err));
      
      // Show success message (don't use alert as it blocks UI)
      // The onSnapshot listener will automatically update the UI
      
      // Note: We don't need to manually update trackedProjects state or call updateDashboardCache
      // because the Firestore onSnapshot listener will trigger these updates automatically
    } catch (error) {
      console.error('Error untracking project:', error);
      alert('Error untracking project: ' + error.message);
      // Reset loading state if there was an error
      setDashboardCache(prev => prev ? {...prev, isLoading: false} : {isLoading: false});
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      console.log('App is online');
      setIsOffline(false);
      if (currentUser) {
        fetchTrackedProjects();
      }
    };

    const handleOffline = () => {
      console.log('App is offline');
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser]);

  useEffect(() => {
    // Function to load user data with enhanced error handling
    const loadUserData = async () => {
      if (!currentUser) {
        console.log('No current user, skipping user data fetch');
        setLoading(false);
        return;
      }
      
      console.log('Loading user data for dashboard. User ID:', currentUser.uid);
      console.log('User email:', currentUser.email);
      console.log('Display name from Auth:', currentUser.displayName);
      
      try {
        // First try to get user data from Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userDocData = userDocSnap.data();
          console.log('User data from Firestore:', userDocData);
          setUserData(userDocData);
          
          // Also store in localStorage for offline/Vercel usage
          try {
            localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify(userDocData));
            console.log('Stored user data in localStorage for faster access');
          } catch (storageError) {
            console.error('Error storing user data in localStorage:', storageError);
          }
        } else {
          console.log('No user document found in Firestore, checking localStorage...');
          
          // Try localStorage as fallback
          try {
            const localData = localStorage.getItem(`userData_${currentUser.uid}`);
            if (localData) {
              const parsedData = JSON.parse(localData);
              console.log('User data from localStorage:', parsedData);
              setUserData(parsedData);
            } else {
              console.log('No user data in localStorage, using Auth data');
              // Create minimal user data from Auth
              const minimalUserData = {
                firstName: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User',
                lastName: currentUser.displayName ? currentUser.displayName.split(' ').slice(1).join(' ') : '',
                email: currentUser.email,
                uid: currentUser.uid
              };
              console.log('Created minimal user data:', minimalUserData);
              setUserData(minimalUserData);
            }
          } catch (localStorageError) {
            console.error('Error reading from localStorage:', localStorageError);
            
            // Fallback to Auth data if everything else fails
            const fallbackUserData = {
              firstName: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User',
              email: currentUser.email,
              uid: currentUser.uid
            };
            console.log('Using fallback user data:', fallbackUserData);
            setUserData(fallbackUserData);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        
        // Always ensure we have some user data to display
        const emergencyUserData = {
          firstName: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User',
          email: currentUser.email,
          uid: currentUser.uid
        };
        console.log('Using emergency user data after error:', emergencyUserData);
        setUserData(emergencyUserData);
      }
    };
    
    loadUserData();
  }, [currentUser]);

  useEffect(() => {
    const initializeData = async () => {
      if (currentUser) {
        setLoading(true);
        try {
          // Load all data in parallel
          const [settingsLoaded, cacheLoaded] = await Promise.all([
            fetchDashboardSettings(),
            loadDashboardCache()
          ]);
          
          // Fetch projects
          await fetchTrackedProjects();
          
          // If no cache was loaded, force create it
          if (!cacheLoaded) {
            console.log('No cache was loaded, creating one...');
            // Give time for projects to load first
            setTimeout(() => updateDashboardCache(currentUser, trackedProjects, setDashboardCache), 1000);
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

  useEffect(() => {
    const logDashboardView = async () => {
      try {
        if (!currentUser) return;
        
        await addDoc(collection(db, 'dashboardAnalytics'), {
          userId: currentUser.uid,
          timestamp: serverTimestamp(),
          action: 'view',
          deviceInfo: {
            width: window.innerWidth,
            height: window.innerHeight,
            isMobile: window.innerWidth < 768,
            userAgent: navigator.userAgent
          }
        });
        
        console.log('Dashboard view logged for analytics');
      } catch (error) {
        console.error('Error logging dashboard view:', error);
      }
    };
    
    logDashboardView();
  }, [currentUser]);

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

  useEffect(() => {
    if (currentUser) {
      setTimeout(() => {
        console.log('Forcing dashboard cache update...');
        updateDashboardCache(currentUser, trackedProjects, setDashboardCache);
      }, 5000);
    }
  }, [currentUser, trackedProjects]);

  useEffect(() => {
    if (currentUser && trackedProjects.length > 0) {
      // Fetch notes for all tracked projects
      fetchAllProjectNotes();
    }
  }, [currentUser, trackedProjects]);

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

  const saveDashboardSettings = async (newSettings) => {
    try {
      const updatedSettings = { ...dashboardSettings, ...newSettings };
      setDashboardSettings(updatedSettings);
      
      // Update the Getting Started visibility state if it's in the settings
      if ('showGettingStarted' in newSettings) {
        setShowGettingStarted(newSettings.showGettingStarted);
      }

      if (currentUser) {
        // Save to Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
          dashboardSettings: updatedSettings,
          updatedAt: serverTimestamp()
        });
        console.log('Dashboard settings saved:', updatedSettings);
      }
    } catch (error) {
      console.error('Error saving dashboard settings:', error);
    }
  };

  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) {
        console.log('No current user, skipping tracked projects fetch');
        setLoading(false);
        return;
      }
      
      console.log('Starting to fetch tracked projects for user:', currentUser.uid);
      setLoading(true); // Set loading state at the beginning
      setDashboardCache(prev => prev ? {...prev, isLoading: true} : {isLoading: true});
      
      // Create a query for tracked projects - IMPORTANT: we need to query by userId field, not by document ID
      const q = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid)
      );
      
      try {
        // Get initial data
        console.log('Executing initial query for tracked projects...');
        const initialSnapshot = await getDocs(q);
        
        if (!initialSnapshot.empty) {
          console.log(`Found ${initialSnapshot.size} tracked projects`);
          
          const projects = [];
          initialSnapshot.forEach(doc => {
            const projectData = doc.data();
            projects.push({
              id: doc.id,
              ...projectData
            });
          });
          
          console.log('Setting tracked projects:', projects);
          setTrackedProjects(projects);
          setError(null); // Clear any previous errors
          setLoading(false);
          setDashboardCache(prev => prev ? {...prev, isLoading: false} : {isLoading: false});
        } else {
          // No projects yet
          console.log('No tracked projects found in the database');
          setTrackedProjects([]);
          setLoading(false);
          setDashboardCache(prev => prev ? {...prev, isLoading: false} : {isLoading: false});
        }
        
        // Set up real-time listener
        console.log('Setting up real-time listener for tracked projects...');
        const unsubscribe = onSnapshot(q, 
          (snapshot) => {
            const projects = [];
            snapshot.forEach(doc => {
              const projectData = doc.data();
              projects.push({
                id: doc.id,
                ...projectData
              });
            });
            
            console.log('Real-time update - tracked projects:', projects);
            setTrackedProjects(projects);
            setLoading(false);
            setDashboardCache(prev => prev ? {...prev, isLoading: false} : {isLoading: false});
          }, 
          (error) => {
            console.error('Error in tracked projects snapshot:', error);
            setError('Failed to load your tracked projects. Please refresh the page or try again later.');
            setLoading(false);
            setDashboardCache(prev => prev ? {...prev, isLoading: false} : {isLoading: false});
          }
        );
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching tracked projects:', error);
        setError('Failed to load tracked projects. Please try again later.');
        setLoading(false);
        setDashboardCache(prev => prev ? {...prev, isLoading: false} : {isLoading: false});
      }
    } catch (error) {
      console.error('Top-level error in fetchTrackedProjects:', error);
      setError('An unexpected error occurred. Please refresh the page.');
      setLoading(false);
      setDashboardCache(prev => prev ? {...prev, isLoading: false} : {isLoading: false});
    }
  };

  // Project Notes CRUD Functions
  const fetchProjectNotes = async (projectId) => {
    try {
      if (!currentUser) return;
      
      console.log('Fetching notes for project:', projectId);
      
      const q = query(
        collection(db, 'projectNotes'),
        where('userId', '==', currentUser.uid),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const notes = [];
      
      snapshot.forEach(doc => {
        // Get the raw data
        const data = doc.data();
        
        // Log the raw timestamp data for debugging
        console.log(`Note ${doc.id} raw timestamps:`, {
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdAtType: data.createdAt ? typeof data.createdAt : 'undefined',
          hasToDate: data.createdAt && typeof data.createdAt.toDate === 'function'
        });
        
        // Create a properly formatted note object
        notes.push({
          id: doc.id,
          text: data.text,
          userId: data.userId,
          projectId: data.projectId,
          // Keep the original timestamp objects
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      
      // Log the notes we found
      if (notes.length > 0) {
        console.log(`Found ${notes.length} notes for project ${projectId}`);
        console.log('First note example:', notes[0]);
      } else {
        console.log(`No notes found for project ${projectId}`);
      }
      
      // Update state with the notes
      setProjectNotes(prev => ({
        ...prev,
        [projectId]: notes
      }));
      
      return notes;
    } catch (error) {
      console.error('Error fetching project notes:', error);
      return [];
    }
  };

  const addProjectNote = async (projectId, text) => {
    try {
      if (!currentUser || !projectId) {
        console.error('Cannot add note: Missing user or project ID');
        return null;
      }
      
      console.log('Adding note to project:', projectId);
      
      // Create note data with server timestamp
      const noteData = {
        userId: currentUser.uid,
        projectId,
        text,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      console.log('Note data before saving:', noteData);
      
      // Add the note document
      const docRef = await addDoc(collection(db, 'projectNotes'), noteData);
      console.log('Note added with ID:', docRef.id);
      
      // Log activity
      await addDoc(collection(db, 'activity'), {
        userId: currentUser.uid,
        type: 'note_add',
        projectId,
        description: 'Added a note to a project',
        timestamp: serverTimestamp()
      });
      
      // Fetch the note we just created to get the server timestamps
      const noteSnapshot = await getDoc(docRef);
      if (noteSnapshot.exists()) {
        const savedNote = noteSnapshot.data();
        console.log('Saved note with timestamps:', {
          id: docRef.id,
          ...savedNote,
          createdAtType: typeof savedNote.createdAt,
          updatedAtType: typeof savedNote.updatedAt
        });
      }
      
      // Refresh the notes list
      await fetchProjectNotes(projectId);
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding project note:', error);
      return null;
    }
  };

  const updateProjectNote = async (noteId, text) => {
    try {
      if (!currentUser || !noteId) return false;
      
      // Get the note to find its projectId
      const noteRef = doc(db, 'projectNotes', noteId);
      const noteSnap = await getDoc(noteRef);
      
      if (!noteSnap.exists()) {
        console.error('Note not found:', noteId);
        return false;
      }
      
      const noteData = noteSnap.data();
      const projectId = noteData.projectId;
      
      // Update the note
      await updateDoc(noteRef, {
        text,
        updatedAt: serverTimestamp()
      });
      
      // Log activity
      await addDoc(collection(db, 'activity'), {
        userId: currentUser.uid,
        type: 'note_update',
        projectId,
        description: 'Updated a project note',
        timestamp: serverTimestamp()
      });
      
      await fetchProjectNotes(projectId);
      return true;
    } catch (error) {
      console.error('Error updating project note:', error);
      return false;
    }
  };

  const deleteProjectNote = async (noteId) => {
    if (!currentUser) {
      console.error('Cannot delete note: No authenticated user');
      return false;
    }
    
    if (!noteId) {
      console.error('Cannot delete note: Missing note ID');
      return false;
    }
    
    console.log('Starting deletion process for note:', noteId);
    
    try {
      // Step 1: Get the note document reference
      const noteRef = doc(db, 'projectNotes', noteId);
      
      // Step 2: Get the note data to find its projectId
      const noteSnap = await getDoc(noteRef);
      
      if (!noteSnap.exists()) {
        console.error('Cannot delete note: Note not found with ID:', noteId);
        return false;
      }
      
      // Step 3: Extract the project ID from the note data
      const noteData = noteSnap.data();
      const projectId = noteData.projectId;
      
      if (!projectId) {
        console.error('Cannot delete note: Note has no associated project ID');
        return false;
      }
      
      console.log(`Deleting note ${noteId} for project ${projectId}`);
      
      // Step 4: Delete the note document
      await deleteDoc(noteRef);
      console.log('Note document deleted successfully');
      
      // Step 5: Log the activity
      const activityRef = await addDoc(collection(db, 'activity'), {
        userId: currentUser.uid,
        type: 'note_delete',
        projectId,
        description: 'Deleted a project note',
        timestamp: serverTimestamp()
      });
      console.log('Activity logged with ID:', activityRef.id);
      
      // Step 6: Update the UI by refreshing the notes list
      await fetchProjectNotes(projectId);
      console.log('Notes list refreshed for project:', projectId);
      
      return true;
    } catch (error) {
      console.error('Error deleting project note:', error);
      return false;
    }
  };

  const fetchAllProjectNotes = async () => {
    if (!currentUser || !trackedProjects.length) return;
    
    try {
      for (const project of trackedProjects) {
        const projectId = project.planning_id || project.id;
        if (projectId) {
          await fetchProjectNotes(projectId);
        }
      }
    } catch (error) {
      console.error('Error fetching all project notes:', error);
    }
  };

  const saveUserDashboardData = (dashboardData) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      const db = getDatabase();
      const userId = user.uid; 

      set(ref(db, 'users/' + userId + '/dashboardData'), dashboardData)
        .then(() => {
          console.log("Dashboard data saved successfully!");
        })
        .catch((error) => {
          console.error("Error saving dashboard data: ", error);
        });
    } else {
      console.log("No user is signed in.");
    }
  };

  useEffect(() => {
    const dashboardData = {
      projects: trackedProjects,
      lastUpdated: new Date().toISOString(),
    };

    saveUserDashboardData(dashboardData);
  }, [trackedProjects]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!currentUser) {
    return (
      <div className="not-authenticated">
        <h2>Please log in to view your dashboard</h2>
        <Link to="/login" className="primary-button">Log In</Link>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Top navigation bar with user info and actions */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>
            Dashboard 
            {currentUser && (
              <span className="user-greeting">
                | Hello, {userData?.firstName || currentUser?.displayName?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'User'}
              </span>
            )}
          </h1>
        </div>
        <div className="header-right">
          {isOffline && (
            <div className="offline-indicator">
              <i className="fas fa-wifi-slash"></i> Offline Mode
            </div>
          )}
          <button className="refresh-btn" onClick={fetchTrackedProjects} title="Refresh Dashboard">
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>
      
      {/* Getting Started Widget - only show if the user has opted to see it */}
      {showGettingStarted && (!completedTasks || completedTasks.length < 4) && (
        <div className="widget-container">
          <GettingStartedWidget />
          <button 
            className="widget-toggle-btn" 
            onClick={() => saveDashboardSettings({ showGettingStarted: false })}>
            <i className="fas fa-times"></i> Hide Getting Started
          </button>
        </div>
      )}
      
      {/* Show button to enable Getting Started if hidden */}
      {!showGettingStarted && (!completedTasks || completedTasks.length < 4) && (
        <button 
          className="show-getting-started-btn" 
          onClick={() => saveDashboardSettings({ showGettingStarted: true })}>
          <i className="fas fa-rocket"></i> Show Getting Started Guide
        </button>
      )}
      
      {/* Summary metrics are now part of the DashboardVisualizations component */}
      
      {/* Dashboard controls in a cleaner interface */}
      <div className="dashboard-controls">
        <div className="controls-section">
          <h3 className="section-title">Layout Options</h3>
          <div className="controls-buttons">
            <button 
              onClick={toggleDashboardLayout}
              className="dashboard-control-btn"
              title={`Switch to ${dashboardSettings.layout === 'grid' ? 'list' : dashboardSettings.layout === 'list' ? 'map' : 'grid'} layout`}
            >
              <i className={`fas fa-${dashboardSettings.layout === 'grid' ? 'list' : dashboardSettings.layout === 'list' ? 'map' : 'th'}`}></i>
              <span className="control-label">{dashboardSettings.layout === 'grid' ? 'List' : dashboardSettings.layout === 'list' ? 'Map' : 'Grid'} View</span>
            </button>
          </div>
        </div>
        
        <div className="controls-section">
          <h3 className="section-title">Widget Visibility</h3>
          <div className="controls-buttons">
            <button 
              onClick={() => toggleWidgetVisibility('trackedProjects')}
              className="dashboard-control-btn active"
              title="Projects Section (Always Visible)"
            >
              <i className="fas fa-bookmark"></i>
              <span className="control-label">Projects</span>
            </button>
            
            <button 
              onClick={() => toggleWidgetVisibility('visualizations')}
              className={`dashboard-control-btn ${dashboardSettings.visibleWidgets.includes('visualizations') ? 'active' : ''}`}
              title="Toggle Analytics Visualizations"
            >
              <i className="fas fa-chart-pie"></i>
              <span className="control-label">Analytics</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Enhanced Visualizations Section with Integrated Summary Statistics */}
      {dashboardSettings.visibleWidgets.includes('visualizations') && (
        <div className="dashboard-statistics">
          <div className="dashboard-card stats-card">
            <div className="card-header">
              <h2><i className="fas fa-chart-pie"></i> Project Analytics</h2>
              {dashboardCache?.isLoading && (
                <span className="analytics-loading-indicator">
                  <i className="fas fa-sync fa-spin"></i> Updating
                </span>
              )}
            </div>
            
            {(dashboardCache && dashboardCache.totalTrackedProjects > 0) || trackedProjects.length > 0 ? (
              <DashboardVisualizations 
                dashboardCache={dashboardCache}
                trackedProjects={trackedProjects}
                loading={loading || dashboardCache?.isLoading}
                visibleWidgets={['projectDistribution', 'valueDistribution']}
              />
            ) : (
              <div className="empty-state">
                <i className="fas fa-chart-bar"></i>
                <p>Track projects to see analytics</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Main dashboard content with improved layout */}
      <div className="dashboard-main">


        {/* Projects column - Tracked Projects (always visible) */}
        <div className="dashboard-column projects-column">
          <div className="dashboard-card">
            <div className="card-header">
              <h2><i className="fas fa-bookmark"></i> Tracked Projects</h2>
              <div className="card-actions">
                <button className="card-action-btn" onClick={() => navigate('/projects')} title="Find Projects">
                  <i className="fas fa-search"></i>
                  <span className="action-label">Find Projects</span>
                </button>
              </div>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className={`projects-container layout-${dashboardSettings.layout}`}>
              {trackedProjects.length > 0 ? (
                <div className="projects-list">
                  {trackedProjects.map((project) => {
                    const projectId = project.id || project.projectId || `project-${Math.random().toString(36).substr(2, 9)}`;
                    const projectName = project.projectName || project.name || project.title || project.planning_title || 'Unnamed Project';
                    
                    // Fix the location extraction to use address fields
                    const projectLocation = project.location || 
                      (project.planning_development_address_1 ? 
                        [
                          project.planning_development_address_1, 
                          project.planning_development_address_2, 
                          project.planning_development_address_3
                        ].filter(Boolean).join(', ') : 
                        (project.planning_location || project.address || 
                          (project.planning_county ? `${project.planning_county}, ${project.planning_region || ''}`.trim() : '')
                        )
                      ) || '';
                    
                    const projectStatus = project.status || project.planning_stage || project.stage || 'Unknown';
                    
                    // Only show one value - remove duplicate display
                    const rawValue = project.projectValue || project.planning_value || project.value || project.budget || 0;
                    let projectValue = '';
                    
                    if (rawValue) {
                      // If it's already a string with a currency symbol, use it as is
                      if (typeof rawValue === 'string' && (rawValue.includes('£') || rawValue.includes('$') || rawValue.includes('€'))) {
                        projectValue = rawValue;
                      } else {
                        // Otherwise format it as currency
                        const numericValue = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, ''));
                        if (!isNaN(numericValue)) {
                          projectValue = `€${numericValue.toLocaleString()}`;
                        }
                      }
                    }
                    
                    return (
                      <div key={projectId} className={`project-card ${dashboardSettings.layout}`}>
                        <div className="project-card-content">
                          <div className="project-header">
                            <h3>{projectName}</h3>
                            <div className="project-status-badge status-${projectStatus.toLowerCase().replace(/\s+/g, '-')}">
                              {projectStatus}
                            </div>
                          </div>
                          
                          {currentUser ? (
                            <>
                              <div className="project-details">
                                <div className="detail-row location-row">
                                  <span><i className="fas fa-map-marker-alt"></i> <strong>Location:</strong> {projectLocation || 'Not specified'}</span>
                                </div>
                                <div className="detail-row">
                                  <span><i className="fas fa-euro-sign"></i> <strong>Value:</strong> {projectValue || 'Not specified'}</span>
                                </div>
                                <div className="detail-row">
                                  <span><i className="fas fa-tag"></i> <strong>Category:</strong> {project.planning_category || 'Not specified'}</span>
                                </div>
                                {project.planning_subcategory && (
                                  <div className="detail-row">
                                    <span><i className="fas fa-tags"></i> <strong>Subcategory:</strong> {project.planning_subcategory}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Project Notes */}
                              <NotesList 
                                projectId={project.planning_id || project.id}
                                notes={projectNotes[project.planning_id || project.id] || []}
                                onAddNote={addProjectNote}
                                onUpdateNote={updateProjectNote}
                                onDeleteNote={deleteProjectNote}
                              />
                              
                              <div className="project-card-actions">
                                <button 
                                  className="view-details-btn"
                                  onClick={() => navigate(`/project/${project.planning_id || project.projectId}`)}
                                >
                                  <i className="fas fa-eye"></i> View Details
                                </button>
                                
                                <button 
                                  className="untrack-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    untrackProject(project.id);
                                  }}
                                  title="Remove from tracked projects"
                                >
                                  <i className="fas fa-times"></i> Untrack
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="login-prompt">
                              <p>Log in to view project details</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fas fa-folder-open"></i>
                  <p>You haven't tracked any projects yet.</p>
                  <Link to="/projects" className="button button-primary">Find Projects</Link>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Stats column removed from here - moved to top of dashboard */}
        
        {/* Map View - Temporarily disabled until map component is implemented */}
        {/* Uncomment when ProjectMap component is available
        {dashboardSettings.layout === 'map' && (
          <div className="dashboard-column map-column">
            <ProjectMap 
              projects={trackedProjects} 
              onProjectClick={(project) => {
                navigate(`/project/${project.id}`);
              }}
            />
          </div>
        )}
        */}
      </div>
      
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
