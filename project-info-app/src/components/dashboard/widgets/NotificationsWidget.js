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
  addDoc
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../contexts/AuthContext';
import { FaBell, FaBellSlash, FaCalendarAlt, FaChartLine, FaFileAlt, FaSave, FaInfoCircle } from 'react-icons/fa';
import './NotificationsWidget.css';

const NotificationsWidget = ({ data }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    emailAddress: currentUser?.email || ''
  });
  const [trackedProjects, setTrackedProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Fetch notification preferences when component mounts
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!currentUser) {
          console.log('No user signed in');
          setLoading(false);
          return;
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
          await setDoc(prefsDocRef, {
            notifications: preferences,
            selectedProjectIds: [],
            updatedAt: serverTimestamp()
          });
          console.log('Created default notification preferences');
        }
        
        // Fetch tracked projects to enable per-project notifications
        await fetchTrackedProjects();
      } catch (error) {
        console.error('Error fetching notification preferences:', error);
        setError('Failed to load notification preferences');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreferences();
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
          category: data.planning_category || data.category || 'Other',
          isSelected: selectedProjects.includes(data.projectId || data.planning_id || doc.id)
        });
      });
      
      setTrackedProjects(projects);
      console.log(`Fetched ${projects.length} tracked projects for notifications`);
    } catch (error) {
      console.error('Error fetching tracked projects:', error);
    }
  };
  
  // Handle preference toggle changes
  const handleToggleChange = (preferenceName) => {
    setPreferences(prev => ({
      ...prev,
      [preferenceName]: !prev[preferenceName]
    }));
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
      setSaveSuccess(false);
      setSaveError(null);
      
      if (!currentUser) {
        setSaveError('You must be logged in to save preferences');
        return;
      }
      
      // Save to Firestore
      const prefsDocRef = doc(db, 'userPreferences', currentUser.uid);
      await setDoc(prefsDocRef, {
        notifications: preferences,
        selectedProjectIds: selectedProjects,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log('Saved notification preferences');
      setSaveSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      setSaveError('Failed to save preferences');
    }
  };
  
  // Send test email function (simulated for demo purposes)
  const sendTestEmail = async () => {
    try {
      setSaveSuccess(false);
      setSaveError(null);
      
      if (!preferences.emailEnabled) {
        setSaveError('Please enable email notifications first.');
        return;
      }
      
      if (!preferences.emailAddress) {
        setSaveError('Please enter an email address.');
        return;
      }
      
      // Validate email format using a simple regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(preferences.emailAddress)) {
        setSaveError('Please enter a valid email address.');
        return;
      }
      
      // Save the email address to preferences first
      await savePreferences();
      
      // Show loading state
      const sendButton = document.querySelector('.test-email-button');
      if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';
      }
      
      // Simulate email sending (just for UI purposes)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Log the email activity for demo purposes
      await addDoc(collection(db, 'userActivity'), {
        userId: currentUser.uid,
        type: 'email_test_sent',
        timestamp: serverTimestamp(),
        details: {
          email: preferences.emailAddress,
          note: 'Demo mode - no actual email sent'
        }
      });
      
      // Display success message
      setSaveSuccess('Email would be sent in production. UI demonstration only.');
      
      // Reset button state
      if (sendButton) {
        sendButton.disabled = false;
        sendButton.textContent = 'Send Test Email';
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Error in email demo:', error);
      setSaveError(`Demo error: ${error.message}`);
      
      // Reset button state
      const sendButton = document.querySelector('.test-email-button');
      if (sendButton) {
        sendButton.disabled = false;
        sendButton.textContent = 'Send Test Email';
      }
    }
  };
  
  if (loading) {
    return (
      <div className="notifications-widget loading">
        <div className="loading-spinner"></div>
        <p>Loading notification preferences...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="notifications-widget error">
        <p className="error-message">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="notifications-widget">
      <div className="notifications-header">
        <h3><FaBell /> Notification Preferences</h3>
        <p className="notifications-description">Configure how you want to be notified about project updates</p>
      </div>
      
      <div className="notifications-section">
        <h4>General Notifications</h4>
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
              <span className="option-description">Receive notifications when tracked projects are updated</span>
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
              <span className="option-description">Get notified when project statuses change</span>
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
              <span className="option-description">Alerts when new documents are added to tracked projects</span>
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
              <span className="option-description">Be notified when project values are updated</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="notifications-section">
        <h4>Summary Reports</h4>
        <div className="notification-options">
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
              <span className="option-description">Receive a daily summary of all project updates</span>
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
              <span className="option-description">Get a weekly digest of all project activities</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="notifications-section">
        <h4>Email Notifications</h4>
        <div className="notification-options">
          <div className="email-feature-banner">
            <FaInfoCircle />
            <span>Email notifications are coming soon! Set your preferences now to be ready when the feature launches.</span>
          </div>
          
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
              <span className="option-description">Receive selected notifications via email</span>
            </div>
          </div>
          
          {preferences.emailEnabled && (
            <>
              <div className="email-input-container">
                <label>Email Address:</label>
                <input 
                  type="email" 
                  value={preferences.emailAddress} 
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    emailAddress: e.target.value
                  }))}
                  placeholder="Your email address"
                  className="email-input"
                />
              </div>
              
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
      
      <div className="notifications-footer">
        <p>
          You'll receive notifications based on these preferences. 
          This feature currently supports in-app notifications only.
        </p>
      </div>
    </div>
  );
};

export default NotificationsWidget;
