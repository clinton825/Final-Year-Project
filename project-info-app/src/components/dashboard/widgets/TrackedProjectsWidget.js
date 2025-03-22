import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaTags, FaEuroSign, FaExternalLinkAlt, FaUnlink, FaProjectDiagram } from 'react-icons/fa';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../contexts/AuthContext';
import './WidgetStyles.css';

const TrackedProjectsWidget = ({ data }) => {
  const { trackedProjects, untrackProject: parentUntrackProject } = data || {};
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [untrackingProjects, setUntrackingProjects] = useState({});
  
  // Check if props are valid
  useEffect(() => {
    if (!data || typeof parentUntrackProject !== 'function') {
      console.error('TrackedProjectsWidget: Missing required props');
    }
  }, [data, parentUntrackProject]);
  
  // Implement a local untrack function as a fallback
  const handleUntrack = useCallback(async (projectId) => {
    try {
      // Set loading state for this project
      setUntrackingProjects(prev => ({ ...prev, [projectId]: true }));
      
      // Try to use the parent function first
      if (typeof parentUntrackProject === 'function') {
        try {
          await parentUntrackProject(projectId);
          return;
        } catch (error) {
          console.error('Error using parent untrackProject function:', error);
          // Fall through to local implementation
        }
      }
      
      // Fallback to local implementation if parent function fails or doesn't exist
      if (!currentUser) {
        console.error('Cannot untrack project: No user logged in');
        return;
      }
      
      // Find the documents to delete - we need to check multiple ways the ID might be stored
      const trackedRef = collection(db, 'trackedProjects');
      
      // Try all possible ID fields
      const idFields = ['docId', 'projectId', 'id', 'planning_id', '_id'];
      let documentFound = false;
      
      for (const field of idFields) {
        const q = query(
          trackedRef,
          where('userId', '==', currentUser.uid),
          where(field, '==', projectId)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          documentFound = true;
          // Delete all matching documents
          const deletePromises = [];
          querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
          });
          
          await Promise.all(deletePromises);
          
          // Force a page refresh to update the UI
          window.location.reload();
          break;
        }
      }
      
      if (!documentFound) {
        // Clear loading state since we're not refreshing the page
        setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
      }
    } catch (error) {
      console.error('Error untracking project:', error);
      // Clear loading state on error
      setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
    }
  }, [currentUser, parentUntrackProject]);

  // Format currency
  const formatCurrency = (value) => {
    if (!value) return '€0';
    
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const viewProjectDetails = (projectId) => {
    if (!projectId) return;
    navigate(`/project/${projectId}`);
  };

  if (!trackedProjects || trackedProjects.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <FaProjectDiagram />
        </div>
        <h3 className="empty-title">No Projects Tracked</h3>
        <p className="empty-message">
          You haven't tracked any projects yet. Explore the Projects section to find and track projects that interest you.
        </p>
      </div>
    );
  }

  return (
    <div className="tracked-projects-widget">
      <div className="projects-grid">
        {trackedProjects.map(project => {
          // Get project ID from various possible field names
          const projectId = 
            project.projectId || 
            project.planning_id || 
            project.id || 
            project._id || 
            project.docId;
            
          // Get project value from various possible field names
          const projectValue = 
            project.projectValue || 
            project.planning_value || 
            project.value || 
            0;
          
          return (
            <div key={project.id} className="project-card">
              <h3 className="project-title">
                {project.title || project.planning_title || project.name || project.planning_description?.substring(0, 30) + '...' || 'Project #' + (projectId?.substring(0, 6) || '')}
              </h3>
              
              <div className="project-info">
                {(project.location || project.planning_location) && (
                  <div className="project-meta">
                    <span className="meta-icon"><FaMapMarkerAlt /></span>
                    <span>{project.location || project.planning_location}</span>
                  </div>
                )}
                
                {(project.category || project.planning_category || project.type) && (
                  <div className="project-meta">
                    <span className="meta-icon"><FaTags /></span>
                    <span>{project.category || project.planning_category || project.type}</span>
                  </div>
                )}
                
                {projectValue > 0 && (
                  <div className="project-meta">
                    <span className="meta-icon"><FaEuroSign /></span>
                    <span>{formatCurrency(projectValue)}</span>
                  </div>
                )}
              </div>
              
              <div className="project-actions">
                <button 
                  className="action-button view"
                  onClick={() => viewProjectDetails(projectId)}
                >
                  <FaExternalLinkAlt /> View
                </button>
                
                <button 
                  className={`action-button untrack ${untrackingProjects[projectId] ? 'loading' : ''}`}
                  onClick={() => {
                    // Prioritize docId which is most reliable for tracking in our system
                    const trackingId = project.docId || projectId;
                    console.log('Untracking project with ID:', trackingId);
                    
                    // Use our robust handleUntrack function
                    handleUntrack(trackingId);
                  }}
                  disabled={untrackingProjects[projectId]}
                  aria-label="Untrack this project"
                >
                  {untrackingProjects[projectId] ? (
                    <>
                      <span className="loading-spinner"></span> Untracking...
                    </>
                  ) : (
                    <>
                      <FaUnlink /> Untrack
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackedProjectsWidget;
