import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
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
    }, 500);
    
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
  const [timeComparisonData, setTimeComparisonData] = useState(null);
  const [chartReady, setChartReady] = useState(false); // Track if charts are ready to display
  const [offlineMode, setOfflineMode] = useState(false);
  const [pageReady, setPageReady] = useState(false); // Track if the page structure is ready

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
      prepareChartData();
      prepareStagesData();
      prepareCountyData();
      prepareTimeComparisonData();
      // Add a small delay to ensure charts render properly
      const timer = setTimeout(() => {
        setChartReady(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [projects, selectedCategory, selectedSubcategory, selectedTimeRange, selectedCounty]);

  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      
      // If offline, use sample data
      if (offlineMode) {
        console.log('Using sample data in offline mode');
        setProjects(getSampleProjects());
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
      
      // Use sample data as fallback
      console.log('Using sample data as fallback due to error');
      setProjects(getSampleProjects());
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
        setTimeComparisonData(generateEmptyTimeComparisonData());
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
        setTimeComparisonData(generateEmptyTimeComparisonData());
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
      setTimeComparisonData(generateEmptyTimeComparisonData());
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
        project.planning_category === selectedCategory
      );
      console.log(`After category filter: ${filteredProjects.length} projects`);
    }
    
    // Apply subcategory filter if selected
    if (selectedSubcategory) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_subcategory === selectedSubcategory
      );
      console.log(`After subcategory filter: ${filteredProjects.length} projects`);
    }
    
    // Apply county filter if selected
    if (selectedCounty) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_county === selectedCounty
      );
      console.log(`After county filter: ${filteredProjects.length} projects`);
    }

    console.log(`Final filtered projects: ${filteredProjects.length}`);

    // Group projects by subcategory and calculate total value for each
    const subcategoryTotals = {};
    
    filteredProjects.forEach(project => {
      const subcategory = project.planning_subcategory || 'Unknown';
      if (!subcategoryTotals[subcategory]) {
        subcategoryTotals[subcategory] = 0;
      }
      subcategoryTotals[subcategory] += project.planning_value;
    });

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

  const prepareTimeComparisonData = () => {
    if (projects.length === 0) return;
    
    // Group data by year and calculate running totals
    const yearlyData = {};
    const currentYear = new Date().getFullYear();
    
    // Initialize yearly data structure for the selected time range
    for (let i = 0; i <= parseInt(selectedTimeRange); i++) {
      const year = currentYear - i;
      yearlyData[year] = {
        count: 0,
        value: 0
      };
    }
    
    // Apply filters to projects
    let filteredProjects = [...projects];
    
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
    
    // Group projects by year
    filteredProjects.forEach(project => {
      // Get project year from application date
      let projectDate = project.planning_application_date;
      if (typeof projectDate === 'string') {
        projectDate = new Date(projectDate);
      }
      
      // Skip projects with invalid dates
      if (!(projectDate instanceof Date) || isNaN(projectDate)) {
        return;
      }
      
      const projectYear = projectDate.getFullYear();
      
      // Only include projects within our time range
      if (projectYear >= currentYear - parseInt(selectedTimeRange) && projectYear <= currentYear) {
        if (!yearlyData[projectYear]) {
          yearlyData[projectYear] = { count: 0, value: 0 };
        }
        
        yearlyData[projectYear].count += 1;
        yearlyData[projectYear].value += (project.planning_value || 0);
      }
    });
    
    // Convert to arrays for chart.js
    const years = Object.keys(yearlyData).sort((a, b) => parseInt(a) - parseInt(b));
    const counts = [];
    const values = [];
    
    years.forEach(year => {
      counts.push(yearlyData[year].count);
      values.push(yearlyData[year].value);
    });
    
    // Set time comparison data
    setTimeComparisonData({
      labels: years,
      datasets: [
        {
          label: 'Project Count',
          data: counts,
          backgroundColor: colorPalette[0] + '80', // Semi-transparent
          borderColor: colorPalette[0],
          borderWidth: 1,
          type: 'bar',
          yAxisID: 'y'
        },
        {
          label: 'Project Value (€M)',
          data: values.map(val => val / 1000000), // Convert to millions
          backgroundColor: colorPalette[1],
          borderColor: colorPalette[1],
          borderWidth: 2,
          type: 'line',
          yAxisID: 'y1',
          fill: false,
          tension: 0.4
        }
      ]
    });
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
        data: [1],
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

  const generateEmptyTimeComparisonData = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    for (let i = 0; i < parseInt(selectedTimeRange); i++) {
      years.push(currentYear - i);
    }
    
    return {
      labels: years,
      datasets: [
        {
          label: 'No Time Comparison Data',
          data: Array(years.length).fill(0),
          backgroundColor: '#e0e0e080',
          borderColor: '#cccccc',
          borderWidth: 1,
        }
      ]
    };
  };

  useEffect(() => {
    // Initialize charts with loading state
    setChartData(generateEmptyChartData());
    setStagesData(generateEmptyStagesData());
    setCountyChartData(generateEmptyCountyData());
    setCountyProjectsData(generateEmptyCountyData());
    setTimeComparisonData(generateEmptyTimeComparisonData());
    
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

  // Sample data for offline mode or API failures
  const getSampleProjects = () => {
    return [
      {
        id: 'sample1',
        title: 'Waterford City Centre Redevelopment',
        description: 'Major redevelopment of Waterford city centre including retail, office and residential units',
        planning_value: 25000000,
        category: 'Commercial',
        subcategory: 'Mixed Use',
        county: 'Waterford',
        stage: 'Planning'
      },
      {
        id: 'sample2',
        title: 'Carlow Hospital Extension',
        description: 'Extension to existing hospital facilities including new emergency department',
        planning_value: 18000000,
        category: 'Healthcare',
        subcategory: 'Hospital',
        county: 'Carlow',
        stage: 'Construction'
      },
      {
        id: 'sample3',
        title: 'Waterford Residential Development',
        description: 'New residential development with 120 housing units',
        planning_value: 35000000,
        category: 'Residential',
        subcategory: 'Housing',
        county: 'Waterford',
        stage: 'Planning'
      },
      {
        id: 'sample4',
        title: 'Carlow Wind Farm',
        description: 'Renewable energy project with 15 wind turbines',
        planning_value: 42000000,
        category: 'Energy',
        subcategory: 'Renewable',
        county: 'Carlow',
        stage: 'Design'
      },
      {
        id: 'sample5',
        title: 'Waterford Road Improvement',
        description: 'Major road infrastructure improvements on N25',
        planning_value: 15000000,
        category: 'Infrastructure',
        subcategory: 'Roads',
        county: 'Waterford',
        stage: 'Construction'
      }
    ];
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
          </div>
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
                  <p>Distribution of project value across different subcategories for the selected time period</p>
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
                <h2>Number of Projects by County</h2>
                <div className="chart-description">
                  <p>Number of projects in each county</p>
                  {selectedCounty && <p className="selected-filter">Selected County: {selectedCounty}</p>}
                </div>
                <div className="chart-wrapper">
                  {chartReady && countyProjectsData && countyProjectsData.labels && countyProjectsData.labels.length > 0 ? (
                    <ChartWrapper chartType="Bar" title="Number of Projects by County">
                      <Bar 
                        data={countyProjectsData} 
                        options={{
                          plugins: {
                            legend: {
                              display: false,
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  return `${context.label}: ${context.raw} projects`;
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
                      <p>No county data available for the selected filters</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="chart-section">
              <div className="chart-card">
                <h2>Project Trends Over Time</h2>
                <div className="chart-description">
                  <p>Comparing project count and value over the selected time period</p>
                  <p className="selected-filter">Time Range: Last {selectedTimeRange} years</p>
                </div>
                <div className="chart-wrapper">
                  {chartReady && timeComparisonData && timeComparisonData.labels && timeComparisonData.labels.length > 0 ? (
                    <ChartWrapper chartType="Line" title="Project Trends Over Time">
                      <Chart 
                        type="bar"
                        data={timeComparisonData} 
                        options={{
                          plugins: {
                            legend: {
                              display: true,
                              position: 'top',
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  if (context.dataset.yAxisID === 'y') {
                                    return `${context.dataset.label}: ${context.raw} projects`;
                                  } else {
                                    return `${context.dataset.label}: ${formatCurrency(context.raw * 1000000)}`;
                                  }
                                }
                              }
                            }
                          },
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            x: {
                              grid: {
                                display: false
                              }
                            },
                            y: {
                              type: 'linear',
                              display: true,
                              position: 'left',
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Project Count'
                              },
                              grid: {
                                display: true,
                                drawBorder: false
                              }
                            },
                            y1: {
                              type: 'linear',
                              display: true,
                              position: 'right',
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Value (€M)'
                              },
                              grid: {
                                display: false
                              }
                            }
                          }
                        }}
                      />
                    </ChartWrapper>
                  ) : (
                    <div className="no-data-message">
                      <p>No trend data available for the selected time period</p>
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
            <h3>Tracked Projects</h3>
            <p className="summary-value">{trackedProjects.length}</p>
            {trackedProjects.length > 0 && (
              <small className="summary-detail">Last updated: {new Date().toLocaleDateString()}</small>
            )}
          </div>
          <div className="summary-card">
            <h3>Total Value</h3>
            <p className="summary-value">
              {formatCurrency(projects.reduce((total, project) => total + (project.planning_value || 0), 0))}
            </p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Analytics;
