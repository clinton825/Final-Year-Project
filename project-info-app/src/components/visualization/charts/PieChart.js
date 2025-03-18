import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useTheme } from '../../../contexts/ThemeContext';
import './ChartStyles.css';

// Register the components
ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * PieChart Component
 * Display project distribution by category, type, or location
 * 
 * @param {Object} props Component props
 * @param {Array} props.labels Labels for each segment of the pie
 * @param {Array} props.data Data values for each segment
 * @param {String} props.title Chart title
 * @param {Boolean} props.loading Whether data is still loading
 */
const PieChart = ({ labels, data, title = 'Project Distribution', loading = false }) => {
  const { darkMode } = useTheme();
  
  // Default colors with both light mode and dark mode options
  const defaultColors = {
    light: [
      'rgba(54, 162, 235, 0.8)', // Blue
      'rgba(255, 99, 132, 0.8)',  // Pink
      'rgba(255, 206, 86, 0.8)',  // Yellow
      'rgba(75, 192, 192, 0.8)',  // Teal
      'rgba(153, 102, 255, 0.8)', // Purple
      'rgba(255, 159, 64, 0.8)',  // Orange
      'rgba(199, 199, 199, 0.8)'  // Grey
    ],
    dark: [
      'rgba(54, 162, 235, 0.9)', // Blue
      'rgba(255, 99, 132, 0.9)',  // Pink
      'rgba(255, 206, 86, 0.9)',  // Yellow
      'rgba(75, 192, 192, 0.9)',  // Teal
      'rgba(153, 102, 255, 0.9)', // Purple
      'rgba(255, 159, 64, 0.9)',  // Orange
      'rgba(199, 199, 199, 0.9)'  // Grey
    ]
  };

  // Use default color scheme based on theme
  const colorScheme = darkMode ? defaultColors.dark : defaultColors.light;
  
  // If data is still loading, display empty chart with a loading message
  if (loading) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">{title}</h3>
        <div className="chart-loading">Loading chart data...</div>
      </div>
    );
  }
  
  // If no data available, show empty state
  if (!data || data.length === 0 || !labels || labels.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">{title}</h3>
        <div className="chart-empty-state">No data available for this chart</div>
      </div>
    );
  }
  
  // Prepare chart data
  const chartData = {
    labels: labels,
    datasets: [
      {
        data: data,
        backgroundColor: colorScheme,
        borderColor: darkMode ? 'rgba(30, 30, 30, 1)' : 'white',
        borderWidth: 1,
      },
    ],
  };
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          font: {
            size: 12
          },
          color: darkMode ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)'
        }
      },
      tooltip: {
        backgroundColor: darkMode ? 'rgba(50, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: darkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
        bodyColor: darkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
        borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 3,
        bodyFont: {
          size: 14
        },
        titleFont: {
          size: 16,
          weight: 'bold'
        }
      }
    }
  };

  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-wrapper">
        <Pie data={chartData} options={options} />
      </div>
    </div>
  );
};

export default PieChart;
