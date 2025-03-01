import React, { useState, useEffect } from 'react';
import NoteCard from './NoteCard';
import AddEditNoteModal from './AddEditNoteModal';
import './Notes.css';

const NotesList = ({ projectId, notes = [], onAddNote, onUpdateNote, onDeleteNote }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState([]);
  
  // Keep local notes in sync with props
  useEffect(() => {
    if (notes && Array.isArray(notes)) {
      setLocalNotes(notes);
    }
  }, [notes]);

  const handleAddNote = () => {
    setIsAddModalOpen(true);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
  };

  const handleSaveNote = (projectId, text, noteId) => {
    if (editingNote) {
      onUpdateNote(noteId, text);
      setEditingNote(null);
    } else {
      onAddNote(projectId, text);
      setIsAddModalOpen(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    console.log('NotesList: Deleting note with ID:', noteId);
    
    // Optimistic UI update - remove note from local state immediately
    setLocalNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
    
    // Call the actual delete function
    const success = await onDeleteNote(noteId);
    
    if (!success) {
      console.error('Failed to delete note:', noteId);
      // If deletion fails, we could restore the note in the UI
      // But for now we'll let the parent component handle refreshing
    }
  };

  const handleCancelModal = () => {
    setIsAddModalOpen(false);
    setEditingNote(null);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="notes-section">
      <div className="notes-header" onClick={toggleExpanded}>
        <h4>
          <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
          Notes {localNotes.length > 0 && `(${localNotes.length})`}
        </h4>
        <button 
          className="add-note-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleAddNote();
          }}
          title="Add a note"
        >
          <i className="fas fa-plus"></i>
        </button>
      </div>

      {isExpanded && (
        <div className="notes-content">
          {localNotes.length > 0 ? (
            <div className="notes-list">
              {localNotes.map(note => (
                <NoteCard 
                  key={note.id}
                  note={note}
                  onEdit={handleEditNote}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          ) : (
            <div className="empty-notes">
              <p>No notes yet. Add a note to track important information about this project.</p>
            </div>
          )}
        </div>
      )}

      {(isAddModalOpen || editingNote) && (
        <AddEditNoteModal 
          note={editingNote}
          projectId={projectId}
          onSave={handleSaveNote}
          onCancel={handleCancelModal}
        />
      )}
    </div>
  );
};

export default NotesList;
