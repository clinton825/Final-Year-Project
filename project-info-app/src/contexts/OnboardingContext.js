import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

// Create context
const OnboardingContext = createContext();

// Define default onboarding tasks
const DEFAULT_ONBOARDING_TASKS = {
  track_project: {
    name: 'Track your first project',
    description: 'Find and track a project from the projects page',
    linkTo: '/projects',
    linkText: 'Find projects',
    completed: false
  },
  add_note: {
    name: 'Add a project note',
    description: 'Keep track of important information about your projects',
    linkTo: '/dashboard',
    linkText: 'Add a note',
    completed: false
  },
  customize_dashboard: {
    name: 'Customize your dashboard',
    description: 'Arrange and personalize your dashboard widgets',
    linkTo: '/dashboard',
    linkText: 'Customize',
    completed: false
  },
  compare_projects: {
    name: 'Compare projects',
    description: 'Select projects to compare their details side by side',
    linkTo: '/compare',
    linkText: 'Compare',
    completed: false
  }
};

// Provider component
export const OnboardingProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [welcomeGuideCompleted, setWelcomeGuideCompleted] = useState(false);
  const [onboardingTasks, setOnboardingTasks] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check localStorage for welcome guide preference
  useEffect(() => {
    const hasSeenWelcomeGuide = localStorage.getItem('hasSeenWelcomeGuide');
    
    // Always default to not showing the welcome guide
    // Users can manually show it using the help button if needed
    setShowWelcomeGuide(false);
    
    // Set initial value in localStorage for new users
    if (currentUser && !hasSeenWelcomeGuide) {
      localStorage.setItem('hasSeenWelcomeGuide', 'true');
    }
    
    setIsLoading(false);
  }, [currentUser]);

  // Load onboarding status from Firestore
  useEffect(() => {
    if (!currentUser) {
      setOnboardingTasks(null);
      return;
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    const onboardingRef = doc(collection(userDocRef, 'settings'), 'onboarding');

    // Listen for real-time updates to onboarding status
    const unsubscribe = onSnapshot(onboardingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Update welcome guide completion status
        setWelcomeGuideCompleted(data.welcomeGuideCompleted || false);
        
        // Load tasks, merging with defaults for any new tasks that might have been added
        const savedTasks = data.tasks || {};
        const mergedTasks = { ...DEFAULT_ONBOARDING_TASKS };
        
        // Update default tasks with saved completion status
        Object.keys(mergedTasks).forEach(taskId => {
          if (savedTasks[taskId]) {
            mergedTasks[taskId] = {
              ...mergedTasks[taskId],
              completed: savedTasks[taskId].completed || false
            };
          }
        });
        
        setOnboardingTasks(mergedTasks);
      } else {
        // First time user, initialize with defaults
        setOnboardingTasks(DEFAULT_ONBOARDING_TASKS);
        // Create the document with default values
        setDoc(onboardingRef, {
          welcomeGuideCompleted: false,
          tasks: DEFAULT_ONBOARDING_TASKS
        });
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Mark welcome guide as completed
  const completeWelcomeGuide = async () => {
    if (!currentUser) return;
    
    // Update localStorage
    localStorage.setItem('hasSeenWelcomeGuide', 'true');
    setShowWelcomeGuide(false);
    setWelcomeGuideCompleted(true);
    
    // Update Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    const onboardingRef = doc(collection(userDocRef, 'settings'), 'onboarding');
    
    try {
      await updateDoc(onboardingRef, {
        welcomeGuideCompleted: true
      });
    } catch (error) {
      console.error('Error updating welcome guide status:', error);
    }
  };

  // Force show welcome guide again
  const forceShowWelcomeGuide = () => {
    setShowWelcomeGuide(true);
  };

  // Mark task as completed
  const completeTask = async (taskId) => {
    if (!currentUser || !onboardingTasks || !onboardingTasks[taskId]) return;
    
    // Update local state
    const updatedTasks = {
      ...onboardingTasks,
      [taskId]: {
        ...onboardingTasks[taskId],
        completed: true
      }
    };
    setOnboardingTasks(updatedTasks);
    
    // Update Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    const onboardingRef = doc(collection(userDocRef, 'settings'), 'onboarding');
    
    try {
      await updateDoc(onboardingRef, {
        [`tasks.${taskId}.completed`]: true
      });
      
      // Log activity
      const activityRef = collection(db, 'users', currentUser.uid, 'activity');
      await setDoc(doc(activityRef), {
        type: 'onboarding_task',
        taskId,
        taskName: onboardingTasks[taskId].name,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // Check if a specific task is completed
  const isTaskCompleted = (taskId) => {
    return onboardingTasks && onboardingTasks[taskId]?.completed;
  };

  // Reset all onboarding progress (for testing)
  const resetOnboarding = async () => {
    if (!currentUser) return;
    
    localStorage.removeItem('hasSeenWelcomeGuide');
    setShowWelcomeGuide(true);
    setWelcomeGuideCompleted(false);
    
    const resettedTasks = Object.keys(DEFAULT_ONBOARDING_TASKS).reduce((acc, taskId) => {
      acc[taskId] = {
        ...DEFAULT_ONBOARDING_TASKS[taskId],
        completed: false
      };
      return acc;
    }, {});
    
    setOnboardingTasks(resettedTasks);
    
    // Update Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    const onboardingRef = doc(collection(userDocRef, 'settings'), 'onboarding');
    
    try {
      await setDoc(onboardingRef, {
        welcomeGuideCompleted: false,
        tasks: resettedTasks
      });
    } catch (error) {
      console.error('Error resetting onboarding status:', error);
    }
  };

  const value = {
    showWelcomeGuide,
    setShowWelcomeGuide,
    welcomeGuideCompleted,
    completeWelcomeGuide,
    forceShowWelcomeGuide,
    onboardingTasks,
    completeTask,
    isTaskCompleted,
    resetOnboarding,
    isLoading
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

// Custom hook to use the onboarding context
export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

// Keep the Provider as the default export to maintain compatibility with existing imports
export default OnboardingProvider;
