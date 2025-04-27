import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  limit,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import axios from 'axios';

/**
 * Service for handling project update notifications
 */
class ProjectUpdateService {
  /**
   * Check for updates to tracked projects and create notifications
   * @param {string} userId - The user ID to check updates for
   * @returns {Promise<number>} - Number of new notifications created
   */
  static async checkForProjectUpdates(userId) {
    if (!userId) {
      console.error('Cannot check for updates: No user ID provided');
      return 0;
    }
    
    try {
      console.log(`Checking for project updates for user: ${userId}`);
      
      // Get all tracked projects for the user
      const trackedProjectsRef = collection(db, 'trackedProjects');
      const q = query(trackedProjectsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('No tracked projects found for this user');
        return 0;
      }
      
      // Create a map of tracked project IDs for quick lookup
      const trackedProjectsMap = new Map();
      snapshot.forEach(doc => {
        const data = doc.data();
        const projectId = data.projectId || data.planning_id || data.id;
        if (projectId) {
          trackedProjectsMap.set(projectId, {
            id: projectId,
            title: data.title || data.planning_title || 'Project',
            docId: doc.id
          });
        }
      });
      
      if (trackedProjectsMap.size === 0) {
        console.log('No valid project IDs found in tracked projects');
        return 0;
      }
      
      console.log(`Found ${trackedProjectsMap.size} tracked projects to check for updates`);
      
      // Get user preferences to determine how far back to check
      const userPrefsRef = doc(db, 'userPreferences', userId);
      const userPrefsDoc = await getDoc(userPrefsRef);
      let checkPeriod = '3'; // Default to today only
      
      if (userPrefsDoc.exists()) {
        const prefs = userPrefsDoc.data();
        if (prefs.notifications && prefs.notifications.checkPeriod) {
          checkPeriod = prefs.notifications.checkPeriod;
        }
      }
      
      // Get the last check timestamp for this user
      const lastCheckRef = doc(db, 'users', userId, 'metadata', 'lastNotificationCheck');
      const lastCheckDoc = await getDoc(lastCheckRef);
      
      const lastCheckTime = lastCheckDoc.exists() ? lastCheckDoc.data().timestamp : null;
      const currentTime = Timestamp.now();
      
      // If this is the first check, just update the timestamp and continue
      if (!lastCheckTime) {
        await setDoc(lastCheckRef, { timestamp: currentTime });
        // Still proceed with checking for updates
      }
      
      // Use the BuildingInfo API to get recently updated projects
      // Try to get API keys from environment variables
      let apiKey = process.env.REACT_APP_BUILDINGINFO_API_KEY;
      let uKey = process.env.REACT_APP_BUILDINGINFO_UKEY;
      
      // Fallback to hardcoded values if environment variables are not set
      if (!apiKey) apiKey = "2f5ae96c-b558-4c7b-a185-c0e7b1e726af";
      if (!uKey) uKey = "1682595945.1682595945.1682595945";
      
      if (!apiKey || !uKey) {
        console.error('API keys not found in environment variables or fallback values');
        return 0;
      }
      
      // Use the exact URL format provided, with proper encoding
      const allUpdatesUrl = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${apiKey}&ukey=${uKey}&more=limit%200,1000&_apion=${checkPeriod}`;
      
      // For major updates (status changes, etc.), use the _updated parameter
      const majorUpdatesUrl = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${apiKey}&ukey=${uKey}&more=limit%200,1000&_updated=${checkPeriod}`;
      
      console.log('Fetching updates with URL:', allUpdatesUrl);
      
      try {
        // Fetch both types of updates
        const [majorUpdatesResponse, allUpdatesResponse] = await Promise.all([
          axios.get(majorUpdatesUrl),
          axios.get(allUpdatesUrl)
        ]);
        
        const majorUpdates = majorUpdatesResponse.data?.data || [];
        const allUpdates = allUpdatesResponse.data?.data || [];
        
        console.log(`Received ${majorUpdates.length} major updates and ${allUpdates.length} total updates`);
        
        // Combine and deduplicate updates
        const allProjectIds = new Set();
        const combinedUpdates = [];
        
        // Process major updates first (they're more important)
        majorUpdates.forEach(project => {
          if (!allProjectIds.has(project.planning_id)) {
            allProjectIds.add(project.planning_id);
            combinedUpdates.push({
              ...project,
              updateType: 'major'
            });
          }
        });
        
        // Then process all other updates
        allUpdates.forEach(project => {
          if (!allProjectIds.has(project.planning_id)) {
            allProjectIds.add(project.planning_id);
            combinedUpdates.push({
              ...project,
              updateType: 'minor'
            });
          }
        });
        
        console.log(`Combined ${combinedUpdates.length} unique project updates`);
        
        // Check if any of the updated projects are being tracked by the user
        let notificationCount = 0;
        
        for (const project of combinedUpdates) {
          const projectId = project.planning_id || project.id;
          
          if (trackedProjectsMap.has(projectId)) {
            const trackedProject = trackedProjectsMap.get(projectId);
            console.log(`Found update for tracked project: ${trackedProject.title}`);
            
            // Create appropriate notification based on update type
            if (project.updateType === 'major') {
              // Check if status changed
              if (project.planning_stage) {
                await this.createStatusChangeNotification(
                  userId,
                  projectId,
                  trackedProject.title,
                  project.planning_stage
                );
                notificationCount++;
              }
              
              // Check if value changed
              if (project.planning_value) {
                await this.createValueChangeNotification(
                  userId,
                  projectId,
                  trackedProject.title,
                  project.planning_value
                );
                notificationCount++;
              }
            } else {
              // For minor updates, create a general update notification
              await this.createGeneralUpdateNotification(
                userId,
                projectId,
                trackedProject.title
              );
              notificationCount++;
            }
          }
        }
        
        // Update the last check timestamp
        await setDoc(lastCheckRef, { timestamp: currentTime });
        
        console.log(`Created ${notificationCount} notifications for tracked projects`);
        return notificationCount;
      } catch (error) {
        console.error('Error fetching updates from BuildingInfo API:', error);
        return 0;
      }
    } catch (error) {
      console.error('Error checking for project updates:', error);
      return 0;
    }
  }
  
  /**
   * Get updates for a specific date range
   * @param {string} userId - The user ID to check updates for
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<number>} - Number of new notifications created
   */
  static async getUpdatesForDateRange(userId, startDate, endDate) {
    if (!userId || !startDate || !endDate) {
      console.error('Missing required parameters for date range update check');
      return 0;
    }
    
    try {
      console.log(`Checking for updates between ${startDate} and ${endDate} for user: ${userId}`);
      
      const apiKey = process.env.REACT_APP_BUILDINGINFO_API_KEY;
      const uKey = process.env.REACT_APP_BUILDINGINFO_UKEY;
      
      if (!apiKey || !uKey) {
        console.error('API keys not found in environment variables');
        return 0;
      }
      
      // Use the date range filtering capability
      const dateRangeUrl = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${apiKey}&ukey=${uKey}&more=limit%200,1000&_apion=8&min_apion=${startDate}&max_apion=${endDate}`;
      
      const response = await axios.get(dateRangeUrl);
      const updatedProjects = response.data?.data || [];
      
      console.log(`Found ${updatedProjects.length} projects updated in the date range`);
      
      // Get all tracked projects for the user
      const trackedProjectsRef = collection(db, 'trackedProjects');
      const q = query(trackedProjectsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('No tracked projects found for this user');
        return 0;
      }
      
      // Filter to only include projects the user is tracking
      const trackedProjectIds = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        trackedProjectIds.add(data.projectId || data.planning_id);
      });
      
      const relevantUpdates = updatedProjects.filter(project => 
        trackedProjectIds.has(project.planning_id)
      );
      
      console.log(`${relevantUpdates.length} of these updates are for tracked projects`);
      
      // Create notifications for relevant updates
      let newNotificationsCount = 0;
      
      for (const project of relevantUpdates) {
        const projectId = project.planning_id;
        const projectTitle = project.planning_title || project.planning_name || 'Unnamed Project';
        
        // Determine update type based on fields
        if (project._updated) {
          // Major update (status change)
          await this.createStatusChangeNotification(
            userId, 
            projectId, 
            projectTitle, 
            project.planning_stage || project.status || 'Unknown'
          );
          newNotificationsCount++;
        } else if (project._value_updated) {
          // Value change
          await this.createValueChangeNotification(
            userId, 
            projectId, 
            projectTitle, 
            project.planning_value || project.projectValue || project.value || 0
          );
          newNotificationsCount++;
        } else if (project._documents_updated) {
          // Document update
          await this.createDocumentUpdateNotification(
            userId, 
            projectId, 
            projectTitle
          );
          newNotificationsCount++;
        } else {
          // General update
          await this.createGeneralUpdateNotification(
            userId, 
            projectId, 
            projectTitle
          );
          newNotificationsCount++;
        }
      }
      
      console.log(`Created ${newNotificationsCount} new notifications`);
      return newNotificationsCount;
    } catch (error) {
      console.error('Error checking for updates in date range:', error);
      return 0;
    }
  }
  
  /**
   * Test function to directly use a specific API URL and create notifications
   * @param {string} userId - The user ID to create notifications for
   * @param {string} apiUrl - The complete API URL to use for testing
   * @returns {Promise<number>} - Number of new notifications created
   */
  static async testWithDirectUrl(userId, apiUrl) {
    if (!userId) {
      console.error('Cannot test: No user ID provided');
      return 0;
    }
    
    if (!apiUrl) {
      console.error('Cannot test: No API URL provided');
      return 0;
    }
    
    try {
      console.log(`Testing notification system with direct URL for user: ${userId}`);
      console.log(`Using URL: ${apiUrl}`);
      
      // Fix URL encoding if needed (replace &amp; with &)
      const fixedUrl = apiUrl.replace(/&amp;/g, '&');
      
      // Fetch data from the API
      const response = await axios.get(fixedUrl);
      const updatedProjects = response.data?.data || [];
      
      console.log(`Found ${updatedProjects.length} updated projects from API`);
      
      // Get all tracked projects for the user
      const trackedProjectsRef = collection(db, 'trackedProjects');
      const q = query(trackedProjectsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('No tracked projects found for this user');
        return 0;
      }
      
      // Filter to only include projects the user is tracking
      const trackedProjectIds = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        trackedProjectIds.add(data.projectId || data.planning_id);
      });
      
      const relevantUpdates = updatedProjects.filter(project => 
        trackedProjectIds.has(project.planning_id)
      );
      
      console.log(`${relevantUpdates.length} of these updates are for tracked projects`);
      
      // Create notifications for relevant updates
      let newNotificationsCount = 0;
      
      for (const project of relevantUpdates) {
        const projectId = project.planning_id;
        const projectTitle = project.planning_title || project.planning_name || 'Unnamed Project';
        
        // Determine update type based on fields
        if (project._updated) {
          // Major update (status change)
          await this.createStatusChangeNotification(
            userId, 
            projectId, 
            projectTitle, 
            project.planning_stage || project.status || 'Unknown'
          );
          newNotificationsCount++;
        } else if (project._value_updated) {
          // Value change
          await this.createValueChangeNotification(
            userId, 
            projectId, 
            projectTitle, 
            project.planning_value || project.projectValue || project.value || 0
          );
          newNotificationsCount++;
        } else if (project._documents_updated) {
          // Document update
          await this.createDocumentUpdateNotification(
            userId, 
            projectId, 
            projectTitle
          );
          newNotificationsCount++;
        } else {
          // General update
          await this.createGeneralUpdateNotification(
            userId, 
            projectId, 
            projectTitle
          );
          newNotificationsCount++;
        }
      }
      
      console.log(`Created ${newNotificationsCount} new notifications`);
      return newNotificationsCount;
    } catch (error) {
      console.error('Error testing with direct URL:', error);
      return 0;
    }
  }
  
  /**
   * Create a notification for a status change
   */
  static async createStatusChangeNotification(userId, projectId, projectTitle, newStatus) {
    try {
      await addDoc(collection(db, 'projectNotifications'), {
        userId,
        projectId,
        title: `Status Change: ${projectTitle}`,
        message: `The status of "${projectTitle}" has changed to "${newStatus}".`,
        type: 'status_change',
        read: false,
        timestamp: serverTimestamp()
      });
      
      console.log(`Created status change notification for project: ${projectId}`);
      return true;
    } catch (error) {
      console.error('Error creating status change notification:', error);
      return false;
    }
  }
  
  /**
   * Create a notification for a value change
   */
  static async createValueChangeNotification(userId, projectId, projectTitle, newValue) {
    try {
      // Format the value as currency
      const formattedValue = new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR'
      }).format(newValue);
      
      await addDoc(collection(db, 'projectNotifications'), {
        userId,
        projectId,
        title: `Value Update: ${projectTitle}`,
        message: `The value of "${projectTitle}" has been updated to ${formattedValue}.`,
        type: 'value_change',
        read: false,
        timestamp: serverTimestamp()
      });
      
      console.log(`Created value change notification for project: ${projectId}`);
      return true;
    } catch (error) {
      console.error('Error creating value change notification:', error);
      return false;
    }
  }
  
  /**
   * Create a notification for a document update
   */
  static async createDocumentUpdateNotification(userId, projectId, projectTitle) {
    try {
      await addDoc(collection(db, 'projectNotifications'), {
        userId,
        projectId,
        title: `New Documents: ${projectTitle}`,
        message: `New documents have been added to "${projectTitle}".`,
        type: 'document_update',
        read: false,
        timestamp: serverTimestamp()
      });
      
      console.log(`Created document update notification for project: ${projectId}`);
      return true;
    } catch (error) {
      console.error('Error creating document update notification:', error);
      return false;
    }
  }
  
  /**
   * Create a notification for a general update
   */
  static async createGeneralUpdateNotification(userId, projectId, projectTitle) {
    try {
      await addDoc(collection(db, 'projectNotifications'), {
        userId,
        projectId,
        title: `Project Update: ${projectTitle}`,
        message: `The project "${projectTitle}" has been updated.`,
        type: 'project_update',
        read: false,
        timestamp: serverTimestamp()
      });
      
      console.log(`Created general update notification for project: ${projectId}`);
      return true;
    } catch (error) {
      console.error('Error creating general update notification:', error);
      return false;
    }
  }
  
  /**
   * Get unread notifications count for a user
   */
  static async getUnreadNotificationsCount(userId) {
    if (!userId) return 0;
    
    try {
      const notificationsRef = collection(db, 'projectNotifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting unread notifications count:', error);
      return 0;
    }
  }
  
  /**
   * Get recent notifications for a user
   */
  static async getRecentNotifications(userId, maxResults = 10) {
    if (!userId) return [];
    
    try {
      const notificationsRef = collection(db, 'projectNotifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(maxResults)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return [];
      }
      
      const notifications = [];
      snapshot.forEach(doc => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return notifications;
    } catch (error) {
      console.error('Error getting recent notifications:', error);
      return [];
    }
  }
  
  /**
   * Mark a notification as read
   */
  static async markNotificationAsRead(notificationId) {
    if (!notificationId) return false;
    
    try {
      const notificationRef = doc(db, 'projectNotifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }
  
  /**
   * Mark all notifications as read for a user
   */
  static async markAllNotificationsAsRead(userId) {
    if (!userId) return false;
    
    try {
      const notificationsRef = collection(db, 'projectNotifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return true;
      }
      
      const batch = [];
      snapshot.forEach(doc => {
        const notificationRef = doc.ref;
        batch.push(updateDoc(notificationRef, {
          read: true,
          readAt: serverTimestamp()
        }));
      });
      
      await Promise.all(batch);
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }
}

export default ProjectUpdateService;
