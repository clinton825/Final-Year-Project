import React from 'react';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { useTheme } from '../../../contexts/ThemeContext';
import './ChartStyles.css';

// Register the components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * BarChart Component
 * Display project values by category, budget segmentation by type, or contractor
 * 
 * @param {Object} props Component props
 * @param {Array} props.labels Labels for each bar in the chart
 * @param {Array} props.data Data values for each bar
 * @param {String} props.title Chart title
 * @param {Boolean} props.loading Whether data is still loading
 * @param {String} props.xAxisLabel Label for the x-axis
 * @param {String} props.yAxisLabel Label for the y-axis
 * @param {Boolean} props.isCurrency Whether to format the y-axis values as currency
 */
const BarChart = ({ 
  labels, 
  data, 
  title = 'Project Values',
  loading = false,
  xAxisLabel = 'Categories',
  yAxisLabel = 'Value (€)',
  isCurrency = true
}) => {
  const { darkMode } = useTheme();
  
  // Default colors with both light mode and dark mode options
  const defaultColors = {
    light: {
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      hoverBackgroundColor: 'rgba(54, 162, 235, 0.8)'
    },
    dark: {
      backgroundColor: 'rgba(54, 162, 235, 0.7)',
      borderColor: 'rgba(54, 162, 235, 1)',
      hoverBackgroundColor: 'rgba(54, 162, 235, 0.9)'
    }
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
        label: title,
        data: data,
        backgroundColor: colorScheme.backgroundColor,
        borderColor: colorScheme.borderColor,
        borderWidth: 1,
        hoverBackgroundColor: colorScheme.hoverBackgroundColor
      },
    ],
  };
  
  // Format as currency if specified
  const formatYAxis = (value) => {
    if (isCurrency) {
      return '€' + value.toLocaleString('en-IE', { maximumFractionDigits: 0 });
    }
    return value.toLocaleString();
  };
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          callback: function(value) {
            return formatYAxis(value);
          }
        },
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        title: {
          display: true,
          text: yAxisLabel,
          color: darkMode ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
          font: {
            size: 12,
            weight: 'normal'
          }
        }
      },
      x: {
        ticks: {
          color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
        },
        grid: {
          display: false
        },
        title: {
          display: true,
          text: xAxisLabel,
          color: darkMode ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
          font: {
            size: 12,
            weight: 'normal'
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
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
        },
        callbacks: {
          label: function(context) {
            let value = context.raw;
            if (isCurrency) {
              return '€' + value.toLocaleString('en-IE', { maximumFractionDigits: 0 });
            }
            return value.toLocaleString();
          }
        }
      }
    }
  };

  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-wrapper">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default BarChart;
