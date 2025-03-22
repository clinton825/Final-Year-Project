import React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { FaRegCalendarAlt } from 'react-icons/fa';
import './WidgetStyles.css';

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

const ProjectTimelineWidget = ({ data }) => {
  const { trackedProjects } = data;

  // Prepare calendar events from project data
  const prepareCalendarEvents = () => {
    if (!trackedProjects || trackedProjects.length === 0) {
      return [];
    }
    
    // Debug info
    console.log('Preparing calendar events for', trackedProjects.length, 'projects');
    trackedProjects.forEach(project => {
      console.log('Project dates:', {
        title: project.title || project.planning_title || project.name,
        appDate: project.application_date,
        decisionDate: project.decision_date,
        startDate: project.start_date,
        completionDate: project.completion_date
      });
    });

    const events = [];
    const categoryColors = {
      'Residential': '#3498db',
      'Commercial': '#2ecc71',
      'Industrial': '#f1c40f',
      'Infrastructure': '#e74c3c',
      'Mixed Use': '#9b59b6',
      'Transport': '#1abc9c',
      'default': '#95a5a6'
    };

    trackedProjects.forEach(project => {
      const projectCategory = project.category || project.planning_category || project.type || 'default';
      const backgroundColor = categoryColors[projectCategory] || categoryColors.default;
      
      // Add application date if available
      // Try different date formats and fields
      const applicationDate = project.application_date || project.receivedDate || project.received_date;
      if (applicationDate) {
        // Handle various date formats (string or timestamp)
        let date;
        if (typeof applicationDate === 'object' && applicationDate.seconds) {
          // Firebase Timestamp
          date = new Date(applicationDate.seconds * 1000);
        } else {
          date = new Date(applicationDate);
        }
        
        if (!isNaN(date.getTime())) {
          events.push({
            id: `${project.id}-application`,
            title: `Application: ${project.title || project.planning_title || project.name || 'Project ' + project.id?.substring(0, 6)}`,
            start: date,
            end: date,
            allDay: true,
            resource: project,
            backgroundColor
          });
        }
      }
      
      // Add decision date if available
      const decisionDate = project.decision_date || project.decided_date || project.decisionDate;
      if (decisionDate) {
        // Handle various date formats
        let date;
        if (typeof decisionDate === 'object' && decisionDate.seconds) {
          // Firebase Timestamp
          date = new Date(decisionDate.seconds * 1000);
        } else {
          date = new Date(decisionDate);
        }
        
        if (!isNaN(date.getTime())) {
          events.push({
            id: `${project.id}-decision`,
            title: `Decision: ${project.title || project.planning_title || project.name || 'Project ' + project.id?.substring(0, 6)}`,
            start: date,
            end: date,
            allDay: true,
            resource: project,
            backgroundColor
          });
        }
      }
      
      // Add start date if available
      const startDate = project.start_date || project.startDate || project.began_date;
      if (startDate) {
        // Handle various date formats
        let date;
        if (typeof startDate === 'object' && startDate.seconds) {
          // Firebase Timestamp
          date = new Date(startDate.seconds * 1000);
        } else {
          date = new Date(startDate);
        }
        
        if (!isNaN(date.getTime())) {
          events.push({
            id: `${project.id}-start`,
            title: `Start: ${project.title || project.planning_title || project.name || 'Project ' + project.id?.substring(0, 6)}`,
            start: date,
            end: date,
            allDay: true,
            resource: project,
            backgroundColor
          });
        }
      }
      
      // Add completion date if available
      const completionDate = project.completion_date || project.completionDate || project.completed_date || project.end_date;
      if (completionDate) {
        // Handle various date formats
        let date;
        if (typeof completionDate === 'object' && completionDate.seconds) {
          // Firebase Timestamp
          date = new Date(completionDate.seconds * 1000);
        } else {
          date = new Date(completionDate);
        }
        
        if (!isNaN(date.getTime())) {
          events.push({
            id: `${project.id}-completion`,
            title: `Completion: ${project.title || project.planning_title || project.name || 'Project ' + project.id?.substring(0, 6)}`,
            start: date,
            end: date,
            allDay: true,
            resource: project,
            backgroundColor
          });
        }
      }
    });

    return events;
  };

  const events = prepareCalendarEvents();

  // Custom event style
  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: event.backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0',
        display: 'block'
      }
    };
  };

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <FaRegCalendarAlt />
        </div>
        <h3 className="empty-title">No Timeline Events</h3>
        <p className="empty-message">
          There are no project milestones to display on the timeline. Track projects with dates to see their milestones here.
        </p>
      </div>
    );
  }

  return (
    <div className="project-timeline-widget">
      <div className="timeline-calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day']}
          defaultView="month"
          defaultDate={new Date()}
          toolbar={true}
          popup
          tooltipAccessor={event => event.title}
        />
      </div>
    </div>
  );
};

export default ProjectTimelineWidget;
