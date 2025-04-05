import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../contexts/AuthContext';
import './RecentActivityWidget.css';

const RecentActivityWidget = ({ data }) => {
  const { userId, limit: activityLimit = 5 } = data || {};
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use the current user ID if no specific userId is provided
        const userIdToUse = userId || (currentUser ? currentUser.uid : null);
        
        if (!userIdToUse) {
          console.log('No user ID available for activity fetch');
          setActivities([]);
          setLoading(false);
          return;
        }
        
        console.log(`Fetching activities for user: ${userIdToUse}, limit: ${activityLimit}`);
        
        // Query the activity collection for this user
        const activityRef = collection(db, 'activity');
        const activityQuery = query(
          activityRef,
          where('userId', '==', userIdToUse),
          orderBy('timestamp', 'desc'),
          limit(activityLimit || 5)
        );
        
        const querySnapshot = await getDocs(activityQuery);
        
        if (querySnapshot.empty) {
          console.log('No activities found for user');
          setActivities([]);
          setLoading(false);
          return;
        }
        
        // Get project details for all activities to ensure we have accurate names
        const activityList = [];
        const projectDetailsMap = new Map(); // Map to store project details to avoid duplicate lookups
        
        // First pass - collect all activities and their project IDs
        const activitiesData = [];
        querySnapshot.forEach((doc) => {
          const activityData = doc.data();
          activitiesData.push({
            id: doc.id,
            ...activityData
          });
          
          // Add project ID to the list of projects to fetch
          if (activityData.projectId && !projectDetailsMap.has(activityData.projectId)) {
            projectDetailsMap.set(activityData.projectId, null);
          }
        });
        
        // Try to fetch project details for all project IDs found in activities
        // This helps us ensure we display correct names
        if (projectDetailsMap.size > 0) {
          try {
            const projectIds = Array.from(projectDetailsMap.keys());
            console.log(`Fetching details for ${projectIds.length} projects`);
            
            // For each project ID, try to get its data from the trackedProjects collection
            for (const projectId of projectIds) {
              // Look for projects with this ID in trackedProjects collection
              const trackedProjectsRef = collection(db, 'trackedProjects');
              const projectQuery = query(
                trackedProjectsRef,
                where('projectId', '==', projectId)
              );
              
              const projectSnapshot = await getDocs(projectQuery);
              if (!projectSnapshot.empty) {
                // Use the first found project data
                const projectData = projectSnapshot.docs[0].data();
                projectDetailsMap.set(projectId, projectData);
              } else {
                // Try another query using planning_id
                const planningIdQuery = query(
                  trackedProjectsRef,
                  where('planning_id', '==', projectId)
                );
                
                const planningIdSnapshot = await getDocs(planningIdQuery);
                if (!planningIdSnapshot.empty) {
                  const projectData = planningIdSnapshot.docs[0].data();
                  projectDetailsMap.set(projectId, projectData);
                }
              }
            }
          } catch (projectError) {
            console.error('Error fetching project details:', projectError);
            // Continue with available data
          }
        }
        
        // Second pass - format activities with enhanced project details when available
        for (const activity of activitiesData) {
          // Format the timestamp
          const timestamp = activity.timestamp ? 
            new Date(activity.timestamp.toDate()) : 
            new Date();
          
          // Get project details if available
          let projectTitle = activity.projectTitle || 'Unknown Project';
          let projectType = 'Unknown';
          let projectLocation = null;
          
          const projectDetails = projectDetailsMap.get(activity.projectId);
          if (projectDetails) {
            // Extract the best available title from project details
            projectTitle = 
              projectDetails.planning_title || 
              projectDetails.planning_name || 
              projectDetails.title || 
              projectDetails.name || 
              activity.projectTitle || 
              'Project #' + activity.projectId.substring(0, 6);
            
            // Extract additional useful information
            projectType = 
              projectDetails.planning_category || 
              projectDetails.category || 
              projectDetails.type || 
              'Unknown';
              
            projectLocation = 
              projectDetails.planning_location || 
              projectDetails.location || 
              projectDetails.planning_county || 
              null;
          }
          
          // Create an enhanced activity object
          activityList.push({
            id: activity.id,
            type: activity.type,
            projectId: activity.projectId,
            projectTitle: projectTitle,
            projectType: projectType,
            projectLocation: projectLocation,
            timestamp: timestamp,
            formattedTime: formatTimestamp(timestamp),
            noteText: activity.noteText // For note activities
          });
        }
        
        console.log(`Found ${activityList.length} activities with enhanced details`);
        setActivities(activityList);
      } catch (error) {
        console.error('Error fetching activities:', error);
        setError('Failed to load recent activities');
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivities();
  }, [currentUser, userId, activityLimit]);
  
  // Format timestamp to relative time (e.g., "2 hours ago")
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    const now = new Date();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    
    return timestamp.toLocaleDateString();
  };
  
  // Get icon for activity type
  const getActivityIcon = (type) => {
    switch (type) {
      case 'view':
        return '👁️';
      case 'track':
        return '🔔';
      case 'untrack':
        return '🔕';
      case 'note':
        return '📝';
      default:
        return '📋';
    }
  };
  
  // Get description for activity type
  const getActivityDescription = (activity) => {
    switch (activity.type) {
      case 'view':
        return `Viewed project: ${activity.projectTitle}`;
      case 'track':
        return `Started tracking: ${activity.projectTitle}`;
      case 'untrack':
        return `Stopped tracking: ${activity.projectTitle}`;
      case 'note':
        return `Added note to: ${activity.projectTitle}`;
      default:
        return `Interacted with: ${activity.projectTitle}`;
    }
  };
  
  if (loading) {
    return (
      <div className="activity-widget loading">
        <div className="loading-spinner"></div>
        <p>Loading recent activities...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="activity-widget error">
        <p className="error-message">{error}</p>
      </div>
    );
  }
  
  if (activities.length === 0) {
    return (
      <div className="activity-widget empty">
        <p className="empty-message">No recent activities found</p>
        <p className="empty-suggestion">Try viewing or tracking some projects to see activity here</p>
      </div>
    );
  }
  
  return (
    <div className="activity-widget">
      <ul className="activity-list">
        {activities.map((activity) => (
          <li key={activity.id} className={`activity-item ${activity.type}`}>
            <div className="activity-icon">{getActivityIcon(activity.type)}</div>
            <div className="activity-content">
              <p className="activity-description">{getActivityDescription(activity)}</p>
              <span className="activity-time">{activity.formattedTime}</span>
              {activity.projectType && (
                <span className="activity-project-type">
                  ({activity.projectType})
                </span>
              )}
              {activity.projectLocation && (
                <span className="activity-project-location">
                  {activity.projectLocation}
                </span>
              )}
              {activity.noteText && (
                <p className="activity-note-text">{activity.noteText}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentActivityWidget;
