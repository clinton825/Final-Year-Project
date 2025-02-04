import React, { useState } from "react";

function App() {
  const [projectId, setProjectId] = useState("");
  const [projectInfo, setProjectInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProjectInfo(null);

    try {
      const response = await fetch(`http://localhost:3001/api/project/${projectId}`);
      const data = await response.json();
      console.log("API Response:", data);

      if (data.status !== "success") {
        throw new Error(data.message || "No project details available");
      }

      setProjectInfo(data.project.data.rows);
    } catch (error) {
      console.error("Fetch Error:", error);
      setError(error.message || "Failed to fetch project info");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App" style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
      <h1>Project Information Finder</h1>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter Planning ID"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
          style={{ marginRight: "10px", padding: "5px", width: "250px" }}
        />
        <button type="submit" style={{ padding: "5px 10px" }}>Search Project</button>
      </form>

      {loading && <p>Loading project details...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {projectInfo && projectInfo.length > 0 && projectInfo.map((row, index) => (
        <div 
          key={index} 
          style={{ 
            border: "1px solid #ddd", 
            borderRadius: "5px", 
            padding: "15px", 
            marginTop: "20px" 
          }}
        >
          <h2>{row.planning_title || "N/A"}</h2>
          <p><strong>Category:</strong> {row.planning_category || "N/A"}</p>
          <p><strong>Stage:</strong> {row.planning_stage || "N/A"}</p>
          <p><strong>Value:</strong> €{row.planning_value ? Number(row.planning_value).toLocaleString() : "N/A"}</p>
          <p><strong>Location:</strong> {row.planning_county || "N/A"}, {row.planning_region || "N/A"}</p>
          <p><strong>Description:</strong> {row.planning_description || "No description available"}</p>
          
          {row.planning_url && (
            <p>
              <strong>More Details:</strong> <a href={row.planning_url} target="_blank" rel="noopener noreferrer">Click here</a>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default App;