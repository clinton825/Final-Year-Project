import React, { useState, useEffect } from "react";

function App() {
  const [projectId, setProjectId] = useState("");
  const [projectInfo, setProjectInfo] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  // Fetch categories when component mounts
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/categories");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setError("Failed to load categories");
    }
  };

  const fetchProjectsByCategory = async (category) => {
    setLoading(true);
    setError(null);
    setProjectInfo([]);

    try {
      const response = await fetch(`http://localhost:3001/api/projects/category/${encodeURIComponent(category)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.status === "error") {
        throw new Error(data.message);
      }

      setProjectInfo(data.data || []);
    } catch (error) {
      console.error("Error fetching projects by category:", error);
      setError(error.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = async (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    setLoading(true);
    setError(null);
    setProjectInfo([]);

    if (!category) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/projects/category/${encodeURIComponent(category)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Category API Response:", data);

      if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch projects");
      }

      // Use the same data structure handling as fetchAllProjects
      const projects = data.data?.[0]?.data || [];
      
      if (projects.length === 0) {
        setError(`No projects found for category: ${category}`);
        return;
      }

      setProjectInfo(projects);
    } catch (error) {
      console.error("Category Fetch Error:", error);
      setError(error.message || "Failed to fetch projects for this category");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProjectInfo([]);

    try {
      console.log('Fetching project with ID:', projectId);
      const response = await fetch(`http://localhost:3001/api/project/${projectId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("API Response for project search:", data);

      if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch project");
      }

      const projectData = data.project || data;
      console.log("Processed project data:", projectData);
      
      if (!projectData) {
        setError("No project found with this ID");
        return;
      }

      setProjectInfo([projectData]);
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
      console.log('Fetching all projects');
      const response = await fetch("http://localhost:3001/api/projects");
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Full API Response:", data);

      if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch projects");
      }

      // Fix: Handle the nested data structure correctly
      const projects = data.data?.[0]?.data || [];
      console.log("Processed projects data:", projects);
      
      if (projects.length === 0) {
        setError("No projects found");
        return;
      }
      
      setProjectInfo(projects);
    } catch (error) {
      console.error("Fetch Error:", error);
      setError(error.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App" style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
      <h1>Project Information Finder</h1>
      
      <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="text"
            placeholder="Enter Planning ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ padding: "5px", width: "250px" }}
          />
          <button onClick={handleSubmit} style={{ padding: "5px 10px" }}>Search Project</button>
          <button onClick={fetchAllProjects} style={{ padding: "5px 10px" }}>Show All Projects</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select 
            value={selectedCategory}
            onChange={handleCategoryChange}
            style={{ padding: "5px", width: "250px" }}
          >
            <option value="">Select Category</option>
            {categories.map((category, index) => (
              <option key={index} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p>Loading project details...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {Array.isArray(projectInfo) && projectInfo.length > 0 ? (
        projectInfo.map((row, index) => (
          <div key={index} style={{ border: "1px solid #ddd", borderRadius: "5px", padding: "15px", marginTop: "20px" }}>
            <h2>{row.planning_title || "Untitled Project"}</h2>
            <p><strong>Planning ID:</strong> {row.planning_id || "Not specified"}</p>
            <p><strong>Category:</strong> {row.planning_category || "Not specified"}</p>
            <p><strong>Stage:</strong> {row.planning_stage || "Not specified"}</p>
            <p><strong>Value:</strong> {row.planning_value ? `€${Number(row.planning_value).toLocaleString()}` : "Not specified"}</p>
            <p><strong>Location:</strong> {
              [row.planning_county, row.planning_region]
                .filter(Boolean)
                .join(", ") || "Not specified"
            }</p>
            <p><strong>Description:</strong> {row.planning_description || "No description available"}</p>
          </div>
        ))
      ) : (
        !loading && !error && <p>No project data available. Try searching for a project or selecting a category.</p>
      )}
    </div>
  );
}

export default App;