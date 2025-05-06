import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { FaCog, FaHome, FaTimes, FaUndo, FaChartBar, FaTable, FaThLarge, FaChartPie, FaBell } from 'react-icons/fa';
import './Dashboard.css';
import './GettingStartedToggle.css';
import SpendingChartWidget from '../components/dashboard/widgets/SpendingChartWidget';
import ProjectStageWidget from '../components/dashboard/widgets/ProjectStageWidget';
import TrackedProjectsWidget from '../components/dashboard/widgets/TrackedProjectsWidget';
import NotificationsWidget from '../components/dashboard/widgets/NotificationsWidget';
import ProjectUpdateService from '../services/ProjectUpdateService';

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
      lastUpdated: new Date().toISOString() // Use ISO string for localStorage compatibility
    };
    
    console.log('Updating dashboard cache with data:', cacheData);
    
    // Always update state cache even if Firestore update fails
    if (setDashboardCache) {
      setDashboardCache({
        ...cacheData,
        isLoading: false
      });
    }
    
    // Store in localStorage as fallback
    try {
      localStorage.setItem(`dashboardCache_${currentUser.uid}`, JSON.stringify({
        ...cacheData,
        lastUpdated: new Date().toISOString()
      }));
      console.log('Dashboard cache saved to localStorage');
    } catch (localStorageError) {
      console.warn('Could not save to localStorage:', localStorageError);
    }
    
    // Try to store in Firestore (but don't let failure break the app)
    try {
      const cacheDocRef = doc(db, 'dashboardCache', currentUser.uid);
      await setDoc(cacheDocRef, {
        ...cacheData,
        lastUpdated: serverTimestamp() // Use server timestamp for Firestore
      });
      
      console.log('Dashboard cache updated successfully in Firestore');
      return true;
    } catch (firestoreError) {
      console.warn('Error updating dashboard cache in Firestore (continuing with localStorage only):', firestoreError);
      // We still return true since the cache was updated in localStorage and state
      return true;
    }
  } catch (error) {
    console.error('Error in updateDashboardCache:', error);
    return false;
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { completedTasks, checkTaskCompleted } = useOnboarding();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trackedProjects, setTrackedProjects] = useState([]);
  const [projectNotes, setProjectNotes] = useState({});
  const [expandedNotes, setExpandedNotes] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [userRole, setUserRole] = useState('standard');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  
  // In-memory cache for faster data retrieval
  const inMemoryCache = useRef({
    trackedProjects: {},
    projectNotes: {},
    dashboardSettings: {},
    userData: {}
  });
  
  const [dashboardCache, setDashboardCache] = useState({
    isLoading: true,
    totalTrackedProjects: 0,
    totalValue: 0,
    projectsByStatus: {},
    valueByCategory: {},
    timestamp: null
  });
  const [dashboardSettings, setDashboardSettings] = useState({
    layout: 'grid',
    widgets: {
      summary: true,
      timeline: true,
      statistics: true,
      trackedProjects: true,
      notifications: true
    }
  });
  const [userData, setUserData] = useState(null);
  const [showGettingStarted, setShowGettingStarted] = useState(false); // Default to hidden
  const [showErrorBanner, setShowErrorBanner] = useState(true);

  // Function to fetch tracked projects
  const fetchTrackedProjects = useCallback(async () => {
    if (!currentUser) {
      console.log('No user logged in');
      return [];
    }

    try {
      console.log('Fetching tracked projects for user:', currentUser.uid);
      
      // Check in-memory cache first for fastest response
      if (inMemoryCache.current.trackedProjects[currentUser.uid]) {
        const { projects, timestamp } = inMemoryCache.current.trackedProjects[currentUser.uid];
        const cacheAge = new Date() - new Date(timestamp);
        
        if (cacheAge < 2 * 60 * 1000) { // Cache valid for 2 minutes (reduced from 5)
          console.log('Using in-memory cached tracked projects');
          setTrackedProjects(projects);
          return projects;
        }
      }
      
      // Then try localStorage for offline support
      const cachedData = localStorage.getItem(`trackedProjects_${currentUser.uid}`);
      if (cachedData) {
        try {
          const { projects, timestamp } = JSON.parse(cachedData);
          const cacheAge = new Date() - new Date(timestamp);
          
          if (cacheAge < 5 * 60 * 1000) { // Cache valid for 5 minutes
            console.log('Using localStorage cached tracked projects');
            setTrackedProjects(projects);
            
            // Update in-memory cache
            inMemoryCache.current.trackedProjects[currentUser.uid] = {
              projects,
              timestamp
            };
            
            // Still proceed with Firestore fetch in background, but don't wait
            setTimeout(() => {
              fetchFromFirestore().catch(err => 
                console.error('Background tracked projects fetch failed:', err)
              );
            }, 100);
            
            return projects;
          }
        } catch (cacheError) {
          console.warn('Error reading projects from cache:', cacheError);
        }
      }
      
      // Fetch from Firestore if cache not available or expired
      return await fetchFromFirestore();
      
    } catch (error) {
      console.error('Error fetching tracked projects:', error);
      setError('Failed to load tracked projects');
      return [];
    }
    
    // Inner function for Firestore fetch
    async function fetchFromFirestore() {
      const trackedRef = collection(db, 'trackedProjects');
      const trackedQuery = query(
        trackedRef,
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(trackedQuery);
      const projects = [];
      
      querySnapshot.forEach((doc) => {
        const projectData = doc.data();
        projects.push({
          ...projectData,
          id: doc.id
        });
      });
      
      // Update localStorage cache
      try {
        localStorage.setItem(
          `trackedProjects_${currentUser.uid}`,
          JSON.stringify({
            projects,
            timestamp: new Date().toISOString()
          })
        );
      } catch (cacheError) {
        console.warn('Error saving projects to localStorage:', cacheError);
      }
      
      // Update in-memory cache
      inMemoryCache.current.trackedProjects[currentUser.uid] = {
        projects,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Found ${projects.length} tracked projects`);
      setTrackedProjects(projects);
      return projects;
    }
  }, [currentUser]);

  // Function to update dashboard stats
  const updateDashboardStats = useCallback((updatedProjects) => {
    // Calculate new statistics
    const stats = {
      totalTrackedProjects: updatedProjects.length,
      totalValue: updatedProjects.reduce((sum, project) => {
        const value = parseFloat(project.planning_value || project.projectValue || project.value || 0);
        return sum + value;
      }, 0),
      projectsByStatus: updatedProjects.reduce((acc, project) => {
        const status = project.planning_stage || project.status || project.stage || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
      valueByCategory: updatedProjects.reduce((acc, project) => {
        const category = project.planning_category || project.category || project.type || 'Other';
        const value = parseFloat(project.planning_value || project.projectValue || project.value || 0);
        acc[category] = (acc[category] || 0) + value;
        return acc;
      }, {})
    };

    // Update dashboard cache
    setDashboardCache(prev => ({
      ...prev,
      ...stats,
      isLoading: false,
      timestamp: new Date()
    }));

    return stats;
  }, []);

  // Function to load user data with enhanced error handling and caching
  const loadUserData = useCallback(async () => {
    if (!currentUser) {
      console.log('No user logged in');
      return null;
    }

    try {
      // Check in-memory cache first (fastest)
      if (inMemoryCache.current.userData[currentUser.uid]) {
        const { data, timestamp } = inMemoryCache.current.userData[currentUser.uid];
        const cacheAge = new Date() - new Date(timestamp);
        
        if (cacheAge < 5 * 60 * 1000) { // Cache valid for 5 minutes
          console.log('Using in-memory cached user data');
          setUserRole(data.role || 'user');
          setUserData(data);
          return data;
        }
      }
      
      // Try localStorage next
      try {
        const cachedData = localStorage.getItem(`userData_${currentUser.uid}`);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          const cacheAge = new Date() - new Date(timestamp);
          
          if (cacheAge < 15 * 60 * 1000) { // Cache valid for 15 minutes
            console.log('Using localStorage cached user data');
            setUserRole(data.role || 'user');
            setUserData(data);
            
            // Update in-memory cache
            inMemoryCache.current.userData[currentUser.uid] = {
              data,
              timestamp
            };
            
            // Continue with Firestore fetch in background
            setTimeout(() => {
              fetchFromFirestore().catch(err => 
                console.error('Background user data fetch failed:', err)
              );
            }, 100);
            
            return data;
          }
        }
      } catch (cacheError) {
        console.warn('Error reading user data from cache:', cacheError);
      }
      
      // Fetch from Firestore if cache not available or expired
      return await fetchFromFirestore();
      
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Failed to load user data');
      return null;
    }
    
    // Inner function for Firestore fetch
    async function fetchFromFirestore() {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      let userData;
      if (userDoc.exists()) {
        userData = userDoc.data();
        setUserRole(userData.role || 'user');
        setUserData(userData);
      } else {
        console.log('No user document found, creating one...');
        userData = {
          email: currentUser.email,
          role: 'user',
          createdAt: serverTimestamp()
        };
        
        await setDoc(userDocRef, userData);
        setUserRole('user');
        setUserData(userData);
      }
      
      // Update caches
      try {
        // Update localStorage
        localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify({
          data: userData,
          timestamp: new Date().toISOString()
        }));
        
        // Update in-memory cache
        inMemoryCache.current.userData[currentUser.uid] = {
          data: userData,
          timestamp: new Date().toISOString()
        };
      } catch (cacheError) {
        console.warn('Error caching user data:', cacheError);
      }
      
      return userData;
    }
  }, [currentUser]);

  // Function to check for project updates with optimized performance
  const checkForProjectUpdates = useCallback(async () => {
    if (!currentUser || checkingForUpdates) return;
    
    setCheckingForUpdates(true);
    
    try {
      // Get unread count even if the full update check isn't complete
      const unreadCount = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
      setUnreadNotificationsCount(unreadCount);
      
      // Run the heavy update check in the background
      setTimeout(async () => {
        try {
          await ProjectUpdateService.checkForProjectUpdates(currentUser.uid);
          // Update unread count again after the check
          const updatedCount = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
          setUnreadNotificationsCount(updatedCount);
        } catch (backgroundError) {
          console.error('Background update check failed:', backgroundError);
        } finally {
          setCheckingForUpdates(false);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error checking for project updates:', error);
      setCheckingForUpdates(false);
    }
  }, [currentUser, checkingForUpdates]);

  // Function to fetch project notes with improved caching
  const fetchAllProjectNotes = useCallback(async () => {
    if (!currentUser) {
      console.log('No user logged in, cannot fetch project notes');
      setProjectNotes({});
      return {};
    }

    try {
      console.log('Fetching project notes for user:', currentUser.uid);
      
      // Check in-memory cache first (fastest)
      if (inMemoryCache.current.projectNotes[currentUser.uid]) {
        const { notes, timestamp } = inMemoryCache.current.projectNotes[currentUser.uid];
        const cacheAge = new Date() - new Date(timestamp);
        
        if (cacheAge < 2 * 60 * 1000) { // Cache valid for 2 minutes
          console.log('Using in-memory cached project notes');
          setProjectNotes(notes);
          return notes;
        }
      }
      
      // Try to get from localStorage first for immediate display
      const cachedNotes = localStorage.getItem(`projectNotes_${currentUser.uid}`);
      if (cachedNotes) {
        try {
          const { notes, timestamp } = JSON.parse(cachedNotes);
          const cacheAge = new Date() - new Date(timestamp);
          
          if (cacheAge < 30 * 60 * 1000) { // Cache valid for 30 minutes
            console.log('Using localStorage cached project notes');
            setProjectNotes(notes);
            
            // Update in-memory cache
            inMemoryCache.current.projectNotes[currentUser.uid] = {
              notes,
              timestamp
            };
            
            // Still proceed with Firestore fetch in background, but don't wait
            setTimeout(() => {
              fetchFromFirestore().catch(err => 
                console.error('Background project notes fetch failed:', err)
              );
            }, 150);
            
            return notes;
          }
        } catch (cacheError) {
          console.warn('Error reading notes from cache:', cacheError);
        }
      }
      
      // Fetch from Firestore if cache not available or expired
      return await fetchFromFirestore();
      
    } catch (error) {
      console.error('Error fetching project notes:', error);
      // Try to use any cached notes if available
      try {
        const cachedNotes = localStorage.getItem(`projectNotes_${currentUser.uid}`);
        if (cachedNotes) {
          const { notes } = JSON.parse(cachedNotes);
          console.log('Using previously cached project notes as fallback');
          setProjectNotes(notes);
          return notes;
        }
      } catch (e) {
        console.warn('No usable cached notes found');
      }
      return {};
    }
    
    // Inner function for Firestore fetch
    async function fetchFromFirestore() {
      // Fetch from Firestore - without orderBy to avoid index requirement
      const notesRef = collection(db, 'projectNotes');
      const q = query(
        notesRef,
        where('userId', '==', currentUser.uid)
        // Removed the orderBy to avoid index requirement
      );
      
      console.log('Executing Firestore query for project notes...');
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('No project notes found in Firestore');
        setProjectNotes({});
        return {};
      }
      
      const notes = {};
      
      querySnapshot.forEach((doc) => {
        const noteData = doc.data();
        const projectId = noteData.projectId;
        
        if (!projectId) {
          console.warn('Found note without projectId:', doc.id);
          return;
        }
        
        if (!notes[projectId]) {
          notes[projectId] = [];
        }
        
        notes[projectId].push({
          id: doc.id,
          ...noteData,
          createdAt: noteData.createdAt?.toDate?.() || new Date()
        });
      });
      
      // Sort notes manually instead of in the query
      Object.keys(notes).forEach(projectId => {
        notes[projectId].sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB - dateA; // descending order (newest first)
        });
      });
      
      console.log(`Successfully fetched notes for ${Object.keys(notes).length} projects`);
      
      // Save to localStorage
      try {
        localStorage.setItem(`projectNotes_${currentUser.uid}`, JSON.stringify({
          notes,
          timestamp: new Date().toISOString()
        }));
        
        // Update in-memory cache
        inMemoryCache.current.projectNotes[currentUser.uid] = {
          notes,
          timestamp: new Date().toISOString()
        };
      } catch (cacheError) {
        console.warn('Error saving notes to cache:', cacheError);
      }
      
      setProjectNotes(notes);
      return notes;
    }
  }, [currentUser]);
  
  // Function to fetch dashboard settings
  const fetchDashboardSettings = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      // Check in-memory cache first
      if (inMemoryCache.current.dashboardSettings[currentUser.uid]) {
        const { settings, timestamp } = inMemoryCache.current.dashboardSettings[currentUser.uid];
        const cacheAge = new Date() - new Date(timestamp);
        
        if (cacheAge < 10 * 60 * 1000) { // Cache valid for 10 minutes
          console.log('Using in-memory cached dashboard settings');
          setDashboardSettings(prevSettings => ({
            ...prevSettings,
            ...settings
          }));
          return settings;
        }
      }
      
      // Check localStorage cache
      const cachedSettings = localStorage.getItem(`dashboardSettings_${currentUser.uid}`);
      if (cachedSettings) {
        try {
          const { settings, timestamp } = JSON.parse(cachedSettings);
          const cacheAge = new Date() - new Date(timestamp);
          
          if (cacheAge < 60 * 60 * 1000) { // Cache valid for 1 hour
            console.log('Using localStorage cached dashboard settings');
            setDashboardSettings(prevSettings => ({
              ...prevSettings,
              ...settings
            }));
            
            // Update in-memory cache
            inMemoryCache.current.dashboardSettings[currentUser.uid] = {
              settings,
              timestamp
            };
            
            // Continue Firestore fetch in background
            setTimeout(() => {
              fetchFromFirestore().catch(err => 
                console.error('Background settings fetch failed:', err)
              );
            }, 200);
            
            return settings;
          }
        } catch (error) {
          console.warn('Error parsing cached settings:', error);
        }
      }
      
      return await fetchFromFirestore();
    } catch (error) {
      console.error('Error fetching dashboard settings:', error);
    }
    
    async function fetchFromFirestore() {
      const settingsRef = doc(db, 'userSettings', currentUser.uid);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        setDashboardSettings(prevSettings => ({
          ...prevSettings,
          ...settings
        }));
        
        // Update caches
        try {
          // Update localStorage
          localStorage.setItem(`dashboardSettings_${currentUser.uid}`, JSON.stringify({
            settings,
            timestamp: new Date().toISOString()
          }));
          
          // Update in-memory cache
          inMemoryCache.current.dashboardSettings[currentUser.uid] = {
            settings,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.warn('Error caching settings:', error);
        }
        
        return settings;
      }
      
      return null;
    }
  }, [currentUser]);

  // Function to initialize data
  const initializeData = useCallback(async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load cached data for immediate display first
      let cachedProjects = null;
      
      try {
        // Try to get from localStorage for immediate display
        const cachedData = localStorage.getItem(`trackedProjects_${currentUser.uid}`);
        if (cachedData) {
          const { projects, timestamp } = JSON.parse(cachedData);
          const cacheAge = new Date() - new Date(timestamp);
          
          if (cacheAge < 5 * 60 * 1000) { // Cache valid for 5 minutes
            console.log('Using cached tracked projects for initial display');
            setTrackedProjects(projects);
            updateDashboardStats(projects);
            cachedProjects = projects;
            
            // Show the UI faster - progressively load
            setLoading(false);
          }
        }
      } catch (cacheError) {
        console.warn('Error reading from cache:', cacheError);
      }
      
      // Prepare all data fetching promises to run in parallel
      const fetchPromises = [
        loadUserData(),
        fetchTrackedProjects(),
        fetchAllProjectNotes(),
        fetchDashboardSettings()
      ];
      
      // Execute all fetches in parallel instead of sequentially
      const [userData, projects, notes, settings] = await Promise.all(fetchPromises);
      
      // Update dashboard stats with fetched projects
      if (projects && projects.length > 0) {
        updateDashboardStats(projects);
      }
      
      // Run update check in the background (non-blocking)
      setTimeout(() => {
        checkForProjectUpdates().catch(err => {
          console.error('Background update check failed:', err);
        });
      }, 200);
      
      setLoading(false);
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  }, [
    currentUser,
    loadUserData,
    fetchTrackedProjects,
    fetchAllProjectNotes,
    fetchDashboardSettings,
    updateDashboardStats,
    checkForProjectUpdates
  ]);

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
    
    const isCurrentlyVisible = dashboardSettings.widgets[widgetName];
    let updatedWidgets;
    
    if (isCurrentlyVisible) {
      // Remove widget from visible list (except trackedProjects which should always be visible)
      if (widgetName === 'trackedProjects') {
        console.log('trackedProjects widget cannot be hidden');
        return;
      }
      
      updatedWidgets = { ...dashboardSettings.widgets };
      delete updatedWidgets[widgetName];
    } else {
      // Add widget to visible list
      updatedWidgets = { ...dashboardSettings.widgets, [widgetName]: true };
    }
    
    const updatedSettings = {
      ...dashboardSettings,
      widgets: updatedWidgets
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
    console.log('Toggling notes visibility for project:', projectId);
    setExpandedNotes(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
    
    // If we're expanding notes for this project and we haven't loaded notes yet,
    // fetch them now
    if (!expandedNotes[projectId] && (!projectNotes[projectId] || projectNotes[projectId].length === 0)) {
      fetchAllProjectNotes();
    }
  };

  // Function to untrack a project
  const untrackProject = useCallback(async (projectId) => {
    if (!currentUser) {
      console.error('Cannot untrack project: No user logged in');
      return false;
    }

    try {
      console.log('Untracking project with ID:', projectId);
      
      let deleteSuccess = false;
      
      // First try the direct approach with compound ID
      const compoundId = `${currentUser.uid}_${projectId}`;
      try {
        const docRef = doc(db, 'trackedProjects', compoundId);
        
        // Verify document exists before deleting
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          await deleteDoc(docRef);
          console.log('Successfully deleted project with compound ID:', compoundId);
          deleteSuccess = true;
        } else {
          console.log('Document with compound ID does not exist:', compoundId);
        }
      } catch (directError) {
        console.error('Error with direct deletion:', directError);
      }
      
      // If direct approach fails, try query approach
      if (!deleteSuccess) {
        console.log('Trying query approach to find document to delete');
        const trackedRef = collection(db, 'trackedProjects');
        const q = query(
          trackedRef,
          where('userId', '==', currentUser.uid),
          where('projectId', '==', projectId)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          console.log('No matching documents found with query approach');
          
          // Try one more approach - query by any ID field
          const allDocsQuery = query(
            trackedRef,
            where('userId', '==', currentUser.uid)
          );
          
          const allDocsSnapshot = await getDocs(allDocsQuery);
          
          allDocsSnapshot.forEach(doc => {
            const data = doc.data();
            const possibleIds = [
              data.projectId,
              data.planning_id,
              data.id,
              data._id
            ];
            
            if (possibleIds.includes(projectId)) {
              console.log('Found and deleting document with ID:', doc.id);
              deleteDoc(doc.ref);
              deleteSuccess = true;
            }
          });
        } else {
          // Delete all matching documents
          const deletePromises = [];
          querySnapshot.forEach(doc => {
            console.log('Deleting document with ID:', doc.id);
            deletePromises.push(deleteDoc(doc.ref));
          });
          
          await Promise.all(deletePromises);
          console.log('Deleted all matching documents with query approach');
          deleteSuccess = true;
        }
      }
      
      if (deleteSuccess) {
        // Update local state - filter out the untracked project
        const updatedProjects = trackedProjects.filter(p => {
          // Check against all possible ID fields
          const id = p.projectId || p.planning_id || p.id;
          return id !== projectId;
        });
        
        // Log the removal
        console.log(`Removed project ${projectId} from tracked projects. New count: ${updatedProjects.length}`);
        
        // Update tracked projects state
        setTrackedProjects(updatedProjects);
        
        // Update dashboard statistics immediately
        const newStats = updateDashboardStats(updatedProjects);
        console.log('Updated dashboard statistics:', newStats);
        
        // Save updated projects list to localStorage to avoid restoring on refresh
        try {
          localStorage.setItem(
            `trackedProjects_${currentUser.uid}`, 
            JSON.stringify({
              projects: updatedProjects,
              timestamp: new Date().toISOString()
            })
          );
          console.log('Updated localStorage cache for tracked projects');
        } catch (e) {
          console.error('Error updating localStorage:', e);
        }
        
        return true;
      } else {
        console.error('Could not find project to untrack with any method');
        return false;
      }
    } catch (error) {
      console.error('Error untracking project:', error);
      return false;
    }
  }, [currentUser, trackedProjects, updateDashboardStats]);

  // Project note functions
  const addProjectNote = async (projectId, projectTitle, noteText) => {
    try {
      if (!currentUser) {
        console.error('Cannot add note: No user logged in');
        return null;
      }
      
      console.log(`Adding note for project ${projectId}: "${noteText.substring(0, 20)}..."`);
      
      const newNote = {
        userId: currentUser.uid,
        projectId,
        projectTitle,
        text: noteText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Add the note to Firestore
      const docRef = await addDoc(collection(db, 'projectNotes'), newNote);
      console.log('Note added with ID:', docRef.id);
      
      try {
        // Log activity in userActivity collection instead of activity
        await addDoc(collection(db, 'userActivity'), {
          userId: currentUser.uid,
          projectId,
          noteId: docRef.id,
          type: 'note_add',
          timestamp: serverTimestamp()
        });
        console.log('Activity logged for note addition');
      } catch (activityError) {
        console.error('Error logging activity (non-critical):', activityError);
        // Continue even if activity logging fails
      }
      
      // Update local state
      const newNoteWithId = {
        id: docRef.id,
        ...newNote,
        createdAt: new Date()
      };
      
      setProjectNotes(prev => {
        const updatedNotes = { ...prev };
        if (!updatedNotes[projectId]) {
          updatedNotes[projectId] = [];
        }
        updatedNotes[projectId] = [newNoteWithId, ...updatedNotes[projectId]];
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
        console.error('Cannot update note: No user logged in');
        return false;
      }
      
      console.log(`Updating note ${noteId} for project ${projectId}`);
      
      const noteRef = doc(db, 'projectNotes', noteId);
      
      // First check if the note exists and belongs to this user
      const noteDoc = await getDoc(noteRef);
      if (!noteDoc.exists()) {
        console.error('Note not found');
        return false;
      }
      
      const noteData = noteDoc.data();
      if (noteData.userId !== currentUser.uid) {
        console.error('Cannot update note: Permission denied');
        return false;
      }
      
      // Update the note
      await updateDoc(noteRef, {
        text: updatedText,
        updatedAt: serverTimestamp()
      });
      console.log('Note updated successfully');
      
      try {
        // Log activity in userActivity collection
        await addDoc(collection(db, 'userActivity'), {
          userId: currentUser.uid,
          projectId,
          noteId,
          type: 'note_edit',
          timestamp: serverTimestamp()
        });
        console.log('Activity logged for note update');
      } catch (activityError) {
        console.error('Error logging activity (non-critical):', activityError);
        // Continue even if activity logging fails
      }
      
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
        console.error('Cannot delete note: No user logged in');
        return false;
      }
      
      console.log(`Deleting note ${noteId} for project ${projectId}`);
      
      const noteRef = doc(db, 'projectNotes', noteId);
      
      // First check if the note exists and belongs to this user
      const noteDoc = await getDoc(noteRef);
      if (!noteDoc.exists()) {
        console.error('Note not found');
        return false;
      }
      
      const noteData = noteDoc.data();
      if (noteData.userId !== currentUser.uid) {
        console.error('Cannot delete note: Permission denied');
        return false;
      }
      
      // Delete the note
      await deleteDoc(noteRef);
      console.log('Note deleted successfully');
      
      try {
        // Log activity in userActivity collection
        await addDoc(collection(db, 'userActivity'), {
          userId: currentUser.uid,
          projectId,
          noteId,
          type: 'note_delete',
          timestamp: serverTimestamp()
        });
        console.log('Activity logged for note deletion');
      } catch (activityError) {
        console.error('Error logging activity (non-critical):', activityError);
        // Continue even if activity logging fails
      }
      
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

  // Function to test notifications by creating a simulated project update (for backend testing only)
  const testNotificationSystem = async () => {
    try {
      if (!currentUser) return;
      
      console.log('Testing notification system...');
      
      // Get a random tracked project to update
      const trackedRef = collection(db, 'trackedProjects');
      const trackedQuery = query(
        trackedRef,
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(trackedQuery);
      
      if (querySnapshot.empty) {
        console.log('You need to track at least one project to test notifications.');
        return;
      }
      
      // Pick a random project from the tracked projects
      const projects = [];
      querySnapshot.forEach(doc => projects.push({ id: doc.id, ...doc.data() }));
      const randomProject = projects[Math.floor(Math.random() * projects.length)];
      
      // Create a simulated update in the project
      const projectId = randomProject.projectId || randomProject.planning_id;
      const projectTitle = randomProject.planning_title || randomProject.planning_name || 'Project';
      
      // Create different types of notifications to test the system
      await Promise.all([
        // Status change notification
        ProjectUpdateService.createStatusChangeNotification(
          currentUser.uid,
          projectId,
          projectTitle,
          'Testing Phase'
        ),
        
        // Value change notification
        ProjectUpdateService.createValueChangeNotification(
          currentUser.uid,
          projectId,
          projectTitle,
          1000000
        ),
        
        // Document update notification
        ProjectUpdateService.createDocumentUpdateNotification(
          currentUser.uid,
          projectId,
          projectTitle
        )
      ]);
      
      // Update the unread notifications count
      const count = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
      setUnreadNotificationsCount(count);
      
      console.log(`Created test notifications for project "${projectTitle}". Check your notifications!`);
    } catch (error) {
      console.error('Error testing notification system:', error);
    }
  };

  // Function to test the backend with a direct API URL and different time periods
  const testBackendWithDirectUrl = async (timePeriod = '3') => {
    try {
      if (!currentUser) {
        console.error('You must be logged in to test the backend');
        return;
      }
      
      console.log(`Testing backend with time period: ${timePeriod}`);
      
      // Use environment variables for API credentials
      const apiKey = process.env.REACT_APP_BUILDINGINFO_API_KEY;
      const uKey = process.env.REACT_APP_BUILDINGINFO_UKEY;
      
      if (!apiKey || !uKey) {
        console.error('API credentials not configured. Please set environment variables.');
        return;
      }
      
      const url = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${apiKey}&ukey=${uKey}&more=limit%200,1000&_apion=${timePeriod}`;
      
      console.log('Using URL:', url);
      
      // Call the test function with the direct URL
      const newNotificationsCount = await ProjectUpdateService.testWithDirectUrl(currentUser.uid, url);
      
      // Update the unread notifications count
      const count = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
      setUnreadNotificationsCount(count);
      
      console.log(`Backend test complete. Created ${newNotificationsCount} new notifications.`);
      
      if (newNotificationsCount === 0) {
        console.log('No notifications were created. This could be because:');
        console.log('1. There are no updated projects in the selected time period');
        console.log('2. You are not tracking any of the updated projects');
        console.log('3. Try a different time period by calling testBackendWithDirectUrl("1") for past 30 days');
      } else {
        console.log('You can check the notifications in the notifications widget.');
      }
      
      return newNotificationsCount;
    } catch (error) {
      console.error('Error testing backend with direct URL:', error);
      return 0;
    }
  };
  
  // Make the test function available globally for console testing
  if (typeof window !== 'undefined') {
    window.testBackendWithDirectUrl = testBackendWithDirectUrl;
  }

  // Add effect to update unread notifications count periodically
  useEffect(() => {
    if (!currentUser) return;
    
    // Get initial unread count
    const getUnreadCount = async () => {
      try {
        const count = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
        setUnreadNotificationsCount(count);
      } catch (error) {
        console.error('Error getting unread notifications count:', error);
      }
    };
    
    getUnreadCount();
    
    // Set up interval to check periodically (every 5 minutes)
    const interval = setInterval(getUnreadCount, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
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

  // Fetch project notes when dashboard loads
  useEffect(() => {
    if (currentUser) {
      fetchTrackedProjects();
      fetchAllProjectNotes();
      fetchDashboardSettings();
      checkForProjectUpdates();
    }
  }, [currentUser]);

  // Clear any errors on component mount
  useEffect(() => {
    // Clear any existing errors related to indexes after 1 second
    const timer = setTimeout(() => {
      if (error && error.includes('index')) {
        setError(null);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [error]);

  // Error display component with dismiss capability
  const ErrorDisplay = ({ message, onDismiss }) => {
    if (!message) return null;
    
    return (
      <div className="error-banner" style={{
        backgroundColor: '#f8d7da',
        color: '#721c24',
        padding: '10px 15px',
        marginBottom: '20px',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>{message}</span>
        <button 
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#721c24',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>
    );
  };

  // Function to render connection status
  const renderConnectionStatus = () => {
    if (!isOnline) {
      return (
        <div style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '10px 15px',
          marginBottom: '20px',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          <p style={{margin: '0'}}>You are currently offline. Some features may be limited.</p>
        </div>
      );
    }
    return null;
  };

  // Function to handle offline functionality
  const handleOfflineAction = async (action) => {
    if (!isOnline) {
      console.log('Offline action queued:', action);
      // Queue the action for when we're back online
      const queuedActions = JSON.parse(localStorage.getItem('queuedActions') || '[]');
      queuedActions.push({
        action,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('queuedActions', JSON.stringify(queuedActions));
      return false;
    }
    return true;
  };

  // Set up online/offline event handlers
  const handleOnline = useCallback(() => {
    setIsOnline(true);
    initializeData();
  }, [initializeData]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    // Set up event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initialize dashboard data
    initializeData();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline, initializeData]);

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

      {renderConnectionStatus()}

      {showGettingStarted && (
        <GettingStartedWidget 
          completedTasks={completedTasks} 
          checkTaskCompleted={checkTaskCompleted} 
        />
      )}

      {error && showErrorBanner && (
        <ErrorDisplay 
          message={error} 
          onDismiss={() => setError(null)} 
        />
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
          
          {/* Notifications Section */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e0e0e0',
            position: 'relative'
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
              <FaBell style={{color: '#4e73df'}} /> Notifications
              {unreadNotificationsCount > 0 && (
                <span className="notification-badge">{unreadNotificationsCount}</span>
              )}
            </h3>
            <NotificationsWidget 
              data={{
                userId: currentUser?.uid,
                limit: 5,
                onNotificationRead: async (notificationId) => {
                  await ProjectUpdateService.markNotificationAsRead(notificationId);
                  // Update unread count
                  const count = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
                  setUnreadNotificationsCount(count);
                },
                onCheckForUpdates: checkForProjectUpdates,
                checkingForUpdates: checkingForUpdates
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
