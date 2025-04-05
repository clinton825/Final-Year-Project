import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { collection, addDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import './Home.css';
import './tracked-badge.css';
import { updateDashboardCache } from '../pages/Dashboard';
import config from '../config';

const Projects = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [displayedProjects, setDisplayedProjects] = useState([]);
  const [projectsToShow, setProjectsToShow] = useState(21);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [valueRange, setValueRange] = useState({ min: '', max: '' });
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [trackedProjectIds, setTrackedProjectIds] = useState(new Set());
  const [selectedCounty, setSelectedCounty] = useState('');
  const [counties, setCounties] = useState(['Waterford', 'Carlow']);
  const [selectedTown, setSelectedTown] = useState('');
  const [towns, setTowns] = useState({
    'Waterford': ['Waterford City', 'Dungarvan', 'Tramore', 'Lismore', 'Ardmore', 'Portlaw', 'Tallow', 'Cappoquin', 'Kilmacthomas'],
    'Carlow': ['Carlow Town', 'Tullow', 'Bagenalstown', 'Borris', 'Hacketstown', 'Tinnahinch']
  });

  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
      setSelectedSubcategory('');
    }
  }, [selectedCategory]);

  // Fetch tracked projects when user logs in
  useEffect(() => {
    if (currentUser) {
      fetchTrackedProjects();
    }
  }, [currentUser]);

  // Fetch tracked projects from Firestore
  const fetchTrackedProjects = async () => {
    if (!currentUser) return;
    
    try {
      const q = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const trackedIds = new Set();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.planning_id) {
          trackedIds.add(data.planning_id);
        }
      });
      
      console.log('Tracked project IDs:', Array.from(trackedIds));
      setTrackedProjectIds(trackedIds);
    } catch (error) {
      console.error('Error fetching tracked projects:', error);
    }
  };
  
  // Apply filters to projects when any filter changes or when projects are loaded
  const applyFilters = () => {
    if (projects.length === 0) return [];
    
    let filtered = [...projects];

    // Apply search term filter
    if (searchTerm.trim()) {
      const searchTermLower = searchTerm.toLowerCase();
      filtered = filtered.filter(project => {
        return (
          project.planning_development_address_1?.toLowerCase().includes(searchTermLower) ||
          project.planning_development_address_2?.toLowerCase().includes(searchTermLower) ||
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
    
    // Filter by county
    if (selectedCounty) {
      filtered = filtered.filter(project => 
        project.planning_county?.toLowerCase() === selectedCounty.toLowerCase()
      );
    }
    
    // Filter by town (when a town is selected)
    if (selectedTown) {
      filtered = filtered.filter(project => {
        const address = project.planning_development_address_1 || '';
        const address2 = project.planning_development_address_2 || '';
        const addressLower = address.toLowerCase();
        const address2Lower = address2.toLowerCase();
        return addressLower.includes(selectedTown.toLowerCase()) || 
               address2Lower.includes(selectedTown.toLowerCase());
      });
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

    return filtered;
  };

  const fetchProjects = async (searchParams = {}) => {
    // Check if this is an empty search (no parameters provided)
    // If it is and no explicit search was requested, don't fetch anything
    const isEmptySearch = Object.values(searchParams).every(param => !param);
    if (isEmptySearch) {
      // Only proceed with empty search if explicitly requested
      if (!window.__FORCE_EMPTY_SEARCH__) {
        return;
      }
    }
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
      
      // Add pagination to reduce data load
      queryParams.push(`limit=50`); // Limit to 50 projects at a time
      
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }
      
      console.log('Fetching projects from URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Cannot connect to the server. Please make sure the API server is running.');
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      
      const projectsData = data.projects || [];
      console.log(`Received ${projectsData.length} projects from API`);
      
      setProjects(projectsData);
      
      // If no projects were returned, set an appropriate message
      if (projectsData.length === 0) {
        setError('No projects found matching your search criteria. Try adjusting your filters.');
        setDisplayedProjects([]);
        setFilteredProjects([]);
        setSearchPerformed(true);
        setLoading(false);
        return;
      }
      
      // Apply filters and update displayed projects directly using the fetched data
      let filtered = [...projectsData];
      setFilteredProjects(filtered);
      setDisplayedProjects(filtered.slice(0, projectsToShow));
      setSearchPerformed(true);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError(error.message || 'Failed to load projects. Please try again.');
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
      navigate('/login', { state: { from: '/' } });
      return;
    }
    // Make sure we have a valid planning ID
    if (!planningId) {
      console.error('No planning ID provided for project navigation');
      return;
    }
    console.log('Navigating to project with planning_id:', planningId);
    navigate(`/project/${encodeURIComponent(planningId)}`);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedSubcategory('');
    
    // Fetch subcategories if a category is selected
    if (category) {
      fetchSubcategories(category);
    } else {
      setSubcategories([]);
    }
  };

  const handleSubcategoryChange = (subcategory) => {
    setSelectedSubcategory(subcategory);
  };

  // Handle county selection
  const handleCountyChange = (county) => {
    setSelectedCounty(county);
    setSelectedTown(''); // Reset town when county changes
  };
  
  // Handle town selection
  const handleTownChange = (town) => {
    setSelectedTown(town);
  };

  const handleValueRangeChange = (type) => (e) => {
    const value = e.target.value;
    // Allow empty values or valid numbers
    setValueRange(prev => ({
      ...prev,
      [type]: value
    }));
    
    // If min is greater than max, adjust max
    if (type === 'min' && valueRange.max && parseFloat(value) > parseFloat(valueRange.max)) {
      setValueRange(prev => ({
        ...prev,
        max: value
      }));
    }
  };

  const toggleDescription = (projectId, event) => {
    // Prevent navigating to project details when clicking read more
    event.stopPropagation();
    
    // Make sure we have a valid ID to toggle
    if (!projectId) {
      console.error('No project ID provided for toggling description');
      return;
    }
    
    // Create a new Set to avoid direct state mutation
    const newExpandedCards = new Set(expandedCards);
    if (newExpandedCards.has(projectId)) {
      newExpandedCards.delete(projectId);
    } else {
      newExpandedCards.add(projectId);
    }
    setExpandedCards(newExpandedCards);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const searchParams = {
      searchTerm: searchTerm,
      category: selectedCategory,
      subcategory: selectedSubcategory,
      minValue: valueRange.min,
      maxValue: valueRange.max
    };
    fetchProjects(searchParams);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSelectedCounty('');
    setSelectedTown('');
    setValueRange({ min: '', max: '' });
    // Reset search state but don't fetch new projects
    setSearchPerformed(false);
    setProjects([]);
    setFilteredProjects([]);
    setDisplayedProjects([]);
    setError(null);
  };

  const loadMoreProjects = () => {
    const newProjectsToShow = projectsToShow + 20;
    setProjectsToShow(newProjectsToShow);
    setDisplayedProjects(filteredProjects.slice(0, newProjectsToShow));
  };


  useEffect(() => {
    if (projects.length > 0) {
      const filtered = applyFilters();
      setFilteredProjects(filtered);
      setDisplayedProjects(filtered.slice(0, projectsToShow));
    }
  }, [searchTerm, selectedCategory, selectedSubcategory, selectedCounty, selectedTown, valueRange, projects, projectsToShow]);

  // Loading state
  if (loading && searchPerformed) {
    return (
      <div className="home-container">
        <div className="header">
          <h1>Explore Projects</h1>
          <p>Search and filter infrastructure projects across the country</p>
        </div>
        
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading projects... This may take a few moments.</p>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="home-container">
      <div className="header">
        <h1>Explore Projects</h1>
        <p>Search and filter infrastructure projects across the country</p>
      </div>

      <div className="filters-section">
        <form onSubmit={handleSearch}>
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by town or project stage..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button 
              type="submit" 
              className="search-button"
              onClick={() => {
                // Allow empty searches when user explicitly clicks search
                window.__FORCE_EMPTY_SEARCH__ = true;
                setTimeout(() => {
                  window.__FORCE_EMPTY_SEARCH__ = false;
                }, 100);
              }}
            >
              Search Projects
            </button>
          </div>

          <div className="filters-row">
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              <option value="Residential">Residential</option>
              <option value="Commercial & Retail">Commercial & Retail</option>
              <option value="Industrial">Industrial</option>
              <option value="Mixed Use">Mixed Use</option>
              <option value="Infrastructure">Infrastructure</option>
            </select>

            <select
              id="subcategory-select"
              value={selectedSubcategory}
              onChange={(e) => handleSubcategoryChange(e.target.value)}
              className="filter-select"
              disabled={!selectedCategory || subcategories.length === 0}
            >
              <option value="">All Subcategories</option>
              {subcategories.map((subcategory, index) => (
                <option key={index} value={subcategory}>
                  {subcategory}
                </option>
              ))}
            </select>
          </div>

          {/* County filter */}
          <div className="filter-section">
            <label htmlFor="county-filter">County:</label>
            <select
              id="county-filter"
              value={selectedCounty}
              onChange={(e) => handleCountyChange(e.target.value)}
              className="filter-select"
            >
              <option value="">All Counties</option>
              {counties.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </div>
          
          {/* Town filter - only show when a county is selected */}
          {selectedCounty && towns[selectedCounty] && (
            <div className="filter-section">
              <label htmlFor="town-filter">Town:</label>
              <select
                id="town-filter"
                value={selectedTown}
                onChange={(e) => handleTownChange(e.target.value)}
                className="filter-select"
              >
                <option value="">All Towns</option>
                {towns[selectedCounty].map((town) => (
                  <option key={town} value={town}>
                    {town}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="value-range-container">
            <div className="value-input-group">
              <input
                type="number"
                placeholder="Min Value (€)"
                value={valueRange.min}
                onChange={(e) => handleValueRangeChange('min')(e)}
                className="value-input"
                min="0"
                step="0.1"
              />
              <span className="value-separator">to</span>
              <input
                type="number"
                placeholder="Max Value (€)"
                value={valueRange.max}
                onChange={(e) => handleValueRangeChange('max')(e)}
                className="value-input"
                min="0"
                step="0.1"
              />
            </div>
          </div>

          {(searchTerm || selectedCategory || selectedSubcategory || selectedCounty || selectedTown || valueRange.min || valueRange.max) && (
            <button type="button" onClick={clearFilters} className="clear-filters-btn">
              Clear Filters
            </button>
          )}
        </form>
      </div>

      {error && <div className="error">{error}</div>}

      {!searchPerformed ? (
        <div className="empty-state">
          <h3>Start Your Search</h3>
          <p>Use the search box and filters above to find projects</p>
        </div>
      ) : searchPerformed && displayedProjects.length === 0 ? (
        <div className="empty-state">
          <h3>No Projects Found</h3>
          <p>Try adjusting your search criteria or filters</p>
        </div>
      ) : displayedProjects.length > 0 ? (
        <>
          <div className="projects-container">
            {displayedProjects.map((project, index) => (
              <div key={project.planning_id || `project-${index}`} className="project-card">
                <div className="project-card-header">
                  <h3>{project.planning_development_address_1}</h3>
                  <div className="project-card-header-right">
                    <div className="project-id">
                      <span>Project ID:</span> {project.planning_id || 'N/A'}
                      {trackedProjectIds.has(project.planning_id) && (
                        <span className="tracked-badge" title="You are tracking this project">
                          <i className="fas fa-bookmark"></i> Tracked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="project-card-body">
                  <div className="project-brief">
                    <p className={expandedCards.has(project.planning_id) ? 'expanded' : ''}>
                      {project.planning_description || 'No description available'}
                    </p>
                    {project.planning_description && project.planning_description.length > 150 && (
                      <button
                        className="read-more-btn"
                        onClick={(e) => toggleDescription(project.planning_id, e)}
                      >
                        {expandedCards.has(project.planning_id) ? 'Read Less' : 'Read More'}
                      </button>
                    )}
                  </div>
                  <div className="project-meta">
                    <div className="meta-row">
                      <span>Category:</span>
                      <span>{project.planning_category || 'N/A'}</span>
                    </div>
                    <div className="meta-row">
                      <span>Stage:</span>
                      <span>{project.planning_stage || 'N/A'}</span>
                    </div>
                    <div className="meta-row">
                      <span>Value:</span>
                      <span>{project.planning_value || 'N/A'}</span>
                    </div>
                    <div className="meta-row">
                      <span>County:</span>
                      <span>{project.planning_county || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="project-actions">
                    <button 
                      onClick={() => handleProjectClick(project.planning_id)} 
                      className="view-details-btn"
                    >
                      <i className="fas fa-info-circle"></i> View Project Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {displayedProjects.length < filteredProjects.length && (
            <div className="load-more-container">
              <button onClick={loadMoreProjects} className="load-more-btn">
                Load More Projects
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default Projects;
