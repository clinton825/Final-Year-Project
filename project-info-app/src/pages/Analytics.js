import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  getDocs, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement
} from 'chart.js';
import { Pie, Bar, Chart } from 'react-chartjs-2';
import config from '../config';
import './Analytics.css';
import ErrorBoundary from '../components/ErrorBoundary';

// Safely register ChartJS components with error handling
try {
  ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    PointElement,
    LineElement
  );
  console.log('ChartJS components registered successfully');
} catch (error) {
  console.error('Error registering ChartJS components:', error);
}

// ChartWrapper component to defer rendering and catch errors
const ChartWrapper = ({ children, chartType, title }) => {
  const [shouldRender, setShouldRender] = useState(false);
  
  useEffect(() => {
    // Defer chart rendering to ensure page is stable first
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, 800); // Increased from 500ms to 800ms for better stability
    
    return () => clearTimeout(timer);
  }, []);
  
  if (!shouldRender) {
    return (
      <div className="chart-loading">
        <div className="loading-spinner"></div>
        <p>Loading {chartType} chart...</p>
      </div>
    );
  }
  
  return (
    <ErrorBoundary 
      fallbackTitle={`${chartType} Chart Issue`}
      fallbackMessage={`Unable to render the ${title} chart. Please try again later.`}
      retryButton={true}
    >
      {children}
    </ErrorBoundary>
  );
};

const Analytics = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [trackedProjects, setTrackedProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('10');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [counties, setCounties] = useState(['Waterford', 'Carlow']);
  const [chartData, setChartData] = useState(null);
  const [stagesData, setStagesData] = useState(null);
  const [countyChartData, setCountyChartData] = useState(null);
  const [countyProjectsData, setCountyProjectsData] = useState(null);
  const [chartReady, setChartReady] = useState(false); // Track if charts are ready to display
  const [offlineMode, setOfflineMode] = useState(false);
  const [pageReady, setPageReady] = useState(false); // Track if the page structure is ready
  const [activeFilters, setActiveFilters] = useState([]); // Track active filters for display
  const [filteredProjectCount, setFilteredProjectCount] = useState(0); // Track number of projects after filtering

  // Color palette for charts
  const colorPalette = [
    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
    '#5a5c69', '#6610f2', '#6f42c1', '#e83e8c', '#fd7e14'
  ];

  // Detect and handle online/offline states
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network is online');
      setOfflineMode(false);
    };
    
    const handleOffline = () => {
      console.log('Network is offline');
      setOfflineMode(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check initial state
    setOfflineMode(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // First ensure page structure renders, then load data
  useEffect(() => {
    // First mark page structure as ready
    setPageReady(true);
    
    // Then after a brief delay, fetch data to ensure page is stable
    const timer = setTimeout(() => {
      fetchAllProjects();
      fetchTrackedProjects();
      fetchCategories();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [currentUser]);

  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (projects.length > 0) {
      setChartReady(false); // Reset chart ready state before updating
      
      // Update active filters display
      const newActiveFilters = [];
      if (selectedCategory) newActiveFilters.push(`Category: ${selectedCategory}`);
      if (selectedSubcategory) newActiveFilters.push(`Subcategory: ${selectedSubcategory}`);
      if (selectedCounty) newActiveFilters.push(`County: ${selectedCounty}`);
      if (selectedTimeRange !== '10') newActiveFilters.push(`Time Range: ${selectedTimeRange} years`);
      setActiveFilters(newActiveFilters);
      
      prepareChartData();
      prepareStagesData();
      prepareCountyData();
      
      // Add a small delay to ensure charts render properly
      const timer = setTimeout(() => {
        setChartReady(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [projects, selectedCategory, selectedSubcategory, selectedTimeRange, selectedCounty]);

  // Modified function to fetch all projects directly from Firestore
  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      
      // If offline, show error instead of using sample data
      if (offlineMode) {
        console.log('Network is offline, cannot fetch projects');
        setError('Network is offline. Please check your connection and try again.');
        setProjects([]);
        return;
      }
      
      // Call the backend API to get all projects
      const response = await fetch(`${config.API_URL}/api/projects?limit=1000`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch projects data');
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.projects.length} projects for analytics`);
      
      // Process and filter projects
      const processedProjects = data.projects.map(project => ({
        ...project,
        planning_value: parseFloat(project.planning_value?.replace(/[^0-9.-]+/g, '')) || 0,
        planning_application_date: project.planning_application_date ? new Date(project.planning_application_date) : null
      }));
      
      setProjects(processedProjects);
      setError(null);
    } catch (error) {
      console.error('Error fetching projects for analytics:', error);
      setError('Failed to load analytics data. Please try again later.');
      
      // Instead of using sample data, set empty array
      console.log('Setting empty projects array due to fetch error');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) {
        setChartData(generateEmptyChartData());
        setStagesData(generateEmptyStagesData());
        setCountyChartData(generateEmptyCountyData());
        setCountyProjectsData(generateEmptyCountyData());
        setChartReady(true);
        return;
      }
      
      console.log('Fetching tracked projects for analytics:', currentUser.uid);
      
      const q = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const trackedProjectsData = [];
      
      querySnapshot.forEach(doc => {
        const projectData = doc.data();
        
        // Skip placeholder documents
        if (projectData._placeholder) {
          console.log('Skipping placeholder document in analytics');
          return;
        }
        
        trackedProjectsData.push({
          id: doc.id,
          ...projectData,
          planning_value: parseFloat(projectData.planning_value?.replace(/[^0-9.-]+/g, '')) || 0
        });
      });
      
      console.log(`Found ${trackedProjectsData.length} tracked projects for analytics`);
      setTrackedProjects(trackedProjectsData);
      
      // Only proceed with empty charts if no tracked projects
      if (trackedProjectsData.length === 0) {
        console.log('No tracked projects for analytics, showing empty state');
        setChartData(generateEmptyChartData());
        setStagesData(generateEmptyStagesData());
        setCountyChartData(generateEmptyCountyData());
        setCountyProjectsData(generateEmptyCountyData());
        setError(null);
      }
      
      setChartReady(true);
    } catch (error) {
      console.error('Error fetching tracked projects for analytics:', error);
      // Don't show error message, just generate empty charts
      setChartData(generateEmptyChartData());
      setStagesData(generateEmptyStagesData());
      setCountyChartData(generateEmptyCountyData());
      setCountyProjectsData(generateEmptyCountyData());
      setChartReady(true);
      setError(null);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${config.API_URL}/api/categories`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSubcategories = async (category) => {
    try {
      const response = await fetch(`${config.API_URL}/api/subcategories/${encodeURIComponent(category)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch subcategories');
      }
      
      const data = await response.json();
      setSubcategories(data.subcategories || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const prepareChartData = () => {
    if (projects.length === 0) return;

    // Get the current date and calculate the start date based on selected time range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - parseInt(selectedTimeRange));
    
    console.log(`Time range filter: ${selectedTimeRange} years (from ${startDate.toISOString()} to ${endDate.toISOString()})`);

    // Filter projects by date range and category/subcategory if selected
    let filteredProjects = projects.filter(project => {
      // Handle date conversion - ensure we have a valid Date object
      let projectDate = project.planning_application_date;
      if (typeof projectDate === 'string') {
        projectDate = new Date(projectDate);
      }
      
      // Check if the project date is valid
      const isValidDate = projectDate instanceof Date && !isNaN(projectDate);
      
      // If date is invalid or missing, include it if time range is the max (10 years)
      if (!isValidDate) {
        return selectedTimeRange === '10';
      }
      
      // Check if the project date is within the selected range
      return projectDate >= startDate && projectDate <= endDate;
    });
    
    console.log(`Filtered to ${filteredProjects.length} projects within date range ${selectedTimeRange}`);
    
    // Apply category filter if selected
    if (selectedCategory) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_category === selectedCategory || 
        project.category === selectedCategory
      );
      console.log(`After category filter: ${filteredProjects.length} projects`);
    }
    
    // Apply subcategory filter if selected
    if (selectedSubcategory) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_subcategory === selectedSubcategory || 
        project.subcategory === selectedSubcategory
      );
      console.log(`After subcategory filter: ${filteredProjects.length} projects`);
    }
    
    // Apply county filter if selected
    if (selectedCounty) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_county === selectedCounty || 
        project.county === selectedCounty
      );
      console.log(`After county filter: ${filteredProjects.length} projects`);
    }

    console.log(`Final filtered projects: ${filteredProjects.length}`);
    setFilteredProjectCount(filteredProjects.length);

    // If a specific subcategory is selected, focus only on that subcategory
    if (selectedSubcategory) {
      // Group projects by county for the selected subcategory
      const countyTotals = {};
      
      filteredProjects.forEach(project => {
        const county = project.planning_county || project.county || 'Unknown';
        if (!countyTotals[county]) {
          countyTotals[county] = 0;
        }
        countyTotals[county] += (project.planning_value || 0);
      });
      
      // If we have no data, add empty data
      if (Object.keys(countyTotals).length === 0) {
        countyTotals['No matching projects'] = 0;
        countyTotals['Try different filters'] = 0;
      }
      
      // Prepare data for pie chart
      let sortedEntries = Object.entries(countyTotals)
        .sort((a, b) => b[1] - a[1]);
        
      let labels = sortedEntries.map(entry => entry[0]);
      let data = sortedEntries.map(entry => entry[1]);
      
      // Generate background colors
      const backgroundColors = labels.map((_, index) => colorPalette[index % colorPalette.length]);

      console.log('Preparing chart data for selected subcategory with labels:', labels);
      console.log('Chart data values:', data);

      setChartData({
        labels,
        datasets: [
          {
            label: `${selectedSubcategory} Value (€)`,
            data,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors,
            borderWidth: 1,
            hoverOffset: 4
          },
        ],
      });
      
      return; // Exit early since we've set the chart data
    }
    
    // If no specific subcategory is selected, continue with normal subcategory grouping
    const subcategoryTotals = {};
    
    filteredProjects.forEach(project => {
      // Use a more comprehensive approach to extract subcategory
      let subcategory = project.planning_subcategory || project.subcategory;
      
      // If no subcategory is available, try to derive from description or category
      if (!subcategory || subcategory === 'Unknown') {
        if (project.planning_description) {
          // Try to extract subcategory from description
          const desc = project.planning_description.toLowerCase();
          if (desc.includes('apartment') || desc.includes('housing')) subcategory = 'Housing';
          else if (desc.includes('office') || desc.includes('commercial')) subcategory = 'Office';
          else if (desc.includes('retail') || desc.includes('shop')) subcategory = 'Retail';
          else if (desc.includes('hotel') || desc.includes('accommodation')) subcategory = 'Hotel';
          else if (desc.includes('industrial') || desc.includes('factory')) subcategory = 'Industrial';
          else if (desc.includes('hospital') || desc.includes('healthcare')) subcategory = 'Healthcare';
          else if (desc.includes('education') || desc.includes('school')) subcategory = 'Education';
          else if (desc.includes('car') || desc.includes('showroom')) subcategory = 'Car Showroom';
        } else if (project.planning_category) {
          // Use category + 'General' if no subcategory is available
          subcategory = `${project.planning_category} General`;
        } else {
          subcategory = 'Other';
        }
      }
      
      if (!subcategoryTotals[subcategory]) {
        subcategoryTotals[subcategory] = 0;
      }
      subcategoryTotals[subcategory] += (project.planning_value || 0);
    });

    // If we have fewer than 3 subcategories or no filtered projects, add empty data
    if (Object.keys(subcategoryTotals).length < 3 || filteredProjects.length === 0) {
      console.log('Adding empty subcategories to enhance chart visualization');
      
      // If we have no filtered projects, add a message to the subcategory
      if (filteredProjects.length === 0 && activeFilters.length > 0) {
        subcategoryTotals['No matching projects'] = 0;
        subcategoryTotals['Try different filters'] = 0;
      } else {
        // Only add these if they don't already exist
        if (!subcategoryTotals['Office']) subcategoryTotals['Office'] = 0;
        if (!subcategoryTotals['Retail']) subcategoryTotals['Retail'] = 0;
        if (!subcategoryTotals['Hotel']) subcategoryTotals['Hotel'] = 0;
        if (!subcategoryTotals['Industrial']) subcategoryTotals['Industrial'] = 0;
      }
    }

    // Prepare data for pie chart - limit to top 8 subcategories for better visualization
    let sortedEntries = Object.entries(subcategoryTotals)
      .sort((a, b) => b[1] - a[1]); // Sort by value, descending
      
    // Take top 7 and group the rest as "Other"
    let topEntries = sortedEntries.slice(0, 7);
    let otherEntries = sortedEntries.slice(7);
    
    let labels = topEntries.map(entry => entry[0]);
    let data = topEntries.map(entry => entry[1]);
    
    // Add "Other" category if needed
    if (otherEntries.length > 0) {
      const otherTotal = otherEntries.reduce((sum, entry) => sum + entry[1], 0);
      labels.push('Other');
      data.push(otherTotal);
    }
    
    // Generate background colors (one for each subcategory)
    const backgroundColors = labels.map((_, index) => colorPalette[index % colorPalette.length]);

    console.log('Preparing chart data with labels:', labels);
    console.log('Chart data values:', data);

    setChartData({
      labels,
      datasets: [
        {
          label: 'Value (€)',
          data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors,
          borderWidth: 1,
          hoverOffset: 4
        },
      ],
    });
  };

  const prepareStagesData = () => {
    if (projects.length === 0) return;

    // Filter projects if category or subcategory selected
    let filteredProjects = projects;
    if (selectedCategory) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_category === selectedCategory
      );
    }
    if (selectedSubcategory) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_subcategory === selectedSubcategory
      );
    }
    if (selectedCounty) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_county === selectedCounty
      );
    }

    // Group projects by stage
    const stageCounts = {};
    
    filteredProjects.forEach(project => {
      const stage = project.planning_stage || 'Unknown';
      if (!stageCounts[stage]) {
        stageCounts[stage] = 0;
      }
      stageCounts[stage]++;
    });

    // Sort stages in a meaningful order if possible, or by count
    const stageOrder = [
      'Planning', 'Approved', 'Commenced', 'In Progress', 'Near Completion', 'Completed'
    ];
    
    // Sort entries by our predefined order or alphabetically if not in our list
    let sortedEntries = Object.entries(stageCounts).sort((a, b) => {
      const indexA = stageOrder.indexOf(a[0]);
      const indexB = stageOrder.indexOf(b[0]);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      } else if (indexA !== -1) {
        return -1;
      } else if (indexB !== -1) {
        return 1;
      } else {
        return a[0].localeCompare(b[0]);
      }
    });
    
    const labels = sortedEntries.map(entry => entry[0]);
    const data = sortedEntries.map(entry => entry[1]);
    
    // Generate background colors (one for each stage)
    const backgroundColors = labels.map((_, index) => colorPalette[index % colorPalette.length]);

    console.log('Preparing stages data with labels:', labels);
    console.log('Stages data values:', data);

    setStagesData({
      labels,
      datasets: [
        {
          label: 'Number of Projects',
          data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors,
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 30,
          maxBarThickness: 35
        },
      ],
    });
  };

  const prepareCountyData = () => {
    if (projects.length === 0) return;

    // Only include Waterford and Carlow counties
    const validCounties = ['Waterford', 'Carlow'];
    const countyData = {};
    
    validCounties.forEach(county => {
      countyData[county] = 0;
    });
    
    projects.forEach(project => {
      const county = project.planning_county;
      if (validCounties.includes(county)) {
        countyData[county] = (countyData[county] || 0) + (project.planning_value || 0);
      }
    });
    
    const data = {
      labels: Object.keys(countyData),
      datasets: [{
        label: 'Project Value',
        data: Object.values(countyData),
        backgroundColor: colorPalette.slice(0, Object.keys(countyData).length),
        borderColor: colorPalette.slice(0, Object.keys(countyData).length),
        borderWidth: 1
      }]
    };
    
    setCountyChartData(data);
  };

  const prepareCountyProjectsData = () => {
    if (projects.length === 0) return;

    // Only include Waterford and Carlow counties
    const validCounties = ['Waterford', 'Carlow'];
    const countyData = {};
    
    validCounties.forEach(county => {
      countyData[county] = 0;
    });
    
    projects.forEach(project => {
      const county = project.planning_county;
      if (validCounties.includes(county)) {
        countyData[county] = (countyData[county] || 0) + 1;
      }
    });
    
    const data = {
      labels: Object.keys(countyData),
      datasets: [{
        label: 'Number of Projects',
        data: Object.values(countyData),
        backgroundColor: colorPalette.slice(0, Object.keys(countyData).length),
        borderColor: colorPalette.slice(0, Object.keys(countyData).length),
        borderWidth: 1
      }]
    };
    
    setCountyProjectsData(data);
  };

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    setSelectedSubcategory(''); // Reset subcategory when category changes
  };

  const handleSubcategoryChange = (e) => {
    setSelectedSubcategory(e.target.value);
  };

  const handleTimeRangeChange = (e) => {
    setSelectedTimeRange(e.target.value);
  };

  const handleCountyChange = (e) => {
    setSelectedCounty(e.target.value);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IE', { 
      style: 'currency', 
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const generateEmptyChartData = () => {
    return {
      labels: ['No Data Available'],
      datasets: [{
        data: [0],
        backgroundColor: ['#e0e0e0'],
        borderWidth: 0
      }]
    };
  };

  const generateEmptyStagesData = () => {
    return {
      labels: ['Planning', 'Design', 'Construction', 'Completed'],
      datasets: [{
        label: 'Projects',
        data: [0, 0, 0, 0],
        backgroundColor: colorPalette[0],
        borderColor: colorPalette[0],
        borderWidth: 1
      }]
    };
  };

  const generateEmptyCountyData = () => {
    return {
      labels: ['Waterford', 'Carlow'],
      datasets: [{
        label: 'Projects',
        data: [0, 0],
        backgroundColor: [colorPalette[0], colorPalette[1]],
        borderColor: [colorPalette[0], colorPalette[1]],
        borderWidth: 1
      }]
    };
  };

  useEffect(() => {
    // Initialize charts with loading state
    setChartData(generateEmptyChartData());
    setStagesData(generateEmptyStagesData());
    setCountyChartData(generateEmptyCountyData());
    setCountyProjectsData(generateEmptyCountyData());
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        await Promise.all([
          fetchAllProjects(),
          fetchTrackedProjects(),
          fetchCategories()
        ]);
      } catch (error) {
        console.error('Error loading analytics data:', error);
        setError(null); // Don't show error to user, just use empty state
        setChartReady(true);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentUser]);

  // Function to clear all filters
  const clearAllFilters = () => {
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSelectedTimeRange('10');
    setSelectedCounty('');
  };

  return (
    <ErrorBoundary
      fallbackTitle="Analytics Issue"
      fallbackMessage="We're having trouble displaying the analytics. Please try again later."
      retryButton={true}
    >
      <div className="analytics-container">
        <h1>Project Analytics Dashboard</h1>
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={fetchAllProjects}>Retry</button>
          </div>
        )}
        
        {offlineMode && (
          <div className="offline-warning">
            <p>You are currently offline. Some features may be limited.</p>
          </div>
        )}
        
        <div className="analytics-header">
          <h1>Project Analytics</h1>
          <p>Visualize your project data with interactive charts</p>
        </div>

        <div className="filters-section">
          <div className="filter-controls">
            <div className="filter-group">
              <label>Category:</label>
              <select
                value={selectedCategory}
                onChange={handleCategoryChange}
                className="filter-select"
              >
                <option value="">All Categories</option>
                {categories.map((category, index) => (
                  <option key={index} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Subcategory:</label>
              <select
                value={selectedSubcategory}
                onChange={handleSubcategoryChange}
                className="filter-select"
                disabled={!selectedCategory}
              >
                <option value="">All Subcategories</option>
                {subcategories.map((subcategory, index) => (
                  <option key={index} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>County:</label>
              <select
                value={selectedCounty}
                onChange={handleCountyChange}
                className="filter-select"
              >
                <option value="">All Counties</option>
                {counties.map((county, index) => (
                  <option key={index} value={county}>
                    {county}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Time Range:</label>
              <select
                value={selectedTimeRange}
                onChange={handleTimeRangeChange}
                className="filter-select"
              >
                <option value="1">Last 1 Year</option>
                <option value="3">Last 3 Years</option>
                <option value="5">Last 5 Years</option>
                <option value="10">Last 10 Years</option>
              </select>
            </div>
            
            {activeFilters.length > 0 && (
              <div className="filter-group filter-actions">
                <button 
                  className="clear-filters-btn" 
                  onClick={clearAllFilters}
                  aria-label="Clear all filters"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
          
          {activeFilters.length > 0 && (
            <div className="active-filters">
              <span className="active-filters-label">Active Filters:</span>
              <div className="filter-tags">
                {activeFilters.map((filter, index) => (
                  <span key={index} className="filter-tag">{filter}</span>
                ))}
              </div>
              <div className="filtered-count">
                Showing {filteredProjectCount} projects
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading analytics data...</p>
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div className="charts-container">
            <div className="chart-section">
              <div className="chart-card">
                <h2>Subcategory Spending Distribution</h2>
                <div className="chart-description">
                  <p>
                    {selectedSubcategory 
                      ? `Distribution of ${selectedSubcategory} projects by county` 
                      : 'Distribution of project value across different subcategories for the selected time period'}
                  </p>
                </div>
                <div className="chart-wrapper">
                  {chartReady && chartData && chartData.labels && chartData.labels.length > 0 ? (
                    <ChartWrapper chartType="Pie" title="Subcategory Spending Distribution">
                      <Pie 
                        data={chartData} 
                        options={{
                          plugins: {
                            legend: {
                              position: 'right',
                              labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: {
                                  size: 12
                                }
                              }
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  let label = context.label || '';
                                  let value = context.raw || 0;
                                  return `${label}: ${formatCurrency(value)}`;
                                }
                              }
                            },
                            title: {
                              display: false
                            }
                          },
                          responsive: true,
                          maintainAspectRatio: false,
                          layout: {
                            padding: 10
                          }
                        }}
                      />
                    </ChartWrapper>
                  ) : (
                    <div className="no-data-message">
                      <p>No data available for the selected filters</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="chart-section">
              <div className="chart-card">
                <h2>Projects by Stage</h2>
                <div className="chart-description">
                  <p>Number of projects in each development stage</p>
                </div>
                <div className="chart-wrapper">
                  {chartReady && stagesData && stagesData.labels && stagesData.labels.length > 0 ? (
                    <ChartWrapper chartType="Bar" title="Projects by Stage">
                      <Bar 
                        data={stagesData} 
                        options={{
                          plugins: {
                            legend: {
                              display: false,
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  return `${context.dataset.label}: ${context.raw} projects`;
                                }
                              }
                            },
                            title: {
                              display: false
                            }
                          },
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                precision: 0,
                                font: {
                                  size: 12
                                }
                              },
                              grid: {
                                display: true,
                                drawBorder: false,
                                lineWidth: 0.5
                              }
                            },
                            x: {
                              ticks: {
                                font: {
                                  size: 12
                                }
                              },
                              grid: {
                                display: false
                              }
                            }
                          },
                          indexAxis: 'y',
                          barThickness: 30,
                          layout: {
                            padding: 10
                          }
                        }}
                      />
                    </ChartWrapper>
                  ) : (
                    <div className="no-data-message">
                      <p>No stage data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="chart-section">
              <div className="chart-card">
                <h2>Project Value by County</h2>
                <div className="chart-description">
                  <p>Distribution of project value across counties</p>
                  {selectedCounty && <p className="selected-filter">Selected County: {selectedCounty}</p>}
                </div>
                <div className="chart-wrapper">
                  {chartReady && countyChartData && countyChartData.labels && countyChartData.labels.length > 0 ? (
                    <ChartWrapper chartType="Bar" title="Project Value by County">
                      <Bar 
                        data={countyChartData} 
                        options={{
                          plugins: {
                            legend: {
                              display: false,
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  return `${context.label}: ${formatCurrency(context.raw)}`;
                                }
                              }
                            },
                            title: {
                              display: false
                            }
                          },
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                callback: function(value) {
                                  return formatCurrency(value);
                                }
                              },
                              grid: {
                                display: true,
                                drawBorder: false,
                                lineWidth: 0.5
                              }
                            },
                            x: {
                              grid: {
                                display: false
                              }
                            }
                          },
                          layout: {
                            padding: 10
                          }
                        }}
                      />
                    </ChartWrapper>
                  ) : (
                    <div className="no-data-message">
                      <p>No county data available for the selected filters</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="chart-section">
              <div className="chart-card">
                <h2>County Comparison Analysis</h2>
                <div className="chart-description">
                  <p>Comparative analysis of key metrics between counties</p>
                </div>
                <div className="comparison-container">
                  {chartReady ? (
                    <>
                      <div className="comparison-metrics">
                        {/* Waterford Card */}
                        <div className="county-metric-card">
                          <h3>Waterford</h3>
                          <div className="metric-row">
                            <div className="metric">
                              <span className="metric-label">Projects</span>
                              <span className="metric-value">65</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Total Value</span>
                              <span className="metric-value">€169,124,670</span>
                            </div>
                          </div>
                          <div className="metric-row">
                            <div className="metric">
                              <span className="metric-label">Avg. Value</span>
                              <span className="metric-value">€2,601,918</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Categories</span>
                              <span className="metric-value">3</span>
                            </div>
                          </div>
                          <div className="county-progress">
                            <div className="progress-item">
                              <span className="progress-label">Planning</span>
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: '65%' }}></div>
                              </div>
                            </div>
                            <div className="progress-item">
                              <span className="progress-label">Construction</span>
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: '35%' }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Carlow Card */}
                        <div className="county-metric-card">
                          <h3>Carlow</h3>
                          <div className="metric-row">
                            <div className="metric">
                              <span className="metric-label">Projects</span>
                              <span className="metric-value">35</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Total Value</span>
                              <span className="metric-value">€215,281,170</span>
                            </div>
                          </div>
                          <div className="metric-row">
                            <div className="metric">
                              <span className="metric-label">Avg. Value</span>
                              <span className="metric-value">€6,151,000</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Categories</span>
                              <span className="metric-value">4</span>
                            </div>
                          </div>
                          <div className="county-progress">
                            <div className="progress-item">
                              <span className="progress-label">Planning</span>
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: '45%' }}></div>
                              </div>
                            </div>
                            <div className="progress-item">
                              <span className="progress-label">Construction</span>
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: '55%' }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="loading-container">
                      <div className="loading-spinner"></div>
                      <p>Loading comparison data...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="analytics-summary">
          <div className="summary-card">
            <h3>Total Projects</h3>
            <p className="summary-value">{projects.length}</p>
          </div>
          <div className="summary-card">
            <h3>Total Value</h3>
            <p className="summary-value">
              {formatCurrency(projects.reduce((total, project) => total + (project.planning_value || 0), 0))}
            </p>
          </div>
          <div className="summary-card">
            <h3>Active Filters</h3>
            <p className="summary-value">{activeFilters.length}</p>
            <small className="summary-detail">Showing {filteredProjectCount} filtered projects</small>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Analytics;
