import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import './Home.css';
import Footer from '../components/Footer';

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
      const response = await fetch('http://localhost:8080/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data.projects);
      setLoading(false);
    } catch (error) {
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

  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
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
          <option value="Commercial">Commercial</option>
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

      {currentUser && (searchTerm || selectedCategory || selectedSubcategory || valueRange.min || valueRange.max) && (
        <button onClick={clearFilters} className="clear-filters-btn">
          Clear All Filters
        </button>
      )}

      <div className="projects-grid">
        {displayedProjects.map((project) => (
          <div
            key={project.planning_id}
            className={`project-card ${!currentUser ? 'limited-view' : ''} ${
              expandedCards.has(project.planning_id) ? 'expanded' : ''
            }`}
            onClick={() => handleProjectClick(project.planning_id)}
          >
            <h3>{project.planning_title}</h3>
            <p className="project-description">
              {project.planning_description?.substring(0, 150)}
              {project.planning_description?.length > 150 ? '...' : ''}
            </p>

            {currentUser ? (
              <>
                <div className="project-details">
                  <div className="detail-row">
                    <span><strong>Planning ID:</strong> {project.planning_id}</span>
                    <span><strong>Town:</strong> {project.planning_development_address_1?.split(',')[0]}</span>
                  </div>

                  <div className="detail-row">
                    <span><strong>Category:</strong> {project.planning_category}</span>
                    <span><strong>Value:</strong> €{project.planning_value?.replace('£', '')}</span>
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
        ))}
      </div>

      {currentUser && filteredProjects.length > displayedProjects.length && (
        <div className="load-more-container">
          <button onClick={loadMoreProjects} className="load-more-btn">
            Load More Projects
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Home;
