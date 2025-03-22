import React from 'react';
import { FaProjectDiagram, FaEuroSign, FaCheckCircle, FaClipboardList } from 'react-icons/fa';
import './WidgetStyles.css';

const SummaryStatsWidget = ({ data }) => {
  const { trackedProjects, valueByCategory } = data;

  // Calculate total project value
  const totalValue = Object.values(valueByCategory || {}).reduce((sum, value) => sum + value, 0);
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Count completed projects
  const completedProjects = trackedProjects
    ? trackedProjects.filter(project => 
        project.status === 'Completed' || 
        project.planning_stage === 'Completed' || 
        project.stage === 'Completed')
      .length
    : 0;
    
  // Count active projects
  const activeProjects = trackedProjects ? trackedProjects.length - completedProjects : 0;

  return (
    <div className="summary-stats-container">
      <div className="summary-stat-card">
        <div className="stat-icon">
          <FaProjectDiagram />
        </div>
        <div className="stat-value">{trackedProjects?.length || 0}</div>
        <div className="stat-label">Tracked Projects</div>
      </div>
      
      <div className="summary-stat-card">
        <div className="stat-icon">
          <FaEuroSign />
        </div>
        <div className="stat-value">{formatCurrency(totalValue)}</div>
        <div className="stat-label">Total Value</div>
      </div>
        
      <div className="summary-stat-card">
        <div className="stat-icon">
          <FaCheckCircle />
        </div>
        <div className="stat-value">{completedProjects}</div>
        <div className="stat-label">Completed Projects</div>
      </div>
      
      <div className="summary-stat-card">
        <div className="stat-icon">
          <FaClipboardList />
        </div>
        <div className="stat-value">{activeProjects}</div>
        <div className="stat-label">Active Projects</div>
      </div>
    </div>
  );
};

export default SummaryStatsWidget;
