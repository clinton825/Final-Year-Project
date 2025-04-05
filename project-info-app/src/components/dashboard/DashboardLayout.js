import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { FaPlus, FaTimes, FaSave, FaUndo, FaChartBar, FaClock, FaTable, FaThLarge, FaChartPie, FaHistory, FaEdit } from 'react-icons/fa';
import './DashboardLayout.css';

// Widget components
import SummaryStatsWidget from './widgets/SummaryStatsWidget';
import ProjectTimelineWidget from './widgets/ProjectTimelineWidget';
import SpendingChartWidget from './widgets/SpendingChartWidget';
import ProjectStageWidget from './widgets/ProjectStageWidget';
import TrackedProjectsWidget from './widgets/TrackedProjectsWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';

const DashboardLayout = ({ 
  trackedProjects, 
  projectsByStatus, 
  valueByCategory,
  userRole, 
  userData,
  untrackProject,
  loading,
  isEditMode,
  onLayoutSave,
  onEditModeToggle
}) => {
  const { currentUser } = useAuth();
  const [layouts, setLayouts] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [availableWidgets, setAvailableWidgets] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [dashboardLayout, setDashboardLayout] = useState('default'); // 'default', 'compact', 'expanded'
  const [showWaterfordNotice, setShowWaterfordNotice] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Initialize default widgets immediately
    setAvailableWidgets(getAvailableWidgets());
    // Set a default layout immediately
    setLayouts(getDefaultLayoutByRole(userRole || 'standard'));
    
    // Then try to load user preferences asynchronously
    if (currentUser) {
      loadUserPreferences();
    }
  }, [currentUser, userRole]);

  useEffect(() => {
    // Check if the notice was previously dismissed
    const noticeDismissed = localStorage.getItem('waterfordNoticeDismissed');
    if (noticeDismissed === 'true') {
      setShowWaterfordNotice(false);
    }
  }, []);

  const getAvailableWidgets = () => [
    { id: 'summary', type: 'summary-stats', title: 'Summary Statistics', icon: <FaThLarge />, visible: true },
    { id: 'stages', type: 'project-stage', title: 'Project Stages', icon: <FaChartPie />, visible: false }, // Hidden by default
    { id: 'spending', type: 'spending-chart', title: 'Spending Chart', icon: <FaChartBar />, visible: true },
    { id: 'projects', type: 'tracked-projects', title: 'Tracked Projects', icon: <FaTable />, visible: true },
    { id: 'timeline', type: 'project-timeline', title: 'Project Timeline', icon: <FaClock />, visible: false }, // Hidden by default
    { id: 'activity', type: 'recent-activity', title: 'Recent Activity', icon: <FaHistory />, visible: true }
  ];
  
  const loadUserPreferences = async () => {
    if (!currentUser) return;
    
    try {
      // Try to load from Firestore - use a single network request
      const prefsDocRef = doc(db, "userPreferences", currentUser.uid);
      const prefsDocSnap = await getDoc(prefsDocRef);
      
      if (prefsDocSnap.exists()) {
        const data = prefsDocSnap.data();
        
        // Load everything at once
        if (data.dashboardLayout) {
          setDashboardLayout(data.dashboardLayout);
        }
        
        if (data.dashboardLayout) {
          console.log('Loading custom layout from Firestore');
          setLayouts(data.dashboardLayout);
        }
          
        // Also load the widget configuration if available
        if (data.dashboardWidgets && data.dashboardWidgets.length > 0) {
          const savedWidgets = data.dashboardWidgets;
          // Merge with available widgets to ensure we have all widget data
          const mergedWidgets = getAvailableWidgets().filter(w => 
            savedWidgets.some(saved => saved.id === w.id)
          );
          setWidgets(mergedWidgets.length > 0 ? mergedWidgets : getAvailableWidgets());
        } else {
          // Initialize with default widgets if none saved
          setWidgets(getAvailableWidgets());
        }
      }
    } catch (error) {
      console.error("Error loading dashboard preferences:", error);
    }
  };

  // We've consolidated the loadUserLayouts function into loadUserPreferences
  // to reduce duplicate Firestore calls

  // We're using the getAvailableWidgets function defined at the top of the component
  // This provides all the widget types and their icons

  // Fixed layout with static positioning for stability
  const getDefaultLayoutByRole = () => {
    return {
      lg: [
        { i: 'summary', x: 0, y: 0, w: 12, h: 3, static: true },
        { i: 'spending', x: 0, y: 3, w: 6, h: 5, static: true },
        { i: 'activity', x: 6, y: 3, w: 6, h: 5, static: true },
        { i: 'projects', x: 0, y: 8, w: 12, h: 6, static: true }
      ],
      md: [
        { i: 'summary', x: 0, y: 0, w: 10, h: 3, static: true },
        { i: 'spending', x: 0, y: 3, w: 5, h: 5, static: true },
        { i: 'activity', x: 5, y: 3, w: 5, h: 5, static: true },
        { i: 'projects', x: 0, y: 8, w: 10, h: 6, static: true }
      ],
      sm: [
        { i: 'summary', x: 0, y: 0, w: 6, h: 3, static: true },
        { i: 'spending', x: 0, y: 3, w: 6, h: 5, static: true },
        { i: 'activity', x: 0, y: 8, w: 6, h: 5, static: true },
        { i: 'projects', x: 0, y: 13, w: 6, h: 6, static: true }
      ]
    };
  };

  const handleLayoutChange = (currentLayout, allLayouts) => {
    if (!mounted || !isEditMode) return;
    setLayouts(allLayouts);
  };

  const toggleEditMode = () => {
    if (onEditModeToggle) {
      onEditModeToggle(!isEditMode);
    }
  };

  const saveLayoutChanges = async () => {
    // Filter layouts to only include visible widgets
    const visibleWidgetIds = widgets.filter(w => w.visible).map(w => w.id);
    
    // Update layouts to only include visible widgets
    const filteredLayouts = {};
    if (layouts) {
      Object.keys(layouts).forEach(breakpoint => {
        filteredLayouts[breakpoint] = layouts[breakpoint].filter(item => 
          visibleWidgetIds.includes(item.i)
        );
      });
    }
    
    // Save the updated layouts
    await saveLayout(filteredLayouts);
  };

  const saveLayout = async (layoutsToSave = layouts) => {
    if (!currentUser) return;

    try {
      await setDoc(doc(db, "userPreferences", currentUser.uid), {
        dashboardLayout: layoutsToSave,
        dashboardWidgets: widgets,
        lastUpdated: new Date()
      }, { merge: true });
      
      console.log("Dashboard layout saved successfully");
      if (onLayoutSave) onLayoutSave();
    } catch (error) {
      console.error("Error saving dashboard layout:", error);
    }
  };

  const resetToDefaultLayout = () => {
    const defaultLayout = getDefaultLayoutByRole(userRole || 'standard');
    setLayouts(defaultLayout);
  };

  const addWidget = (widgetId) => {
    const widgetToAdd = availableWidgets.find(w => w.id === widgetId);
    if (!widgetToAdd) return;
    
    // If the widget already exists, just mark it as visible
    if (widgets.some(w => w.id === widgetId)) {
      const updatedWidgets = widgets.map(w => {
        if (w.id === widgetId) {
          return { ...w, visible: true };
        }
        return w;
      });
      setWidgets(updatedWidgets);
    } else {
      // Otherwise add it as a new widget
      setWidgets([...widgets, widgetToAdd]);
    }
    
    // Update layouts to include this widget at a default position
    if (layouts) {
      const updatedLayouts = { ...layouts };
      Object.keys(updatedLayouts).forEach(breakpoint => {
        if (!updatedLayouts[breakpoint].some(item => item.i === widgetId)) {
          // Add widget to a default position - bottom of layout
          const maxY = Math.max(...updatedLayouts[breakpoint].map(item => item.y + item.h), 0);
          const newItem = { i: widgetId, x: 0, y: maxY + 1, w: 12, h: 5, static: true };
          updatedLayouts[breakpoint] = [...updatedLayouts[breakpoint], newItem];
        }
      });
      setLayouts(updatedLayouts);
    }
  };

  const removeWidget = (widgetId) => {
    if (widgetId === 'projects') {
      alert('The Tracked Projects widget cannot be removed');
      return;
    }
    // Update the widgets list, marking the widget as not visible
    const updatedWidgets = widgets.map(widget => {
      if (widget.id === widgetId) {
        return { ...widget, visible: false };
      }
      return widget;
    });
    
    setWidgets(updatedWidgets);
    console.log(`Removed widget: ${widgetId}`, updatedWidgets);
    
    // Also update layouts to remove this widget
    if (layouts) {
      const updatedLayouts = {};
      Object.keys(layouts).forEach(breakpoint => {
        updatedLayouts[breakpoint] = layouts[breakpoint].filter(item => item.i !== widgetId);
      });
      setLayouts(updatedLayouts);
    }
  };

  const renderWidget = (widget) => {
    const data = {
      trackedProjects,
      projectsByStatus,
      valueByCategory,
      userData,
      untrackProject
    };
    
    // Handle case where widget is a string ID instead of an object
    const widgetType = typeof widget === 'string' ? widget : widget.type;
    
    // Check if this widget type should be visible
    const widgetConfig = widgets.find(w => w.type === widgetType);
    if (widgetConfig && !widgetConfig.visible) {
      // Don't render widgets that are marked as not visible
      return null;
    }
    
    // Apply consistent styling to each widget
    const containerClass = widgetType.replace(/-/g, '-') + '-container';
    
    switch(widgetType) {
      case 'summary-stats':
        return (
          <div className={`widget-container ${containerClass}`}>
            <SummaryStatsWidget data={data} />
          </div>
        );
      case 'project-timeline':
        return (
          <div className={`widget-container ${containerClass}`}>
            <ProjectTimelineWidget data={data} />
          </div>
        );
      case 'spending-chart':
        return (
          <div className={`widget-container ${containerClass}`}>
            <SpendingChartWidget data={data} />
          </div>
        );
      case 'project-stage':
        return (
          <div className={`widget-container ${containerClass}`}>
            <ProjectStageWidget data={data} />
          </div>
        );
      case 'tracked-projects':
        return (
          <div className={`widget-container ${containerClass}`}>
            <TrackedProjectsWidget 
              data={{
                trackedProjects,
                untrackProject: untrackProject || function() { console.error('untrackProject function not available'); }
              }} 
            />
          </div>
        );
      case 'recent-activity':
        return (
          <div className={`widget-container ${containerClass}`}>
            <RecentActivityWidget data={data} />
          </div>
        );
      default:
        return <div className="widget-container">Unknown widget type</div>;
    }
  };

  const dismissWaterfordNotice = () => {
    setShowWaterfordNotice(false);
    // Store the dismissal in localStorage so it won't show again in this session
    localStorage.setItem('waterfordNoticeDismissed', 'true');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your personalized dashboard...</p>
      </div>
    );
  }

  if (!layouts) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Preparing your dashboard...</p>
      </div>
    );
  }

  // Extract the icon component for each widget
  const getWidgetIcon = (widgetId) => {
    const widgetDef = getAvailableWidgets().find(w => w.id === widgetId);
    return widgetDef ? widgetDef.icon : null;
  };

  // Fixed widget container
  return (
    <div className="dashboard-container">
      {showWaterfordNotice && (
        <div className="notification-banner">
          <div className="notification-content">
            <span className="notification-icon">🆕</span>
            <p>New data available: County Waterford projects have been added to our database!</p>
            <button className="dismiss-btn" onClick={dismissWaterfordNotice}>×</button>
          </div>
        </div>
      )}
        {isEditMode && (
          <div className="edit-controls">
            <button onClick={saveLayoutChanges} className="save-btn">
              <FaSave /> Save Changes
            </button>
            <button onClick={resetToDefaultLayout} className="reset-btn">
              <FaUndo /> Reset Layout
            </button>
            <div className="add-widget-dropdown">
              <button className="add-widget-btn">
                <FaPlus /> Add Widget
              </button>
              <div className="widget-dropdown-content">
                {availableWidgets.filter(w => !widgets.some(widget => widget.id === w.id && widget.visible)).map(widget => (
                  <button key={widget.id} onClick={() => addWidget(widget.id)} className="dropdown-item">
                    {widget.icon} {widget.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      
      {/* Dashboard Content - Improved Grid Layout */}
      <div className="dashboard-content">
        {/* Full Width Summary Stats */}
        <div className="dashboard-row">
          <div className="dashboard-widget full-width">
            <div className="widget-header">
              <h3><FaThLarge /> Summary Statistics</h3>
              {isEditMode && (
                <div className="widget-controls">
                  <button className="widget-toggle-btn" onClick={() => removeWidget('summary')}>
                    <FaTimes />
                  </button>
                </div>
              )}
            </div>
            <div className="widget-content">
              {renderWidget('summary-stats')}
            </div>
          </div>
        </div>
        
        {/* Two Column Row for Spending and Timeline Charts */}
        <div className="dashboard-row">
          <div className="dashboard-row-split">
            <div className="dashboard-widget">
              <div className="widget-header">
                <h3><FaChartBar /> Spending Distribution</h3>
                {isEditMode && (
                  <div className="widget-controls">
                    <button className="widget-toggle-btn" onClick={() => removeWidget('spending')}>
                      <FaTimes />
                    </button>
                  </div>
                )}
              </div>
              <div className="widget-content">
                {renderWidget('spending-chart')}
              </div>
            </div>
            
            <div className="dashboard-widget">
              <div className="widget-header">
                <h3><FaChartPie /> Project Stages</h3>
                {isEditMode && (
                  <div className="widget-controls">
                    <button className="widget-toggle-btn" onClick={() => removeWidget('stages')}>
                      <FaTimes />
                    </button>
                  </div>
                )}
              </div>
              <div className="widget-content">
                {renderWidget('project-stage')}
              </div>
            </div>
          </div>
        </div>
        
        {/* Full Width Projects */}
        <div className="dashboard-row">
          <div className="dashboard-widget full-width">
            <div className="widget-header">
              <h3><FaTable /> Tracked Projects</h3>
              {/* No remove button for this essential widget */}
            </div>
            <div className="widget-content">
              {renderWidget('tracked-projects')}
            </div>
          </div>
        </div>
        
        {/* Single Column - Just Recent Activity */}
        <div className="dashboard-row">
          <div className="dashboard-widget full-width">
            <div className="widget-header">
              <h3><FaHistory /> Recent Activity</h3>
              {isEditMode && (
                <div className="widget-controls">
                  <button className="widget-toggle-btn" onClick={() => removeWidget('activity')}>
                    <FaTimes />
                  </button>
                </div>
              )}
            </div>
            <div className="widget-content">
              {renderWidget('recent-activity')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

};

export default DashboardLayout;
