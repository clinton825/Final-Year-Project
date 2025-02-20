import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ProjectDetails.css';

const ProjectDetails = () => {
  const { planningId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        console.log('Fetching project details for ID:', planningId);
        const response = await fetch(`http://localhost:3001/api/project/${planningId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch project details');
        }

        const data = await response.json();
        console.log('Received project data:', data);

        if (data.status === "success" && data.project) {
          setProject(data.project);
        } else {
          throw new Error('Project not found');
        }
      } catch (err) {
        console.error('Error fetching project:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (planningId) {
      fetchProjectDetails();
    }
  }, [planningId]);

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="project-details">
        <div className="loading">Loading project details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-details">
        <div className="error-container">
          <div className="error">{error}</div>
          <button onClick={handleBack} className="back-button">Back to Projects</button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-details">
        <div className="error-container">
          <div className="error">Project not found</div>
          <button onClick={handleBack} className="back-button">Back to Projects</button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-details">
      <button onClick={handleBack} className="back-button">
        Back to Projects
      </button>
      
      <h1>{project.planning_title}</h1>
      
      <div className="details-grid">
        <div className="detail-item">
          <h3>Planning ID</h3>
          <p>{project.planning_id}</p>
        </div>
        <div className="detail-item">
          <h3>Category</h3>
          <p>{project.planning_category}</p>
        </div>
        <div className="detail-item">
          <h3>Type</h3>
          <p>{project.planning_type}</p>
        </div>
        <div className="detail-item">
          <h3>Stage</h3>
          <p>{project.planning_stage}</p>
        </div>
        <div className="detail-item">
          <h3>Value</h3>
          <p>{project.planning_value}</p>
        </div>
        <div className="detail-item">
          <h3>Region</h3>
          <p>{project.planning_region}</p>
        </div>
        <div className="detail-item">
          <h3>County</h3>
          <p>{project.planning_county}</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
