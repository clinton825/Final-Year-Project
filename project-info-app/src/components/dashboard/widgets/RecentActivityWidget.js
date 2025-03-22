import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  FaPlus, FaMinus, FaEdit, FaEye, FaUnlink, 
  FaRegFileAlt, FaHistory
} from 'react-icons/fa';
import './WidgetStyles.css';

const RecentActivityWidget = ({ data }) => {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create fallback activities from tracked projects when no real activities exist
  useEffect(() => {
    if (!loading && activities.length === 0 && data?.trackedProjects?.length > 0) {
      console.log('Creating fallback activities from tracked projects:', data.trackedProjects.length);
      
      const fallbackActivities = data.trackedProjects.map((project, index) => {
        const projectId = project.projectId || project.planning_id || project.id || project._id || project.docId;
        const projectTitle = project.title || project.planning_title || project.name || `Project #${projectId?.substring(0, 6)}`;
        
        return {
          id: `fallback-${index}`,
          type: 'track',
          projectId: projectId,
          projectName: projectTitle,
          timestamp: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)), // Staggered dates going back
          description: `Tracked ${projectTitle}`
        };
      });
      
      setActivities(fallbackActivities.slice(0, 5)); // Show at most 5 fallback activities
    }
  }, [loading, activities.length, data?.trackedProjects]);
  
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    console.log('Loading activities for user:', currentUser.uid);
    setLoading(true);
    
    // Create queries for recent activities
    // Try both userId and user_id fields to ensure compatibility
    const activitiesQuery1 = query(
      collection(db, 'activity'),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    
    const activitiesQuery2 = query(
      collection(db, 'activity'),
      where('user_id', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    // Try to fetch activities from the first query
    getDocs(activitiesQuery1).then(snapshot => {
      if (!snapshot.empty) {
        const activitiesList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          activitiesList.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date()
          });
        });
        
        console.log('Found activities using userId:', activitiesList.length);
        setActivities(activitiesList);
        setLoading(false);
        
        // Set up real-time listener for this query
        return onSnapshot(activitiesQuery1, (snapshot) => {
          const updatedList = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            updatedList.push({
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date()
            });
          });
          
          setActivities(updatedList);
        });
      } else {
        // Try the second query if first one is empty
        console.log('No activities found with userId, trying user_id');
        return getDocs(activitiesQuery2).then(snapshot => {
          const activitiesList = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            activitiesList.push({
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date()
            });
          });
          
          console.log('Found activities using user_id:', activitiesList.length);
          setActivities(activitiesList);
          setLoading(false);
          
          // Set up real-time listener for this query
          return onSnapshot(activitiesQuery2, (snapshot) => {
            const updatedList = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              updatedList.push({
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate() || new Date()
              });
            });
            
            setActivities(updatedList);
          });
        });
      }
    }).catch(error => {
      console.error('Error fetching activities:', error);
      setLoading(false);
    });

    return () => {}; // Return empty function as real unsubscribe is returned in promises
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

  // Get icon for activity type with more comprehensive type matching
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

  if (activities.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <FaRegFileAlt />
        </div>
        <h3 className="empty-title">No Recent Activity</h3>
        <p className="empty-message">
          Your recent activities will appear here. Track projects, add notes, or explore projects to create activity.
        </p>
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
