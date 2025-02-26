import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [trackedProjects, setTrackedProjects] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [userData, setUserData] = useState(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('App is online');
      setIsOffline(false);
      // Refetch data when back online
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
      try {
        if (!currentUser) {
          setLoading(false);
          return;
        }

        console.log('Dashboard: Current user:', currentUser.uid);
        
        // Fetch user data
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            setUserData(userSnap.data());
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
        
        await fetchTrackedProjects();
        await fetchRecentActivity();
        
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) {
        setTrackedProjects([]);
        return;
      }
      
      console.log('Fetching tracked projects for user:', currentUser.uid);
      
      // Create a query to get projects tracked by current user
      const q = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid),
        orderBy('trackedAt', 'desc')
      );
      
      try {
        // Use onSnapshot for real-time updates that works offline too
        const unsubscribe = onSnapshot(q, (snapshot) => {
          console.log('Tracked projects snapshot size:', snapshot.size);
          
          const projects = [];
          snapshot.forEach(doc => {
            const projectData = doc.data();
            console.log('Tracked project data:', projectData);
            projects.push(projectData);
          });
          
          setTrackedProjects(projects);
          console.log('Tracked projects set:', projects.length, 'projects');
          setLoading(false);
        }, (error) => {
          console.error('Error in tracked projects snapshot:', error);
          // Try fallback method if snapshot fails
          getDocs(q).then((snapshot) => {
            const projects = [];
            snapshot.forEach(doc => {
              projects.push(doc.data());
            });
            setTrackedProjects(projects);
            setLoading(false);
          }).catch(err => {
            console.error('Fallback fetch also failed:', err);
            setError('Failed to load your tracked projects. Please try again later.');
            setLoading(false);
          });
        });
        
        return () => unsubscribe();
      } catch (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error fetching tracked projects:', error);
      setError('Failed to load your tracked projects. Please try again later.');
    }
  };

  const fetchRecentActivity = async () => {
    try {
      if (!currentUser) {
        setRecentActivity([]);
        return;
      }
      
      console.log('Fetching recent activity for user:', currentUser.uid);
      
      // Create a query to get recent activity by current user
      const q = query(
        collection(db, 'activity'),
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      try {
        // Use onSnapshot for real-time updates that works offline too
        const unsubscribe = onSnapshot(q, (snapshot) => {
          console.log('Recent activity snapshot size:', snapshot.size);
          
          const activities = [];
          snapshot.forEach(doc => {
            const activityData = doc.data();
            console.log('Recent activity data:', activityData);
            activities.push({ id: doc.id, ...activityData, timestamp: activityData.timestamp?.toDate() || new Date() });
          });
          
          setRecentActivity(activities);
          console.log('Recent activity set:', activities.length, 'activities');
          setLoading(false);
        }, (error) => {
          console.error('Error in recent activity snapshot:', error);
          // Try fallback method if snapshot fails
          getDocs(q).then((snapshot) => {
            const activities = [];
            snapshot.forEach(doc => {
              activities.push({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate() || new Date() });
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
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard {userData && `| Hello, ${userData.firstName || currentUser?.displayName || 'User'}`}</h1>
        {isOffline && (
          <div className="offline-indicator">
            You are currently offline. Some features may be limited.
          </div>
        )}
      </div>

      <div className="dashboard-content">
        <section className="tracked-projects">
          <h2>Tracked Projects</h2>
          {error && <div className="error-message">{error}</div>}
          {trackedProjects.length > 0 ? (
            <ul className="projects-list">
              {trackedProjects.map(project => (
                <li key={project.projectId} className="project-item">
                  <Link to={`/project/${project.projectId}`}>
                    <h3>{project.projectName}</h3>
                    <p>{[
                        project.projectAddress1,
                        project.projectAddress2
                      ].filter(Boolean).join(', ')}</p>
                    <span className="project-date">
                      Status: {project.projectStatus}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <p>You haven't tracked any projects yet.</p>
              <Link to="/" className="btn-primary">Explore Projects</Link>
            </div>
          )}
        </section>

        <section className="recent-activity">
          <h2>Recent Activity</h2>
          {recentActivity.length > 0 ? (
            <ul className="activity-list">
              {recentActivity.map(activity => (
                <li key={activity.id} className={`activity-item ${activity.type}`}>
                  <div className="activity-icon">
                    {activity.type === 'track' ? '📌' : '🗑️'}
                  </div>
                  <div className="activity-details">
                    <p>{activity.description}</p>
                    <span className="activity-date">
                      {activity.timestamp ? activity.timestamp.toLocaleString() : 'Recent'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <p>No recent activity.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
