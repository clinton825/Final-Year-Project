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
  const [expandedNotes, setExpandedNotes] = useState({});
  const [projectNotes, setProjectNotes] = useState({});
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [userData, setUserData] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [userRole, setUserRole] = useState('standard');
  const [showGettingStarted, setShowGettingStarted] = useState(false); // Default to hidden

  // Set up online/offline event handlers
  const handleOnline = () => {
    console.log('Dashboard detected online status');
    setIsOnline(true);
    setIsOffline(false);
  };
  
  const handleOffline = () => {
    console.log('Dashboard detected offline status');
    setIsOnline(false);
    setIsOffline(true);
  };

  // Function to initialize data
  const initializeData = () => {
    if (currentUser) {
      console.log('Loading dashboard data...');
      fetchTrackedProjects();
      fetchAllProjectNotes();
      fetchDashboardSettings();
      loadDashboardCache();
    }
  };

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
          const emergencyUserData = {
            firstName: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User',
            email: currentUser.email,
            uid: currentUser.uid,
            role: 'standard'
          };
          setUserData(emergencyUserData);
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

  // Add initializeData function reference at component level, before the useEffect
  const initializeDataWithDelay = () => {
    setTimeout(() => {
      initializeData();
    }, 100);
  };
  
  // Function to check for project updates
  const checkForProjectUpdates = async () => {
    if (!currentUser) return;
    
    try {
      setCheckingForUpdates(true);
      console.log('Checking for project updates...');
      
      // Use the ProjectUpdateService to check for updates
      await ProjectUpdateService.checkForProjectUpdates(currentUser.uid);
      
      // Get unread notifications count
      const count = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
      setUnreadNotificationsCount(count);
      
      console.log(`Found ${count} unread notifications`);
    } catch (error) {
      console.error('Error checking for project updates:', error);
    } finally {
      setCheckingForUpdates(false);
    }
  };

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
            
            // Extract project data either from the root level or from nested projectData object
            const nestedData = projectData.projectData || {};
            
            // Ensure we have complete project information
            const processedProject = {
              // Ensure all required fields exist with clear fallbacks
              planning_id: projectId,
              planning_title: 
                projectData.planning_title || 
                projectData.planning_name || 
                projectData.title || 
                nestedData.planning_title || 
                nestedData.planning_name || 
                nestedData.title || 
                (projectData.name ? `${projectData.name} Project` : 'New Project'),
              planning_description: 
                projectData.planning_description || 
                projectData.description || 
                nestedData.planning_description || 
                nestedData.description || 
                'No description available',
              planning_value: parseFloat(
                projectData.planning_value || 
                projectData.projectValue || 
                projectData.value || 
                nestedData.planning_value || 
                nestedData.projectValue || 
                nestedData.value || 
                0
              ),
              planning_stage: 
                projectData.planning_stage || 
                projectData.status || 
                nestedData.planning_stage || 
                nestedData.status || 
                'Unknown',
              planning_category: 
                projectData.planning_category || 
                projectData.category || 
                projectData.type || 
                nestedData.planning_category || 
                nestedData.category || 
                nestedData.type || 
                'Uncategorized',
              planning_county: 
                projectData.planning_county || 
                projectData.county || 
                projectData.planning_location || 
                projectData.location || 
                nestedData.planning_county || 
                nestedData.county || 
                nestedData.planning_location || 
                nestedData.location || 
                'Unknown',
              
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
                planning_name: data.planning_name || data.planning_title || data.title || (data.name ? `${data.name} Project` : 'New Project'),
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

  // Function to untrack a project from the dashboard
  const untrackProject = async (projectId) => {
    if (!currentUser) {
      console.log('No user logged in, cannot untrack project');
      return;
    }
    
    try {
      console.log('Untracking project with ID:', projectId);
      
      // Get clean ID from possibly compound ID
      let cleanProjectId = projectId;
      if (typeof projectId === 'string' && projectId.includes('_')) {
        cleanProjectId = projectId.split('_')[1];
        console.log('Extracted clean ID for untracking:', cleanProjectId);
      }
      
      // First try the direct compound ID approach
      const compoundId = `${currentUser.uid}_${cleanProjectId}`;
      const docRef = doc(db, 'trackedProjects', compoundId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Delete the document
        await deleteDoc(docRef);
        console.log('Successfully untracked project with compound ID');
      } else {
        // Try alternative query approach
        console.log('Document not found with compound ID, trying query approach');
        
        const q = query(
          collection(db, 'trackedProjects'),
          where('userId', '==', currentUser.uid),
          where('projectId', '==', cleanProjectId)
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
        } else {
          console.log('No document found to untrack');
          return false;
        }
      }
      
      // Update cached tracked projects
      const cachedProjects = JSON.parse(localStorage.getItem('trackedProjectsCache') || '[]');
      if (cachedProjects.length > 0) {
        // Remove the untracked project from the cache
        const updatedCache = cachedProjects.filter(
          project => project.projectId !== cleanProjectId && 
                    project.planning_id !== cleanProjectId
        );
        
        // Update the cache in localStorage
        localStorage.setItem('trackedProjectsCache', JSON.stringify(updatedCache));
        
        // Update state
        setTrackedProjects(prevTrackedProjects => 
          prevTrackedProjects.filter(
            project => project.projectId !== cleanProjectId && 
                      project.planning_id !== cleanProjectId
          )
        );
      }
      
      // Log the untrack activity
      await addDoc(collection(db, 'userActivity'), {
        userId: currentUser.uid,
        type: 'untrack',
        projectId: cleanProjectId,
        timestamp: serverTimestamp()
      });
      
      console.log('Project successfully untracked');
      
      return true;
    } catch (error) {
      console.error('Error untracking project:', error);
      return false;
    }
  };

  // Fetch project notes
  const fetchAllProjectNotes = async () => {
    try {
      if (!currentUser) {
        console.error('Cannot fetch project notes: No user logged in');
        return;
      }
      
      console.log('Fetching all project notes for user:', currentUser.uid);
      
      // Create a query to get all notes for this user
      const notesRef = collection(db, 'projectNotes');
      const q = query(
        notesRef,
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('No project notes found for this user');
        setProjectNotes({});
        return;
      }
      
      // Group notes by project ID
      const notesByProject = {};
      
      querySnapshot.forEach((doc) => {
        const noteData = doc.data();
        const projectId = noteData.projectId;
        
        if (!notesByProject[projectId]) {
          notesByProject[projectId] = [];
        }
        
        notesByProject[projectId].push({
          id: doc.id,
          ...noteData
        });
      });
      
      console.log('Fetched notes for projects:', Object.keys(notesByProject));
      setProjectNotes(notesByProject);
      
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
        if (!loadedSettings.widgets || !loadedSettings.widgets.trackedProjects) {
          console.log('trackedProjects was not in widgets, adding it');
          loadedSettings.widgets = { ...loadedSettings.widgets, trackedProjects: true };
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

  // Get initial unread count
  const getUnreadCount = async () => {
    if (currentUser) {
      const count = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
      setUnreadNotificationsCount(count);
    }
  };

  // Mark notification as read
  const onNotificationRead = async (notificationId) => {
    await ProjectUpdateService.markNotificationAsRead(notificationId);
    // Update unread count
    const count = await ProjectUpdateService.getUnreadNotificationsCount(currentUser.uid);
    setUnreadNotificationsCount(count);
  };

  // Main initialization effect
  useEffect(() => {
    if (currentUser) {
      console.log('Dashboard mounted with user:', currentUser.uid);
      
      // Set up online/offline event listeners
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      // Load user data first
      loadUserData();
      
      // Initialize dashboard data with a slight delay to improve perceived performance
      initializeDataWithDelay();
      
      // Check for project updates when user logs in
      checkForProjectUpdates();
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [currentUser]);

  // Add effect to update unread notifications count periodically
  useEffect(() => {
    if (!currentUser) return;
    
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
                onNotificationRead: onNotificationRead,
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
