import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './SecurityTab.css';

const SecurityTab = () => {
  const { changeUserPassword } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: ''
  });
  
  const validatePassword = (password) => {
    let score = 0;
    let feedback = [];
    
    // Check length
    if (password.length < 8) {
      feedback.push('Password should be at least 8 characters long');
    } else {
      score += 1;
    }
    
    // Check for uppercase
    if (!/[A-Z]/.test(password)) {
      feedback.push('Include at least one uppercase letter');
    } else {
      score += 1;
    }
    
    // Check for lowercase
    if (!/[a-z]/.test(password)) {
      feedback.push('Include at least one lowercase letter');
    } else {
      score += 1;
    }
    
    // Check for numbers
    if (!/[0-9]/.test(password)) {
      feedback.push('Include at least one number');
    } else {
      score += 1;
    }
    
    // Check for special characters
    if (!/[^A-Za-z0-9]/.test(password)) {
      feedback.push('Include at least one special character');
    } else {
      score += 1;
    }
    
    return {
      score,
      feedback: feedback.join('. ')
    };
  };
  
  const handleNewPasswordChange = (e) => {
    const password = e.target.value;
    setNewPassword(password);
    
    // Only validate if there's a password entered
    if (password) {
      setPasswordStrength(validatePassword(password));
    } else {
      setPasswordStrength({ score: 0, feedback: '' });
    }
  };
  
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Reset states
    setError('');
    setSuccess('');
    
    // Validate
    if (!currentPassword) {
      return setError('Please enter your current password');
    }
    
    if (!newPassword) {
      return setError('Please enter a new password');
    }
    
    if (newPassword !== confirmPassword) {
      return setError('New passwords do not match');
    }
    
    if (passwordStrength.score < 3) {
      return setError('Please choose a stronger password. ' + passwordStrength.feedback);
    }
    
    // Change password
    setLoading(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setSuccess('Password has been successfully updated');
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStrength({ score: 0, feedback: '' });
    } catch (error) {
      setError(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };
  
  const getPasswordStrengthClass = () => {
    if (passwordStrength.score === 0) return '';
    if (passwordStrength.score < 3) return 'weak';
    if (passwordStrength.score < 4) return 'medium';
    return 'strong';
  };
  
  return (
    <div className="security-tab">
      <h2>Security Settings</h2>
      <p className="security-subtitle">Manage your account security and credentials</p>
      
      <div className="security-section password-section">
        <h3>Change Password</h3>
        
        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            <i className="fas fa-check-circle"></i>
            <span>{success}</span>
          </div>
        )}
        
        <form onSubmit={handlePasswordChange} className="password-form">
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <div className="password-input-wrapper">
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <div className="password-input-wrapper">
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={handleNewPasswordChange}
                disabled={loading}
              />
            </div>
            
            {newPassword && (
              <>
                <div className={`password-strength-bar ${getPasswordStrengthClass()}`}>
                  <div 
                    className="strength-indicator" 
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  ></div>
                </div>
                <div className="password-feedback">
                  {passwordStrength.feedback && <span>{passwordStrength.feedback}</span>}
                  {passwordStrength.score >= 4 && <span className="strong-password">Strong password</span>}
                </div>
              </>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <div className="password-input-wrapper">
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <div className="password-feedback error">Passwords do not match</div>
            )}
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Updating...
              </>
            ) : 'Update Password'}
          </button>
        </form>
      </div>
      
      <div className="security-section">
        <h3>Two-Factor Authentication</h3>
        <p className="section-description">
          Add an extra layer of security to your account by enabling two-factor authentication.
        </p>
        
        <div className="two-factor-status">
          <div className="status-label">Status:</div>
          <div className="status-badge not-enabled">
            <i className="fas fa-times-circle"></i> Not Enabled
          </div>
        </div>
        
        <button className="btn btn-secondary">
          <i className="fas fa-shield-alt"></i> Enable 2FA
        </button>
      </div>
      
      <div className="security-section">
        <h3>Active Sessions</h3>
        <p className="section-description">
          These are devices that have logged into your account. Revoke any sessions that you do not recognize.
        </p>
        
        <div className="session-list">
          <div className="session-item current">
            <div className="session-icon">
              <i className="fas fa-laptop"></i>
            </div>
            <div className="session-details">
              <div className="session-device">MacOS - Chrome</div>
              <div className="session-meta">
                <span className="session-location">London, UK</span>
                <span className="session-time">Current session</span>
              </div>
            </div>
            <div className="session-actions">
              <button className="btn btn-text" disabled>This Device</button>
            </div>
          </div>
          
          <div className="session-item">
            <div className="session-icon">
              <i className="fas fa-mobile-alt"></i>
            </div>
            <div className="session-details">
              <div className="session-device">iOS - Safari</div>
              <div className="session-meta">
                <span className="session-location">London, UK</span>
                <span className="session-time">Last active: 2 hours ago</span>
              </div>
            </div>
            <div className="session-actions">
              <button className="btn btn-danger btn-sm">
                <i className="fas fa-sign-out-alt"></i> Revoke
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="security-alerts">
        <h3>Security Alerts</h3>
        <p className="nothing-to-report">
          <i className="fas fa-check-circle"></i> No security alerts at this time
        </p>
      </div>
    </div>
  );
};

export default SecurityTab;
