import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from '@firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from '@firebase/firestore';
import { auth, db, storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Helper functions for local storage
  const storeUserDataLocally = (userData) => {
    if (!userData) return;
    try {
      const dataToStore = {
        ...userData,
        // Don't include sensitive data in localStorage
        localStorageTimestamp: new Date().toISOString()
      };
      localStorage.setItem('userData', JSON.stringify(dataToStore));
      console.log('User data stored in localStorage as fallback');
    } catch (error) {
      console.error('Error storing user data in localStorage:', error);
    }
  };
  
  const getLocalUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      if (!userData) {
        console.warn('No user data found in localStorage');
        return null;
      }
      const parsedData = JSON.parse(userData);
      console.log('Retrieved user data from localStorage:', 
                 parsedData.uid ? `UID: ${parsedData.uid.substring(0,5)}...` : 'No UID', 
                 parsedData.localStorageTimestamp ? `Saved: ${parsedData.localStorageTimestamp}` : 'No timestamp');
      return parsedData;
    } catch (error) {
      console.error('Error retrieving user data from localStorage:', error);
      return null;
    }
  };

  async function signup(email, password, firstName, lastName, role) {
    try {
      // Force browser persistence before signup
      await setPersistence(auth, browserLocalPersistence);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile with display name
      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`
      });

      // Store additional user data in Firestore
      const userData = {
        firstName,
        lastName,
        email,
        role,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', user.uid), userData);
      
      // Store in localStorage as backup
      storeUserDataLocally({
        uid: user.uid,
        ...userData
      });

      return user;
    } catch (error) {
      console.error('Signup error:', error);
      setAuthError(error.message);
      throw error;
    }
  }

  async function login(email, password) {
    try {
      // Force browser persistence before login
      await setPersistence(auth, browserLocalPersistence);
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // After successful login, fetch and store user data locally
      try {
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (userDoc.exists()) {
          storeUserDataLocally({
            uid: result.user.uid,
            ...userDoc.data()
          });
        }
      } catch (fetchError) {
        console.error('Could not fetch user data after login:', fetchError);
      }
      
      return result;
    } catch (error) {
      console.error('Login error:', error);
      setAuthError(error.message);
      throw error;
    }
  }

  function logout() {
    try {
      // Clear local storage data on logout
      localStorage.removeItem('userData');
      return signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      setAuthError(error.message);
      throw error;
    }
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  function googleSignIn() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  function githubSignIn() {
    const provider = new GithubAuthProvider();
    return signInWithPopup(auth, provider);
  }

  async function updateUserProfile(userData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      // Update displayName if provided
      if (userData.displayName) {
        await updateProfile(user, {
          displayName: userData.displayName
        });
      }

      // Update user data in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...userData,
        updatedAt: new Date().toISOString()
      });

      return user;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  async function uploadProfilePicture(file) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      // Create storage reference
      const storageRef = ref(storage, `profilePictures/${user.uid}`);
      
      // Upload file
      await uploadBytes(storageRef, file);
      
      // Get download URL
      const photoURL = await getDownloadURL(storageRef);
      
      // Update user profile with new photo URL
      await updateProfile(user, { photoURL });
      
      // Update user record in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        photoURL,
        updatedAt: new Date().toISOString()
      });

      return photoURL;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw error;
    }
  }

  async function changeUserPassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');
      if (!user.email) throw new Error('User has no email');

      // Reauthenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      return { success: true };
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  async function getUserData() {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn('No authenticated user found');
        return null;
      }

      // First check if there's network connectivity
      if (!navigator.onLine) {
        console.log('Device is offline, attempting to use localStorage data');
        const localData = getLocalUserData();
        if (localData && localData.uid === user.uid) {
          console.log('Successfully retrieved user data from localStorage while offline');
          return localData;
        } else {
          console.warn('No matching user data found in localStorage while offline');
          throw new Error('Cannot retrieve user data while offline and no cached data exists');
        }
      }

      // If online, try Firestore first
      console.log('Fetching user data from Firestore for:', user.uid);
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Store in localStorage for offline access
            storeUserDataLocally({
              uid: user.uid,
              ...userData
            });
            console.log('Successfully retrieved and cached user data from Firestore');
            return userData;
          } else {
            console.warn('User document does not exist in Firestore');
            break; // No need to retry if doc doesn't exist
          }
        } catch (firestoreError) {
          retryCount++;
          console.warn(`Firestore fetch attempt ${retryCount} failed:`, firestoreError);
          
          if (retryCount >= maxRetries) {
            console.error('All Firestore retry attempts failed');
            throw firestoreError;
          }
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }
      
      // Try localStorage as fallback if Firestore doesn't have the data
      const localData = getLocalUserData();
      if (localData && localData.uid === user.uid) {
        console.log('Using localStorage data as fallback after Firestore issues');
        return localData;
      }
      
      // If no data exists anywhere, create basic profile
      const basicProfile = {
        firstName: user.displayName ? user.displayName.split(' ')[0] : '',
        lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        role: 'user',
        createdAt: new Date().toISOString()
      };
      
      // Attempt to save this basic profile
      try {
        await setDoc(doc(db, 'users', user.uid), basicProfile);
        console.log('Created new user profile in Firestore');
        storeUserDataLocally({
          uid: user.uid,
          ...basicProfile
        });
        return basicProfile;
      } catch (error) {
        console.error('Failed to create user profile in Firestore:', error);
        // Still store locally even if Firestore save failed
        storeUserDataLocally({
          uid: user.uid,
          ...basicProfile
        });
        return basicProfile; // Return anyway for UI display
      }
    } catch (error) {
      console.error('Error in getUserData:', error);
      
      // Final fallback - try localStorage one last time
      try {
        const localData = getLocalUserData();
        if (localData && localData.uid === auth.currentUser?.uid) {
          console.log('Using localStorage data after all other attempts failed');
          return localData;
        }
      } catch (localStorageError) {
        console.error('Even localStorage fallback failed:', localStorageError);
      }
      
      // If all attempts fail, return a minimal profile to prevent UI errors
      if (auth.currentUser) {
        const emergencyProfile = {
          firstName: auth.currentUser.displayName ? auth.currentUser.displayName.split(' ')[0] : 'User',
          lastName: auth.currentUser.displayName ? auth.currentUser.displayName.split(' ').slice(1).join(' ') : '',
          email: auth.currentUser.email || '',
          photoURL: auth.currentUser.photoURL || '',
          role: 'user',
          createdAt: new Date().toISOString(),
          isEmergencyProfile: true // Flag to indicate this is a fallback profile
        };
        return emergencyProfile;
      }
      
      return null;
    }
  }

  async function reauthenticateUser(currentPassword) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');
      
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (error) {
      console.error('Error reauthenticating user:', error);
      setAuthError(error.message);
      throw error;
    }
  }
  
  async function updateEmail(newEmail) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');
      
      // Update email in Firebase Auth
      await user.updateEmail(newEmail);
      
      // Update email in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        email: newEmail,
        updatedAt: new Date().toISOString()
      });
      
      // Update localStorage
      const localData = getLocalUserData();
      if (localData && localData.uid === user.uid) {
        storeUserDataLocally({
          ...localData,
          email: newEmail
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error updating email:', error);
      setAuthError(error.message);
      throw error;
    }
  }
  
  async function updatePassword(newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');
      
      // Update password in Firebase Auth
      await user.updatePassword(newPassword);
      
      // Update Firestore record to indicate password change
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        passwordLastUpdated: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      setAuthError(error.message);
      throw error;
    }
  }

  useEffect(() => {
    // Ensure auth persistence is set to LOCAL
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Firebase auth persistence set to LOCAL');
      })
      .catch((error) => {
        console.error('Error setting auth persistence:', error);
        setAuthError('Failed to set persistence: ' + error.message);
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      
      if (user) {
        // Check if we have cached user data
        let userDataFetched = false;
        
        try {
          // Try to get fresh data from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            storeUserDataLocally({
              uid: user.uid,
              ...userData
            });
            userDataFetched = true;
          }
        } catch (error) {
          console.error('Error fetching user data on auth state change:', error);
          // Continue to set currentUser even if we can't fetch additional data
        }
        
        // If Firestore fetch failed, try local storage
        if (!userDataFetched) {
          const localData = getLocalUserData();
          if (localData && localData.uid === user.uid) {
            console.log('Using locally stored user data on auth state change');
          }
        }
      } else {
        // No user, no need to fetch profile data
      }
      
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    authError,
    setAuthError,
    signup,
    login,
    logout,
    resetPassword,
    googleSignIn,
    githubSignIn,
    updateUserProfile,
    uploadProfilePicture,
    updateEmail,
    updatePassword,
    reauthenticateUser,
    getUserData,
    getLocalUserData,
    storeUserDataLocally
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
