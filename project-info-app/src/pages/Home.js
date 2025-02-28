import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { collection, addDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import './Home.css';
import { updateDashboardCache } from '../pages/Dashboard';

const Home = () => {
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

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
  }, [searchTerm, selectedCategory, selectedSubcategory, projects, valueRange, projectsToShow]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8080/api/projects')
        .catch(err => {
          console.error('Network error:', err);
          throw new Error('Cannot connect to the server. Please make sure the API server is running.');
        });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
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
      const response = await fetch(`http://localhost:8080/api/subcategories/${encodeURIComponent(category)}`);
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
      navigate('/login', { state: { from: '/' } });
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

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedSubcategory('');
    setValueRange({ min: '', max: '' });
    setProjectsToShow(21);
    fetchProjects();
  };

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
    <div className="home-container">
      <div className="hero-section">
        <h1>Infrastructure Tracking Web Application</h1>
        <p>Transparent Insights into Local Infrastructure Development</p>
        {!currentUser && (
          <div className="auth-prompt">
            <p>Log in to access full details and tracking features</p>
            <div className="auth-buttons">
              <button onClick={() => navigate('/login')} className="login-btn">
                Log In
              </button>
              <button onClick={() => navigate('/signup')} className="signup-btn">
                Sign Up
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder={currentUser ? "Search by town or project stage..." : "Log in to search projects"}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
          disabled={!currentUser}
        />
      </div>

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
          <button className="retry-button" onClick={fetchProjects}>Retry</button>
        </div>
      )}

      {currentUser && (searchTerm || selectedCategory || selectedSubcategory || valueRange.min || valueRange.max) && (
        <button onClick={clearFilters} className="clear-filters-btn">
          Clear All Filters
        </button>
      )}

      <div className="projects-container">
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
            }`}> 
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

export default Home;
