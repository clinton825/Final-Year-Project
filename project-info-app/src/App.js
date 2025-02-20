import React, { useState, useEffect } from "react";
import './App.css';

function App() {
  const [projectId, setProjectId] = useState("");
  const [projectInfo, setProjectInfo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/categories');
      const data = await response.json();
      setCategories(data.categories || []);
      setSubcategories(data.subcategories || {});
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProjectInfo([]);

    // Validate that the ID is numeric
    if (!projectId || !/^\d+$/.test(projectId)) {
      setError("Please enter a valid numeric Planning ID");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/project/${projectId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch project");
      }

      if (!data.project) {
        setError("No project found with this ID");
        return;
      }

      setProjectInfo([data.project]);
    } catch (error) {
      console.error("Fetch Error:", error);
      setError(error.message || "Failed to fetch project info");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProjects = async () => {
    setLoading(true);
    setError(null);
    setProjectInfo([]);

    try {
      const response = await fetch("http://localhost:3001/api/projects");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === "success" && data.projects && data.projects.projects) {
        setProjectInfo(data.projects.projects);
        if (data.projects.projects.length === 0) {
          setError("No projects found");
        }
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error fetching all projects:", error);
      setError(error.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectsByCategory = async (category) => {
    setLoading(true);
    setError(null);
    setProjectInfo([]);

    try {
      console.log(`Fetching projects for category: ${category}`);
      const response = await fetch(`http://localhost:3001/api/projects/category/${encodeURIComponent(category)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch projects (${response.status})`);
      }

      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.status === "success" && Array.isArray(data.projects)) {
        setProjectInfo(data.projects);
        if (data.projects.length === 0) {
          setError(`No projects found for category: ${category}`);
        }
      } else if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch projects");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error fetching projects by category:", error);
      setError(error.message === "The request timed out. Please try again." 
        ? "The connection timed out. Please try again in a few moments." 
        : error.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectsBySubcategory = async (category, subcategory) => {
    setLoading(true);
    setError(null);
    setProjectInfo([]);

    try {
      const response = await fetch(`http://localhost:3001/api/projects/category/${encodeURIComponent(category)}?subcategory=${encodeURIComponent(subcategory)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === "success" && Array.isArray(data.projects)) {
        setProjectInfo(data.projects);
        if (data.projects.length === 0) {
          setError(`No projects found for subcategory: ${subcategory}`);
        }
      } else {
        throw new Error(data.message || "Invalid response format");
      }
    } catch (error) {
      console.error("Error fetching projects by subcategory:", error);
      setError(error.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    setSelectedSubcategory("");
    if (category) {
      fetchProjectsByCategory(category);
    } else {
      setProjectInfo([]);
    }
  };

  const handleSubcategoryChange = (e) => {
    const subcategory = e.target.value;
    setSelectedSubcategory(subcategory);
    
    if (subcategory && selectedCategory) {
      fetchProjectsBySubcategory(selectedCategory, subcategory);
    } else if (!subcategory && selectedCategory) {
      fetchProjectsByCategory(selectedCategory);
    }
  };

  return (
    <div className="App">
      <h1>Project Information</h1>

      <div className="search-container">
        <input
          type="text"
          placeholder="Enter Planning ID"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
        <button onClick={handleSubmit}>Search Project</button>
        <button onClick={fetchAllProjects}>Show All Projects</button>
      </div>

      <div className="filters">
        <select value={selectedCategory} onChange={handleCategoryChange}>
          <option value="">Select Category</option>
          {categories.map((category, index) => (
            <option key={index} value={category}>{category}</option>
          ))}
        </select>

        <select 
          value={selectedSubcategory} 
          onChange={handleSubcategoryChange}
          disabled={!selectedCategory}
        >
          <option value="">Select Subcategory</option>
          {selectedCategory && subcategories[selectedCategory]?.map((subcategory, index) => (
            <option key={index} value={subcategory}>{subcategory}</option>
          ))}
        </select>
      </div>

      {loading && <div className="loading">Loading projects...</div>}
      {error && <div className="error">{error}</div>}

      <div className="projects-container">
        {projectInfo.map((row, index) => (
          <div key={index} className="project-card">
            <h2>{row.planning_title || "Untitled Project"}</h2>
            
            <div className="project-info">
              <p><strong>Planning ID:</strong> {row.planning_id || "Not specified"}</p>
              <p><strong>Category:</strong> {row.planning_category || "Not specified"}</p>
              <p><strong>Subcategory:</strong> {row.planning_subcategory || "Not specified"}</p>
              <p><strong>Type:</strong> {row.planning_type || "Not specified"}</p>
              <p><strong>Funding Type:</strong> {row.planning_funding_type || "Not specified"}</p>
              <p><strong>Stage:</strong> {row.planning_stage || "Not specified"}</p>
              <p><strong>Value:</strong> {row.planning_value ? `€${Number(row.planning_value).toLocaleString()}` : "Not specified"}</p>
              <p><strong>Size:</strong> {row.planning_sizesqmt ? `${row.planning_sizesqmt} sq.mt` : "Not specified"}</p>
              <p><strong>Site Area:</strong> {row.planning_siteha ? `${row.planning_siteha} ha` : "Not specified"}</p>
              
              <p><strong>Location:</strong> {[
                row.planning_development_address_1,
                row.planning_development_address_2,
                row.planning_development_address_3,
                row.planning_development_address_4,
                row.planning_county,
                row.planning_region
              ].filter(Boolean).join(", ") || "Not specified"}</p>
              
              <p><strong>Coordinates:</strong> {row.planning_latitude && row.planning_longitude ? 
                `${row.planning_latitude}, ${row.planning_longitude}` : "Not specified"}</p>

              <p><strong>Important Dates:</strong></p>
              <ul>
                <li>Application: {row.planning_application_date || "Not specified"}</li>
                <li>Decision: {row.planning_decision_date || "Not specified"}</li>
                <li>Start: {row.planning_start_date || row.planning_est_start_date || "Not specified"}</li>
                <li>Est. Completion: {row.planning_est_completion_date || "Not specified"}</li>
              </ul>

              <p><strong>Description:</strong> {row.planning_description || "No description available"}</p>
              
              {row.planning_tags && (
                <p><strong>Tags:</strong> {row.planning_tags.split(',').join(', ')}</p>
              )}
            </div>

            {row.companies && row.companies.length > 0 && (
              <div className="companies-section">
                <h3>Companies Involved</h3>
                {row.companies.map((company, companyIndex) => (
                  <div key={companyIndex} className="company-info">
                    <p><strong>Company Name:</strong> {company.company_name}</p>
                    <p><strong>Role:</strong> {company.planning_company_type_name.company_type_name}</p>
                    {company.company_phone && <p><strong>Phone:</strong> {company.company_phone}</p>}
                    {company.company_email && <p><strong>Email:</strong> {company.company_email}</p>}
                    {company.company_web && <p><strong>Website:</strong> {company.company_web}</p>}
                    {company.company_description && <p><strong>Description:</strong> {company.company_description}</p>}
                    {[company.company_address_1, company.company_address_2, company.company_address_3, company.company_address_4]
                      .filter(Boolean).length > 0 && (
                      <p><strong>Address:</strong> {[
                        company.company_address_1,
                        company.company_address_2,
                        company.company_address_3,
                        company.company_address_4
                      ].filter(Boolean).join(", ")}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;