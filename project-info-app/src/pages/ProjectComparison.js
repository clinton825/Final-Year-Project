import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
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
  const [showTownView, setShowTownView] = useState(false);

  // New state for filters
  const [filters, setFilters] = useState({
    projectType: '',
    stakeholderType: '',
    stage: '',
    valueRange: 'all',
    county: '',
    town: '',
    sortBy: 'value'
  });

  // New state for unique filter options
  const [filterOptions, setFilterOptions] = useState({
    projectTypes: [],
    stakeholderTypes: [],
    stages: [],
    counties: ['Waterford', 'Carlow'],
    towns: {
      'Waterford': ['Waterford City', 'Dungarvan', 'Tramore', 'Lismore', 'Ardmore', 'Portlaw', 'Tallow', 'Cappoquin', 'Kilmacthomas'],
      'Carlow': ['Carlow Town', 'Tullow', 'Bagenalstown', 'Borris', 'Hacketstown', 'Tinnahinch']
    },
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
      const counties = [...new Set(availableProjects.map(p => p.planning_county).filter(Boolean))];
      
      // Group towns by county from project data
      const townsFromData = {};
      availableProjects.forEach(project => {
        if (project.planning_county && project.planning_town) {
          if (!townsFromData[project.planning_county]) {
            townsFromData[project.planning_county] = new Set();
          }
          townsFromData[project.planning_county].add(project.planning_town);
        }
      });
      
      // Convert Set to Array for each county
      const townsByCounty = { ...filterOptions.towns }; // Start with hardcoded towns
      Object.keys(townsFromData).forEach(county => {
        if (!townsByCounty[county]) {
          townsByCounty[county] = [...townsFromData[county]].sort();
        } else {
          // Merge with existing towns, avoiding duplicates
          const existingTowns = new Set(townsByCounty[county]);
          townsFromData[county].forEach(town => existingTowns.add(town));
          townsByCounty[county] = [...existingTowns].sort();
        }
      });
      
      // Debug logging
      console.log('Available counties:', counties);
      console.log('Towns by county:', townsByCounty);

      setFilterOptions(prev => ({
        ...prev,
        projectTypes: types,
        stakeholderTypes: stakeholders,
        stages: stages,
        counties: [...new Set([...prev.counties, ...counties])],
        towns: townsByCounty
      }));
    }
  }, [availableProjects]);
  
  // Reset town when county changes
  useEffect(() => {
    if (filters.county === '' || !filterOptions.towns[filters.county]?.includes(filters.town)) {
      setFilters(prev => ({
        ...prev,
        town: ''
      }));
    }
  }, [filters.county, filters.town, filterOptions.towns]);

  useEffect(() => {
    // Apply filters whenever filters state changes or when availableProjects changes
    if (availableProjects.length > 0) {
      const filtered = getFilteredProjects();
      console.log(`Filtered projects: ${filtered.length} of ${availableProjects.length}`);
      // Log filter values for debugging
      console.log('Current filters:', {
        projectType: filters.projectType,
        stakeholderType: filters.stakeholderType,
        stage: filters.stage,
        valueRange: filters.valueRange,
        county: filters.county,
        town: filters.town
      });
    }
  }, [filters, availableProjects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.API_URL}/api/projects`);
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      
      // Preprocess projects to ensure planning_town and planning_county are standardized
      const processedProjects = data.projects.map(project => {
        // Make sure county names are standardized
        if (project.planning_county) {
          project.planning_county = project.planning_county.trim();
        }
        
        // Make sure town names are standardized
        if (project.planning_town) {
          project.planning_town = project.planning_town.trim();
        }
        
        // For projects without town but with county, set default town to match filters
        if (!project.planning_town && project.planning_county) {
          const countyTowns = filterOptions.towns[project.planning_county];
          if (countyTowns && countyTowns.length > 0) {
            // Check if address contains any town name
            const address = `${project.planning_development_address_1 || ''} ${project.planning_development_address_2 || ''}`.toLowerCase();
            const matchingTown = countyTowns.find(town => address.includes(town.toLowerCase()));
            if (matchingTown) {
              project.planning_town = matchingTown;
            }
          }
        }
        
        return project;
      });
      
      setAvailableProjects(processedProjects);
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
      const countyMatch = !filters.county || project.planning_county === filters.county;
      const townMatch = !filters.town || project.planning_town === filters.town;
      
      // Debug logging for town filtering
      if (filters.town && project.planning_county === filters.county) {
        console.log(`Project town: "${project.planning_town}", Selected town: "${filters.town}", Match: ${project.planning_town === filters.town}`);
      }
      
      return typeMatch && stageMatch && stakeholderMatch && valueMatch && countyMatch && townMatch;
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
    // Preprocess the project to ensure town and county data is standardized
    const processedProject = { ...project };
    
    // Standardize county
    if (processedProject.planning_county) {
      processedProject.planning_county = processedProject.planning_county.trim();
    }
    
    // Standardize town
    if (processedProject.planning_town) {
      processedProject.planning_town = processedProject.planning_town.trim();
    }
    
    // Check if the project is already selected
    if (selectedProjects.find(p => p.planning_id === processedProject.planning_id)) {
      // Remove project from selection
      setSelectedProjects(prev => prev.filter(p => p.planning_id !== processedProject.planning_id));
      
      // If all projects are unselected, set showAllProjects to true
      if (selectedProjects.length === 1) {
        setShowAllProjects(true);
      }
    } else {
      // Add project to selection (limited to 3 projects)
      if (selectedProjects.length < 3) {
        setSelectedProjects(prev => [...prev, processedProject]);
        setShowAllProjects(false);
      } else {
        // Could show an alert or toast here that max is reached
        console.log('Maximum of 3 projects can be selected for comparison');
      }
    }
    
    console.log('Selected projects after update:', selectedProjects.length);
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

  const prepareCountyComparisonData = () => {
    if (selectedProjects.length === 0) return [];
    
    const countyData = {};
    
    // Group projects by county
    selectedProjects.forEach(project => {
      // Apply standard preprocessing to ensure consistency
      const county = project.planning_county ? project.planning_county.trim() : 'Unknown';
      
      if (!countyData[county]) {
        countyData[county] = {
          county,
          projectCount: 0,
          totalValue: 0,
          averageValue: 0,
          projects: []
        };
      }
      
      // Parse value properly, handling potential non-numeric values
      let value = 0;
      if (project.planning_value) {
        // Remove currency symbols and commas, then parse
        const cleanValue = project.planning_value.toString().replace(/[€,$,£,\s,]/g, '');
        value = parseFloat(cleanValue) || 0;
      }
      
      countyData[county].projectCount += 1;
      countyData[county].totalValue += value;
      countyData[county].projects.push(project);
      
      // Debug log to see actual values being calculated
      console.log(`Project in ${county}: Value ${value} from original ${project.planning_value}`);
    });
    
    console.log('County data before calculations:', countyData);
    
    // Calculate averages and format data
    return Object.values(countyData).map(item => {
      // Avoid division by zero
      const avgValue = item.projectCount > 0 ? item.totalValue / item.projectCount : 0;
      
      return {
        ...item,
        totalValue: item.totalValue / 1000000, // Convert to millions
        averageValue: avgValue / 1000000 // Convert to millions
      };
    });
  };
  
  const prepareTownComparisonData = () => {
    if (selectedProjects.length === 0) return [];
    
    const townData = {};
    
    // Group projects by town within counties
    selectedProjects.forEach(project => {
      if (!project.planning_town) return;
      
      const town = project.planning_town.trim();
      const county = project.planning_county ? project.planning_county.trim() : 'Unknown';
      const key = `${town} (${county})`;
      
      if (!townData[key]) {
        townData[key] = {
          town,
          county,
          fullName: key,
          projectCount: 0,
          totalValue: 0,
          averageValue: 0,
          projects: []
        };
      }
      
      // Parse value properly, handling potential non-numeric values
      let value = 0;
      if (project.planning_value) {
        // Remove currency symbols and commas, then parse
        const cleanValue = project.planning_value.toString().replace(/[€,$,£,\s,]/g, '');
        value = parseFloat(cleanValue) || 0;
      }
      
      townData[key].projectCount += 1;
      townData[key].totalValue += value;
      townData[key].projects.push(project);
    });
    
    // Calculate averages and format data
    return Object.values(townData).map(item => {
      // Avoid division by zero
      const avgValue = item.projectCount > 0 ? item.totalValue / item.projectCount : 0;
      
      return {
        ...item,
        totalValue: item.totalValue / 1000000, // Convert to millions
        averageValue: avgValue / 1000000 // Convert to millions
      };
    });
  };

  const COUNTY_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F'];
  const TOWN_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

  const renderTimeline = () => (
    <div className="chart">
      <h4>
        <span className="icon">📅</span>
        Project Timeline Comparison
      </h4>
      <div className="timeline-section">
        <div className="timeline-container">
          {selectedProjects.map(project => (
            <div key={project.planning_id} className="timeline-item">
              <h5>{project.planning_title}</h5>
              <div className="timeline-dates">
                <p><strong>Application:</strong> {project.planning_application_date ? format(parseISO(project.planning_application_date), 'MMM dd, yyyy') : 'N/A'}</p>
                <p><strong>Start:</strong> {project.planning_start_date ? format(parseISO(project.planning_start_date), 'MMM dd, yyyy') : 'N/A'}</p>
                <p><strong>Expected Completion:</strong> {project.planning_completion_date ? format(parseISO(project.planning_completion_date), 'MMM dd, yyyy') : 'N/A'}</p>
                {project.planning_actual_completion_date && (
                  <p><strong>Actual Completion:</strong> {format(parseISO(project.planning_actual_completion_date), 'MMM dd, yyyy')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
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

  const renderCountyComparison = () => {
    const countyData = prepareCountyComparisonData();
    const townData = prepareTownComparisonData();
    
    console.log('County data for visualization:', countyData);
    console.log('Town data for visualization:', townData);
    
    if (selectedProjects.length === 0) {
      return (
        <div className="empty-chart">
          <p>Select projects to compare county metrics</p>
        </div>
      );
    }
    
    if (countyData.length === 0) {
      return (
        <div className="empty-chart">
          <p>Selected projects don't have county information</p>
        </div>
      );
    }
    
    const pieData = countyData.map(item => ({
      name: item.county,
      value: item.totalValue
    }));
    
    return (
      <div className="county-comparison">
        <div className="comparison-tabs">
          <button 
            className={`comparison-tab ${showTownView ? '' : 'active'}`}
            onClick={() => setShowTownView(false)}
          >
            County View
          </button>
          <button 
            className={`comparison-tab ${showTownView ? 'active' : ''}`}
            onClick={() => setShowTownView(true)}
          >
            Town View
          </button>
        </div>
        
        {!showTownView ? (
          // County View
          <>
            <div className="chart-row">
              <div className="chart-col">
                <h4>
                  <span className="icon">📊</span>
                  Project Value by County (Millions €)
                </h4>
                <BarChart width={500} height={300} data={countyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="county" />
                  <YAxis />
                  <Tooltip formatter={(value) => `€${value.toFixed(2)}M`} />
                  <Bar dataKey="totalValue" fill="#8884d8" name="Total Value (€M)" />
                </BarChart>
              </div>
              
              <div className="chart-col">
                <h4>
                  <span className="icon">🥧</span>
                  Value Distribution
                </h4>
                <PieChart width={300} height={300}>
                  <Pie
                    data={pieData}
                    cx={150}
                    cy={150}
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COUNTY_COLORS[index % COUNTY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `€${value.toFixed(2)}M`} />
                </PieChart>
              </div>
            </div>
            
            <div className="county-metrics">
              <h4>County Project Metrics</h4>
              <div className="metrics-grid">
                {countyData.map((county, index) => (
                  <div key={index} className="county-metric-card" style={{borderLeftColor: COUNTY_COLORS[index % COUNTY_COLORS.length]}}>
                    <h5>{county.county}</h5>
                    <div className="metric-row">
                      <div className="metric">
                        <span className="metric-label">Projects</span>
                        <span className="metric-value">{county.projectCount}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Total Value</span>
                        <span className="metric-value">€{county.totalValue.toFixed(2)}M</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Avg. Value</span>
                        <span className="metric-value">€{county.averageValue.toFixed(2)}M</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          // Town View
          <>
            <div className="chart-row">
              <div className="chart-col">
                <h4>
                  <span className="icon">🏙️</span>
                  Project Value by Town (Millions €)
                </h4>
                {townData.length > 0 ? (
                  <BarChart width={500} height={300} data={townData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fullName" tick={{fontSize: 10}} />
                    <YAxis />
                    <Tooltip formatter={(value) => `€${value.toFixed(2)}M`} />
                    <Bar dataKey="totalValue" fill="#82ca9d" name="Total Value (€M)" />
                  </BarChart>
                ) : (
                  <div className="empty-chart-message">
                    <p>No town data available for the selected projects</p>
                  </div>
                )}
              </div>
              
              <div className="chart-col">
                <h4>
                  <span className="icon">📈</span>
                  Projects per Town
                </h4>
                {townData.length > 0 ? (
                  <BarChart width={500} height={300} data={townData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fullName" tick={{fontSize: 10}} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="projectCount" fill="#ffc658" name="Number of Projects" />
                  </BarChart>
                ) : (
                  <div className="empty-chart-message">
                    <p>No town data available for the selected projects</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="town-metrics">
              <h4>Town Project Metrics</h4>
              {townData.length > 0 ? (
                <div className="metrics-grid">
                  {townData.map((town, index) => (
                    <div key={index} className="town-metric-card" style={{borderLeftColor: TOWN_COLORS[index % TOWN_COLORS.length]}}>
                      <h5>{town.fullName}</h5>
                      <div className="metric-row">
                        <div className="metric">
                          <span className="metric-label">Projects</span>
                          <span className="metric-value">{town.projectCount}</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Total Value</span>
                          <span className="metric-value">€{town.totalValue.toFixed(2)}M</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Avg. Value</span>
                          <span className="metric-value">€{town.averageValue.toFixed(2)}M</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-metrics-message">
                  <p>Select projects with town data to view town metrics</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderFilters = () => (
    <div className="filters-container">
      <h3>Filter Projects</h3>
      <div className="filter-row">
        <div className="filter-group">
          <label>Project Type</label>
          <select 
            value={filters.projectType}
            onChange={(e) => handleFilterChange('projectType', e.target.value)}
          >
            <option value="">All Types</option>
            {filterOptions.projectTypes.map((type, index) => (
              <option key={index} value={type}>{type}</option>
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
            {filterOptions.stages.map((stage, index) => (
              <option key={index} value={stage}>{stage}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>County</label>
          <select 
            value={filters.county}
            onChange={(e) => handleFilterChange('county', e.target.value)}
            className="county-filter"
          >
            <option value="">All Counties</option>
            {filterOptions.counties.map((county, index) => (
              <option key={index} value={county}>{county}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Town</label>
          <select 
            value={filters.town}
            onChange={(e) => handleFilterChange('town', e.target.value)}
            className="town-filter"
            disabled={!filters.county}
          >
            <option value="">All Towns</option>
            {filters.county && filterOptions.towns[filters.county]?.map((town, index) => (
              <option key={index} value={town}>{town}</option>
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
            {filterOptions.stakeholderTypes.map((type, index) => (
              <option key={index} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Value Range</label>
          <select 
            value={filters.valueRange}
            onChange={(e) => handleFilterChange('valueRange', e.target.value)}
          >
            {filterOptions.valueRanges.map((range, index) => (
              <option key={index} value={range.value}>{range.label}</option>
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
                      {project.planning_county && (
                        <span className="county-badge">County: {project.planning_county}</span>
                      )}
                      {project.planning_town && (
                        <span className="town-badge">Town: {project.planning_town}</span>
                      )}
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
                  {project.planning_county && (
                    <span className="county-badge">County: {project.planning_county}</span>
                  )}
                  {project.planning_town && (
                    <span className="town-badge">Town: {project.planning_town}</span>
                  )}
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
              <button 
                className={`tab ${activeTab === 'county' ? 'active' : ''}`}
                onClick={() => setActiveTab('county')}
              >
                County Analysis
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
              {activeTab === 'county' && renderCountyComparison()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectComparison;
