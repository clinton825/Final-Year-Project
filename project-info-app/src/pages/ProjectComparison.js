import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import './ProjectComparison.css';
import config from '../config';

const ProjectComparison = () => {
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('budget');
  const [showAllProjects, setShowAllProjects] = useState(true);

  // New state for filters
  const [filters, setFilters] = useState({
    projectType: '',
    stakeholderType: '',
    stage: '',
    valueRange: 'all',
    sortBy: 'value'
  });

  // New state for unique filter options
  const [filterOptions, setFilterOptions] = useState({
    projectTypes: [],
    stakeholderTypes: [],
    stages: [],
    valueRanges: [
      { label: 'All', value: 'all' },
      { label: 'Under €1M', value: 'under1m' },
      { label: '€1M - €5M', value: '1m-5m' },
      { label: '€5M - €10M', value: '5m-10m' },
      { label: 'Over €10M', value: 'over10m' }
    ]
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    // Extract unique filter options from available projects
    if (availableProjects.length > 0) {
      const types = [...new Set(availableProjects.map(p => p.planning_type))];
      const stages = [...new Set(availableProjects.map(p => p.planning_stage))];
      const stakeholders = [...new Set(availableProjects.flatMap(p => 
        p.companies?.map(c => c.planning_company_type_name.company_type_name) || []
      ))];

      setFilterOptions(prev => ({
        ...prev,
        projectTypes: types,
        stakeholderTypes: stakeholders,
        stages: stages
      }));
    }
  }, [availableProjects]);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${config.API_URL}/api/projects`);
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

  const getValueRange = (value) => {
    const numValue = parseFloat(value);
    if (numValue < 1000000) return 'under1m';
    if (numValue <= 5000000) return '1m-5m';
    if (numValue <= 10000000) return '5m-10m';
    return 'over10m';
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const getFilteredProjects = () => {
    return availableProjects.filter(project => {
      const typeMatch = !filters.projectType || project.planning_type === filters.projectType;
      const stageMatch = !filters.stage || project.planning_stage === filters.stage;
      const stakeholderMatch = !filters.stakeholderType || 
        project.companies?.some(c => c.planning_company_type_name.company_type_name === filters.stakeholderType);
      const valueMatch = filters.valueRange === 'all' || getValueRange(project.planning_value) === filters.valueRange;
      
      return typeMatch && stageMatch && stakeholderMatch && valueMatch;
    }).sort((a, b) => {
      switch (filters.sortBy) {
        case 'value':
          return (parseFloat(b.planning_value) || 0) - (parseFloat(a.planning_value) || 0);
        case 'size':
          return (parseFloat(b.planning_sizesqmt) || 0) - (parseFloat(a.planning_sizesqmt) || 0);
        case 'date':
          return new Date(b.planning_application_date) - new Date(a.planning_application_date);
        case 'stage':
          return a.planning_stage.localeCompare(b.planning_stage);
        default:
          return 0;
      }
    });
  };

  const handleProjectSelect = (project) => {
    if (selectedProjects.find(p => p.planning_id === project.planning_id)) {
      const updatedProjects = selectedProjects.filter(p => p.planning_id !== project.planning_id);
      setSelectedProjects(updatedProjects);
      // Show all projects again if none are selected
      if (updatedProjects.length === 0) {
        setShowAllProjects(true);
      }
    } else if (selectedProjects.length < 3) {
      setSelectedProjects([...selectedProjects, project]);
      // Hide unselected projects when we start comparing
      setShowAllProjects(false);
    }
  };

  const handleResetComparison = () => {
    setSelectedProjects([]);
    setShowAllProjects(true);
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

  const renderFilters = () => (
    <div className="filters-section">
      <h3>Filters and Sorting</h3>
      <div className="filters-grid">
        <div className="filter-group">
          <label>Project Type</label>
          <select 
            value={filters.projectType}
            onChange={(e) => handleFilterChange('projectType', e.target.value)}
          >
            <option value="">All Types</option>
            {filterOptions.projectTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Project Stage</label>
          <select 
            value={filters.stage}
            onChange={(e) => handleFilterChange('stage', e.target.value)}
          >
            <option value="">All Stages</option>
            {filterOptions.stages.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Value Range</label>
          <select 
            value={filters.valueRange}
            onChange={(e) => handleFilterChange('valueRange', e.target.value)}
          >
            {filterOptions.valueRanges.map(range => (
              <option key={range.value} value={range.value}>{range.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Stakeholder Type</label>
          <select 
            value={filters.stakeholderType}
            onChange={(e) => handleFilterChange('stakeholderType', e.target.value)}
          >
            <option value="">All Stakeholders</option>
            {filterOptions.stakeholderTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Sort By</label>
          <select 
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
          >
            <option value="value">Project Value</option>
            <option value="size">Project Size</option>
            <option value="date">Application Date</option>
            <option value="stage">Project Stage</option>
          </select>
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="loading">Loading projects...</div>;
  if (error) return <div className="error">{error}</div>;

  const filteredProjects = getFilteredProjects();

  return (
    <div className="comparison-container">
      <h2>
        <span className="icon">⇄</span> 
        Project Comparison
      </h2>
      <p className="subtitle">Compare infrastructure projects across different metrics</p>

      {showAllProjects ? (
        <>
          {renderFilters()}
          <div className="comparison-content">
            <div className="project-selection">
              <h3>Select Projects to Compare (Max 3)</h3>
              <div className="project-list">
                {filteredProjects.map(project => (
                  <div 
                    key={project.planning_id} 
                    className={`project-item ${selectedProjects.find(p => p.planning_id === project.planning_id) ? 'selected' : ''}`}
                    onClick={() => handleProjectSelect(project)}
                  >
                    <h4>{project.planning_title}</h4>
                    <div className="project-meta">
                      <span>Type: {project.planning_type}</span>
                      <span>Value: €{formatValue(project.planning_value).toLocaleString()}</span>
                      <span>Stage: {project.planning_stage}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="comparison-content">
          <div className="selected-projects-header">
            <h3>Selected Projects</h3>
            <button 
              className="reset-button"
              onClick={handleResetComparison}
            >
              Reset Comparison
            </button>
          </div>
          <div className="selected-projects-grid">
            {selectedProjects.map(project => (
              <div 
                key={project.planning_id} 
                className="selected-project-card"
              >
                <div className="card-header">
                  <h4>{project.planning_title}</h4>
                  <button 
                    className="remove-button"
                    onClick={() => handleProjectSelect(project)}
                  >
                    ×
                  </button>
                </div>
                <div className="project-meta">
                  <span>Type: {project.planning_type}</span>
                  <span>Value: €{formatValue(project.planning_value).toLocaleString()}</span>
                  <span>Stage: {project.planning_stage}</span>
                </div>
              </div>
            ))}
            {selectedProjects.length < 3 && (
              <div 
                className="add-project-card"
                onClick={() => setShowAllProjects(true)}
              >
                <div className="add-icon">+</div>
                <p>Add Another Project</p>
              </div>
            )}
          </div>

          <div className="comparison-charts">
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'budget' ? 'active' : ''}`}
                onClick={() => setActiveTab('budget')}
              >
                Budget Analysis
              </button>
              <button 
                className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                Timeline
              </button>
              <button 
                className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
                onClick={() => setActiveTab('metrics')}
              >
                Size Metrics
              </button>
              <button 
                className={`tab ${activeTab === 'stakeholders' ? 'active' : ''}`}
                onClick={() => setActiveTab('stakeholders')}
              >
                Stakeholders
              </button>
            </div>

            <div className="chart-container">
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
              {activeTab === 'metrics' && renderSizeMetrics()}
              {activeTab === 'stakeholders' && renderStakeholderAnalysis()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectComparison;
