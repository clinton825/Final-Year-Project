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
        
        const activityList = [];
        querySnapshot.forEach((doc) => {
          const activityData = doc.data();
          
          // Format the timestamp
          const timestamp = activityData.timestamp ? 
            new Date(activityData.timestamp.toDate()) : 
            new Date();
          
          // Create a formatted activity object
          activityList.push({
            id: doc.id,
            type: activityData.type,
            projectId: activityData.projectId,
            projectTitle: activityData.projectTitle || 'Unknown Project',
            timestamp,
            formattedTime: formatTimestamp(timestamp)
          });
        });
        
        console.log(`Found ${activityList.length} activities`);
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentActivityWidget;
