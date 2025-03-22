import React, { useState, useEffect } from 'react';
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
  Title
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import config from '../config';
import './Analytics.css';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

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
  const [chartData, setChartData] = useState(null);
  const [stagesData, setStagesData] = useState(null);
  const [chartReady, setChartReady] = useState(false); // Track if charts are ready to display

  // Color palette for charts
  const colorPalette = [
    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
    '#5a5c69', '#6610f2', '#6f42c1', '#e83e8c', '#fd7e14'
  ];

  useEffect(() => {
    fetchAllProjects();
    fetchTrackedProjects();
    fetchCategories();
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
      // Add a small delay to ensure charts render properly
      const timer = setTimeout(() => {
        setChartReady(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [projects, selectedCategory, selectedSubcategory, selectedTimeRange]);

  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      
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
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackedProjects = async () => {
    try {
      if (!currentUser) return;
      
      const q = query(
        collection(db, 'trackedProjects'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const trackedProjectsData = [];
      
      querySnapshot.forEach(doc => {
        trackedProjectsData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setTrackedProjects(trackedProjectsData);
    } catch (error) {
      console.error('Error fetching tracked projects for analytics:', error);
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

    // Filter projects by date range and category/subcategory if selected
    let filteredProjects = projects.filter(project => {
      // Handle date conversion - ensure we have a Date object
      let projectDate = project.planning_application_date;
      if (typeof projectDate === 'string') {
        projectDate = new Date(projectDate);
      }
      
      // Skip projects without a valid date
      if (!projectDate || isNaN(projectDate.getTime())) return false;
      
      // Check if project is within the selected time range
      const isInTimeRange = projectDate >= startDate && projectDate <= endDate;
      
      // Apply category filter if selected
      const matchesCategory = !selectedCategory || project.planning_category === selectedCategory;
      
      // Apply subcategory filter if selected
      const matchesSubcategory = !selectedSubcategory || project.planning_subcategory === selectedSubcategory;
      
      return isInTimeRange && matchesCategory && matchesSubcategory;
    });

    console.log(`Filtered to ${filteredProjects.length} projects within date range`);

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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IE', { 
      style: 'currency', 
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="analytics-container">
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
                  <div style={{ height: '300px', width: '100%', position: 'relative' }}>
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
                  </div>
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
                  <div style={{ height: '300px', width: '100%', position: 'relative' }}>
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
                  </div>
                ) : (
                  <div className="no-data-message">
                    <p>No stage data available</p>
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
        </div>
        <div className="summary-card">
          <h3>Total Value</h3>
          <p className="summary-value">
            {formatCurrency(projects.reduce((total, project) => total + (project.planning_value || 0), 0))}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
