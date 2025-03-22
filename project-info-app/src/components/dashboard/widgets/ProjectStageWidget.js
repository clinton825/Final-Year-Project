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
import { FaChartBar } from 'react-icons/fa';
import './WidgetStyles.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend
);

const ProjectStageWidget = ({ data }) => {
  const { projectsByStatus } = data;
  
  // Prepare chart data
  const prepareBarChartData = () => {
    if (!projectsByStatus || Object.keys(projectsByStatus).length === 0) {
      return null;
    }

    const labels = Object.keys(projectsByStatus);
    const data = Object.values(projectsByStatus);
    
    return {
      labels,
      datasets: [
        {
          label: 'Projects',
          data,
          backgroundColor: '#3498db',
          borderColor: '#2980b9',
          borderWidth: 1,
        }
      ]
    };
  };

  const chartData = prepareBarChartData();

  if (!chartData) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <FaChartBar />
        </div>
        <h3 className="empty-title">No Stage Data</h3>
        <p className="empty-message">
          There are no projects with stage information to visualize. Track projects with different stages to see this distribution.
        </p>
      </div>
    );
  }

  return (
    <div className="project-stage-widget">
      <div className="chart-container">
        <Bar 
          data={chartData} 
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
            barThickness: 20,
            layout: {
              padding: 10
            }
          }}
        />
      </div>
    </div>
  );
};

export default ProjectStageWidget;
