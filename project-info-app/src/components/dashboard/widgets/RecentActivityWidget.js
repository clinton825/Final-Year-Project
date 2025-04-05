import React, { useState } from 'react';
import { 
  FaPlus, FaMinus, FaEdit, FaEye, 
  FaRegFileAlt, FaHistory
} from 'react-icons/fa';
import './WidgetStyles.css';

const RecentActivityWidget = ({ data }) => {
  const [loading, setLoading] = useState(false);
  
  // Create fallback activities
  const fallbackActivities = [
    {
      id: 'fallback-1',
      type: 'track',
      projectName: 'Housing Development Project',
      timestamp: new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)),
      description: 'Tracked Housing Development Project'
    },
    {
      id: 'fallback-2',
      type: 'view',
      projectName: 'Town Center Renovation',
      timestamp: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)),
      description: 'Viewed Town Center Renovation details'
    },
    {
      id: 'fallback-3',
      type: 'note_add',
      projectName: 'Highway Extension Phase 2',
      timestamp: new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)),
      description: 'Added a note to Highway Extension Phase 2'
    },
    {
      id: 'fallback-4',
      type: 'edit',
      projectName: 'School Expansion Project',
      timestamp: new Date(Date.now() - (4 * 24 * 60 * 60 * 1000)),
      description: 'Updated School Expansion Project'
    },
    {
      id: 'fallback-5',
      type: 'untrack',
      projectName: 'Community Center',
      timestamp: new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)),
      description: 'Untracked Community Center'
    }
  ];

  // Format date
  const formatDate = (date) => {
    if (!date) return '';
    
    // If today, show time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Add extra validation for date
    if (!date || isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    if (date >= today) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If yesterday, show "Yesterday"
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= yesterday && date < today) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise, show full date
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get icon for activity type
  const getActivityIcon = (type) => {
    if (!type) return <FaHistory />;
    
    // Normalize the type to lowercase for better matching
    const normalizedType = type.toLowerCase();
    
    // Check for tracking activities
    if (normalizedType.includes('track') || normalizedType.includes('add')) {
      return <FaPlus />;
    }
    
    // Check for untracking activities
    if (normalizedType.includes('untrack') || normalizedType.includes('remov') || normalizedType.includes('delet')) {
      return <FaMinus />;
    }
    
    // Check for editing activities
    if (normalizedType.includes('edit') || normalizedType.includes('updat') || normalizedType.includes('chang') || 
        normalizedType.includes('modif')) {
      return <FaEdit />;
    }
    
    // Check for viewing activities
    if (normalizedType.includes('view') || normalizedType.includes('read') || normalizedType.includes('open') ||
        normalizedType.includes('access')) {
      return <FaEye />;
    }
    
    // Default icon
    return <FaHistory />;
  };

  // Get activity title
  const getActivityTitle = (activity) => {
    switch (activity.type) {
      case 'track':
        return 'Tracked a project';
      case 'untrack':
        return 'Untracked a project';
      case 'note_add':
        return 'Added a note';
      case 'note_edit':
        return 'Updated a note';
      case 'note_delete':
        return 'Deleted a note';
      case 'view':
        return 'Viewed project details';
      default:
        return activity.description || 'Activity logged';
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="recent-activity-widget">
      <div className="activity-list">
        {fallbackActivities.map(activity => (
          <div key={activity.id} className="activity-item">
            <div className="activity-icon">
              {getActivityIcon(activity.type)}
            </div>
            <div className="activity-content">
              <div className="activity-title">
                {getActivityTitle(activity)}
              </div>
              <div className="activity-project">
                {activity.projectName}
              </div>
              <div className="activity-meta">
                {formatDate(activity.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivityWidget;
