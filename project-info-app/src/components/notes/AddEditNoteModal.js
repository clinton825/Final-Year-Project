import React, { useState, useEffect, useRef } from 'react';
import './Notes.css';

const AddEditNoteModal = ({ note, projectId, onSave, onCancel }) => {
  const [noteText, setNoteText] = useState('');
  const [charCount, setCharCount] = useState(0);
  const MAX_CHARS = 500; // Maximum character count
  const textareaRef = useRef(null);
  
  useEffect(() => {
    // Set initial text if editing an existing note
    if (note && note.text) {
      setNoteText(note.text);
      setCharCount(note.text.length);
    }
    
    // Focus the textarea when the modal opens
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [note]);
  
  const handleTextChange = (e) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARS) {
      setNoteText(text);
      setCharCount(text.length);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (noteText.trim()) {
      onSave(projectId, noteText.trim(), note?.id);
    }
  };
  
  return (
    <div className="note-modal-overlay">
      <div className="note-modal">
        <div className="note-modal-header">
          <h3>{note ? 'Edit Note' : 'Add Note'}</h3>
          <button 
            className="note-modal-close" 
            onClick={onCancel}
            aria-label="Close modal"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="note-form">
          <div className="note-form-group">
            <textarea
              ref={textareaRef}
              className="note-textarea"
              placeholder="Enter your note here..."
              value={noteText}
              onChange={handleTextChange}
              required
            ></textarea>
            
            <div className="char-counter">
              <span className={charCount > MAX_CHARS * 0.9 ? 'near-limit' : ''}>
                {charCount}/{MAX_CHARS}
              </span>
            </div>
          </div>
          
          <div className="note-modal-footer">
            <button 
              type="button" 
              className="note-btn cancel-btn" 
              onClick={onCancel}
            >
              Cancel
            </button>
            
            <button 
              type="submit" 
              className="note-btn save-btn"
              disabled={!noteText.trim()}
            >
              {note ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditNoteModal;
