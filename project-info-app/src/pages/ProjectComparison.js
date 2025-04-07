import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Pie as ChartJsPie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartJsTooltip, Legend as ChartJsLegend } from 'chart.js';
import config from '../config';

// Register Chart.js components
ChartJS.register(ArcElement, ChartJsTooltip, ChartJsLegend);

// Define critical inline styles to ensure baseline styling
const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  heading: {
    fontSize: '1.8rem',
    marginBottom: '8px',
    color: '#333',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#666',
    marginBottom: '25px',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '25px',
    border: '1px solid #e0e0e0',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
  },
  filterHeading: {
    fontSize: '1.2rem',
    marginTop: 0,
    marginBottom: '15px',
    fontWeight: 600,
    color: '#333',
    display: 'flex',
    alignItems: 'center',
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '15px',
    marginBottom: '10px',
  },
  filterGroup: {
    marginBottom: '15px',
  },
  filterLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: '#666',
  },
  filterSelect: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    fontSize: '0.9rem',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e0e0e0',
  },
  selectedProjectCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e0e0e0',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  addCard: {
    backgroundColor: '#f8f9fa',
    border: '2px dashed #e0e0e0',
    borderRadius: '10px',
    padding: '25px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.2s, border-color 0.2s',
    minHeight: '150px',
    maxWidth: '300px',
  },
  addIcon: {
    fontSize: '2rem',
    color: '#666',
    marginBottom: '10px',
    width: '50px',
    height: '50px',
    backgroundColor: '#f0f2f5',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    display: 'flex',
    gap: '2px',
    overflowX: 'auto',
    paddingBottom: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid #e0e0e0',
  },
  tab: {
    padding: '10px 16px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
    color: '#666',
    borderRadius: '6px 6px 0 0',
    fontSize: '0.9rem',
    cursor: 'pointer',
    marginBottom: '-1px',
  },
  activeTab: {
    backgroundColor: '#4e73df',
    color: 'white',
    borderColor: '#4e73df',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e0e0e0',
    width: '100%',
    height: 'auto',
    minHeight: '400px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '25px',
    boxShadow: '0 5px 20px rgba(0, 0, 0, 0.3)',
    border: '1px solid #e0e0e0',
  }
};

// Add these styling objects for specific components
const countyStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
    overflow: 'visible',
    height: 'auto',
    width: '100%',
  },
  chartRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '25px',
    marginBottom: '30px',
    height: 'auto',
    minHeight: '350px',
    width: '100%',
  },
  chartCol: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e0e0e0',
    height: 'auto',
    minHeight: '350px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    marginTop: 0,
    marginBottom: '15px',
    fontSize: '1.1rem',
    color: '#333',
    width: '100%',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '10px',
    display: 'flex',
    alignItems: 'center',
  },
  metricsContainer: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e0e0e0',
    marginTop: '20px',
    width: '100%',
  },
  metricsHeader: {
    marginTop: 0,
    marginBottom: '15px',
    fontSize: '1.1rem',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '10px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '15px',
    marginTop: '10px',
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    borderLeft: '4px solid #8884d8',
    border: '1px solid #e0e0e0',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  metricCardHeading: {
    marginTop: 0,
    marginBottom: '10px',
    fontSize: '1rem',
    color: '#333',
  },
  metricRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: '0.8rem',
    color: '#666',
  },
  metricValue: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#333',
  },
  emptyChart: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '300px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    textAlign: 'center',
    padding: '20px',
    border: '1px solid #e0e0e0',
    color: '#666',
  }
};

const timelineStyles = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e0e0e0',
    width: '100%',
    height: 'auto',
    minHeight: '400px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    flexWrap: 'wrap',
    gap: '15px',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '10px',
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
  },
  legend: {
    display: 'flex',
    gap: '15px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.85rem',
    color: '#666',
  },
  legendDot: (color) => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginRight: '5px',
    backgroundColor: color,
  }),
  legendLine: {
    width: '20px',
    height: '3px',
    marginRight: '5px',
    backgroundColor: '#4e73df',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    overflow: 'visible',
    paddingRight: '10px',
    height: 'auto',
    minHeight: '400px',
  },
  projectTimeline: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e0e0e0',
    marginBottom: '20px',
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '200px 1fr 200px',
    gap: '15px',
    alignItems: 'center',
    height: 'auto',
    minHeight: '150px',
  },
  projectInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  projectTitle: {
    margin: '0 0 8px 0',
    fontSize: '1rem',
    color: '#333',
    fontWeight: 600,
  },
  projectMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '0.85rem',
    color: '#666',
  },
  timelineTrack: {
    position: 'relative',
    padding: '10px 0',
    width: '100%',
  },
  timelineLine: {
    position: 'relative',
    height: '6px',
    backgroundColor: '#f0f2f5',
    borderRadius: '3px',
    width: '100%',
  },
  timelineMarker: (color) => ({
    position: 'absolute',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: color,
    transform: 'translateX(-50%) translateY(-3px)',
    zIndex: 2,
  }),
  durationLine: {
    position: 'absolute',
    height: '6px',
    backgroundColor: '#4e73df',
    borderRadius: '3px',
    top: '0',
  },
  metrics: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: '0.8rem',
    color: '#666',
  },
  metricValue: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#333',
  },
  emptyTimeline: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '300px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    textAlign: 'center',
    padding: '20px',
    border: '1px solid #e0e0e0',
    color: '#666',
  }
};

// Add these console logs to help debug
console.log('ProjectComparison component loaded');
console.log('CSS file should be imported');

const ProjectComparison = () => {
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('budget');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showTownView, setShowTownView] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

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
    
    // If this is the first filter being applied, set filtersApplied to true
    if (!filtersApplied && value !== '' && filterType !== 'sortBy') {
      setFiltersApplied(true);
    }
    
    // If all filters are cleared, set filtersApplied back to false
    if (filterType !== 'sortBy' && value === '') {
      const updatedFilters = {
        ...filters,
        [filterType]: value
      };
      
      const anyFilterApplied = 
        updatedFilters.projectType !== '' || 
        updatedFilters.stakeholderType !== '' || 
        updatedFilters.stage !== '' || 
        updatedFilters.valueRange !== 'all' || 
        updatedFilters.county !== '' || 
        updatedFilters.town !== '';
      
      setFiltersApplied(anyFilterApplied);
    }
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
    return selectedProjects.map(project => {
      // Parse dates
      const applicationDate = project.planning_application_date ? new Date(project.planning_application_date) : null;
      const decisionDate = project.planning_decision_date ? new Date(project.planning_decision_date) : null;
      
      // Calculate duration in days if both dates exist
      let durationDays = 0;
      if (applicationDate && decisionDate) {
        durationDays = Math.round((decisionDate - applicationDate) / (1000 * 60 * 60 * 24));
      }
      
      return {
        id: project.planning_id,
        title: project.planning_title || 'Unnamed Project',
        type: project.planning_type || 'Unknown Type',
        stage: project.planning_stage || 'Unknown Stage',
        county: project.planning_county || 'Unknown Location',
        town: project.planning_town || '',
        applicationDate,
        decisionDate,
        durationDays,
        startTimestamp: applicationDate ? applicationDate.getTime() : 0,
        endTimestamp: decisionDate ? decisionDate.getTime() : 0
      };
    }).filter(project => project.applicationDate); // Filter out projects without timeline data
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

  const renderTimeline = () => {
    const timelineData = prepareTimelineData();
    
    if (timelineData.length === 0) {
      return (
        <div style={timelineStyles.emptyTimeline} className="project-comparison-timeline-empty">
          <p>Selected projects don't have timeline information</p>
        </div>
      );
    }
    
    // Find the earliest and latest dates across all projects
    const allDates = timelineData.reduce((acc, project) => {
      if (project.applicationDate) acc.push(project.applicationDate);
      if (project.decisionDate) acc.push(project.decisionDate);
      return acc;
    }, []);
    
    const earliestDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
    const latestDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
    
    // Add 10% padding on each side
    const totalTimespan = latestDate - earliestDate;
    const paddedEarliest = new Date(earliestDate.getTime() - totalTimespan * 0.1);
    const paddedLatest = new Date(latestDate.getTime() + totalTimespan * 0.1);
    
    // Calculate total timespan for scaling
    const totalDays = Math.ceil((paddedLatest - paddedEarliest) / (1000 * 60 * 60 * 24));
    
    return (
      <div style={timelineStyles.container} className="project-comparison-timeline">
        <div style={timelineStyles.header} className="project-comparison-timeline-header">
          <h4 style={timelineStyles.title} className="project-comparison-timeline-title">
            <span style={{marginRight: '8px'}}>📅</span>
            Project Timelines Comparison
          </h4>
          <div style={timelineStyles.legend} className="project-comparison-timeline-legend">
            <div style={timelineStyles.legendItem} className="project-comparison-legend-item">
              <div style={timelineStyles.legendDot('#4e73df')}></div>
              <span>Application Date</span>
            </div>
            <div style={timelineStyles.legendItem} className="project-comparison-legend-item">
              <div style={timelineStyles.legendDot('#1cc88a')}></div>
              <span>Decision Date</span>
            </div>
            <div style={timelineStyles.legendItem} className="project-comparison-legend-item">
              <div style={timelineStyles.legendLine}></div>
              <span>Processing Duration</span>
            </div>
          </div>
        </div>
        
        <div style={timelineStyles.grid}>
          {/* Timeline scale */}
          <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 0'}}>
            {Array.from({ length: 5 }).map((_, i) => {
              const date = new Date(paddedEarliest.getTime() + (totalTimespan * i / 4));
              return (
                <div key={i} style={{flex: 1, display: 'flex', justifyContent: 'center'}}>
                  <span style={{fontSize: '0.8rem', color: '#666'}}>{format(date, 'MMM yyyy')}</span>
                </div>
              );
            })}
          </div>
          
          {/* Individual project timelines */}
          {timelineData.map((project, index) => (
            <div key={project.id} style={timelineStyles.projectTimeline}>
              <div style={timelineStyles.projectInfo}>
                <h5 style={timelineStyles.projectTitle}>{project.title}</h5>
                <div style={timelineStyles.projectMeta}>
                  <span>{project.type}</span>
                  <span className="county-badge">{project.county}</span>
                  {project.town && <span className="town-badge">{project.town}</span>}
                </div>
              </div>
              
              <div style={timelineStyles.timelineTrack}>
                <div style={timelineStyles.timelineLine}>
                  {/* Application date marker */}
                  <div 
                    style={{
                      ...timelineStyles.timelineMarker('#4e73df'),
                      left: `${((project.applicationDate - paddedEarliest) / (paddedLatest - paddedEarliest)) * 100}%`
                    }}
                    title={`Application: ${project.applicationDate ? format(project.applicationDate, 'dd MMM yyyy') : 'Unknown'}`}
                  >
                    <div style={{
                      position: 'absolute',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      color: '#666',
                      top: '-25px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#fff',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      border: '1px solid #e0e0e0',
                    }}>
                      {project.applicationDate ? format(project.applicationDate, 'dd MMM yyyy') : ''}
                    </div>
                  </div>
                  
                  {/* Decision date marker */}
                  {project.decisionDate && (
                    <div 
                      style={{
                        ...timelineStyles.timelineMarker('#1cc88a'),
                        left: `${((project.decisionDate - paddedEarliest) / (paddedLatest - paddedEarliest)) * 100}%`
                      }}
                      title={`Decision: ${format(project.decisionDate, 'dd MMM yyyy')}`}
                    >
                      <div style={{
                        position: 'absolute',
                        fontSize: '0.75rem',
                        whiteSpace: 'nowrap',
                        color: '#666',
                        top: '-25px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#fff',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        border: '1px solid #e0e0e0',
                      }}>
                        {format(project.decisionDate, 'dd MMM yyyy')}
                      </div>
                    </div>
                  )}
                  
                  {/* Duration line */}
                  {project.applicationDate && project.decisionDate && (
                    <div 
                      style={{
                        ...timelineStyles.durationLine,
                        left: `${((project.applicationDate - paddedEarliest) / (paddedLatest - paddedEarliest)) * 100}%`,
                        width: `${(((project.decisionDate - project.applicationDate) / (paddedLatest - paddedEarliest)) * 100)}%`
                      }}
                      title={`Duration: ${project.durationDays} days`}
                    >
                      <span style={{
                        position: 'absolute',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                        color: '#fff',
                        top: '-20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#4e73df',
                        padding: '2px 5px',
                        borderRadius: '3px',
                      }}>
                        {project.durationDays} days
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={timelineStyles.metrics}>
                <div style={timelineStyles.metric}>
                  <span style={timelineStyles.metricLabel}>Processing Time</span>
                  <span style={timelineStyles.metricValue}>{project.durationDays || 'N/A'} days</span>
                </div>
                <div style={timelineStyles.metric}>
                  <span style={timelineStyles.metricLabel}>Current Stage</span>
                  <span style={timelineStyles.metricValue}>{project.stage}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
        <div style={countyStyles.emptyChart} className="project-comparison-county-empty">
          <p>Select projects to compare county metrics</p>
        </div>
      );
    }
    
    if (countyData.length === 0) {
      return (
        <div style={countyStyles.emptyChart} className="project-comparison-county-empty">
          <p>Selected projects don't have county information</p>
        </div>
      );
    }
    
    const pieData = countyData.map(item => ({
      name: item.county,
      value: item.totalValue
    }));
    
    return (
      <div style={countyStyles.container} className="project-comparison-county">
        <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}} className="project-comparison-county-tabs">
          <button 
            style={{
              padding: '8px 16px',
              backgroundColor: !showTownView ? '#4e73df' : '#f8f9fa',
              color: !showTownView ? 'white' : '#666',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
            className="project-comparison-county-tab"
            onClick={() => setShowTownView(false)}
          >
            County View
          </button>
          <button 
            style={{
              padding: '8px 16px',
              backgroundColor: showTownView ? '#4e73df' : '#f8f9fa',
              color: showTownView ? 'white' : '#666',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
            className="project-comparison-county-tab"
            onClick={() => setShowTownView(true)}
          >
            Town View
          </button>
        </div>
        
        {!showTownView ? (
          <>
            <div style={countyStyles.chartRow}>
              <div style={countyStyles.chartCol}>
                <h4 style={countyStyles.header}>
                  <span style={{marginRight: '8px'}}>📊</span>
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
              
              <div style={{...countyStyles.chartCol, padding: '0 30px'}}>
                <h4 style={countyStyles.header}>
                  <span style={{marginRight: '8px'}}>🥧</span>
                  Value Distribution
                </h4>
                <div style={{width: '100%', height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                  <ChartJsPie
                    data={{
                      labels: pieData.map(item => item.name),
                      datasets: [{
                        label: 'Value Distribution',
                        data: pieData.map(item => item.value),
                        backgroundColor: COUNTY_COLORS,
                        borderColor: COUNTY_COLORS,
                        borderWidth: 1
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            padding: 20,
                            font: {
                              size: 14,
                              weight: 'bold'
                            },
                            generateLabels: (chart) => {
                              const datasets = chart.data.datasets;
                              const totalValue = datasets[0].data.reduce((a, b) => a + b, 0);
                              
                              return chart.data.labels.map((label, i) => {
                                const percentage = ((datasets[0].data[i] / totalValue) * 100).toFixed(1);
                                return {
                                  text: `${label}: ${percentage}%`,
                                  fillStyle: datasets[0].backgroundColor[i],
                                  hidden: false,
                                  index: i
                                };
                              });
                            }
                          }
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const totalValue = context.dataset.data.reduce((total, value) => total + value, 0);
                              const percentage = ((context.raw / totalValue) * 100).toFixed(1);
                              return `${context.label}: €${context.raw.toFixed(2)}M (${percentage}%)`;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            
            <div style={countyStyles.metricsContainer}>
              <h4 style={countyStyles.metricsHeader}>
                <span style={{marginRight: '8px'}}>🏆</span>
                County Project Metrics
              </h4>
              <div style={countyStyles.metricsGrid}>
                {countyData.map((county, index) => (
                  <div 
                    key={index} 
                    style={{
                      ...countyStyles.metricCard,
                      borderLeftColor: COUNTY_COLORS[index % COUNTY_COLORS.length]
                    }}
                  >
                    <h5 style={countyStyles.metricCardHeading}>{county.county}</h5>
                    <div style={countyStyles.metricRow}>
                      <div style={countyStyles.metric}>
                        <span style={countyStyles.metricLabel}>Projects</span>
                        <span style={countyStyles.metricValue}>{county.projectCount}</span>
                      </div>
                      <div style={countyStyles.metric}>
                        <span style={countyStyles.metricLabel}>Total Value</span>
                        <span style={countyStyles.metricValue}>€{county.totalValue.toFixed(2)}M</span>
                      </div>
                      <div style={countyStyles.metric}>
                        <span style={countyStyles.metricLabel}>Avg. Value</span>
                        <span style={countyStyles.metricValue}>€{county.averageValue.toFixed(2)}M</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={countyStyles.chartRow}>
              <div style={countyStyles.chartCol}>
                <h4 style={countyStyles.header}>
                  <span style={{marginRight: '8px'}}>🏙️</span>
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
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '300px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    padding: '20px',
                    border: '1px solid #e0e0e0',
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    <p>No town data available for the selected projects</p>
                  </div>
                )}
              </div>
              
              {townData.length > 0 && (
                <div style={countyStyles.chartCol}>
                  <h4 style={countyStyles.header}>
                    <span style={{marginRight: '8px'}}>📈</span>
                    Projects per Town
                  </h4>
                  <BarChart width={500} height={300} data={townData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fullName" tick={{fontSize: 10}} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="projectCount" fill="#ffc658" name="Number of Projects" />
                  </BarChart>
                </div>
              )}
            </div>
            
            {townData.length > 0 && (
              <div style={countyStyles.metricsContainer}>
                <h4 style={countyStyles.metricsHeader}>
                  <span style={{marginRight: '8px'}}>🏙️</span>
                  Town Project Metrics
                </h4>
                <div style={countyStyles.metricsGrid}>
                  {townData.map((town, index) => (
                    <div 
                      key={index} 
                      style={{
                        ...countyStyles.metricCard,
                        borderLeftColor: TOWN_COLORS[index % TOWN_COLORS.length]
                      }}
                    >
                      <h5 style={countyStyles.metricCardHeading}>{town.fullName}</h5>
                      <div style={countyStyles.metricRow}>
                        <div style={countyStyles.metric}>
                          <span style={countyStyles.metricLabel}>Projects</span>
                          <span style={countyStyles.metricValue}>{town.projectCount}</span>
                        </div>
                        <div style={countyStyles.metric}>
                          <span style={countyStyles.metricLabel}>Total Value</span>
                          <span style={countyStyles.metricValue}>€{town.totalValue.toFixed(2)}M</span>
                        </div>
                        <div style={countyStyles.metric}>
                          <span style={countyStyles.metricLabel}>Avg. Value</span>
                          <span style={countyStyles.metricValue}>€{town.averageValue.toFixed(2)}M</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderFilters = () => (
    <div style={styles.filterContainer}>
      <h3 style={styles.filterHeading}>🔍 Filter Projects</h3>
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Project Type</label>
          <select 
            style={styles.filterSelect}
            value={filters.projectType}
            onChange={(e) => handleFilterChange('projectType', e.target.value)}
          >
            <option value="">All Types</option>
            {filterOptions.projectTypes.map((type, index) => (
              <option key={index} value={type}>{type}</option>
            ))}
          </select>
        </div>
        
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Project Stage</label>
          <select 
            style={styles.filterSelect}
            value={filters.stage}
            onChange={(e) => handleFilterChange('stage', e.target.value)}
          >
            <option value="">All Stages</option>
            {filterOptions.stages.map((stage, index) => (
              <option key={index} value={stage}>{stage}</option>
            ))}
          </select>
        </div>
        
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>County</label>
          <select 
            style={styles.filterSelect}
            value={filters.county}
            onChange={(e) => handleFilterChange('county', e.target.value)}
          >
            <option value="">All Counties</option>
            {filterOptions.counties.map((county, index) => (
              <option key={index} value={county}>{county}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Town</label>
          <select 
            style={styles.filterSelect}
            value={filters.town}
            onChange={(e) => handleFilterChange('town', e.target.value)}
            disabled={!filters.county}
          >
            <option value="">All Towns</option>
            {filters.county && filterOptions.towns[filters.county]?.map((town, index) => (
              <option key={index} value={town}>{town}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Stakeholder Type</label>
          <select 
            style={styles.filterSelect}
            value={filters.stakeholderType}
            onChange={(e) => handleFilterChange('stakeholderType', e.target.value)}
          >
            <option value="">All Stakeholders</option>
            {filterOptions.stakeholderTypes.map((type, index) => (
              <option key={index} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Value Range</label>
          <select 
            style={styles.filterSelect}
            value={filters.valueRange}
            onChange={(e) => handleFilterChange('valueRange', e.target.value)}
          >
            {filterOptions.valueRanges.map((range, index) => (
              <option key={index} value={range.value}>{range.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Sort By</label>
          <select 
            style={styles.filterSelect}
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

  if (loading) return <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>Loading projects...</div>;
  if (error) return <div style={{textAlign: 'center', padding: '20px', color: '#e74a3b'}}>{error}</div>;

  const filteredProjects = getFilteredProjects();

  const pageContainerStyle = {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  return (
    <div style={pageContainerStyle}>
      <h2 style={styles.heading}>Project Comparison</h2>
      <p style={styles.subtitle}>Compare infrastructure projects across different metrics</p>
      
      <div style={styles.filterContainer}>
        <h3 style={styles.filterHeading}>🔍 Filter Projects</h3>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Project Type</label>
            <select 
              style={styles.filterSelect}
              value={filters.projectType}
              onChange={(e) => handleFilterChange('projectType', e.target.value)}
            >
              <option value="">All Types</option>
              {filterOptions.projectTypes.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Project Stage</label>
            <select 
              style={styles.filterSelect}
              value={filters.stage}
              onChange={(e) => handleFilterChange('stage', e.target.value)}
            >
              <option value="">All Stages</option>
              {filterOptions.stages.map((stage, index) => (
                <option key={index} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>County</label>
            <select 
              style={styles.filterSelect}
              value={filters.county}
              onChange={(e) => handleFilterChange('county', e.target.value)}
            >
              <option value="">All Counties</option>
              {filterOptions.counties.map((county, index) => (
                <option key={index} value={county}>{county}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Town</label>
            <select 
              style={styles.filterSelect}
              value={filters.town}
              onChange={(e) => handleFilterChange('town', e.target.value)}
              disabled={!filters.county}
            >
              <option value="">All Towns</option>
              {filters.county && filterOptions.towns[filters.county]?.map((town, index) => (
                <option key={index} value={town}>{town}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Stakeholder Type</label>
            <select 
              style={styles.filterSelect}
              value={filters.stakeholderType}
              onChange={(e) => handleFilterChange('stakeholderType', e.target.value)}
            >
              <option value="">All Stakeholders</option>
              {filterOptions.stakeholderTypes.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Value Range</label>
            <select 
              style={styles.filterSelect}
              value={filters.valueRange}
              onChange={(e) => handleFilterChange('valueRange', e.target.value)}
            >
              {filterOptions.valueRanges.map((range, index) => (
                <option key={index} value={range.value}>{range.label}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Sort By</label>
            <select 
              style={styles.filterSelect}
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
      
      {loading ? (
        <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>Loading projects...</div>
      ) : error ? (
        <div style={{textAlign: 'center', padding: '20px', color: '#e74a3b'}}>{error}</div>
      ) : (
        <div style={styles.card}>
          <div style={{marginBottom: '25px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
              <h3 style={{margin: 0, fontSize: '1.2rem', color: '#333', display: 'flex', alignItems: 'center'}}>
                📋 Selected Projects
              </h3>
              {selectedProjects.length > 0 && (
                <button 
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f8f9fa',
                    color: '#666',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onClick={handleResetComparison}
                >
                  Reset Comparison
                </button>
              )}
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
              {selectedProjects.map(project => (
                <div 
                  key={project.planning_id} 
                  style={styles.selectedProjectCard}
                >
                  <div style={{
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '15px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #e0e0e0'
                  }}>
                    <h4 style={{margin: 0, fontSize: '1.1rem', color: '#333', fontWeight: 600}}>{project.planning_title}</h4>
                    <button 
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#666',
                        fontSize: '1.2rem',
                        padding: 0,
                        cursor: 'pointer',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%'
                      }}
                      onClick={() => handleProjectSelect(project)}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    <span style={{fontSize: '0.9rem', color: '#666', padding: '4px 0'}}>Type: {project.planning_type}</span>
                    <span style={{fontSize: '0.9rem', color: '#666', padding: '4px 0'}}>Value: €{formatValue(project.planning_value).toLocaleString()}</span>
                    <span style={{fontSize: '0.9rem', color: '#666', padding: '4px 0'}}>Stage: {project.planning_stage}</span>
                    {project.planning_county && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: 'rgba(35, 75, 142, 0.1)',
                        color: '#234b8e',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        marginTop: '5px',
                        fontWeight: 500
                      }}>County: {project.planning_county}</span>
                    )}
                    {project.planning_town && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: 'rgba(30, 127, 94, 0.1)',
                        color: '#1e7f5e',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        marginTop: '5px',
                        fontWeight: 500
                      }}>Town: {project.planning_town}</span>
                    )}
                  </div>
                </div>
              ))}
              {selectedProjects.length < 3 && (
                <div 
                  style={styles.addCard}
                  onClick={() => setShowAllProjects(true)}
                >
                  <div style={styles.addIcon}>+</div>
                  <p style={{margin: 0, fontSize: '1rem', color: '#666'}}>Add Another Project</p>
                </div>
              )}
            </div>
          </div>

          {selectedProjects.length > 0 && (
            <div>
              <div style={styles.tabsContainer}>
                <button 
                  style={{...styles.tab, ...(activeTab === 'budget' ? styles.activeTab : {})}}
                  onClick={() => setActiveTab('budget')}
                >
                  Budget Analysis
                </button>
                <button 
                  style={{...styles.tab, ...(activeTab === 'timeline' ? styles.activeTab : {})}}
                  onClick={() => setActiveTab('timeline')}
                >
                  Timeline
                </button>
                <button 
                  style={{...styles.tab, ...(activeTab === 'metrics' ? styles.activeTab : {})}}
                  onClick={() => setActiveTab('metrics')}
                >
                  Size Metrics
                </button>
                <button 
                  style={{...styles.tab, ...(activeTab === 'stakeholders' ? styles.activeTab : {})}}
                  onClick={() => setActiveTab('stakeholders')}
                >
                  Stakeholders
                </button>
                <button 
                  style={{...styles.tab, ...(activeTab === 'county' ? styles.activeTab : {})}}
                  onClick={() => setActiveTab('county')}
                >
                  County Analysis
                </button>
              </div>

              <div style={styles.chartContainer}>
                {activeTab === 'budget' && (
                  <div>
                    <h4 style={{marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '10px'}}>
                      💰 Budget Comparison (Millions)
                    </h4>
                    <BarChart width={500} height={300} data={prepareChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => `€${value.toFixed(2)}M`} />
                      <Legend />
                      <Bar dataKey="value" fill="#8884d8" name="Project Value (€M)" />
                    </BarChart>
                  </div>
                )}
                {activeTab === 'timeline' && renderTimeline()}
                {activeTab === 'metrics' && renderSizeMetrics()}
                {activeTab === 'stakeholders' && renderStakeholderAnalysis()}
                {activeTab === 'county' && renderCountyComparison()}
              </div>
            </div>
          )}
        </div>
      )}

      {showAllProjects && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e0e0e0'}}>
              <h3 style={{margin: 0, fontSize: '1.3rem', color: '#333', display: 'flex', alignItems: 'center'}}>
                📋 Available Projects
              </h3>
              <button 
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f8f9fa',
                  color: '#666',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={() => setShowAllProjects(false)}
              >
                Close
              </button>
            </div>
            
            {!filtersApplied ? (
              <div style={{textAlign: 'center', padding: '50px 20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', margin: '20px 0'}}>
                <div style={{fontSize: '3rem', marginBottom: '15px', color: '#666'}}>🔍</div>
                <h4 style={{margin: '0 0 15px 0', fontSize: '1.2rem', color: '#333'}}>Apply filters to see projects</h4>
                <p style={{margin: '5px 0', color: '#666', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto'}}>Use the filters above to narrow down projects by type, county, value range, or other criteria.</p>
                <p style={{margin: '5px 0', color: '#666', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto'}}>This helps us show you the most relevant results and improves page performance.</p>
              </div>
            ) : getFilteredProjects().length === 0 ? (
              <div style={{textAlign: 'center', padding: '50px 20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', margin: '20px 0'}}>
                <div style={{fontSize: '3rem', marginBottom: '15px', color: '#666'}}>📋</div>
                <h4 style={{margin: '0 0 15px 0', fontSize: '1.2rem', color: '#333'}}>No projects match your filters</h4>
                <p style={{margin: '5px 0', color: '#666', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto'}}>Try adjusting your filter criteria to see more results.</p>
              </div>
            ) : (
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
                {getFilteredProjects().map(project => (
                  <div 
                    key={project.planning_id} 
                    style={{
                      ...styles.selectedProjectCard,
                      ...(selectedProjects.some(p => p.planning_id === project.planning_id) ? {
                        border: '2px solid #4e73df',
                        backgroundColor: 'rgba(78, 115, 223, 0.1)'
                      } : {}),
                      cursor: 'pointer'
                    }}
                    onClick={() => handleProjectSelect(project)}
                  >
                    <h4 style={{margin: 0, fontSize: '1rem', color: '#333'}}>{project.planning_title}</h4>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      <span style={{fontSize: '0.9rem', color: '#666', padding: '4px 0'}}>Type: {project.planning_type}</span>
                      <span style={{fontSize: '0.9rem', color: '#666', padding: '4px 0'}}>Value: €{formatValue(project.planning_value).toLocaleString()}</span>
                      <span style={{fontSize: '0.9rem', color: '#666', padding: '4px 0'}}>Stage: {project.planning_stage}</span>
                      {project.planning_county && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: 'rgba(35, 75, 142, 0.1)',
                          color: '#234b8e',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          marginTop: '5px',
                          fontWeight: 500
                        }}>County: {project.planning_county}</span>
                      )}
                      {project.planning_town && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: 'rgba(30, 127, 94, 0.1)',
                          color: '#1e7f5e',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          marginTop: '5px',
                          fontWeight: 500
                        }}>Town: {project.planning_town}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectComparison;
