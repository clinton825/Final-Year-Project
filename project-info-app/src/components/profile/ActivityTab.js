import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import { collection, doc, getDoc, getDocs, query, orderBy, limit, where, addDoc } from 'firebase/firestore';
import './ActivityTab.css';

const ActivityTab = () => {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch real activity data from Firestore
  useEffect(() => {
    const fetchActivities = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      try {
        // First try to get from the user-specific activities collection
        const activitiesRef = collection(db, 'userActivity');
        const activitiesQuery = query(
          activitiesRef,
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        
        const querySnapshot = await getDocs(activitiesQuery);
        const activityData = [];
        
        if (!querySnapshot.empty) {
          querySnapshot.forEach(doc => {
            activityData.push({
              id: doc.id,
              ...doc.data()
            });
          });
          setActivities(activityData);
        } else {
          // If no activities found, create initial login activity
          await addDoc(collection(db, 'userActivity'), {
            userId: currentUser.uid,
            type: 'login',
            description: 'Logged in successfully',
            timestamp: new Date(),
            ipAddress: '192.168.1.1', // This would normally be captured from the request
            device: navigator.userAgent
          });
          
          // Then use mock data for demo purposes
          const mockActivities = [
            { 
              id: 1, 
              type: 'login', 
              description: 'Logged in successfully', 
              timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), 
              ipAddress: '192.168.1.1',
              device: navigator.userAgent || 'Unknown device'
            }
          ];
          
          setActivities(mockActivities);
        }
      } catch (err) {
        console.error('Error fetching activities:', err);
        setError('Error fetching activity data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivities();
  }, [currentUser]);
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    let date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
  };
  
  const getActivityIcon = (type) => {
    switch (type) {
      case 'login':
        return <i className="fas fa-sign-in-alt"></i>;
      case 'logout':
        return <i className="fas fa-sign-out-alt"></i>;
      case 'project_view':
        return <i className="fas fa-eye"></i>;
      case 'project_compare':
        return <i className="fas fa-chart-bar"></i>;
      case 'profile_update':
        return <i className="fas fa-user-edit"></i>;
      default:
        return <i className="fas fa-history"></i>;
    }
  };
  
  return (
    <div className="activity-tab">
      <h2>Account Activity</h2>
      <p className="section-description">Review your recent account activity and security events</p>
      
      {loading ? (
        <div className="loading-indicator">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading activity data...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error}</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-history"></i>
          <p>No activity recorded yet</p>
        </div>
      ) : (
        <div className="activity-timeline">
          {activities.map(activity => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon">
                {getActivityIcon(activity.type)}
              </div>
              <div className="activity-details">
                <h4 className="activity-title">{activity.description}</h4>
                <div className="activity-meta">
                  <span className="activity-time">
                    <i className="far fa-clock"></i> {formatTimestamp(activity.timestamp)}
                  </span>
                  {activity.device && (
                    <span className="activity-device">
                      <i className="fas fa-laptop"></i> {activity.device}
                    </span>
                  )}
                  {activity.ipAddress && (
                    <span className="activity-ip">
                      <i className="fas fa-network-wired"></i> {activity.ipAddress}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="activity-stats">
        <h3>Usage Statistics</h3>
        <p>Coming soon: Track your app usage patterns and interactions</p>
      </div>
    </div>
  );
};

export default ActivityTab;
