import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../firebase/config';
import { useAuth } from './AuthContext';
import UserService from '../services/userService';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        if (currentUser) {
          // Get the user profile from our database
          const userProfile = await UserService.getUserProfile();
          setUser({ ...currentUser, ...userProfile });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [currentUser]);

  const updateProfile = async (updates) => {
    try {
      const updatedProfile = await UserService.updateUserProfile(updates);
      setUser(current => ({ ...current, ...updatedProfile }));
      return updatedProfile;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const value = {
    user,
    loading,
    error,
    updateProfile,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
