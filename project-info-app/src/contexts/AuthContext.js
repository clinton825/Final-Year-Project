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
      if (!userData) return null;
      return JSON.parse(userData);
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
      if (!user) throw new Error('No user logged in');
      
      try {
        // Try Firestore first
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          // Update local storage with fresh data
          storeUserDataLocally({
            uid: user.uid,
            ...userData
          });
          return { uid: user.uid, ...userData };
        }
      } catch (firestoreError) {
        console.error('Error fetching from Firestore, trying localStorage:', firestoreError);
      }
      
      // Firestore failed or no data, try localStorage
      const localData = getLocalUserData();
      if (localData && localData.uid === user.uid) {
        console.log('Using locally stored user data as fallback');
        return localData;
      }
      
      throw new Error('User data not found in Firestore or localStorage');
    } catch (error) {
      console.error('Error fetching user data:', error);
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
    authError,
    signup,
    login,
    logout,
    resetPassword,
    googleSignIn,
    githubSignIn,
    updateUserProfile,
    uploadProfilePicture,
    changeUserPassword,
    getUserData,
    getLocalUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
