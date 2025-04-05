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
import { doc, setDoc, getDoc, updateDoc, increment } from '@firebase/firestore';
import { auth, db, storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { databaseInitService } from '../services/databaseInitService';

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

  async function googleSignIn() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Ensure user data is saved to Firestore
      const user = result.user;
      await ensureUserInFirestore(user, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        provider: 'google',
        lastLogin: new Date()
      });
      
      return result;
    } catch (error) {
      console.error('Google sign-in error:', error);
      setAuthError(error.message);
      throw error;
    }
  }

  async function githubSignIn() {
    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Ensure user data is saved to Firestore
      const user = result.user;
      await ensureUserInFirestore(user, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        provider: 'github',
        lastLogin: new Date()
      });
      
      return result;
    } catch (error) {
      console.error('GitHub sign-in error:', error);
      setAuthError(error.message);
      throw error;
    }
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

  const userDataCache = {};

  async function getUserData() {
    if (!currentUser) {
      console.log('No current user found, cannot get user data');
      return null;
    }
    
    // Check if we have cached data in memory first (fastest)
    if (userDataCache[currentUser.uid]) {
      console.log('Using in-memory cached user data');
      return userDataCache[currentUser.uid];
    }
    
    // Initialize a promise that will be resolved with localStorage data
    // but can be superseded by Firestore data
    let resolveWithLocalData;
    const localDataPromise = new Promise(resolve => {
      resolveWithLocalData = resolve;
    });
    
    // Start loading from localStorage immediately (non-blocking)
    let localData = null;
    try {
      const storedData = localStorage.getItem(`userData_${currentUser.uid}`);
      if (storedData) {
        localData = JSON.parse(storedData);
        console.log('Found user data in localStorage');
        
        // Cache the data in memory for future use
        userDataCache[currentUser.uid] = localData;
        
        // We'll resolve with this data if Firestore takes too long
        setTimeout(() => {
          resolveWithLocalData(localData);
        }, 500); // If Firestore takes more than 500ms, use localStorage data
      }
    } catch (error) {
      console.error('Error retrieving data from localStorage:', error);
    }
    
    // Start Firestore request in parallel
    try {
      console.log('Attempting to fetch user data from Firestore');
      const docRef = doc(db, "users", currentUser.uid);
      const docSnap = await Promise.race([
        getDoc(docRef),
        // If Firestore takes too long, use localStorage data
        localDataPromise.then(() => null)
      ]);
      
      // If we got Firestore data, use it
      if (docSnap && docSnap.exists()) {
        console.log('Successfully retrieved user data from Firestore');
        const firestoreData = docSnap.data();
        
        // Cache the Firestore data
        userDataCache[currentUser.uid] = firestoreData;
        
        // Also update localStorage for future offline access
        try {
          localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify(firestoreData));
          console.log('User data cached to localStorage');
        } catch (error) {
          console.error('Error caching user data to localStorage:', error);
        }
        
        return firestoreData;
      } else if (localData) {
        // If Firestore failed but we have localStorage data, use that
        console.log('Using localStorage data as Firestore fetch failed or timed out');
        return localData;
      }
    } catch (error) {
      console.error('Error fetching user data from Firestore:', error);
      
      // If Firestore failed but we have localStorage data, use that
      if (localData) {
        console.log('Falling back to localStorage data due to Firestore error');
        return localData;
      }
    }
    
    // If we reach here, both Firestore and localStorage failed
    // Create an emergency profile as last resort
    console.log('Creating emergency profile as both Firestore and localStorage failed');
    const emergencyProfile = {
      firstName: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User',
      lastName: currentUser.displayName ? currentUser.displayName.split(' ').slice(1).join(' ') : '',
      email: currentUser.email,
      photoURL: currentUser.photoURL,
      isEmergencyProfile: true
    };
    
    return emergencyProfile;
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

  // Function to handle successful login
  const handleSuccessfulLogin = async (user) => {
    try {
      if (!user) return;
      
      console.log('Handling successful login for user:', user.email);
      
      // Use the ensureUserInFirestore function to ensure user data is in Firestore
      await ensureUserInFirestore(user, {
        lastLogin: new Date(),
        loginCount: increment(1)
      });
      
      // Initialize database collections for this user
      try {
        await databaseInitService.initializeDatabase(user);
        console.log('Database initialization complete for user:', user.email);
      } catch (error) {
        console.error('Error during database initialization:', error);
        // Continue execution even if database initialization fails
      }
      
    } catch (error) {
      console.error('Error in handleSuccessfulLogin:', error);
      // We don't throw the error to prevent blocking the auth flow
    }
  };

  // Function to ensure a user exists in Firestore
  const ensureUserInFirestore = async (user, additionalData = {}) => {
    if (!user || !user.uid) return;
    
    const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
          lastError = error;
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
          }
        }
      }
      
      throw lastError;
    };
    
    try {
      // Check if user document exists
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await retryOperation(() => getDoc(userRef));
      
      if (!userDoc.exists()) {
        // Create new user document
        const userData = {
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          createdAt: new Date(),
          lastLogin: new Date(),
          lastUpdated: new Date(),
          ...additionalData
        };
        
        await retryOperation(() => setDoc(userRef, userData));
        console.log(`Created new user document in Firestore for ${user.email || user.uid}`);
        
        // Store in localStorage
        storeUserDataLocally({
          uid: user.uid,
          ...userData
        });
      } else {
        // Update existing user
        const updateData = {
          lastLogin: new Date(),
          lastUpdated: new Date(),
          ...additionalData
        };
        
        await retryOperation(() => updateDoc(userRef, updateData));
        console.log(`Updated existing user in Firestore: ${user.email || user.uid}`);
        
        // Get updated user data and store locally
        const updatedDoc = await retryOperation(() => getDoc(userRef));
        if (updatedDoc.exists()) {
          storeUserDataLocally({
            uid: user.uid,
            ...updatedDoc.data()
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring user in Firestore:', error);
      return false;
    }
  };

  // Function to synchronize all authenticated users with Firestore
  const syncAllUsersWithFirestore = async () => {
    console.error('This function is not available in client-side applications. It requires Firebase Admin SDK.');
    return false;
  };

  // Effect to handle auth state changes
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

    // Unsubscribe function to clean up the listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed, user:', user?.email || 'No user');
      
      try {
        if (user) {
          console.log('User authenticated:', user.email);
          
          // Set current user immediately to prevent auth issues
          setCurrentUser(user);
          
          // Attempt to get cached profile data for immediate display
          const cachedUserData = getLocalUserData();
          if (cachedUserData && cachedUserData.uid === user.uid) {
            console.log('Using locally stored user data on auth state change');
          }
          
          // Process the user data in the background
          handleSuccessfulLogin(user).catch(error => {
            console.error('Error in background login processing:', error);
          });
        } else {
          console.log('No user is signed in');
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
        // Set current user anyway to prevent blocking the auth flow
        setCurrentUser(user);
      } finally {
        setLoading(false);
      }
    });
    
    // Clean up the listener when the component unmounts
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
    storeUserDataLocally,
    ensureUserInFirestore
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
