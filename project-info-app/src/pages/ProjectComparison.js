import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import './ProjectComparison.css';

const ProjectComparison = () => {
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setAvailableProjects(data.projects);
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleProjectSelect = (project) => {
    if (selectedProjects.find(p => p.planning_id === project.planning_id)) {
      setSelectedProjects(selectedProjects.filter(p => p.planning_id !== project.planning_id));
    } else if (selectedProjects.length < 3) {
      setSelectedProjects([...selectedProjects, project]);
    }
  };

  const formatValue = (value) => {
    if (!value) return 0;
    return parseFloat(value.replace(/[^0-9.-]+/g, ''));
  };

  const prepareChartData = () => {
    return selectedProjects.map(project => ({
      name: project.planning_title,
      value: formatValue(project.planning_value),
      units: project.planning_units || 0
    }));
  };

  if (loading) return <div className="loading">Loading projects...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="comparison-container">
      <h2>
        <span className="icon">⇄</span> 
        Project Comparison
      </h2>
      <p className="subtitle">Compare housing projects across different metrics</p>

      <div className="comparison-content">
        <div className="project-selection">
          <h3>Comparative Analysis</h3>
          <div className="selected-projects">
            {selectedProjects.map(project => (
              <span key={project.planning_id} className="selected-project">
                {project.planning_title}
                <button 
                  onClick={() => handleProjectSelect(project)}
                  className="remove-btn"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {selectedProjects.length > 0 && (
          <div className="charts-container">
            <div className="chart">
              <h4>
                <span className="icon">💰</span>
                Budget Comparison (Millions)
              </h4>
              <BarChart width={500} height={300} data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </div>

            <div className="chart">
              <h4>
                <span className="icon">🏠</span>
                Housing Units
              </h4>
              <BarChart width={500} height={300} data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="units" fill="#82ca9d" />
              </BarChart>
            </div>
          </div>
        )}

        <div className="available-projects">
          {availableProjects.map(project => (
            <div 
              key={project.planning_id} 
              className={`project-card ${selectedProjects.find(p => p.planning_id === project.planning_id) ? 'selected' : ''}`}
              onClick={() => handleProjectSelect(project)}
            >
              <h3>{project.planning_title}</h3>
              <div className="project-details">
                <p><span className="icon">📍</span> {project.planning_county}</p>
                <p><span className="icon">💶</span> {project.planning_value}</p>
                <p><span className="icon">🏗️</span> {project.planning_units || 'N/A'} Units</p>
                <p><span className="icon">📅</span> {project.planning_timeline || 'Timeline N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectComparison;
