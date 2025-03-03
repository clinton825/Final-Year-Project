import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const PreferencesContext = createContext();

export function usePreferences() {
  return useContext(PreferencesContext);
}

export function PreferencesProvider({ children }) {
  const { currentUser } = useAuth();
  const [preferences, setPreferences] = useState({
    notifications: {
      projectUpdates: true,
      commentMentions: true,
      systemAnnouncements: true,
      emailDigest: true
    },
    display: {
      compactMode: false,
      darkModeAuto: true,
      showStatistics: true,
      defaultView: 'list'
    },
    privacy: {
      shareUsageData: true,
      showProfileToOthers: true
    }
  });
  const [loading, setLoading] = useState(true);

  // Load user preferences from Firestore
  useEffect(() => {
    async function loadPreferences() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const prefsRef = doc(db, 'userPreferences', currentUser.uid);
        const prefsSnap = await getDoc(prefsRef);
        
        if (prefsSnap.exists()) {
          setPreferences(prefsSnap.data());
        } else {
          // Create default preferences if none exist
          await setDoc(prefsRef, preferences);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [currentUser]);

  // Update a specific preference
  async function updatePreference(category, setting, value) {
    if (!currentUser) return;

    try {
      // Update local state first for immediate UI feedback
      setPreferences(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [setting]: value
        }
      }));

      // Update in Firestore
      const prefsRef = doc(db, 'userPreferences', currentUser.uid);
      await updateDoc(prefsRef, {
        [`${category}.${setting}`]: value,
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error updating preference:', error);
      // Revert local change on error
      loadPreferences();
      return false;
    }
  }

  // Update multiple preferences at once
  async function updatePreferences(newPreferences) {
    if (!currentUser) return;

    try {
      // Update local state
      setPreferences(prev => ({
        ...prev,
        ...newPreferences
      }));

      // Update in Firestore
      const prefsRef = doc(db, 'userPreferences', currentUser.uid);
      await updateDoc(prefsRef, {
        ...newPreferences,
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  }

  async function loadPreferences() {
    if (!currentUser) return;

    try {
      setLoading(true);
      const prefsRef = doc(db, 'userPreferences', currentUser.uid);
      const prefsSnap = await getDoc(prefsRef);
      
      if (prefsSnap.exists()) {
        setPreferences(prefsSnap.data());
      }
    } catch (error) {
      console.error('Error reloading preferences:', error);
    } finally {
      setLoading(false);
    }
  }

  const value = {
    preferences,
    updatePreference,
    updatePreferences,
    loadPreferences,
    loading
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export default PreferencesProvider;
