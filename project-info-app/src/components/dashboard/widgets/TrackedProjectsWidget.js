import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaTags, FaEuroSign, FaExternalLinkAlt, FaUnlink, FaProjectDiagram, FaCalendarAlt, FaStickyNote } from 'react-icons/fa';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../contexts/AuthContext';
import './TrackedProjectsWidget.css';
import NotesList from '../../notes/NotesList';

const TrackedProjectsWidget = ({ data }) => {
  const { 
    trackedProjects = [], 
    untrackProject: parentUntrackProject,
    loading = false,
    showNotes = {},
    projectNotes = {},
    onToggleNotes,
    onAddNote,
    onUpdateNote,
    onDeleteNote
  } = data || {};
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
  const handleUntrack = useCallback(async (projectId, project) => {
    try {
      // Set loading state for this project
      setUntrackingProjects(prev => ({ ...prev, [projectId]: true }));
      
      console.log('Starting untrack process for project ID:', projectId);
      
      // Try to use the parent function first
      if (typeof parentUntrackProject === 'function') {
        try {
          // Pass the document ID if available in the project data
          console.log('Using parentUntrackProject for untracking:', projectId);
          
          const result = await parentUntrackProject(projectId);
          
          if (result) {
            console.log('Successfully untracked project using parent function');
            // Reset loading state
            setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
            
            // Fade out the project card for smoother UX
            const projectElement = document.getElementById(`project-card-${projectId}`);
            if (projectElement) {
              projectElement.style.transition = 'opacity 0.3s, max-height 0.5s ease-out';
              projectElement.style.opacity = '0';
              projectElement.style.maxHeight = '0';
              projectElement.style.overflow = 'hidden';
              projectElement.style.marginBottom = '0';
              projectElement.style.padding = '0';
              projectElement.style.border = 'none';
            }
            
            return true;
          } else {
            console.log('Untrack operation returned false, falling back to local implementation');
          }
        } catch (error) {
          console.error('Error using parent untrackProject function:', error);
          // Fall through to local implementation
        }
      }
      
      // Fallback to local implementation if parent function fails or doesn't exist
      if (!currentUser) {
        console.error('Cannot untrack project: No user logged in');
        setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
        return;
      }
      
      // Try direct document deletion with compound ID
      const compoundId = `${currentUser.uid}_${projectId}`;
      console.log('Trying direct deletion with compound ID:', compoundId);
      
      try {
        const compoundDocRef = doc(db, 'trackedProjects', compoundId);
        await deleteDoc(compoundDocRef);
        console.log('Successfully deleted tracked project with compound ID');
        
        // Remove this project from the DOM
        const projectElement = document.getElementById(`project-card-${projectId}`);
        if (projectElement) {
          projectElement.style.transition = 'opacity 0.3s, max-height 0.5s ease-out';
          projectElement.style.opacity = '0';
          projectElement.style.maxHeight = '0';
          projectElement.style.overflow = 'hidden';
          projectElement.style.marginBottom = '0';
          projectElement.style.padding = '0';
          projectElement.style.border = 'none';
        }
        
        return;
      } catch (error) {
        console.error('Error deleting document with compound ID:', error);
        
        // Try query-based approach as last resort
        try {
          console.log('Trying query-based approach...');
          const trackedRef = collection(db, 'trackedProjects');
          const q = query(
            trackedRef,
            where('userId', '==', currentUser.uid),
            where('projectId', '==', projectId)
          );
          
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.empty) {
            console.log('No matching documents found');
            setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
            return;
          }
          
          // Delete all matching documents
          const deletePromises = [];
          querySnapshot.forEach(doc => {
            console.log('Deleting document:', doc.id);
            deletePromises.push(deleteDoc(doc.ref));
          });
          
          await Promise.all(deletePromises);
          console.log('Successfully deleted tracked project using query approach');
          
          // Remove this project from the DOM
          const projectElement = document.getElementById(`project-card-${projectId}`);
          if (projectElement) {
            projectElement.style.transition = 'opacity 0.3s, max-height 0.5s ease-out';
            projectElement.style.opacity = '0';
            projectElement.style.maxHeight = '0';
            projectElement.style.overflow = 'hidden';
            projectElement.style.marginBottom = '0';
            projectElement.style.padding = '0';
            projectElement.style.border = 'none';
          }
          
          return;
        } catch (queryError) {
          console.error('Error in query-based deletion approach:', queryError);
          setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
        }
      }
    } catch (error) {
      console.error('Error untracking project:', error);
      setUntrackingProjects(prev => ({ ...prev, [projectId]: false }));
    }
  }, [currentUser, parentUntrackProject]);
  
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

  return (
    <div className={`tracked-projects-widget ${loading ? 'loading' : ''}`}>
      {loading ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading tracked projects...</p>
        </div>
      ) : trackedProjects.length === 0 ? (
        <div className="empty-state">
          <p>You're not tracking any projects yet.</p>
          <p className="hint">Visit the Projects page to find and track projects.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {trackedProjects.map(project => {
            // Log the project data to help with debugging
            console.log('Rendering project in widget:', project);
            
            // Extract project ID from various possible fields
            const projectId = 
              project.docId || 
              project.projectId || 
              project.planning_id || 
              project.id || 
              project._id;
            
            // Debug logging
            if (!projectId) {
              console.warn('Project missing ID:', project);
            }
              
            // Extract project title from various possible fields
            const projectTitle = 
              project.title || 
              project.planning_title || 
              project.planning_name || 
              project.name || 
              (project.planning_description ? project.planning_description.substring(0, 30) + '...' : null) || 
              'Unnamed Project';
            
            // Extract location information
            const location = 
              project.location || 
              project.planning_location || 
              project.planning_county || 
              (project.planning_development_address_1 ? 
                [
                  project.planning_development_address_1,
                  project.planning_development_address_2,
                  project.planning_development_address_3
                ].filter(Boolean).join(', ') : 
                null
              ) || 
              'Location not specified';
            
            // Get project value from various possible field names
            const projectValue = 
              parseFloat(project.projectValue) || 
              parseFloat(project.planning_value) || 
              parseFloat(project.value) || 
              0;
          
            // Get category for styling
            const category = project.category || project.planning_category || project.type || 'other';
            const categoryClass = getCategoryClass(category);
            
            // Get dates
            const applicationDate = project.planning_application_date || project.application_date || null;
            const decisionDate = project.planning_decision_date || project.decision_date || null;
            
            return (
              <div key={projectId || Math.random().toString()} id={`project-card-${projectId}`} className={`project-card ${categoryClass}`}>
                <h3 className="project-title">{projectTitle}</h3>
                
                <div className="project-info">
                  <div className="project-meta">
                    <span className="meta-icon"><FaMapMarkerAlt /></span>
                    <span className="meta-value">{location}</span>
                  </div>
                  
                  {category && (
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
                    className="action-button notes"
                    onClick={(e) => {
                      e.preventDefault();
                      if (typeof onToggleNotes === 'function') {
                        onToggleNotes(projectId);
                      }
                    }}
                    aria-label="Toggle project notes"
                  >
                    <FaStickyNote /> Notes
                  </button>
                  
                  <button 
                    className={`action-button untrack ${untrackingProjects[projectId] ? 'loading' : ''}`}
                    onClick={() => {
                      // Prioritize docId which is most reliable for tracking in our system
                      const trackingId = project.docId || projectId;
                      console.log('Untracking project with ID:', trackingId);
                      
                      // Use our robust handleUntrack function
                      handleUntrack(trackingId, project);
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
                
                {/* Notes Section */}
                {showNotes && showNotes[projectId] && (
                  <div className="project-notes-container">
                    <NotesList 
                      projectId={projectId}
                      notes={projectNotes[projectId] || []}
                      onAddNote={(projectId, text) => {
                        if (typeof onAddNote === 'function') {
                          onAddNote(projectId, projectTitle, text);
                        }
                      }}
                      onUpdateNote={(noteId, text) => {
                        if (typeof onUpdateNote === 'function') {
                          onUpdateNote(noteId, projectId, text);
                        }
                      }}
                      onDeleteNote={(noteId) => {
                        if (typeof onDeleteNote === 'function') {
                          return onDeleteNote(noteId, projectId);
                        }
                        return Promise.resolve(false);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrackedProjectsWidget;
