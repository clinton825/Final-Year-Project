import React from 'react';
import './Auth.css';

const LogoutModal = ({ onConfirm, onCancel, isLoading }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Confirm Logout</h2>
        <p>Are you sure you want to log out?</p>
        
        <div className="modal-actions">
          <button 
            onClick={onCancel}
            className="modal-button secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="modal-button primary"
            disabled={isLoading}
          >
            {isLoading ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
