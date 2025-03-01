import React, { useState, useEffect } from 'react';
import './Notes.css';

const NoteCard = ({ note, onEdit, onDelete }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  // Handle delete with explicit confirmation
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isConfirmingDelete) {
      console.log('Confirming delete for note:', note.id);
      onDelete(note.id);
      setIsConfirmingDelete(false);
    } else {
      setIsConfirmingDelete(true);
      
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => {
        setIsConfirmingDelete(false);
      }, 3000);
    }
  };

  return (
    <div className="note-card">
      <div className="note-content">
        <p>{note.text}</p>
      </div>
      
      <div className="note-footer">
        {/* Date display removed as requested */}
        
        <div className="note-actions">
          <button 
            className="note-action-btn edit-btn" 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onEdit(note);
            }}
            title="Edit Note"
          >
            <i className="fas fa-edit"></i>
          </button>
          
          <button 
            className={`note-action-btn delete-btn ${isConfirmingDelete ? 'confirming' : ''}`} 
            onClick={handleDeleteClick}
            title={isConfirmingDelete ? "Click again to confirm deletion" : "Delete Note"}
          >
            {isConfirmingDelete ? (
              <i className="fas fa-exclamation-triangle"></i>
            ) : (
              <i className="fas fa-trash"></i>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;
