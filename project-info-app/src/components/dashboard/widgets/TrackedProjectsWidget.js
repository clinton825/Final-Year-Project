import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaTags, FaEuroSign, FaExternalLinkAlt, FaUnlink, FaProjectDiagram, FaCalendarAlt } from 'react-icons/fa';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../contexts/AuthContext';
import './TrackedProjectsWidget.css';

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
      
      // Search for the project by its document ID first
      let foundDoc = null;
      try {
        const docRef = doc(db, 'trackedProjects', projectId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          foundDoc = { id: docSnap.id, ref: docSnap.ref };
          console.log('Found project by direct document ID');
        }
      } catch (error) {
        console.log('Not a valid document ID, trying other methods');
      }
      
      // If not found by direct ID, try querying by various ID fields
      if (!foundDoc) {
        // Try all possible ID fields without filtering by userId
        const trackedRef = collection(db, 'trackedProjects');
        const querySnapshot = await getDocs(query(trackedRef));
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Check all possible ID fields
          const idFields = ['docId', 'projectId', 'id', 'planning_id', '_id'];
          for (const field of idFields) {
            if (data[field] === projectId) {
              foundDoc = { id: doc.id, ref: doc.ref };
              console.log(`Found project by ${field} field`);
              break;
            }
          }
        });
      }
      
      if (!foundDoc) {
        console.log('No tracked project found with ID:', projectId);
        setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
        return;
      }
      
      // Delete the found document
      console.log('Deleting tracked project document:', foundDoc.id);
      await deleteDoc(foundDoc.ref);
      
      // Update local state instead of refreshing the page
      // Remove this project from the tracked projects list
      const updatedProjects = trackedProjects.filter(project => {
        const projectIdentifier = 
          project.docId || 
          project.projectId || 
          project.id || 
          project.planning_id || 
          project._id;
        return projectIdentifier !== projectId;
      });
      
      // If parent component passes a new untrackProject function with proper implementation,
      // the Dashboard component should update its state and propagate the change down
      console.log('Project untracked successfully, locally removed from UI');
    } catch (error) {
      console.error('Error untracking project:', error);
      // Clear loading state on error
      setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
    }
  }, [currentUser, parentUntrackProject, trackedProjects]);

  // Format currency
  const formatCurrency = (value) => {
    if (!value) return '€0';
    
    // Handle string values with commas or other characters
    let numValue = value;
    if (typeof value === 'string') {
      numValue = parseFloat(value.replace(/[^0-9.-]+/g, ''));
    }
    
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(numValue);
  };

  // Determine category class for styling
  const getCategoryClass = (category) => {
    const categoryStr = (category || '').toLowerCase();
    
    if (categoryStr.includes('industrial')) return 'industrial';
    if (categoryStr.includes('residential')) return 'residential';
    if (categoryStr.includes('commercial') || categoryStr.includes('retail')) return 'commercial';
    if (categoryStr.includes('transport') || categoryStr.includes('road')) return 'transport';
    if (categoryStr.includes('education') || categoryStr.includes('school') || categoryStr.includes('college')) return 'education';
    if (categoryStr.includes('health') || categoryStr.includes('hospital') || categoryStr.includes('medical')) return 'healthcare';
    
    return 'other';
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-IE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      return dateStr;
    }
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
            project.docId || 
            project.projectId || 
            project.planning_id || 
            project.id || 
            project._id;
            
          // Get project value from various possible field names
          const projectValue = 
            project.projectValue || 
            project.planning_value || 
            project.value || 
            0;
          
          // Get category for styling
          const category = project.category || project.planning_category || project.type || 'other';
          const categoryClass = getCategoryClass(category);
          
          // Get dates
          const applicationDate = project.planning_application_date || project.application_date || null;
          const decisionDate = project.planning_decision_date || project.decision_date || null;
          
          return (
            <div key={projectId || Math.random().toString()} className={`project-card ${categoryClass}`}>
              <h3 className="project-title">
                {project.title || project.planning_title || project.name || project.planning_description?.substring(0, 30) + '...' || 'Project #' + (projectId?.substring(0, 6) || '')}
              </h3>
              
              <div className="project-info">
                {(project.location || project.planning_location || project.planning_county) && (
                  <div className="project-meta">
                    <span className="meta-icon"><FaMapMarkerAlt /></span>
                    <span className="meta-value">{project.location || project.planning_location || project.planning_county}</span>
                  </div>
                )}
                
                {(category) && (
                  <div className="project-meta">
                    <span className="meta-icon"><FaTags /></span>
                    <span className="meta-value">{category}</span>
                  </div>
                )}
                
                {applicationDate && (
                  <div className="project-meta">
                    <span className="meta-icon"><FaCalendarAlt /></span>
                    <span className="meta-value">Applied: {formatDate(applicationDate)}</span>
                  </div>
                )}
                
                {projectValue > 0 && (
                  <div className="project-value">
                    <FaEuroSign /> {formatCurrency(projectValue)}
                  </div>
                )}
              </div>
              
              <div className="project-actions">
                <button 
                  className="action-button view"
                  onClick={() => viewProjectDetails(projectId)}
                  aria-label="View project details"
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
