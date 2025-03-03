import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db, storage, auth } from '../firebase/config';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';
import ActivityTab from '../components/profile/ActivityTab';
import PreferencesTab from '../components/profile/PreferencesTab';
import SecurityTab from '../components/profile/SecurityTab';
import './Profile.css';

const Profile = () => {
  const { currentUser, updatePassword, updateEmail, getUserData, getLocalUserData } = useAuth();
  const { theme } = useTheme();
  
  // User profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [stats, setStats] = useState(null);
  const [componentError, setComponentError] = useState(false);
  
  // Function to load profile data from localStorage
  const loadFromLocalStorage = () => {
    try {
      const localData = getLocalUserData();
      
      if (localData && localData.uid === currentUser?.uid) {
        console.log('Loading profile data from localStorage');
        
        // Set user profile data from localStorage
        setFirstName(localData.firstName || '');
        setLastName(localData.lastName || '');
        setEmail(currentUser.email || '');
        setPhotoURL(localData.photoURL || currentUser.photoURL || '');
        setPhoneNumber(localData.phoneNumber || '');
        setRole(localData.role || '');
        
        // Show fallback notification
        setMessage({
          type: 'info',
          text: 'Using cached profile data. Some information may not be up to date.'
        });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
      return false;
    }
  };

  // Monitor online/offline status and load profile data
  useEffect(() => {
    const handleOnline = () => {
      console.log('App is online - attempting to reconnect to Firebase');
      setMessage({
        type: 'info',
        text: 'Connection restored. Retrieving your profile data...'
      });
      if (currentUser) {
        setLoading(true);
        setComponentError(false);
        // Reduced delay to improve perceived performance
        setTimeout(() => {
          fetchUserProfile();
        }, 300); // Reduced from 1000ms to 300ms
      }
    };
    
    const handleOffline = () => {
      console.log('App is offline - Firebase operations may fail');
      setMessage({
        type: 'warning',
        text: 'You are currently offline. Some features may not be available.'
      });
      
      // Try to load from localStorage when offline
      if (currentUser) {
        const hasLocalData = loadFromLocalStorage();
        if (!hasLocalData) {
          setMessage({
            type: 'error',
            text: 'Unable to load profile data while offline. Please reconnect to the internet.'
          });
        }
      }
    };
    
    // Function to get user data with Firestore first, localStorage as fallback
    const fetchUserProfile = async () => {
      if (!currentUser) {
        console.log('No current user, cannot fetch profile');
        setLoading(false);
        return;
      }
      
      // Try localStorage first for immediate display while Firestore loads
      const hasLocalData = loadFromLocalStorage();
      if (hasLocalData) {
        // If we have local data, show it immediately but keep loading
        // This creates a progressive loading experience
        setLoading(false);
      }
      
      let retryAttempt = 0;
      const maxRetries = 1; // Reduced from 2 to 1 for faster loading
      
      const attemptFetch = async () => {
        try {
          console.log('Fetching user profile data for user:', currentUser.uid);
          
          // Try to get user data from Firestore with fallback to localStorage
          const userData = await getUserData();
          
          if (userData) {
            console.log('User data retrieved successfully:', userData.firstName);
            
            // Set user profile data
            setFirstName(userData.firstName || '');
            setLastName(userData.lastName || '');
            setEmail(currentUser.email || '');
            setPhotoURL(userData.photoURL || currentUser.photoURL || '');
            setPhoneNumber(userData.phoneNumber || '');
            setRole(userData.role || '');
            
            // Show fallback notification if using emergency profile
            if (userData.isEmergencyProfile) {
              setMessage({
                type: 'warning',
                text: 'Limited connectivity. Only basic profile information is available.'
              });
            } else if (!hasLocalData) {
              // Only clear messages if we didn't already show local data
              setMessage(null);
            }
            setComponentError(false);
            setLoading(false);
            return true;
          } else {
            throw new Error('Could not retrieve user data');
          }
        } catch (error) {
          console.error('Error fetching user profile (attempt ' + (retryAttempt + 1) + '):', error);
          
          if (retryAttempt < maxRetries) {
            retryAttempt++;
            console.log(`Retrying profile data fetch (${retryAttempt}/${maxRetries})...`);
            setMessage({
              type: 'info',
              text: `Retrieving your profile data (try ${retryAttempt}/${maxRetries})...`
            });
            // Reduced wait time between retries
            await new Promise(resolve => setTimeout(resolve, 800)); // Reduced from 1500ms
            return await attemptFetch();
          }
          
          // If we already have local data, we can just keep using it
          if (hasLocalData) {
            setLoading(false);
            return true;
          }
          
          // Try local storage as last resort if we haven't already
          if (!hasLocalData && !loadFromLocalStorage()) {
            setComponentError(true);
            setMessage({ 
              type: 'error', 
              text: 'Failed to load profile data. Please try refreshing the page.'
            });
          }
          setLoading(false);
          return false;
        }
      };
      
      await attemptFetch();
    };
    
    // Set up online/offline listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial profile data fetch
    if (currentUser) {
      if (navigator.onLine) {
        fetchUserProfile();
      } else {
        handleOffline();
      }
    } else {
      setLoading(false);
      setMessage({
        type: 'error',
        text: 'You must be logged in to view this page.'
      });
    }
    
    // Clean up listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser, getUserData]);

  // Fetch user statistics
  const fetchUserStats = async () => {
    if (!currentUser) return;
    
    try {
      // Get tracked projects count
      const trackedProjectsDoc = await getDoc(doc(db, 'trackedProjects', currentUser.uid));
      const trackedProjects = trackedProjectsDoc.exists() ? trackedProjectsDoc.data().projects || [] : [];
      
      // Get user activity
      const activityDoc = await getDoc(doc(db, 'userActivity', currentUser.uid));
      const activity = activityDoc.exists() ? activityDoc.data().activities || [] : [];
      
      const lastLoginDoc = await getDoc(doc(db, 'userLogins', currentUser.uid));
      const lastLogin = lastLoginDoc.exists() ? new Date(lastLoginDoc.data().lastLogin?.toDate()) : null;
      
      setStats({
        trackedProjectsCount: trackedProjects.length,
        activityCount: activity.length,
        lastActivity: activity.length > 0 ? new Date(activity[0].timestamp?.toDate()) : null,
        lastLogin: lastLogin,
        accountCreated: currentUser.metadata.creationTime ? new Date(currentUser.metadata.creationTime) : null,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

  // Handle profile photo change
  const handlePhotoChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file type
      if (!file.type.match('image.*')) {
        setMessage({ type: 'error', text: 'Please select an image file (JPEG, PNG, etc.)' });
        return;
      }
      
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image file size must be less than 5MB' });
        return;
      }
      
      setPhotoFile(file);
      setMessage({ type: 'success', text: 'Photo selected! Click "Save Changes" to update your profile picture.' });
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoURL(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Direct photo upload function for testing
  const handleDirectPhotoUpload = async () => {
    if (!photoFile) {
      setMessage({ type: 'error', text: 'Please select a photo first' });
      return;
    }
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      console.log('Starting direct photo upload');
      
      // Compress image before upload to reduce storage costs
      const compressedFile = await compressImage(photoFile);
      console.log(`Original size: ${photoFile.size / 1024} KB, Compressed size: ${compressedFile.size / 1024} KB`);
      
      const storageRef = ref(storage, `profile-photos/${currentUser.uid}`);
      console.log('Storage reference:', storageRef.fullPath);
      
      // Upload the compressed file
      const uploadTask = uploadBytes(storageRef, compressedFile);
      
      // Show progress message
      setMessage({ type: 'info', text: 'Uploading photo...' });
      
      // Wait for upload to complete
      const uploadSnapshot = await uploadTask;
      console.log('Upload successful:', uploadSnapshot);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL:', downloadURL);
      
      // Update Firebase Auth profile
      await updateFirebaseProfile(currentUser, { photoURL: downloadURL });
      console.log('Firebase Auth profile updated');
      
      // Update Firestore user document
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { 
        photoURL: downloadURL,
        updatedAt: new Date()
      });
      console.log('Firestore document updated');
      
      // Update UI
      setPhotoURL(downloadURL);
      setMessage({ type: 'success', text: 'Photo uploaded successfully!' });
      
      // Force refresh the current user object
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        console.log('User reloaded, new photoURL:', user.photoURL);
      }
      
    } catch (error) {
      console.error('Direct photo upload error:', error);
      
      // Provide more helpful error messages based on error code
      let errorMessage = error.message;
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'You do not have permission to upload images. Please check your authentication.';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Upload was canceled.';
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'An unknown error occurred during upload.';
      } else if (error.code?.includes('cors')) {
        errorMessage = 'Cross-Origin Request Blocked: CORS configuration issue. Please ensure CORS is properly set up for Firebase Storage.';
      }
      
      setMessage({ type: 'error', text: `Photo upload failed: ${errorMessage}` });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to compress images before upload
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      // Create a new image object
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = () => {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions - max 800px width/height while maintaining aspect ratio
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        // Set canvas dimensions and draw the resized image
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert canvas to blob (compressed image file)
        canvas.toBlob((blob) => {
          // Create a new file from the blob
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          
          resolve(compressedFile);
        }, 'image/jpeg', 0.7); // 0.7 quality (70%) - adjust as needed
      };
      
      img.onerror = (error) => {
        reject(error);
      };
    });
  };

  // Update profile information
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    console.log('Starting profile update process');
    
    try {
      // Update user profile in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      console.log('User reference:', userRef.path);
      
      // Upload profile photo if changed
      let photoURLToUpdate = photoURL;
      if (photoFile) {
        console.log('Photo file detected, starting upload process');
        try {
          // Compress image before upload to reduce storage costs
          const compressedFile = await compressImage(photoFile);
          console.log(`Original size: ${photoFile.size / 1024} KB, Compressed size: ${compressedFile.size / 1024} KB`);
          
          const storageRef = ref(storage, `profile-photos/${currentUser.uid}`);
          console.log('Storage reference created:', storageRef.fullPath);
          
          console.log('Starting uploadBytes operation');
          const uploadResult = await uploadBytes(storageRef, compressedFile);
          console.log('Upload completed:', uploadResult);
          
          console.log('Getting download URL');
          photoURLToUpdate = await getDownloadURL(storageRef);
          console.log('Download URL obtained:', photoURLToUpdate);
          
          // Also update auth profile photo
          console.log('Updating Firebase Auth profile');
          await updateFirebaseProfile(currentUser, {
            photoURL: photoURLToUpdate
          });
          console.log('Firebase Auth profile updated successfully');
        } catch (photoError) {
          console.error('Error uploading photo - Full error object:', photoError);
          console.error('Error code:', photoError.code);
          console.error('Error message:', photoError.message);
          setMessage({ 
            type: 'error', 
            text: `Photo upload failed: ${photoError.message}. Profile update will continue without photo change.` 
          });
          // Don't update photoURL if photo upload failed
        }
      }
      
      // Create display name from first and last name
      const fullDisplayName = `${firstName} ${lastName}`.trim();
      console.log('Generated display name:', fullDisplayName);
      
      // Update Firestore document
      console.log('Updating Firestore document with new data');
      const updateData = {
        firstName,
        lastName,
        displayName: fullDisplayName,
        photoURL: photoURLToUpdate,
        phoneNumber,
        updatedAt: new Date(),
      };
      console.log('Update data:', updateData);
      
      await updateDoc(userRef, updateData);
      console.log('Firestore document updated successfully');
      
      // Update email if changed
      if (email !== currentUser.email) {
        console.log('Email changed, updating Firebase Auth email');
        await updateEmail(email);
        console.log('Email updated successfully');
      }
      
      // Update password if provided
      if (newPassword && newPassword === confirmPassword) {
        console.log('Password changed, updating Firebase Auth password');
        await updatePassword(newPassword);
        setNewPassword('');
        setConfirmPassword('');
        console.log('Password updated successfully');
      }
      
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: `Failed to update profile: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Render specific tab content based on activeTab
  const renderTabContent = () => {
    try {
      switch(activeTab) {
        case 'profile':
          return (
            <div className="profile-card">
              <div className="profile-photo-container">
                <div className="profile-photo">
                  {photoURL ? (
                    <img src={photoURL} alt="Profile" />
                  ) : (
                    <div className="profile-photo-placeholder">
                      <i className="fas fa-user"></i>
                    </div>
                  )}
                </div>
                <label className="photo-upload-button">
                  <i className="fas fa-camera"></i>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoChange} 
                    style={{ display: 'none' }}
                  />
                </label>
                {photoFile && (
                  <button 
                    type="button"
                    className="direct-upload-button"
                    onClick={handleDirectPhotoUpload}
                    disabled={loading}
                  >
                    {loading ? 'Uploading...' : 'Upload Photo Now'}
                  </button>
                )}
              </div>
              
              <form onSubmit={handleUpdateProfile}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      type="text"
                      id="firstName"
                      className="form-control"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      type="text"
                      id="lastName"
                      className="form-control"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="phoneNumber">Phone Number</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    className="form-control"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="role">User Role</label>
                  <input
                    type="text"
                    id="role"
                    className="form-control"
                    value={role}
                    disabled
                    readOnly
                  />
                </div>
                
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          );
        case 'security':
          if (typeof SecurityTab === 'undefined') {
            return <div className="error-message">Security settings currently unavailable</div>;
          }
          return <SecurityTab />;
        case 'preferences':
          if (typeof PreferencesTab === 'undefined') {
            return <div className="error-message">Preferences currently unavailable</div>;
          }
          return <PreferencesTab />;
        case 'activity':
          if (typeof ActivityTab === 'undefined') {
            return <div className="error-message">Activity history currently unavailable</div>;
          }
          return <ActivityTab />;
        default:
          return null;
      }
    } catch (error) {
      console.error('Error rendering tab content:', error);
      return (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <p>There was an error loading this content. Please try refreshing the page.</p>
        </div>
      );
    }
  };

  return (
    <div className={`profile-container ${theme}`}>
      {loading ? (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading profile data...</p>
        </div>
      ) : componentError ? (
        <div className="error-container">
          <div className="error-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <h2>Failed to load profile data</h2>
          <p>We're having trouble connecting to our servers. Please try:</p>
          <ul>
            <li>Checking your internet connection</li>
            <li>Refreshing the page</li>
            <li>Logging out and back in</li>
          </ul>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      ) : (
        <>
          {message && (
            <div className={`message-banner ${message.type}`}>
              <span>{message.text}</span>
              <button onClick={() => setMessage(null)}>×</button>
            </div>
          )}
          
          <div className="profile-header">
            <h1>User Profile</h1>
            <div className="profile-tabs">
              <button 
                className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <i className="fas fa-user"></i> Profile
              </button>
              <button 
                className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <i className="fas fa-lock"></i> Security
              </button>
              <button 
                className={`tab-button ${activeTab === 'preferences' ? 'active' : ''}`}
                onClick={() => setActiveTab('preferences')}
              >
                <i className="fas fa-cog"></i> Preferences
              </button>
              <button 
                className={`tab-button ${activeTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveTab('activity')}
              >
                <i className="fas fa-chart-line"></i> Activity
              </button>
            </div>
          </div>
          
          <div className="profile-content">
            {renderTabContent()}
          </div>
        </>
      )}
    </div>
  );
};

export default Profile;
