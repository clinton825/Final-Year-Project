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
import { Pie, Bar, Line, Chart } from 'react-chartjs-2';
import config from '../config';
import './Analytics.css';
import ErrorBoundary from '../components/ErrorBoundary';

// Helper function to lighten colors
const lightenColor = (hex, percent) => {
  // Convert hex to RGB
  let r = parseInt(hex.substring(1, 3), 16);
  let g = parseInt(hex.substring(3, 5), 16);
  let b = parseInt(hex.substring(5, 7), 16);
  
  // Lighten
  r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  
  // Convert back to hex
  return "#" + 
    ((1 << 24) + (r << 16) + (g << 8) + b)
      .toString(16)
      .slice(1);
};

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
  const [counties, setCounties] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('10');
  const [timeRangeOptions] = useState([
    { value: '1', label: 'Last 1 Year' },
    { value: '3', label: 'Last 3 Years' },
    { value: '5', label: 'Last 5 Years' },
    { value: '10', label: 'Last 10 Years' },
    { value: '15', label: 'Last 15 Years' },
    { value: '20', label: 'Last 20 Years' },
  ]);
  const [chartData, setChartData] = useState(null);
  const [stagesData, setStagesData] = useState(null);
  const [countyChartData, setCountyChartData] = useState(null);
  const [countyProjectsData, setCountyProjectsData] = useState(null);
  const [subcategoryChartData, setSubcategoryChartData] = useState(null);
  const [chartReady, setChartReady] = useState(false); // Track if charts are ready to display
  const [offlineMode, setOfflineMode] = useState(false);
  const [pageReady, setPageReady] = useState(false); // Track if the page structure is ready
  const [activeFilters, setActiveFilters] = useState([]); // Track active filters for display
  const [filteredProjectCount, setFilteredProjectCount] = useState(0); // Track number of projects after filtering
  const [activeTab, setActiveTab] = useState('charts'); // Track active tab: 'charts' or 'metrics'
  const [topCounty, setTopCounty] = useState('');
  const [topCountyValue, setTopCountyValue] = useState(0);
  const [topProjectsCounty, setTopProjectsCounty] = useState('');
  const [topProjectsCount, setTopProjectsCount] = useState(0);

  // Color palette for charts
  const colorPalette = [
    '#4285F4', // Google Blue
    '#34A853', // Google Green
    '#FBBC05', // Google Yellow
    '#EA4335', // Google Red
    '#8758FF', // Purple
    '#00C6CF', // Teal
    '#FF914D', // Orange
    '#FF69B4', // Hot Pink
    '#7F7F7F', // Grey
    '#5C366A', // Deep Purple
    '#2B908F', // Teal Blue
    '#F45B5B', // Salmon
    '#91E8E1', // Light Teal
    '#F7A35C', // Light Orange
    '#8085E9', // Light Purple
    '#F15C80', // Pink
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
      prepareCountyProjectsData();
      prepareSubcategoryData();
      calculateTopMetrics();
      
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
        setSubcategoryChartData(generateEmptySubcategoryData());
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
        setSubcategoryChartData(generateEmptySubcategoryData());
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
      setSubcategoryChartData(generateEmptySubcategoryData());
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

  const extractCounties = (projectsData) => {
    const uniqueCounties = [...new Set(projectsData
      .filter(project => project.planning_county)
      .map(project => project.planning_county))];
    
    setCounties(uniqueCounties);
    return uniqueCounties;
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

    // Use all counties from project data
    const countyData = {};
    
    // Initialize counties with 0 values
    counties.forEach(county => {
      countyData[county] = 0;
    });
    
    // Filter projects based on user selections
    let filteredProjects = [...projects];
    
    if (selectedCategory) {
      filteredProjects = filteredProjects.filter(p => p.planning_category === selectedCategory);
    }
    
    if (selectedSubcategory) {
      filteredProjects = filteredProjects.filter(p => p.planning_subcategory === selectedSubcategory);
    }
    
    if (selectedTimeRange) {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - parseInt(selectedTimeRange));
      filteredProjects = filteredProjects.filter(p => {
        if (!p.planning_decision_date) return true;
        const decisionDate = new Date(p.planning_decision_date);
        return decisionDate >= cutoffDate;
      });
    }
    
    if (selectedCounty) {
      filteredProjects = filteredProjects.filter(p => p.planning_county === selectedCounty);
    }
    
    // Calculate values by county
    filteredProjects.forEach(project => {
      const county = project.planning_county;
      if (county && counties.includes(county)) {
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
    
    // Filter projects based on user selections
    let filteredProjects = [...projects];
    
    // Apply category filter if selected
    if (selectedCategory) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_category === selectedCategory
      );
    }
    
    // Apply subcategory filter if selected
    if (selectedSubcategory) {
      filteredProjects = filteredProjects.filter(project => 
        project.planning_subcategory === selectedSubcategory
      );
    }
    
    // Apply time range filter if selected
    if (selectedTimeRange) {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - parseInt(selectedTimeRange));
      
      filteredProjects = filteredProjects.filter(project => {
        if (!project.planning_date) return true;
        const projectDate = new Date(project.planning_date);
        return projectDate >= cutoffDate;
      });
    }
    
    // Group projects by county and calculate total value
    const countyData = {};
    filteredProjects.forEach(project => {
      const county = project.planning_county || 'Unspecified';
      if (!countyData[county]) {
        countyData[county] = 0;
      }
      countyData[county] += (project.planning_value || 0);
    });
    
    // Convert to chart.js format
    const labels = Object.keys(countyData);
    const values = Object.values(countyData);
    
    // Generate colors for each county
    const backgroundColors = labels.map((_, i) => colorPalette[i % colorPalette.length]);
    
    // Ensure we have at least 2 data points for a pie chart
    if (labels.length === 1) {
      labels.push('Other');
      values.push(0); // Add a zero-value segment
      backgroundColors.push('#e0e0e0'); // Gray color for empty segment
    }
    
    const data = {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => lightenColor(color, 10)),
          borderWidth: 1,
          hoverOffset: 4
        }
      ]
    };
    
    setCountyProjectsData(data);
  };

  const prepareSubcategoryData = () => {
    if (projects.length === 0) return;
    
    // Filter projects based on user selections
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
    
    if (selectedTimeRange) {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - parseInt(selectedTimeRange));
      
      filteredProjects = filteredProjects.filter(project => {
        if (!project.planning_date) return true;
        const projectDate = new Date(project.planning_date);
        return projectDate >= cutoffDate;
      });
    }
    
    // Group projects by subcategory and calculate total value
    const subcategoryData = {};
    
    filteredProjects.forEach(project => {
      const subcategory = project.planning_subcategory || 'Unspecified';
      if (!subcategoryData[subcategory]) {
        subcategoryData[subcategory] = 0;
      }
      subcategoryData[subcategory] += (project.planning_value || 0);
    });

    // If no data is available after filtering, show message for all subcategories
    if (Object.keys(subcategoryData).length === 0) {
      if (selectedCategory) {
        // If a category is selected but no subcategories, show "No subcategories"
        subcategoryData['No subcategories found'] = 1;
      } else {
        // If no category is selected, show all subcategories across all projects
        projects.forEach(project => {
          const subcategory = project.planning_subcategory || 'Unspecified';
          if (!subcategoryData[subcategory]) {
            subcategoryData[subcategory] = 0;
          }
          subcategoryData[subcategory] += (project.planning_value || 0);
        });
      }
    }
    
    // Prepare chart data format
    const data = {
      labels: Object.keys(subcategoryData),
      datasets: [{
        label: 'Project Value',
        data: Object.values(subcategoryData),
        backgroundColor: colorPalette.slice(0, Object.keys(subcategoryData).length),
        borderColor: colorPalette.slice(0, Object.keys(subcategoryData).length),
        borderWidth: 1
      }]
    };
    
    setSubcategoryChartData(data);
  };

  const calculateTopMetrics = () => {
    if (projects.length === 0) return;
    
    // Group projects by county and calculate total value and count
    const countyMetrics = {};
    
    projects.forEach(project => {
      const county = project.planning_county || 'Unknown';
      if (!countyMetrics[county]) {
        countyMetrics[county] = {
          totalValue: 0,
          count: 0
        };
      }
      countyMetrics[county].totalValue += (project.planning_value || 0);
      countyMetrics[county].count += 1;
    });
    
    // Find top county by value
    let maxValue = 0;
    let maxValueCounty = '';
    
    // Find top county by project count
    let maxProjects = 0;
    let maxProjectsCounty = '';
    
    Object.entries(countyMetrics).forEach(([county, metrics]) => {
      if (metrics.totalValue > maxValue) {
        maxValue = metrics.totalValue;
        maxValueCounty = county;
      }
      
      if (metrics.count > maxProjects) {
        maxProjects = metrics.count;
        maxProjectsCounty = county;
      }
    });
    
    setTopCounty(maxValueCounty);
    setTopCountyValue(maxValue);
    setTopProjectsCounty(maxProjectsCounty);
    setTopProjectsCount(maxProjects);
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
    // Generate empty county data with proper structure
    const emptyLabels = counties.length > 0 ? counties : ['No Counties Available'];
    const emptyValues = counties.length > 0 ? counties.map(() => 0) : [0];
    
    return {
      labels: emptyLabels,
      datasets: [{
        label: 'County Value',
        data: emptyValues,
        backgroundColor: colorPalette.slice(0, emptyLabels.length),
        borderColor: colorPalette.slice(0, emptyLabels.length),
        borderWidth: 1
      }]
    };
  };

  const generateEmptySubcategoryData = () => {
    return {
      labels: ['No Subcategories Available'],
      datasets: [{
        label: 'Projects',
        data: [0],
        backgroundColor: colorPalette[0],
        borderColor: colorPalette[0],
        borderWidth: 1
      }]
    };
  };

  useEffect(() => {
    document.title = "Analytics | Infrastructure Tracking";
    // Initialize charts with loading state
    setChartData(generateEmptyChartData());
    setStagesData(generateEmptyStagesData());
    setCountyChartData(generateEmptyCountyData());
    setCountyProjectsData(generateEmptyCountyData());
    setSubcategoryChartData(generateEmptySubcategoryData());
    
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

  useEffect(() => {
    if (projects.length > 0) {
      extractCounties(projects);
    }
  }, [projects]);

  // Function to clear all filters
  const clearAllFilters = () => {
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSelectedTimeRange('10');
    setSelectedCounty('');
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 15,
        right: 15,
        top: 15,
        bottom: 15
      }
    },
    plugins: {
      legend: {
        position: 'right',
        align: 'center',
        labels: {
          boxWidth: 10, 
          padding: 8,
          font: {
            size: 11
          },
          color: function(context) {
            // Dynamically set color based on current theme (dark or light)
            return getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
          },
          generateLabels: (chart) => {
            const datasets = chart.data.datasets;
            return chart.data.labels.map((label, i) => {
              // Truncate long labels but don't add percentages
              return {
                text: label.length > 15 ? label.substring(0, 12) + '...' : label,
                fillStyle: datasets[0].backgroundColor[i],
                strokeStyle: datasets[0].borderColor[i],
                lineWidth: 1,
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
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 1,
        padding: 10,
        bodyFont: {
          size: 12
        }
      }
    }
  };

  return (
    <ErrorBoundary
      fallbackTitle="Analytics Issue"
      fallbackMessage="We're having trouble displaying the analytics. Please try again later."
      retryButton={true}
    >
      <div className="analytics-dashboard">
        <h1>Analytics Dashboard</h1>
        
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading analytics data...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards Section - Centered with shadow container */}
            <div className="dashboard-container">
              <div className="dashboard-header">
                <div className="summary-section">
                  <div className="analytics-summary">
                    <div className="summary-card">
                      <h3>Total Projects</h3>
                      <p className="summary-value">{projects.length}</p>
                      <div className="summary-icon">
                        <i className="fas fa-folder"></i>
                      </div>
                    </div>
                    <div className="summary-card">
                      <h3>Total Value</h3>
                      <p className="summary-value">
                        {formatCurrency(projects.reduce((total, project) => total + (project.planning_value || 0), 0))}
                      </p>
                      <div className="summary-icon">
                        <i className="fas fa-euro-sign"></i>
                      </div>
                    </div>
                    <div className="summary-card">
                      <h3>Active Filters</h3>
                      <p className="summary-value">{activeFilters.length}</p>
                      <small className="summary-detail">Showing {filteredProjectCount} filtered projects</small>
                      <div className="summary-icon">
                        <i className="fas fa-filter"></i>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="filters-section">
                  <div className="filter-controls-row">
                    <div className="filter-group">
                      <label htmlFor="categoryFilter">
                        <i className="fas fa-folder-open"></i> Category
                      </label>
                      <select 
                        id="categoryFilter" 
                        value={selectedCategory}
                        onChange={handleCategoryChange}
                        className="filter-select"
                      >
                        <option value="">All Categories</option>
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-group">
                      <label htmlFor="subcategoryFilter">
                        <i className="fas fa-tag"></i> Subcategory
                      </label>
                      <select 
                        id="subcategoryFilter" 
                        value={selectedSubcategory}
                        onChange={handleSubcategoryChange}
                        className="filter-select"
                        disabled={!selectedCategory}
                      >
                        <option value="">All Subcategories</option>
                        {subcategories.map(subcategory => (
                          <option key={subcategory} value={subcategory}>{subcategory}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-group">
                      <label htmlFor="countyFilter">
                        <i className="fas fa-map-marker-alt"></i> County
                      </label>
                      <select 
                        id="countyFilter" 
                        value={selectedCounty}
                        onChange={handleCountyChange}
                        className="filter-select"
                      >
                        <option value="">All Counties</option>
                        {counties.map(county => (
                          <option key={county} value={county}>{county}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-group">
                      <label htmlFor="timeRangeFilter">
                        <i className="fas fa-calendar-alt"></i> Time Range
                      </label>
                      <select 
                        id="timeRangeFilter" 
                        value={selectedTimeRange}
                        onChange={handleTimeRangeChange}
                        className="filter-select"
                      >
                        {timeRangeOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {activeFilters.length > 0 && (
                    <div className="active-filters">
                      <span><i className="fas fa-filter"></i> Active Filters: </span>
                      {activeFilters.map((filter, index) => (
                        <span key={index} className="filter-badge">
                          {filter}
                        </span>
                      ))}
                      <button 
                        className="clear-filters-btn" 
                        onClick={clearAllFilters}
                        aria-label="Clear all filters"
                      >
                        <i className="fas fa-times"></i> Clear All
                      </button>
                    </div>
                  )}
                </div>
              
                <div className="view-toggle">
                  <button 
                    className={`toggle-btn ${activeTab === 'charts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('charts')}
                  >
                    <i className="fas fa-chart-pie"></i> Charts View
                  </button>
                  <button 
                    className={`toggle-btn ${activeTab === 'metrics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('metrics')}
                  >
                    <i className="fas fa-table"></i> County Metrics
                  </button>
                </div>
              </div>

              {activeTab === 'charts' ? (
                <div className="charts-view">
                  {/* Category & Value Analysis - First row */}
                  <div className="chart-section">
                    <h3 className="section-header">Category & Value Analysis</h3>
                    <div className="chart-grid">
                      <div className="chart-container pie-container">
                        <h3>Category Value Distribution</h3>
                        <ChartWrapper chartType="Pie" title="Category Distribution">
                          <Pie 
                            data={chartData} 
                            options={pieOptions}
                          />
                        </ChartWrapper>
                      </div>
                      <div className="chart-container">
                        <h3>Value by Project Stage</h3>
                        <ChartWrapper chartType="Bar" title="Project Stages">
                          <Bar 
                            data={stagesData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { 
                                  position: 'top',
                                  labels: { boxWidth: 10, padding: 5 }
                                },
                                tooltip: {
                                  callbacks: {
                                    label: (context) => {
                                      return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        </ChartWrapper>
                      </div>
                    </div>
                  </div>

                  {/* Subcategory & County Analysis - Second row */}
                  <div className="chart-section">
                    <h3 className="section-header">Subcategory & County Analysis</h3>
                    <div className="chart-grid">
                      <div className="chart-container pie-container">
                        <h3>Subcategory Spending Distribution</h3>
                        <ChartWrapper chartType="Pie" title="Subcategory Spending">
                          <Pie 
                            data={subcategoryChartData} 
                            options={pieOptions}
                          />
                        </ChartWrapper>
                      </div>
                      <div className="chart-container">
                        <h3>Project Value by County</h3>
                        <ChartWrapper chartType="Bar" title="County Values">
                          <Bar 
                            data={countyChartData} 
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { 
                                  position: 'top',
                                  labels: { boxWidth: 10, padding: 5 }
                                },
                                tooltip: {
                                  callbacks: {
                                    label: (context) => {
                                      return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        </ChartWrapper>
                      </div>
                    </div>
                  </div>

                  {/* Comparative Value Analysis - Third row */}
                  <div className="chart-section">
                    <h3 className="section-header">Comparative Value Analysis</h3>
                    <div className="chart-grid">
                      <div className="chart-container pie-container">
                        <h3>County Value Comparison</h3>
                        <ChartWrapper chartType="Pie" title="County Value Distribution">
                          <Pie 
                            data={countyProjectsData} 
                            options={pieOptions}
                          />
                        </ChartWrapper>
                      </div>
                      <div className="chart-container comparative-analysis-container">
                        <h3>Comparative Analysis</h3>
                        <div className="comparative-metrics">
                          <div className="metric-card">
                            <div className="metric-icon">
                              <i className="fas fa-trophy"></i>
                            </div>
                            <div className="metric-content">
                              <h4>Most Valuable County</h4>
                              <p className="metric-value">{topCounty || 'None'}</p>
                              <p className="metric-detail">
                                Value: {formatCurrency(topCountyValue)}
                              </p>
                            </div>
                          </div>
                          <div className="metric-card">
                            <div className="metric-icon">
                              <i className="fas fa-chart-line"></i>
                            </div>
                            <div className="metric-content">
                              <h4>Most Projects</h4>
                              <p className="metric-value">{topProjectsCounty || 'None'}</p>
                              <p className="metric-detail">
                                Count: {topProjectsCount} projects
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="metrics-view">
                  <div className="county-metrics-section">
                    <h3 className="section-header">County Metrics</h3>
                    <div className="metrics-table-container">
                      <table className="metrics-table">
                        <thead>
                          <tr>
                            <th>County</th>
                            <th>Projects</th>
                            <th>Total Value</th>
                            <th>Avg. Value</th>
                            <th>Categories</th>
                            <th>Planning %</th>
                            <th>Construction %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {counties.length > 0 ? (
                            counties.map(county => {
                              // Calculate county-specific metrics
                              const countyProjects = projects.filter(p => p.planning_county === county);
                              const countyProjectCount = countyProjects.length;
                              const countyTotalValue = countyProjects.reduce((sum, p) => sum + (p.planning_value || 0), 0);
                              const countyAvgValue = countyProjectCount > 0 ? countyTotalValue / countyProjectCount : 0;
                              
                              // Calculate project stages for county
                              const planningCount = countyProjects.filter(p => 
                                p.planning_status === 'Application' || 
                                p.planning_status === 'Decision').length;
                              const constructionCount = countyProjects.filter(p => 
                                p.planning_status === 'Commenced' || 
                                p.planning_status === 'Completed').length;
                              
                              const planningPercentage = countyProjectCount > 0 
                                ? (planningCount / countyProjectCount) * 100 
                                : 0;
                              
                              const constructionPercentage = countyProjectCount > 0 
                                ? (constructionCount / countyProjectCount) * 100 
                                : 0;
                              
                              // Get unique categories in this county
                              const uniqueCategories = [...new Set(countyProjects
                                .filter(p => p.planning_category)
                                .map(p => p.planning_category))];
                              
                              return (
                                <tr key={county} className={selectedCounty === county ? 'selected-row' : ''}>
                                  <td className="county-name">{county}</td>
                                  <td>{countyProjectCount}</td>
                                  <td>{formatCurrency(countyTotalValue)}</td>
                                  <td>{formatCurrency(countyAvgValue)}</td>
                                  <td>{uniqueCategories.length}</td>
                                  <td>
                                    <div className="progress-bar-cell">
                                      <span>{planningPercentage.toFixed(0)}%</span>
                                      <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${planningPercentage}%` }}></div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="progress-bar-cell">
                                      <span>{constructionPercentage.toFixed(0)}%</span>
                                      <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${constructionPercentage}%` }}></div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="7" className="empty-data">No county data available. Try different filters or add more projects.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Analytics;
