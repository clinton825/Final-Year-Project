import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import './Home.css';

const Home = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProjects(projects);
      return;
    }

    const searchTermLower = searchTerm.toLowerCase();
    const filtered = projects.filter(project => {
      return (
        project.planning_id?.toString().includes(searchTermLower) ||
        project.planning_title?.toLowerCase().includes(searchTermLower) ||
        project.planning_county?.toLowerCase().includes(searchTermLower) ||
        project.planning_region?.toLowerCase().includes(searchTermLower) ||
        project.planning_category?.toLowerCase().includes(searchTermLower) ||
        project.planning_subcategory?.toLowerCase().includes(searchTermLower)
      );
    });

    setFilteredProjects(filtered);
  }, [searchTerm, projects]);

  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
      setSelectedSubcategory('');
    }
  }, [selectedCategory]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data.projects);
      setFilteredProjects(data.projects);
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchSubcategories = async (category) => {
    try {
      const response = await fetch(`http://localhost:3001/api/subcategories/${encodeURIComponent(category)}`);
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

  const fetchFilteredProjects = async (category, subcategory = null) => {
    setLoading(true);
    setError(null);
    try {
      let url = `http://localhost:3001/api/projects/category/${encodeURIComponent(category)}`;
      if (subcategory) {
        url += `?subcategory=${encodeURIComponent(subcategory)}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch filtered projects');
      }
      
      const data = await response.json();
      setProjects(data.projects);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setSelectedCategory('');
    setSelectedSubcategory('');
  };

  const handleProjectClick = (planningId) => {
    navigate(`/project/${planningId}`);
  };

  const handleCategoryChange = async (category) => {
    setSelectedCategory(category);
    setSelectedSubcategory('');
    setSearchTerm('');
    if (category) {
      await fetchFilteredProjects(category);
    } else {
      fetchProjects();
    }
  };

  const handleSubcategoryChange = async (subcategory) => {
    setSelectedSubcategory(subcategory);
    setSearchTerm('');
    if (subcategory && selectedCategory) {
      await fetchFilteredProjects(selectedCategory, subcategory);
    } else if (selectedCategory) {
      await fetchFilteredProjects(selectedCategory);
    }
  };

  const categories = [...new Set(projects.map(project => project.planning_category))].filter(Boolean).sort();

  return (
    <div className="home-container">
      <h1>PROJECT INFORMATION</h1>
      {error && <div className="error">{error}</div>}

      <div className="search-container">
        <input
          type="text"
          placeholder="Search by ID, title, location, or category..."
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
        />
      </div>

      <div className="filter-container">
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          disabled={searchTerm !== ''}
        >
          <option value="">Select Category</option>
          {categories.map((category, index) => (
            <option key={index} value={category}>
              {category}
            </option>
          ))}
        </select>

        {selectedCategory && subcategories.length > 0 && (
          <select
            value={selectedSubcategory}
            onChange={(e) => handleSubcategoryChange(e.target.value)}
            disabled={searchTerm !== ''}
          >
            <option value="">Select Subcategory</option>
            {subcategories.map((subcategory, index) => (
              <option key={index} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <div className="loading">Loading projects...</div>}

      <div className="project-grid">
        {filteredProjects.map((project) => (
          <div
            key={project.planning_id}
            className="project-card"
            onClick={() => handleProjectClick(project.planning_id)}
          >
            <h3>{project.planning_title}</h3>
            <p><strong>Planning ID:</strong> {project.planning_id}</p>
            <p><strong>Category:</strong> {project.planning_category}</p>
            {project.planning_subcategory && (
              <p><strong>Subcategory:</strong> {project.planning_subcategory}</p>
            )}
            <p><strong>Value:</strong> {project.planning_value}</p>
            <p><strong>Location:</strong> {project.planning_county}, {project.planning_region}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
