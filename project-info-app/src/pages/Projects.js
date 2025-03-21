import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import './Home.css';  // Reusing the same styles for now
import { updateDashboardCache } from '../pages/Dashboard';
import config from '../config';

const Projects = () => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [displayedProjects, setDisplayedProjects] = useState([]);
  const [projectsToShow, setProjectsToShow] = useState(21);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [valueRange, setValueRange] = useState({ min: '', max: '' });
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [trackedProjectIds, setTrackedProjectIds] = useState(new Set());
  const [showTrackedProjects, setShowTrackedProjects] = useState(false);
  const navigate = useNavigate();

  // Fetch the user's tracked projects to filter them out
  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) return;
      
      const q = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      const trackedIds = new Set();
      
      snapshot.forEach(doc => {
        const projectData = doc.data();
        // Extract the planning_id from potentially compound IDs (user_id:planning_id)
        let planningId = null;
        
        if (projectData.planning_id) {
          // The planning_id might be a compound ID
          if (projectData.planning_id.includes(':')) {
            // Extract the actual planning_id from the compound ID
            planningId = projectData.planning_id.split(':')[1];
          } else {
            planningId = projectData.planning_id;
          }
          
          if (planningId) {
            trackedIds.add(planningId);
          }
        }
      });
      
      setTrackedProjectIds(trackedIds);
      console.log('Tracked project IDs:', Array.from(trackedIds));
    } catch (error) {
      console.error('Error fetching tracked projects:', error);
    }
  };

  useEffect(() => {
    // Only fetch tracked projects on mount, not all projects
    if (currentUser) {
      fetchTrackedProjects();
    }
  }, [currentUser]); // Removed fetchTrackedProjects from dependency array
  
  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
      setSelectedSubcategory('');
    }
  }, [selectedCategory]);

  useEffect(() => {
    let filtered = [...projects];

    // Filter out tracked projects unless showTrackedProjects is true
    if (currentUser && !showTrackedProjects && trackedProjectIds.size > 0) {
      filtered = filtered.filter(project => {
        // The project's planning_id should not be in our tracked IDs set
        // Need to check both raw ID and potential compound ID (user_id:planning_id)
        const planningId = project.planning_id;
        const compoundId = `${currentUser.uid}:${planningId}`;
        
        return !trackedProjectIds.has(planningId) && !trackedProjectIds.has(compoundId);
      });
    }

    if (searchTerm.trim()) {
      const searchTermLower = searchTerm.toLowerCase();
      filtered = filtered.filter(project => {
        return (
          project.planning_development_address_1?.toLowerCase().includes(searchTermLower) ||
          project.planning_stage?.toLowerCase().includes(searchTermLower) ||
          project.planning_category?.toLowerCase().includes(searchTermLower)
        );
      });
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(project => 
        project.planning_category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Filter by subcategory
    if (selectedSubcategory) {
      filtered = filtered.filter(project => 
        project.planning_subcategory?.toLowerCase() === selectedSubcategory.toLowerCase()
      );
    }

    // Filter by value range
    if (valueRange.min !== '' || valueRange.max !== '') {
      filtered = filtered.filter(project => {
        const projectValue = parseFloat(project.planning_value?.replace(/[^0-9.-]+/g, '')) || 0;
        const minValue = valueRange.min === '' ? Number.MIN_SAFE_INTEGER : parseFloat(valueRange.min);
        const maxValue = valueRange.max === '' ? Number.MAX_SAFE_INTEGER : parseFloat(valueRange.max);
        return projectValue >= minValue && projectValue <= maxValue;
      });
    }

    setFilteredProjects(filtered);
    setDisplayedProjects(filtered.slice(0, projectsToShow));
  }, [searchTerm, selectedCategory, selectedSubcategory, projects, valueRange, projectsToShow, trackedProjectIds, showTrackedProjects, currentUser]);

  const fetchProjects = async (searchParams = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      // Base URL
      let url = `${config.API_URL}/api/projects`;
      
      // Add query params for filtering if provided
      const queryParams = [];
      if (searchParams.searchTerm) queryParams.push(`search=${encodeURIComponent(searchParams.searchTerm)}`);
      if (searchParams.category) queryParams.push(`category=${encodeURIComponent(searchParams.category)}`);
      if (searchParams.subcategory) queryParams.push(`subcategory=${encodeURIComponent(searchParams.subcategory)}`);
      if (searchParams.minValue) queryParams.push(`minValue=${encodeURIComponent(searchParams.minValue)}`);
      if (searchParams.maxValue) queryParams.push(`maxValue=${encodeURIComponent(searchParams.maxValue)}`);
      
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Cannot connect to the server. Please make sure the API server is running.');
      }
      
      const data = await response.json();
      setProjects(data.projects);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchSubcategories = async (category) => {
    try {
      const response = await fetch(`${config.API_URL}/api/subcategories/${encodeURIComponent(category)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subcategories');
      }
      const data = await response.json();
      setSubcategories(data.subcategories);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      setError('Failed to load subcategories');
    }
  };

  const handleProjectClick = (planningId) => {
    if (!currentUser) {
      navigate('/login', { state: { from: '/projects' } });
      return;
    }
    navigate(`/project/${encodeURIComponent(planningId)}`);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedSubcategory('');
  };

  const handleSubcategoryChange = (subcategory) => {
    setSelectedSubcategory(subcategory);
  };

  const handleValueRangeChange = (type) => (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setValueRange(prev => ({
        ...prev,
        [type]: value
      }));
    }
  };

    const loadMoreProjects = () => {
    setProjectsToShow(prev => prev + 21);
  };
  
  // Handle search/filter form submission
  const handleSearch = (e) => {
    if (e) e.preventDefault();
    
    // Collect all search parameters
    const searchParams = {
      searchTerm,
      category: selectedCategory,
      subcategory: selectedSubcategory,
      minValue: valueRange.min,
      maxValue: valueRange.max
    };
    
    // Fetch projects with the search parameters
    fetchProjects(searchParams);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedSubcategory('');
    setValueRange({ min: '', max: '' });
    setProjectsToShow(21);
    setProjects([]);
    setFilteredProjects([]);
    setDisplayedProjects([]);
    // Not automatically fetching projects anymore
  };

  // Toggle project description expansion
  const toggleDescription = (projectId, e) => {
    e.stopPropagation();
    e.preventDefault();
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  // Helper function to truncate text
  const truncateDescription = (description, maxLength = 150) => {
    if (!description) return '';
    if (description.length <= maxLength) return description;
    return `${description.substring(0, maxLength)}...`;
  };

  const trackProject = async (projectData) => {
    try {
      if (!currentUser) {
        console.log('No user logged in');
        return;
      }
      
      // Check if project is already tracked
      const projectId = projectData.planning_id;
      if (trackedProjectIds.has(projectId)) {
        console.log('Project already tracked:', projectId);
        alert('This project is already being tracked.');
        return;
      }
      
      // Add user ID and timestamp to the project data
      const trackingData = {
        ...projectData,
        userId: currentUser.uid,
        trackedAt: serverTimestamp()
      };
      
      // Add to trackedProjects collection
      const projectRef = await addDoc(collection(db, 'trackedProjects'), trackingData);
      console.log('Project tracked:', projectRef.id);
      
      // Log activity
      try {
        await addDoc(collection(db, 'activity'), {
          userId: currentUser.uid,
          type: 'track',
          projectId: projectData.planning_id || projectData.id,
          description: `Tracked project: ${projectData.planning_title || projectData.title || 'Unnamed project'}`,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error('Error logging track activity:', err);
      }

      // Get all tracked projects for this user to update the dashboard cache
      const trackedProjectsQuery = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid)
      );
      
      const trackedProjectsSnapshot = await getDocs(trackedProjectsQuery);
      const trackedProjects = trackedProjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Update dashboard cache with the current user's tracked projects
      await updateDashboardCache(currentUser, trackedProjects, null);
      
      // Update local state to reflect the newly tracked project
      setTrackedProjectIds(prev => {
        const newSet = new Set(prev);
        newSet.add(projectId);
        return newSet;
      });
      
      alert('Project tracked successfully!');
    } catch (error) {
      console.error('Error tracking project:', error);
      alert('Error tracking project: ' + error.message);
    }
  };

  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  return (
    <div className="projects-container">
      <div className="page-header">
        <h1>Explore Projects</h1>
        <p>Search and filter infrastructure projects across the country</p>
      </div>

      <form onSubmit={handleSearch} className="search-container">
        <input
          type="text"
          placeholder={currentUser ? "Search by town or project stage..." : "Log in to search projects"}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
          disabled={!currentUser}
        />
        {currentUser && (
          <button type="submit" className="search-button">
            <i className="fas fa-search"></i> Search Projects
          </button>
        )}
      </form>

      <div className="search-filters">
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="filter-select"
          disabled={!currentUser}
        >
          <option value="">Select Category</option>
          <option value="Residential">Residential</option>
          <option value="Commercial & Retail">Commercial & Retail</option>
          <option value="Industrial">Industrial</option>
        </select>

        {currentUser && selectedCategory && subcategories.length > 0 && (
          <select
            value={selectedSubcategory}
            onChange={(e) => handleSubcategoryChange(e.target.value)}
            className="filter-select"
          >
            <option value="">Select Subcategory</option>
            {subcategories.map((subcategory, index) => (
              <option key={index} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>
        )}

        <div className="value-range-inputs">
          <input
            type="text"
            placeholder="Min Value (€)"
            value={valueRange.min}
            onChange={handleValueRangeChange('min')}
            className="value-input"
            disabled={!currentUser}
          />
          <span className="value-separator">to</span>
          <input
            type="text"
            placeholder="Max Value (€)"
            value={valueRange.max}
            onChange={handleValueRangeChange('max')}
            className="value-input"
            disabled={!currentUser}
          />
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
          <button className="retry-button" onClick={() => handleSearch()}>Retry</button>
        </div>
      )}

      {currentUser && (searchTerm || selectedCategory || selectedSubcategory || valueRange.min || valueRange.max) && (
        <button onClick={clearFilters} className="clear-filters-btn">
          Clear All Filters
        </button>
      )}

      {currentUser && (
        <div className="show-tracked-projects-toggle">
          <input
            type="checkbox"
            id="show-tracked-projects"
            checked={showTrackedProjects}
            onChange={() => setShowTrackedProjects(prev => !prev)}
          />
          <label htmlFor="show-tracked-projects">Show Tracked Projects</label>
          {!showTrackedProjects && trackedProjectIds.size > 0 && (
            <span className="tracked-count-badge">
              {trackedProjectIds.size} project{trackedProjectIds.size !== 1 ? 's' : ''} hidden
            </span>
          )}
        </div>
      )}

      {currentUser && (
        <div className="tracked-status">
          <i className={`fas fa-info-circle status-icon ${showTrackedProjects ? 'tracked' : ''}`}></i>
          <span>
            {showTrackedProjects 
              ? `Showing ${displayedProjects.length} tracked projects` 
              : `Showing all available projects (${trackedProjectIds.size} tracked projects are marked with a green indicator)`}
          </span>
        </div>
      )}

      <div className="projects-list">
        {displayedProjects.map((project) => {
          const projectLocation = 
            project.planning_development_address_1 || 
            project.planning_development_address_2 || 
            project.planning_development_address_3 || 
            `${project.planning_region}, ${project.planning_county}` || 
            'Location not specified';

          const projectStatus = project.planning_stage || 'Status not available';

          return (
            <div key={project.planning_id} className={`project-card ${!currentUser ? 'limited-view' : ''} ${
              expandedCards.has(project.planning_id) ? 'expanded' : ''
            } ${trackedProjectIds.has(project.planning_id) ? 'tracked' : ''}`}> 
              <div className="project-card-content">
                <div className="project-header">
                  <h3>{project.planning_title}</h3>
                </div>
                
                <div className="project-card-body">
                  <p className="project-description">
                    {project.planning_description?.substring(0, 150)}
                    {project.planning_description?.length > 150 ? '...' : ''}
                  </p>

                  {currentUser ? (
                    <>
                      <div className="project-details">
                        <div className="detail-row">
                          <span><strong>Location:</strong> {projectLocation}</span>
                        </div>
                        <div className="detail-row">
                          <span><strong>Value:</strong> €{project.planning_value.toLocaleString()}</span>
                        </div>
                        <div className="detail-row">
                          <span><strong>Status:</strong> {projectStatus}</span>
                        </div>
                        <div className="detail-row">
                          <span><strong>Category:</strong> {project.planning_category}</span>
                        </div>

                        {project.planning_subcategory && (
                          <div className="detail-row">
                            <span><strong>Subcategory:</strong> {project.planning_subcategory}</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="login-prompt">
                      <p>Log in to view project details</p>
                    </div>
                  )}
                </div>
                
                <div className="project-card-footer">
                  <div className="project-actions">
                    <button 
                      className="view-details-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProjectClick(project.planning_id);
                      }}
                    >
                      <i className="fas fa-eye"></i> View Details
                    </button>
                    
                    {currentUser && !trackedProjectIds.has(project.planning_id) && (
                      <button 
                        className="track-project-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          trackProject(project);
                        }}
                      >
                        <i className="fas fa-bookmark"></i> Track Project
                      </button>
                    )}
                    
                    {currentUser && trackedProjectIds.has(project.planning_id) && (
                      <button 
                        className="tracked-project-btn"
                        disabled
                      >
                        <i className="fas fa-check"></i> Tracked
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {currentUser && filteredProjects.length > displayedProjects.length && (
        <div className="load-more-container">
          <button onClick={loadMoreProjects} className="load-more-btn">
            Load More Projects
          </button>
        </div>
      )}
    </div>
  );
};

export default Projects;
