import React, { useState } from 'react';
import { FaBell, FaExternalLinkAlt, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './ProjectUpdateNotification.css';

const ProjectUpdateNotification = ({ notification, onMarkAsRead }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  
  // Format the timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    // If the date is today, show time only
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
    
    if (isToday) {
      return `Today at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // If the date is yesterday, show "Yesterday"
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
                        date.getMonth() === yesterday.getMonth() &&
                        date.getFullYear() === yesterday.getFullYear();
    
    if (isYesterday) {
      return `Yesterday at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Otherwise, show full date
    return `${date.toLocaleDateString()} at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'status_change':
        return <FaInfoCircle className="notification-icon status-change" />;
      case 'value_change':
        return <FaInfoCircle className="notification-icon value-change" />;
      case 'document_update':
        return <FaInfoCircle className="notification-icon document-update" />;
      default:
        return <FaBell className="notification-icon" />;
    }
  };
  
  // Handle view project click
  const handleViewProject = () => {
    if (notification.projectId) {
      navigate(`/project/${notification.projectId}`);
    }
  };
  
  // Handle mark as read
  const handleMarkAsRead = (e) => {
    e.stopPropagation();
    if (onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };
  
  return (
    <div 
      className={`project-update-notification ${notification.read ? 'read' : 'unread'}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="notification-header">
        {getNotificationIcon(notification.type)}
        <div className="notification-title">
          <h4>{notification.title}</h4>
          <span className="notification-time">{formatDate(notification.timestamp)}</span>
        </div>
        {!notification.read && (
          <button 
            className="mark-read-button" 
            onClick={handleMarkAsRead}
            aria-label="Mark as read"
          >
            <FaCheckCircle />
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="notification-details">
          <p>{notification.message}</p>
          {notification.projectId && (
            <button 
              className="view-project-button" 
              onClick={handleViewProject}
            >
              <FaExternalLinkAlt /> View Project
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectUpdateNotification;
