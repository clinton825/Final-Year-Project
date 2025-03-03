import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnboarding } from '../../contexts/OnboardingContext';
import Tooltip from '../common/Tooltip';
import './GettingStartedWidget.css';

const GettingStartedWidget = () => {
  const { onboardingTasks, completeTask, forceShowWelcomeGuide } = useOnboarding();
  const [progress, setProgress] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Calculate progress percentage
  useEffect(() => {
    if (!onboardingTasks) return;
    
    const completedCount = Object.values(onboardingTasks).filter(task => task.completed).length;
    const totalTasks = Object.keys(onboardingTasks).length;
    const newProgress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
    
    setProgress(newProgress);
    
    // Auto-hide widget when all tasks are completed (after animation)
    if (newProgress === 100) {
      setTimeout(() => {
        setFadeOut(true);
      }, 3000);
    }
  }, [onboardingTasks]);

  const handleTaskClick = (taskId) => {
    if (onboardingTasks[taskId].completed) return;
    completeTask(taskId);
  };

  // Don't render if all tasks completed and faded out
  if (fadeOut && progress === 100) return null;
  
  // Don't render if no tasks defined
  if (!onboardingTasks || Object.keys(onboardingTasks).length === 0) return null;

  return (
    <div className={`getting-started-widget ${fadeOut ? 'fade-out' : ''}`}>
      <div className="widget-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="header-content">
          <i className="fas fa-rocket"></i>
          <h3>Getting Started</h3>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="progress-text">{progress}% complete</span>
        </div>
        <button className="collapse-button">
          <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="widget-content">
          <div className="intro-text">
            <p>Complete these tasks to get the most out of your experience:</p>
            <button 
              className="guide-button" 
              onClick={forceShowWelcomeGuide}
            >
              <i className="fas fa-play-circle"></i> Replay Welcome Guide
            </button>
          </div>
          
          <ul className="task-list">
            {Object.entries(onboardingTasks).map(([taskId, task]) => (
              <li 
                key={taskId} 
                className={`task-item ${task.completed ? 'completed' : ''}`}
                onClick={() => handleTaskClick(taskId)}
              >
                <Tooltip text={task.description || 'Click to mark as completed'}>
                  <div className="task-content">
                    <div className="task-status">
                      {task.completed ? (
                        <i className="fas fa-check-circle"></i>
                      ) : (
                        <i className="far fa-circle"></i>
                      )}
                    </div>
                    <div className="task-info">
                      <span className="task-name">{task.name}</span>
                      <Link to={task.linkTo || '#'} className="task-link">
                        {task.linkText || 'Start'}
                        <i className="fas fa-arrow-right"></i>
                      </Link>
                    </div>
                  </div>
                </Tooltip>
              </li>
            ))}
          </ul>
          
          {progress === 100 && (
            <div className="completion-message">
              <i className="fas fa-trophy"></i>
              <p>Great job! You've completed all getting started tasks.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GettingStartedWidget;
