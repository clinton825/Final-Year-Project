import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import './ProjectComparison.css';

const ProjectComparison = () => {
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('budget');

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
      units: project.planning_units || 0,
      siteArea: parseFloat(project.planning_siteha) || 0,
      buildingSize: parseFloat(project.planning_sizesqmt) || 0
    }));
  };

  const prepareTimelineData = () => {
    return selectedProjects.map(project => ({
      name: project.planning_title,
      applicationDate: project.planning_application_date,
      startDate: project.planning_start_date,
      completionDate: project.planning_est_completion_date
    }));
  };

  const prepareStakeholderData = () => {
    return selectedProjects.map(project => ({
      name: project.planning_title,
      stakeholders: project.companies ? project.companies.length : 0,
      types: project.companies ? [...new Set(project.companies.map(c => c.planning_company_type_name.company_type_name))].length : 0
    }));
  };

  const renderTimeline = () => (
    <div className="chart timeline-chart">
      <h4>
        <span className="icon">📅</span>
        Project Timeline
      </h4>
      <div className="timeline-container">
        {prepareTimelineData().map((project, index) => (
          <div key={index} className="timeline-item">
            <h5>{project.name}</h5>
            <div className="timeline-dates">
              <div>Application: {format(parseISO(project.applicationDate), 'MMM dd, yyyy')}</div>
              {project.startDate && <div>Start: {format(parseISO(project.startDate), 'MMM dd, yyyy')}</div>}
              {project.completionDate && <div>Expected Completion: {format(parseISO(project.completionDate), 'MMM dd, yyyy')}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSizeMetrics = () => (
    <div className="chart">
      <h4>
        <span className="icon">📐</span>
        Size Metrics
      </h4>
      <BarChart width={500} height={300} data={prepareChartData()}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="siteArea" name="Site Area (ha)" fill="#8884d8" />
        <Bar yAxisId="right" dataKey="buildingSize" name="Building Size (sq.mt)" fill="#82ca9d" />
      </BarChart>
    </div>
  );

  const renderStakeholderAnalysis = () => (
    <div className="chart">
      <h4>
        <span className="icon">👥</span>
        Stakeholder Analysis
      </h4>
      <BarChart width={500} height={300} data={prepareStakeholderData()}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="stakeholders" name="Total Stakeholders" fill="#8884d8" />
        <Bar dataKey="types" name="Stakeholder Types" fill="#82ca9d" />
      </BarChart>
    </div>
  );

  if (loading) return <div className="loading">Loading projects...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="comparison-container">
      <h2>
        <span className="icon">⇄</span> 
        Project Comparison
      </h2>
      <p className="subtitle">Compare infrastructure projects across different metrics</p>

      <div className="comparison-content">
        <div className="project-selection">
          <h3>Select Projects to Compare (Max 3)</h3>
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
          <div className="comparison-tabs">
            <button 
              className={activeTab === 'budget' ? 'active' : ''} 
              onClick={() => setActiveTab('budget')}
            >
              Budget
            </button>
            <button 
              className={activeTab === 'timeline' ? 'active' : ''} 
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
            <button 
              className={activeTab === 'size' ? 'active' : ''} 
              onClick={() => setActiveTab('size')}
            >
              Size & Scope
            </button>
            <button 
              className={activeTab === 'stakeholders' ? 'active' : ''} 
              onClick={() => setActiveTab('stakeholders')}
            >
              Stakeholders
            </button>
          </div>
        )}

        {selectedProjects.length > 0 && (
          <div className="charts-container">
            {activeTab === 'budget' && (
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
            )}
            {activeTab === 'timeline' && renderTimeline()}
            {activeTab === 'size' && renderSizeMetrics()}
            {activeTab === 'stakeholders' && renderStakeholderAnalysis()}
          </div>
        )}

        <div className="available-projects">
          <h3>Available Projects</h3>
          <div className="projects-grid">
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
                  <p><span className="icon">📐</span> {project.planning_sizesqmt || 'N/A'} sq.mt</p>
                  <p><span className="icon">📅</span> {format(parseISO(project.planning_application_date), 'MMM yyyy')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectComparison;
