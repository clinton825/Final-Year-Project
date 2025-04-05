import React, { useState, useEffect } from 'react';
import { 
  FaPlus, FaMinus, FaEdit, FaEye, 
  FaRegFileAlt, FaHistory
} from 'react-icons/fa';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../contexts/AuthContext';
import './WidgetStyles.css';

const RecentActivityWidget = ({ data }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  
  // Fetch real activity data from Firestore
  useEffect(() => {
    const fetchActivities = async () => {
      if (!currentUser) {
        setLoading(false);
        setActivities([]);
        return;
      }
      
      // Check if we're in development mode
      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
      
      try {
        setLoading(true);
        
        // In development mode, we can use sample data for testing
        if (isDevelopment) {
          console.log('Running in development mode, using sample activities');
          // Create development sample data with timestamps that work properly
          const sampleActivities = [
            {
              id: 'dev-1',
              type: 'track',
              projectTitle: 'Housing Development Project',
              timestamp: new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)),
              userId: currentUser.uid
            },
            {
              id: 'dev-2',
              type: 'view',
              projectTitle: 'Town Center Renovation',
              timestamp: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)),
              userId: currentUser.uid
            },
            {
              id: 'dev-3',
              type: 'note_add',
              projectTitle: 'Highway Extension Phase 2',
              timestamp: new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)),
              userId: currentUser.uid
            }
          ];
          
          setActivities(sampleActivities);
          setLoading(false);
          return;
        }
        
        // In production, use real Firestore data
        const activitiesRef = collection(db, 'activity');
        const activitiesQuery = query(
          activitiesRef,
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'desc'),
          limit(10) // Limit to 10 most recent activities
        );
        
        const querySnapshot = await getDocs(activitiesQuery);
        const activitiesData = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          activitiesData.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate?.() || new Date(),
          });
        });
        
        console.log(`Fetched ${activitiesData.length} activities for dashboard`);
        setActivities(activitiesData);
        setError(null);
      } catch (error) {
        console.error('Error fetching activities:', error);
        setError('Failed to load recent activities');
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivities();
  }, [currentUser]);

  // Format date
  const formatDate = (date) => {
    if (!date) return '';
    
    // If today, show time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Add extra validation for date
    if (!date || isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    if (date >= today) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If yesterday, show "Yesterday"
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= yesterday && date < today) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise, show full date
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get icon for activity type
  const getActivityIcon = (type) => {
    if (!type) return <FaHistory />;
    
    // Normalize the type to lowercase for better matching
    const normalizedType = type.toLowerCase();
    
    // Check for tracking activities
    if (normalizedType.includes('track') || normalizedType.includes('add')) {
      return <FaPlus />;
    }
    
    // Check for untracking activities
    if (normalizedType.includes('untrack') || normalizedType.includes('remov') || normalizedType.includes('delet')) {
      return <FaMinus />;
    }
    
    // Check for editing activities
    if (normalizedType.includes('edit') || normalizedType.includes('updat') || normalizedType.includes('chang') || 
        normalizedType.includes('modif')) {
      return <FaEdit />;
    }
    
    // Check for viewing activities
    if (normalizedType.includes('view') || normalizedType.includes('read') || normalizedType.includes('open') ||
        normalizedType.includes('access')) {
      return <FaEye />;
    }
    
    // Default icon
    return <FaHistory />;
  };

  // Get activity title
  const getActivityTitle = (activity) => {
    switch (activity.type) {
      case 'track':
        return 'Tracked a project';
      case 'untrack':
        return 'Untracked a project';
      case 'note_add':
        return 'Added a note';
      case 'note_edit':
        return 'Updated a note';
      case 'note_delete':
        return 'Deleted a note';
      case 'view':
        return 'Viewed project details';
      default:
        return activity.description || 'Activity logged';
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading activity...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <FaHistory size={24} />
        <p>{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="empty-state">
        <FaHistory size={24} />
        <p>No recent activities found</p>
        <small>Your activities will appear here as you interact with projects</small>
      </div>
    );
  }

  return (
    <div className="recent-activity-widget">
      <div className="activity-list">
        {activities.map(activity => (
          <div key={activity.id} className="activity-item">
            <div className="activity-icon">
              {getActivityIcon(activity.type)}
            </div>
            <div className="activity-content">
              <div className="activity-title">
                {getActivityTitle(activity)}
              </div>
              <div className="activity-project">
                {activity.projectTitle || activity.projectName || 'Unknown project'}
              </div>
              <div className="activity-meta">
                {formatDate(activity.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivityWidget;
