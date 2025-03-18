import React from 'react';
import PieChart from './charts/PieChart';
import BarChart from './charts/BarChart';
import './charts/ChartStyles.css';

/**
 * DashboardVisualizations Component
 * Organizes and displays all data visualization charts for the dashboard
 * 
 * @param {Object} props Component props
 * @param {Object} props.dashboardCache Dashboard cache data with statistics
 * @param {Array} props.trackedProjects Array of tracked projects
 * @param {boolean} props.loading Whether data is still loading
 * @param {Array} props.visibleWidgets Array of widget names that should be visible
 */
const DashboardVisualizations = ({ 
  dashboardCache, 
  trackedProjects = [], 
  loading = false,
  visibleWidgets = ['projectDistribution', 'valueDistribution'] 
}) => {
  // Check if the widget should be visible
  const isWidgetVisible = (widgetName) => visibleWidgets.includes(widgetName);
  
  // Prepare data for Project Type Distribution (Pie Chart)
  const prepareProjectTypeData = () => {
    // First check if we have cached data
    if (dashboardCache?.projectsByStatus && Object.keys(dashboardCache.projectsByStatus).length > 0) {
      return {
        labels: Object.keys(dashboardCache.projectsByStatus),
        data: Object.values(dashboardCache.projectsByStatus)
      };
    }
    
    // If no cache, calculate from tracked projects
    if (trackedProjects && trackedProjects.length > 0) {
      const statusCounts = {};
      
      trackedProjects.forEach(project => {
        const status = project.planning_stage || project.status || project.stage || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      return {
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts)
      };
    }
    
    return { labels: [], data: [] };
  };
  
  // Prepare data for Project Value Distribution (Bar Chart)
  const prepareValueDistributionData = () => {
    // First check if we have cached data
    if (dashboardCache?.valueByCategory && Object.keys(dashboardCache.valueByCategory).length > 0) {
      return {
        labels: Object.keys(dashboardCache.valueByCategory),
        data: Object.values(dashboardCache.valueByCategory)
      };
    }
    
    // If no cache, calculate from tracked projects
    if (trackedProjects && trackedProjects.length > 0) {
      const valueByCategory = {};
      
      trackedProjects.forEach(project => {
        const category = project.category || project.planning_category || project.type || 'Other';
        const rawValue = project.projectValue || project.planning_value || project.value || 0;
        
        // Convert value to number
        let numericValue = 0;
        if (rawValue) {
          if (typeof rawValue === 'string') {
            // Remove currency symbols, commas, etc
            numericValue = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, '')) || 0;
          } else {
            numericValue = parseFloat(rawValue) || 0;
          }
        }
        
        valueByCategory[category] = (valueByCategory[category] || 0) + numericValue;
      });
      
      return {
        labels: Object.keys(valueByCategory),
        data: Object.values(valueByCategory)
      };
    }
    
    return { labels: [], data: [] };
  };

  // Get data for the charts
  const projectTypeData = prepareProjectTypeData();
  const valueDistributionData = prepareValueDistributionData();
  
  // Calculate total project value
  const calculateTotalValue = () => {
    return trackedProjects.reduce((total, project) => {
      const rawValue = project.projectValue || project.planning_value || project.value || project.budget || 0;
      let numValue = 0;
      try {
        numValue = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, '')) || 0;
      } catch (e) {
        numValue = 0;
      }
      return total + numValue;
    }, 0);
  };

  // Count projects by status for summary card
  const getTopStatus = () => {
    if (!trackedProjects || trackedProjects.length === 0) return { status: 'None', count: 0 };
    
    const statusCounts = {};
    trackedProjects.forEach(project => {
      const status = project.planning_stage || project.status || project.stage || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    let topStatus = '';
    let topCount = 0;
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      if (count > topCount) {
        topStatus = status;
        topCount = count;
      }
    });
    
    return { status: topStatus, count: topCount };
  };

  const totalValue = calculateTotalValue();
  const topStatus = getTopStatus();

  return (
    <div className="dashboard-visualizations">
      {/* Summary Statistics Cards */}
      <div className="visualization-summary">
        <div className="summary-card">
          <div className="summary-icon">
            <i className="fas fa-clipboard-list"></i>
          </div>
          <div className="summary-content">
            <h3 className="summary-value">{dashboardCache?.totalTrackedProjects || trackedProjects.length}</h3>
            <p className="summary-label">Total Projects</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon">
            <i className="fas fa-euro-sign"></i>
          </div>
          <div className="summary-content">
            <h3 className="summary-value">€{totalValue.toLocaleString()}</h3>
            <p className="summary-label">Total Value</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon">
            <i className="fas fa-chart-pie"></i>
          </div>
          <div className="summary-content">
            <h3 className="summary-value">{topStatus.status} ({topStatus.count})</h3>
            <p className="summary-label">Top Project Status</p>
          </div>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="charts-grid">
        {isWidgetVisible('projectDistribution') && (
          <div className="chart-container-card">
            <PieChart 
              labels={projectTypeData.labels}
              data={projectTypeData.data}
              title="Project Status Distribution"
              loading={loading}
            />
          </div>
        )}
        
        {isWidgetVisible('valueDistribution') && (
          <div className="chart-container-card">
            <BarChart 
              labels={valueDistributionData.labels}
              data={valueDistributionData.data}
              title="Project Value by Category"
              xAxisLabel="Categories"
              yAxisLabel="Value (€)"
              isCurrency={true}
              loading={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardVisualizations;
