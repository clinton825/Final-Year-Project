import React, { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  orderBy,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../contexts/AuthContext';
import { FaBell, FaBellSlash, FaCalendarAlt, FaChartLine, FaFileAlt, FaSave, FaInfoCircle, FaSync, FaTimes, FaCog } from 'react-icons/fa';
import './NotificationsWidget.css';
import ProjectUpdateNotification from './ProjectUpdateNotification';
import ProjectUpdateService from '../../../services/ProjectUpdateService';

const NotificationsWidget = ({ data }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [preferences, setPreferences] = useState({
    projectUpdates: true,
    statusChanges: true,
    newDocuments: false,
    valueChanges: true,
    dailySummary: false,
    weeklySummary: true,
    // Email notification preferences
    emailEnabled: false,
    emailProjectTracking: true, 
    emailStatusChanges: true,
    emailWeeklySummary: true,
    emailAddress: currentUser?.email || '',
    // New check period preference
    checkPeriod: '3' // Default to today only
  });
  const [trackedProjects, setTrackedProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch notification preferences when component mounts
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        setError(null);
        setOfflineMode(false);
        
        if (!currentUser) {
          console.log('No user signed in');
          setLoading(false);
          return;
        }
        
        // Check online status first
        if (!navigator.onLine) {
          console.log('Device is offline, using cached data if available');
          setOfflineMode(true);
        }
        
        // Fetch notification preferences from Firestore
        const prefsDocRef = doc(db, 'userPreferences', currentUser.uid);
        const prefsDoc = await getDoc(prefsDocRef);
        
        if (prefsDoc.exists()) {
          const prefsData = prefsDoc.data();
          if (prefsData.notifications) {
            setPreferences(prefsData.notifications);
            console.log('Loaded notification preferences:', prefsData.notifications);
          }
          
          if (prefsData.selectedProjectIds) {
            setSelectedProjects(prefsData.selectedProjectIds);
            console.log('Loaded selected projects:', prefsData.selectedProjectIds);
          }
        } else {
          // Create default preferences if they don't exist
          try {
            await setDoc(prefsDocRef, {
              notifications: preferences,
              selectedProjectIds: [],
              updatedAt: serverTimestamp()
            });
            console.log('Created default notification preferences');
          } catch (writeError) {
            console.error('Error creating default preferences, likely offline:', writeError);
            // Continue with default preferences in memory
          }
        }
        
        // Fetch tracked projects to enable per-project notifications
        await fetchTrackedProjects();
        
        // Fetch project update notifications
        await fetchProjectNotifications();
      } catch (error) {
        console.error('Error fetching notification preferences:', error);
        setError('Failed to load notification preferences. You may be offline.');
        setOfflineMode(!navigator.onLine);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreferences();
    
    // Add online/offline event listeners
    const handleOnline = () => {
      console.log('Device is back online, refreshing notification data');
      setOfflineMode(false);
      fetchPreferences();
    };
    
    const handleOffline = () => {
      console.log('Device went offline, switching to offline mode');
      setOfflineMode(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser]);
  
  // Fetch tracked projects to allow per-project notification configuration
  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) return;
      
      const trackedProjectsRef = collection(db, 'trackedProjects');
      const q = query(trackedProjectsRef, where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      
      const projects = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        projects.push({
          id: data.projectId || data.planning_id || doc.id,
          title: data.planning_title || data.planning_name || data.title || 'Unnamed Project',
          category: data.planning_sector || data.sector || 'General',
          status: data.planning_stage || data.status || 'Unknown'
        });
      });
      
      setTrackedProjects(projects);
      console.log('Loaded tracked projects:', projects);
    } catch (error) {
      console.error('Error fetching tracked projects:', error);
    }
  };
  
  // Fetch project update notifications
  const fetchProjectNotifications = async () => {
    try {
      if (!currentUser) return;
      
      // Use the ProjectUpdateService to get recent notifications
      const recentNotifications = await ProjectUpdateService.getRecentNotifications(currentUser.uid);
      setNotifications(recentNotifications);
      
      console.log('Loaded notifications:', recentNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };
  
  // Check for project updates and create notifications
  const checkForProjectUpdates = async () => {
    try {
      setRefreshing(true);
      
      if (!currentUser) {
        console.error('No user signed in');
        return;
      }
      
      // Use the ProjectUpdateService to check for updates
      const newNotificationsCount = await ProjectUpdateService.checkForProjectUpdates(currentUser.uid);
      
      // Refresh the notifications list
      await fetchProjectNotifications();
      
      if (newNotificationsCount > 0) {
        // Show a success message
        alert(`Found ${newNotificationsCount} new updates to your tracked projects!`);
      } else {
        // Show a message that no updates were found
        alert('No new updates found for your tracked projects.');
      }
    } catch (error) {
      console.error('Error checking for project updates:', error);
      alert('Error checking for project updates. Please try again later.');
    } finally {
      setRefreshing(false);
    }
  };

  // Check for updates within a specific date range
  const checkForUpdatesInDateRange = async (startDate, endDate) => {
    try {
      setRefreshing(true);
      
      if (!currentUser) {
        console.error('No user signed in');
        return;
      }
      
      if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
      }
      
      // Use the ProjectUpdateService to check for updates in the date range
      const newNotificationsCount = await ProjectUpdateService.getUpdatesForDateRange(
        currentUser.uid,
        startDate,
        endDate
      );
      
      // Refresh the notifications list
      await fetchProjectNotifications();
      
      if (newNotificationsCount > 0) {
        // Show a success message
        alert(`Found ${newNotificationsCount} new updates to your tracked projects between ${startDate} and ${endDate}!`);
      } else {
        // Show a message that no updates were found
        alert(`No updates found for your tracked projects between ${startDate} and ${endDate}.`);
      }
    } catch (error) {
      console.error('Error checking for updates in date range:', error);
      alert('Error checking for updates in date range. Please try again later.');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Handle preference toggle changes
  const handleToggleChange = (preferenceName, value) => {
    setPreferences(prev => {
      // If a value is provided, use it (for radio buttons)
      if (value !== undefined) {
        return { ...prev, [preferenceName]: value };
      }
      // Otherwise toggle the boolean value (for checkboxes)
      return { ...prev, [preferenceName]: !prev[preferenceName] };
    });
  };
  
  // Handle project selection changes
  const handleProjectSelection = (projectId) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };
  
  // Save notification preferences
  const savePreferences = async () => {
    try {
      if (!currentUser) return;
      
      setSaveSuccess(false);
      setSaveError(null);
      
      // Save to Firestore
      const prefsDocRef = doc(db, 'userPreferences', currentUser.uid);
      
      await setDoc(prefsDocRef, {
        notifications: preferences,
        selectedProjectIds: selectedProjects,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log('Saved notification preferences:', preferences);
      console.log('Saved selected projects:', selectedProjects);
      
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      setSaveError('Failed to save preferences. Please try again.');
    }
  };
  
  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    try {
      if (!notificationId) return;
      
      // Use the ProjectUpdateService to mark notification as read
      await ProjectUpdateService.markNotificationAsRead(notificationId);
      
      // Update the local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      if (!currentUser) return;
      
      // Use the ProjectUpdateService to mark all notifications as read
      await ProjectUpdateService.markAllNotificationsAsRead(currentUser.uid);
      
      // Update the local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };
  
  // Send test email function (simulated for demo purposes)
  const sendTestEmail = async () => {
    try {
      if (!currentUser) return;
      
      // This is a simulated function - in a real app, you would call an API
      console.log('Sending test email to:', preferences.emailAddress);
      
      // Show a success message
      alert(`Test email sent to ${preferences.emailAddress}. Please check your inbox.`);
    } catch (error) {
      console.error('Error sending test email:', error);
      alert('Error sending test email. Please try again later.');
    }
  };
  
  return (
    <div className="notifications-widget">
      <div className="notifications-header">
        <h3>
          <FaBell /> Notifications
          {offlineMode && <span className="offline-badge">Offline</span>}
        </h3>
        <div className="notifications-controls">
          <button 
            className="refresh-button" 
            onClick={() => {
              setRefreshing(true);
              fetchProjectNotifications().finally(() => setRefreshing(false));
            }}
            disabled={refreshing}
          >
            <FaSync className={refreshing ? 'spinning' : ''} />
          </button>
          <button 
            className="settings-button" 
            onClick={() => setShowSettings(!showSettings)}
          >
            <FaCog />
          </button>
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          <div className="error-content">
            <FaInfoCircle /> {error}
            {offlineMode && (
              <p className="offline-message">
                You're currently offline. Some features may be limited until you reconnect.
              </p>
            )}
          </div>
          <button 
            onClick={() => {
              setError(null);
              setLoading(true);
              const refreshData = async () => {
                try {
                  setOfflineMode(false);
                  await fetchTrackedProjects();
                  await fetchProjectNotifications();
                } catch (err) {
                  console.error('Error refreshing data:', err);
                  setError('Failed to refresh data. You may be offline.');
                  setOfflineMode(!navigator.onLine);
                } finally {
                  setLoading(false);
                }
              };
              refreshData();
            }}
            className="retry-button"
          >
            <FaSync /> Retry
          </button>
        </div>
      )}
      
      {showSettings ? (
        <div className="notifications-settings">
          <h4>Notification Preferences</h4>
          <p className="section-description">Configure how you want to be notified about project updates</p>
          
          <div className="notifications-section">
            <h4>Update Check Period</h4>
            <p className="section-description">Select how far back to check for project updates:</p>
            
            <div className="check-period-options">
              <div className="option">
                <label>
                  <input 
                    type="radio" 
                    name="checkPeriod" 
                    value="3" 
                    checked={preferences.checkPeriod === '3'} 
                    onChange={() => handleToggleChange('checkPeriod', '3')}
                  />
                  <span>Today only</span>
                </label>
              </div>
              <div className="option">
                <label>
                  <input 
                    type="radio" 
                    name="checkPeriod" 
                    value="3.1" 
                    checked={preferences.checkPeriod === '3.1'} 
                    onChange={() => handleToggleChange('checkPeriod', '3.1')}
                  />
                  <span>Yesterday</span>
                </label>
              </div>
              <div className="option">
                <label>
                  <input 
                    type="radio" 
                    name="checkPeriod" 
                    value="0.7" 
                    checked={preferences.checkPeriod === '0.7'} 
                    onChange={() => handleToggleChange('checkPeriod', '0.7')}
                  />
                  <span>Past 7 days</span>
                </label>
              </div>
              <div className="option">
                <label>
                  <input 
                    type="radio" 
                    name="checkPeriod" 
                    value="1" 
                    checked={preferences.checkPeriod === '1'} 
                    onChange={() => handleToggleChange('checkPeriod', '1')}
                  />
                  <span>Past 30 days</span>
                </label>
              </div>
              <div className="option">
                <label>
                  <input 
                    type="radio" 
                    name="checkPeriod" 
                    value="1.1" 
                    checked={preferences.checkPeriod === '1.1'} 
                    onChange={() => handleToggleChange('checkPeriod', '1.1')}
                  />
                  <span>Past 3 months</span>
                </label>
              </div>
              <div className="option">
                <label>
                  <input 
                    type="radio" 
                    name="checkPeriod" 
                    value="2" 
                    checked={preferences.checkPeriod === '2'} 
                    onChange={() => handleToggleChange('checkPeriod', '2')}
                  />
                  <span>Past 12 months</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="notifications-section">
            <h4>Custom Date Range</h4>
            <p className="section-description">Check for updates within a specific date range:</p>
            
            <div className="date-range-selector">
              <div className="date-input">
                <label>Start Date:</label>
                <input 
                  type="date" 
                  id="startDate" 
                  name="startDate"
                />
              </div>
              <div className="date-input">
                <label>End Date:</label>
                <input 
                  type="date" 
                  id="endDate" 
                  name="endDate"
                />
              </div>
              <button 
                className="check-range-button"
                onClick={() => {
                  const startDate = document.getElementById('startDate').value;
                  const endDate = document.getElementById('endDate').value;
                  checkForUpdatesInDateRange(startDate, endDate);
                }}
              >
                Check This Range
              </button>
            </div>
          </div>
          
          <div className="notifications-section">
            <h4>Notification Types</h4>
            <p className="section-description">Choose which notifications you want to receive:</p>
            
            <div className="notification-options">
              <div className="notification-option">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={preferences.projectUpdates}
                    onChange={() => handleToggleChange('projectUpdates')}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="option-details">
                  <span className="option-label">Project Updates</span>
                  <span className="option-description">Notify when tracked projects are updated</span>
                </div>
              </div>
              
              <div className="notification-option">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={preferences.statusChanges}
                    onChange={() => handleToggleChange('statusChanges')}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="option-details">
                  <span className="option-label">Status Changes</span>
                  <span className="option-description">Notify when project status changes</span>
                </div>
              </div>
              
              <div className="notification-option">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={preferences.valueChanges}
                    onChange={() => handleToggleChange('valueChanges')}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="option-details">
                  <span className="option-label">Value Changes</span>
                  <span className="option-description">Notify when project value changes</span>
                </div>
              </div>
              
              <div className="notification-option">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={preferences.newDocuments}
                    onChange={() => handleToggleChange('newDocuments')}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="option-details">
                  <span className="option-label">New Documents</span>
                  <span className="option-description">Notify when new project documents are added</span>
                </div>
              </div>
              
              <div className="notification-option">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={preferences.dailySummary}
                    onChange={() => handleToggleChange('dailySummary')}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="option-details">
                  <span className="option-label">Daily Summary</span>
                  <span className="option-description">Receive a daily summary of all updates</span>
                </div>
              </div>
              
              <div className="notification-option">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={preferences.weeklySummary}
                    onChange={() => handleToggleChange('weeklySummary')}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="option-details">
                  <span className="option-label">Weekly Summary</span>
                  <span className="option-description">Receive a weekly summary of all updates</span>
                </div>
              </div>
            </div>
            
            <h4>Email Notifications</h4>
            <div className="notification-options">
              <div className="notification-option">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={preferences.emailEnabled}
                    onChange={() => handleToggleChange('emailEnabled')}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="option-details">
                  <span className="option-label">Enable Email Notifications</span>
                  <span className="option-description">Send notifications to your email</span>
                </div>
              </div>
              
              {preferences.emailEnabled && (
                <>
                  <div className="notification-option">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={preferences.emailProjectTracking}
                        onChange={() => handleToggleChange('emailProjectTracking')}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <div className="option-details">
                      <span className="option-label">Project Tracking Confirmations</span>
                      <span className="option-description">Email when you start tracking a new project</span>
                    </div>
                  </div>
                  
                  <div className="notification-option">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={preferences.emailStatusChanges}
                        onChange={() => handleToggleChange('emailStatusChanges')}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <div className="option-details">
                      <span className="option-label">Status Change Emails</span>
                      <span className="option-description">Email when tracked project statuses change</span>
                    </div>
                  </div>
                  
                  <div className="notification-option">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={preferences.emailWeeklySummary}
                        onChange={() => handleToggleChange('emailWeeklySummary')}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <div className="option-details">
                      <span className="option-label">Weekly Summary Email</span>
                      <span className="option-description">Receive a weekly digest of all project activities</span>
                    </div>
                  </div>
                  
                  <div className="test-email-container">
                    <button className="test-email-button" onClick={sendTestEmail}>
                      Send Test Email
                    </button>
                    <span className="test-email-description">
                      Send a test email to verify your notification settings
                    </span>
                  </div>
                </>
              )}
            </div>
      
            {trackedProjects.length > 0 && (
              <div className="notifications-section">
                <h4>Project-Specific Notifications</h4>
                <p className="section-description">Select which projects you want to receive notifications for:</p>
                
                <div className="project-selection">
                  {trackedProjects.map(project => (
                    <div key={project.id} className="project-option">
                      <label className="checkbox-container">
                        <input 
                          type="checkbox"
                          checked={selectedProjects.includes(project.id)}
                          onChange={() => handleProjectSelection(project.id)}
                        />
                        <span className="checkmark"></span>
                        <div className="project-details">
                          <span className="project-title">{project.title}</span>
                          <span className="project-category">{project.category}</span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="notifications-actions">
              <button className="save-button" onClick={savePreferences}>
                <FaSave /> Save Preferences
              </button>
              
              {saveSuccess && (
                <span className="save-success">Preferences saved successfully!</span>
              )}
              
              {saveError && (
                <span className="save-error">{saveError}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="notifications-content">
          {loading ? (
            <div className="loading-spinner">Loading notifications...</div>
          ) : (
            notifications.length > 0 ? (
              <div>
                <div className="notifications-list">
                  {notifications.map(notification => (
                    <ProjectUpdateNotification 
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markNotificationAsRead}
                    />
                  ))}
                </div>
                <div className="notifications-footer">
                  <button className="clear-all-button" onClick={clearAllNotifications}>
                    Mark all as read
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-notifications">
                <FaBellSlash className="empty-icon" />
                <p>No notifications yet</p>
                <p className="empty-description">
                  When there are updates to your tracked projects, they will appear here.
                </p>
                <button className="check-updates-button" onClick={checkForProjectUpdates}>
                  <FaSync /> Check for Updates
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsWidget;
