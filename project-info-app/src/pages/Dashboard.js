import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, getDoc, setDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getDatabase, ref, set } from "firebase/database";
import { getAuth } from "firebase/auth";
import './Dashboard.css';

// Export the updateDashboardCache function
export const updateDashboardCache = async (currentUser, trackedProjects, setDashboardCache) => {
  try {
    if (!currentUser) {
      console.log('No current user, skipping dashboard cache update');
      return;
    }
    
    console.log('Updating dashboard cache for user:', currentUser.uid);
    console.log('Projects to analyze:', trackedProjects);
    
    // Safety check for trackedProjects
    if (!trackedProjects || !Array.isArray(trackedProjects)) {
      console.error('Invalid tracked projects data for cache update');
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
  const navigate = useNavigate();
  const [trackedProjects, setTrackedProjects] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [userData, setUserData] = useState(null);
  const [dashboardSettings, setDashboardSettings] = useState({
    layout: 'grid',
    visibleWidgets: ['trackedProjects', 'recentActivity', 'projectStats'],
    theme: 'system',
    defaultView: 'all'
  });
  const [dashboardCache, setDashboardCache] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [chartData, setChartData] = useState({
    categories: [],
    values: []
  });

  // Function to toggle dashboard layout between grid and list
  const toggleDashboardLayout = async () => {
    try {
      const newLayout = dashboardSettings.layout === 'grid' ? 'list' : 'grid';
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
  const untrackProject = async (projectId) => {
    try {
      if (!currentUser) return;
      
      // First confirm with the user
      if (!window.confirm('Are you sure you want to untrack this project?')) {
        return;
      }
      
      console.log('Untracking project:', projectId);
      
      // Delete from trackedProjects collection
      const projectRef = doc(db, 'trackedProjects', projectId);
      await deleteDoc(projectRef);
      
      // Update local state to remove the project
      const updatedProjects = trackedProjects.filter(p => {
        const pId = p.id || p.projectId;
        return pId !== projectId;
      });
      
      setTrackedProjects(updatedProjects);
      
      // Log activity
      try {
        await addDoc(collection(db, 'activity'), {
          userId: currentUser.uid,
          type: 'untrack',
          projectId: projectId,
          description: 'Untracked a project',
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error('Error logging untrack activity:', err);
      }
      
      // Update dashboard cache with the updated projects list
      await updateDashboardCache(currentUser, updatedProjects, setDashboardCache);
      
      // Show success message
      alert('Project successfully untracked');
      
    } catch (error) {
      console.error('Error untracking project:', error);
      alert('Error untracking project: ' + error.message);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      console.log('App is online');
      setIsOffline(false);
      if (currentUser) {
        fetchTrackedProjects();
        fetchRecentActivity();
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
    const fetchUserData = async () => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userSnapshot = await getDoc(userDocRef);
          
          if (userSnapshot.exists()) {
            setUserData(userSnapshot.data());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    
    fetchUserData();
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
        const status = project.status || project.planning_stage || 'Unknown';
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
      if (!currentUser) return;
      
      console.log('Saving dashboard settings:', newSettings);
      setSavingSettings(true);
      
      // Make sure we don't remove trackedProjects from visible widgets
      if (newSettings.visibleWidgets && !newSettings.visibleWidgets.includes('trackedProjects')) {
        console.log('Ensuring trackedProjects remains visible');
        newSettings.visibleWidgets.push('trackedProjects');
      }
      
      // Create updated settings object
      const updatedSettings = {
        ...dashboardSettings,
        ...newSettings,
        updatedAt: serverTimestamp()
      };
      
      // Update local state
      setDashboardSettings(updatedSettings);
      
      // Save to Firestore
      const settingsDocRef = doc(db, 'userSettings', currentUser.uid);
      await setDoc(settingsDocRef, {
        dashboardSettings: updatedSettings,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      console.log('Dashboard settings saved successfully');
    } catch (error) {
      console.error('Error saving dashboard settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) {
        console.log('No current user, skipping tracked projects fetch');
        return;
      }
      
      console.log('Fetching tracked projects for user:', currentUser.uid);
      
      const q = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid)
      );
      
      try {
        const initialSnapshot = await getDocs(q);
        console.log('Initial tracked projects snapshot size:', initialSnapshot.size);
        
        if (!initialSnapshot.empty) {
          const projects = [];
          initialSnapshot.forEach(doc => {
            const projectData = doc.data();
            console.log('Project data from Firestore:', projectData);
            
            projects.push({
              id: doc.id,
              ...projectData
            });
          });
          
          console.log('All projects:', projects);
          setTrackedProjects(projects);
          console.log('Initial tracked projects set:', projects.length, 'projects');
        } else {
          console.log('No tracked projects found for user:', currentUser.uid);
          const allProjectsQuery = query(collection(db, 'trackedProjects'));
          const allProjectsSnapshot = await getDocs(allProjectsQuery);
          console.log('Total projects in collection:', allProjectsSnapshot.size);
          
          if (allProjectsSnapshot.size > 0) {
            const sampleDoc = allProjectsSnapshot.docs[0];
            console.log('Sample project structure:', sampleDoc.data());
            console.log('Sample project userId:', sampleDoc.data().userId);
            console.log('Current user ID for comparison:', currentUser.uid);
          }
        }
        
        const unsubscribe = onSnapshot(q, 
          (snapshot) => {
            console.log('Real-time tracked projects snapshot size:', snapshot.size);
            const projects = [];
            snapshot.forEach(doc => {
              const projectData = doc.data();
              projects.push({
                id: doc.id,
                ...projectData
              });
            });
            
            console.log('Updated projects list:', projects);
            setTrackedProjects(projects);
          }, 
          (error) => {
            console.error('Error in tracked projects snapshot:', error);
            setError('Failed to load your tracked projects. Please refresh the page or try again later.');
            setLoading(false);
          }
        );
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching tracked projects:', error);
        setError('Failed to load tracked projects. Please try again later.');
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error in fetchTrackedProjects:', error);
      setError('An unexpected error occurred. Please refresh the page or try again later.');
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      if (!currentUser) {
        setRecentActivity([]);
        return;
      }
      
      console.log('Fetching recent activity for user:', currentUser.uid);
      
      const q = query(
        collection(db, 'activity'),
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      try {
        const unsubscribe = onSnapshot(q, (snapshot) => {
          console.log('Recent activity snapshot size:', snapshot.size);
          
          const activities = [];
          snapshot.forEach(doc => {
            const activityData = doc.data();
            console.log('Recent activity data:', activityData);
            
            // Improved timestamp handling 
            let timestamp;
            try {
              // Handle Firestore timestamps properly
              timestamp = activityData.timestamp?.toDate ? activityData.timestamp.toDate() : 
                          (activityData.timestamp ? new Date(activityData.timestamp) : new Date());
            } catch (err) {
              console.error('Error parsing timestamp:', err);
              timestamp = new Date();
            }
            
            activities.push({ 
              id: doc.id, 
              ...activityData,
              timestamp: timestamp 
            });
          });
          
          setRecentActivity(activities);
          console.log('Recent activity set:', activities.length, 'activities');
          setLoading(false);
        }, (error) => {
          console.error('Error in recent activity snapshot:', error);
          getDocs(q).then((snapshot) => {
            const activities = [];
            snapshot.forEach(doc => {
              const activityData = doc.data();
              console.log('Recent activity data:', activityData);
              
              // Improved timestamp handling 
              let timestamp;
              try {
                // Handle Firestore timestamps properly
                timestamp = activityData.timestamp?.toDate ? activityData.timestamp.toDate() : 
                            (activityData.timestamp ? new Date(activityData.timestamp) : new Date());
              } catch (err) {
                console.error('Error parsing timestamp:', err);
                timestamp = new Date();
              }
              
              activities.push({ 
                id: doc.id, 
                ...activityData,
                timestamp: timestamp 
              });
            });
            
            setRecentActivity(activities);
            setLoading(false);
          }).catch(err => {
            console.error('Fallback fetch also failed:', err);
            setError('Failed to load your recent activity. Please try again later.');
            setLoading(false);
          });
        });
        
        return () => unsubscribe();
      } catch (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      setError('Failed to load your recent activity. Please try again later.');
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
      recentActivity: recentActivity,
      lastUpdated: new Date().toISOString(),
    };

    saveUserDashboardData(dashboardData);
  }, [trackedProjects, recentActivity]);

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
      {/* User greeting banner with personalized suggestions */}
      <div className="dashboard-header">
        <h1>Dashboard {userData && `| Hello, ${userData.firstName || currentUser?.displayName || 'User'}`}</h1>
        {isOffline && (
          <div className="offline-indicator">
            You are currently offline. Some features may be limited.
          </div>
        )}
      </div>
      
      {/* Summary section with key metrics */}
      {trackedProjects.length > 0 && (
        <div className="dashboard-summary">
          <div className="summary-card total-projects">
            <i className="fas fa-clipboard-list"></i>
            <div className="summary-data">
              <span className="summary-value">{trackedProjects.length}</span>
              <span className="summary-label">Tracked Projects</span>
            </div>
          </div>
          
          <div className="summary-card total-value">
            <i className="fas fa-euro-sign"></i>
            <div className="summary-data">
              <span className="summary-value">
                €{trackedProjects.reduce((total, project) => {
                  const rawValue = project.projectValue || project.planning_value || project.value || project.budget || 0;
                  let numValue = 0;
                  try {
                    numValue = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, '')) || 0;
                  } catch (e) {
                    numValue = 0;
                  }
                  return total + numValue;
                }, 0).toLocaleString()}
              </span>
              <span className="summary-label">Total Value</span>
            </div>
          </div>
          
          <div className="summary-card user-activity">
            <i className="fas fa-user-clock"></i>
            <div className="summary-data">
              <span className="summary-value">{recentActivity.length}</span>
              <span className="summary-label">Recent Activities</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Dashboard settings controls */}
      <div className="dashboard-controls">
        <button 
          onClick={toggleDashboardLayout}
          className="dashboard-control-btn"
          title={`Switch to ${dashboardSettings.layout === 'grid' ? 'list' : 'grid'} layout`}
        >
          <i className={`fas fa-${dashboardSettings.layout === 'grid' ? 'list' : 'th'}`}></i>
          <span className="control-label">Layout</span>
        </button>
        
        {/* Widget visibility toggles - clarified purpose */}
        <div className="widget-toggles">
          <span className="toggle-label">Show/Hide:</span>
          <button 
            onClick={() => toggleWidgetVisibility('trackedProjects')}
            className="dashboard-control-btn active"
            title="Projects Section (Always Visible)"
          >
            <i className="fas fa-bookmark"></i>
            <span className="control-label">Projects</span>
          </button>
          
          <button 
            onClick={() => toggleWidgetVisibility('recentActivity')}
            className={`dashboard-control-btn ${dashboardSettings.visibleWidgets.includes('recentActivity') ? 'active' : ''}`}
            title="Toggle Activity Widget"
          >
            <i className="fas fa-history"></i>
            <span className="control-label">Activity</span>
          </button>
          
          <button 
            onClick={() => toggleWidgetVisibility('projectStats')}
            className={`dashboard-control-btn ${dashboardSettings.visibleWidgets.includes('projectStats') ? 'active' : ''}`}
            title="Toggle Statistics Widget"
          >
            <i className="fas fa-chart-pie"></i>
            <span className="control-label">Stats</span>
          </button>
        </div>
      </div>
      
      {/* Dashboard content with applied settings */}
      <div className={`dashboard-content layout-${dashboardSettings.layout}`}>
        {/* Tracked Projects section - always visible */}
        <section className="tracked-projects">
          <h2>Tracked Projects</h2>
          
          {error && <div className="error-message">{error}</div>}
          
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
                              <span><i className="fas fa-info-circle"></i> <strong>Status:</strong> {projectStatus}</span>
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
                          <div className="project-card-actions">
                            <button 
                              className="view-details-btn"
                              onClick={() => navigate(`/project/${projectId}`)}
                            >
                              <i className="fas fa-eye"></i> View Details
                            </button>
                            
                            <button 
                              className="untrack-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                untrackProject(projectId);
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
              <Link to="/" className="button button-primary">Find Projects</Link>
            </div>
          )}
        </section>
        
        {dashboardSettings.visibleWidgets.includes('recentActivity') && (
          <section className="recent-activity">
            <h2>Recent Activity</h2>
            
            {recentActivity.length > 0 ? (
              <div className="activity-list">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-icon">
                      <i className={`fas fa-${
                        activity.type === 'track' ? 'bookmark' : 
                        activity.type === 'untrack' ? 'times' :
                        activity.type === 'search' ? 'search' : 
                        activity.type === 'view' ? 'eye' : 'history'
                      }`}></i>
                    </div>
                    <div className="activity-content">
                      <p>{activity.description}</p>
                      <span className="activity-meta">
                        {activity.timestamp ? 
                          (() => {
                            try {
                              return new Date(activity.timestamp).toLocaleString();
                            } catch (e) {
                              console.error('Error formatting timestamp:', e);
                              return 'Unknown time';
                            }
                          })() 
                          : 'Unknown time'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <i className="fas fa-history"></i>
                <p>No recent activity</p>
              </div>
            )}
          </section>
        )}
        
        {dashboardSettings.visibleWidgets.includes('projectStats') && (
          <section className="project-stats">
            <h2>Project Statistics</h2>
            
            {(dashboardCache && dashboardCache.totalTrackedProjects > 0) || trackedProjects.length > 0 ? (
              <div className="stats-container">
                {/* Basic stats cards */}
                <div className="stat-card">
                  <div className="stat-icon"><i className="fas fa-bookmark"></i></div>
                  <div className="stat-content">
                    <h3 className="stat-title">Tracked Projects</h3>
                    <p className="stat-value">{dashboardCache?.totalTrackedProjects || trackedProjects.length}</p>
                  </div>
                </div>
                
                {/* Status distribution stats */}
                {dashboardCache && Object.entries(dashboardCache.projectsByStatus || {}).length > 0 ? (
                  Object.entries(dashboardCache.projectsByStatus || {}).map(([status, count]) => (
                    <div className="stat-card" key={status}>
                      <div className="stat-icon">
                        <i className={`fas fa-${
                          status.toLowerCase().includes('plan') ? 'clipboard' : 
                          status.toLowerCase().includes('progress') ? 'hammer' : 
                          status.toLowerCase().includes('complet') ? 'check-circle' : 
                          'circle'
                        }`}></i>
                      </div>
                      <div className="stat-content">
                        <h3 className="stat-title">{status}</h3>
                        <p className="stat-value">{count}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  // Calculate status counts directly from trackedProjects if dashboardCache is not available
                  (() => {
                    const statusCounts = trackedProjects.reduce((acc, project) => {
                      const status = project.status || project.planning_stage || project.stage || 'Unknown';
                      acc[status] = (acc[status] || 0) + 1;
                      return acc;
                    }, {});
                    
                    return Object.entries(statusCounts).map(([status, count]) => (
                      <div className="stat-card" key={status}>
                        <div className="stat-icon">
                          <i className={`fas fa-${
                            status.toLowerCase().includes('plan') ? 'clipboard' : 
                            status.toLowerCase().includes('progress') ? 'hammer' : 
                            status.toLowerCase().includes('complet') ? 'check-circle' : 
                            'circle'
                          }`}></i>
                        </div>
                        <div className="stat-content">
                          <h3 className="stat-title">{status}</h3>
                          <p className="stat-value">{count}</p>
                        </div>
                      </div>
                    ));
                  })()
                )}
                
                {/* Value by category stats */}
                {dashboardCache && Object.entries(dashboardCache.valueByCategory || {}).length > 0 ? (
                  Object.entries(dashboardCache.valueByCategory || {}).map(([category, value]) => (
                    <div className="stat-card" key={`value-${category}`}>
                      <div className="stat-icon">
                        <i className="fas fa-euro-sign"></i>
                      </div>
                      <div className="stat-content">
                        <h3 className="stat-title">{category} Value</h3>
                        <p className="stat-value">€{value.toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  // Calculate category values directly from trackedProjects if dashboardCache is not available
                  (() => {
                    const categoryValues = trackedProjects.reduce((acc, project) => {
                      const category = project.planning_category || project.category || 'Unknown';
                      const rawValue = project.projectValue || project.planning_value || project.value || project.budget || 0;
                      let numValue = 0;
                      try {
                        numValue = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, '')) || 0;
                      } catch (e) {
                        numValue = 0;
                      }
                      acc[category] = (acc[category] || 0) + numValue;
                      return acc;
                    }, {});
                    
                    return Object.entries(categoryValues).map(([category, value]) => (
                      <div className="stat-card" key={`value-${category}`}>
                        <div className="stat-icon">
                          <i className="fas fa-euro-sign"></i>
                        </div>
                        <div className="stat-content">
                          <h3 className="stat-title">{category} Value</h3>
                          <p className="stat-value">€{value.toLocaleString()}</p>
                        </div>
                      </div>
                    ));
                  })()
                )}
                
                {/* Simple bar chart visualization */}
                <div className="stats-chart">
                  <h3 className="chart-title">Project Value Distribution</h3>
                  <div className="chart-container">
                    {dashboardCache && Object.entries(dashboardCache.valueByCategory || {}).length > 0 ? (
                      Object.entries(dashboardCache.valueByCategory || {}).map(([category, value]) => {
                        // Calculate width percentage - cap at 100% for display
                        const maxValue = Math.max(...Object.values(dashboardCache.valueByCategory || {}));
                        const percentage = Math.min(100, (value / maxValue) * 100);
                        
                        return (
                          <div className="chart-bar-container" key={`chart-${category}`}>
                            <div className="chart-label">{category}</div>
                            <div className="chart-bar-wrapper">
                              <div 
                                className="chart-bar" 
                                style={{width: `${percentage}%`}}
                                title={`€${value.toLocaleString()}`}
                              ></div>
                              <span className="chart-value">€{value.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // Generate chart directly from trackedProjects if dashboardCache is not available
                      (() => {
                        const categoryValues = trackedProjects.reduce((acc, project) => {
                          const category = project.planning_category || project.category || 'Unknown';
                          const rawValue = project.projectValue || project.planning_value || project.value || project.budget || 0;
                          let numValue = 0;
                          try {
                            numValue = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, '')) || 0;
                          } catch (e) {
                            numValue = 0;
                          }
                          acc[category] = (acc[category] || 0) + numValue;
                          return acc;
                        }, {});
                        
                        const maxValue = Math.max(...Object.values(categoryValues), 1);
                        
                        return Object.entries(categoryValues).map(([category, value]) => {
                          const percentage = Math.min(100, (value / maxValue) * 100);
                          
                          return (
                            <div className="chart-bar-container" key={`chart-${category}`}>
                              <div className="chart-label">{category}</div>
                              <div className="chart-bar-wrapper">
                                <div 
                                  className="chart-bar" 
                                  style={{width: `${percentage}%`}}
                                  title={`€${value.toLocaleString()}`}
                                ></div>
                                <span className="chart-value">€{value.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state enhanced">
                <i className="fas fa-chart-bar"></i>
                <p>No statistics available yet</p>
                <p className="empty-subtext">Track some projects to generate personalized statistics and insights</p>
                <Link to="/" className="button button-primary">
                  <i className="fas fa-search"></i> Find Projects to Track
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
      
      {savingSettings && (
        <div className="saving-indicator">
          <i className="fas fa-spinner fa-spin"></i> Saving settings...
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
