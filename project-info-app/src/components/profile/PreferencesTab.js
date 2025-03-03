import React, { useState } from 'react';
import { usePreferences } from '../../contexts/PreferencesContext';
import './PreferencesTab.css';

const PreferencesTab = () => {
  const { preferences, updatePreference } = usePreferences();
  const [saving, setSaving] = useState({});
  
  const handleToggle = async (category, setting) => {
    const currentValue = preferences[category][setting];
    const key = `${category}.${setting}`;
    
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updatePreference(category, setting, !currentValue);
    } catch (error) {
      console.error('Error updating preference:', error);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };
  
  const isSaving = (category, setting) => {
    return saving[`${category}.${setting}`] === true;
  };
  
  return (
    <div className="preferences-tab">
      <h2>User Preferences</h2>
      <p className="preferences-subtitle">Customize your app experience</p>
      
      <div className="preferences-section">
        <h3>Notifications</h3>
        <div className="preference-toggle-group">
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Project Updates</span>
              <span className="preference-description">Get notified when projects you are following are updated</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.notifications.projectUpdates ? 'active' : ''}`}
                onClick={() => handleToggle('notifications', 'projectUpdates')}
                disabled={isSaving('notifications', 'projectUpdates')}
              >
                {isSaving('notifications', 'projectUpdates') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
          
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Comment Mentions</span>
              <span className="preference-description">Get notified when someone mentions you in a comment</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.notifications.commentMentions ? 'active' : ''}`}
                onClick={() => handleToggle('notifications', 'commentMentions')}
                disabled={isSaving('notifications', 'commentMentions')}
              >
                {isSaving('notifications', 'commentMentions') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
          
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">System Announcements</span>
              <span className="preference-description">Receive important system-wide announcements</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.notifications.systemAnnouncements ? 'active' : ''}`}
                onClick={() => handleToggle('notifications', 'systemAnnouncements')}
                disabled={isSaving('notifications', 'systemAnnouncements')}
              >
                {isSaving('notifications', 'systemAnnouncements') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
          
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Email Digest</span>
              <span className="preference-description">Receive a weekly email summarizing your activities</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.notifications.emailDigest ? 'active' : ''}`}
                onClick={() => handleToggle('notifications', 'emailDigest')}
                disabled={isSaving('notifications', 'emailDigest')}
              >
                {isSaving('notifications', 'emailDigest') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="preferences-section">
        <h3>Display</h3>
        <div className="preference-toggle-group">
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Compact Mode</span>
              <span className="preference-description">Display more content in less space</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.display.compactMode ? 'active' : ''}`}
                onClick={() => handleToggle('display', 'compactMode')}
                disabled={isSaving('display', 'compactMode')}
              >
                {isSaving('display', 'compactMode') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
          
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Auto Dark Mode</span>
              <span className="preference-description">Automatically switch to dark mode based on system preference</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.display.darkModeAuto ? 'active' : ''}`}
                onClick={() => handleToggle('display', 'darkModeAuto')}
                disabled={isSaving('display', 'darkModeAuto')}
              >
                {isSaving('display', 'darkModeAuto') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
          
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Show Statistics</span>
              <span className="preference-description">Display statistical information in project views</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.display.showStatistics ? 'active' : ''}`}
                onClick={() => handleToggle('display', 'showStatistics')}
                disabled={isSaving('display', 'showStatistics')}
              >
                {isSaving('display', 'showStatistics') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
          
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Default View</span>
              <span className="preference-description">Choose how projects are displayed by default</span>
            </div>
            <div className="preference-control">
              <select 
                value={preferences.display.defaultView} 
                onChange={(e) => updatePreference('display', 'defaultView', e.target.value)}
                className="preference-select"
              >
                <option value="list">List View</option>
                <option value="grid">Grid View</option>
                <option value="map">Map View</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div className="preferences-section">
        <h3>Privacy</h3>
        <div className="preference-toggle-group">
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Share Usage Data</span>
              <span className="preference-description">Allow us to collect anonymous usage data to improve the app</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.privacy.shareUsageData ? 'active' : ''}`}
                onClick={() => handleToggle('privacy', 'shareUsageData')}
                disabled={isSaving('privacy', 'shareUsageData')}
              >
                {isSaving('privacy', 'shareUsageData') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
          
          <div className="preference-item">
            <div className="preference-info">
              <span className="preference-label">Show Profile To Others</span>
              <span className="preference-description">Allow other users to see your profile information</span>
            </div>
            <div className="preference-control">
              <button 
                className={`toggle-switch ${preferences.privacy.showProfileToOthers ? 'active' : ''}`}
                onClick={() => handleToggle('privacy', 'showProfileToOthers')}
                disabled={isSaving('privacy', 'showProfileToOthers')}
              >
                {isSaving('privacy', 'showProfileToOthers') ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <span className="toggle-slider"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="preferences-note">
        <i className="fas fa-info-circle"></i>
        <p>Your preferences are automatically saved when you make changes.</p>
      </div>
    </div>
  );
};

export default PreferencesTab;
