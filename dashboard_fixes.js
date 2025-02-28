// Fix for currency display - change from £ to €
// Line 787: Change pound to euro symbol
projectValue = `€${numericValue.toLocaleString()}`;

// Line 867-868: Change pound to euro symbol in stats
<div className="stat-icon">
  <i className="fas fa-euro-sign"></i>
</div>

// Line 871: Change pound to euro in value display
<p className="stat-value">€{value.toLocaleString()}</p>

// Line 770-790: Fix the View Details and Untrack buttons styling
<div className="project-card-actions">
  <button 
    className="view-details-btn"
    onClick={() => navigate(`/project/${projectId}`)}
  >
    <i className="fas fa-eye"></i> View Details
  </button>
  
  <button 
    className="untrack-btn"
    onClick={(e) => {
      e.stopPropagation();
      untrackProject(projectId);
    }}
    title="Remove from tracked projects"
  >
    <i className="fas fa-times"></i> Untrack
  </button>
</div>
