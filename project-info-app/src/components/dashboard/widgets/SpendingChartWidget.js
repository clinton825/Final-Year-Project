import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { FaChartPie } from 'react-icons/fa';
import './WidgetStyles.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const SpendingChartWidget = ({ data }) => {
  const { valueByCategory } = data;
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Prepare chart data
  const preparePieChartData = () => {
    if (!valueByCategory || Object.keys(valueByCategory).length === 0) {
      return null;
    }

    const labels = Object.keys(valueByCategory);
    const data = Object.values(valueByCategory);
    const backgroundColors = [
      '#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6', 
      '#1abc9c', '#f39c12', '#d35400', '#c0392b', '#8e44ad'
    ];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors.slice(0, labels.length),
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.5)'
        }
      ]
    };
  };

  const chartData = preparePieChartData();

  if (!chartData) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <FaChartPie />
        </div>
        <h3 className="empty-title">No Spending Data</h3>
        <p className="empty-message">
          There is no project value data available for visualization. Track projects with value information to see spending distribution.
        </p>
      </div>
    );
  }

  return (
    <div className="spending-chart-widget">
      <div className="chart-container">
        <Pie 
          data={chartData} 
          options={{
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  boxWidth: 15,
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
              }
            },
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: 20
            }
          }}
        />
      </div>
    </div>
  );
};

export default SpendingChartWidget;
