import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Function to check if a user has completed onboarding
export const getUserOnboardingStatus = async (userId) => {
  if (!userId) return null;
  
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    if (userPrefsSnap.exists()) {
      const userData = userPrefsSnap.data();
      return userData.onboarding || {
        welcomeGuideCompleted: false,
        welcomeGuideDismissed: false,
        lastSeenFeatures: [],
        completedTasks: [],
        completedTasksProgress: {},
      };
    } else {
      // User preferences don't exist yet, create default onboarding status
      const defaultOnboarding = {
        welcomeGuideCompleted: false,
        welcomeGuideDismissed: false,
        lastSeenFeatures: [],
        completedTasks: [],
        completedTasksProgress: {},
      };
      
      // Initialize the user preferences document
      await setDoc(userPrefsRef, {
        onboarding: defaultOnboarding,
        createdAt: new Date(),
      });
      
      return defaultOnboarding;
    }
  } catch (error) {
    console.error('Error getting user onboarding status:', error);
    return null;
  }
};

// Function to update user onboarding status
export const updateUserOnboardingStatus = async (userId, onboardingUpdate) => {
  if (!userId) return false;
  
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    if (userPrefsSnap.exists()) {
      // Update existing document
      await updateDoc(userPrefsRef, {
        'onboarding': {
          ...userPrefsSnap.data().onboarding,
          ...onboardingUpdate,
        },
        'lastUpdated': new Date(),
      });
    } else {
      // Create new document with onboarding status
      await setDoc(userPrefsRef, {
        onboarding: {
          welcomeGuideCompleted: false,
          welcomeGuideDismissed: false,
          lastSeenFeatures: [],
          completedTasks: [],
          completedTasksProgress: {},
          ...onboardingUpdate,
        },
        createdAt: new Date(),
        lastUpdated: new Date(),
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error updating user onboarding status:', error);
    return false;
  }
};

// Function to mark the welcome guide as completed
export const completeWelcomeGuide = async (userId) => {
  return updateUserOnboardingStatus(userId, {
    welcomeGuideCompleted: true,
    welcomeGuideCompletedAt: new Date(),
  });
};

// Function to mark the welcome guide as dismissed/skipped
export const dismissWelcomeGuide = async (userId) => {
  return updateUserOnboardingStatus(userId, {
    welcomeGuideDismissed: true,
    welcomeGuideDismissedAt: new Date(),
  });
};

// Function to reset the welcome guide (allow it to be shown again)
export const resetWelcomeGuide = async (userId) => {
  return updateUserOnboardingStatus(userId, {
    welcomeGuideCompleted: false,
    welcomeGuideDismissed: false,
  });
};

// Function to track completed onboarding tasks
export const completeOnboardingTask = async (userId, taskId) => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    if (userPrefsSnap.exists()) {
      const userData = userPrefsSnap.data();
      const onboarding = userData.onboarding || {};
      const completedTasks = onboarding.completedTasks || [];
      
      // Only add the task if it's not already in the list
      if (!completedTasks.includes(taskId)) {
        await updateDoc(userPrefsRef, {
          'onboarding.completedTasks': [...completedTasks, taskId],
          'onboarding.completedTasksProgress': {
            ...(onboarding.completedTasksProgress || {}),
            [taskId]: {
              completedAt: new Date(),
              status: 'completed'
            }
          },
          'lastUpdated': new Date(),
        });
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error completing onboarding task:', error);
    return false;
  }
};

// Function to get task progress for a specific task or all tasks
export const getTaskProgress = async (userId, taskId = null) => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    if (userPrefsSnap.exists()) {
      const userData = userPrefsSnap.data();
      const onboarding = userData.onboarding || {};
      const completedTasks = onboarding.completedTasks || [];
      const taskProgress = onboarding.completedTasksProgress || {};
      
      if (taskId) {
        // Return progress for a specific task
        const isCompleted = completedTasks.includes(taskId);
        return {
          isCompleted,
          progress: taskProgress[taskId] || { status: isCompleted ? 'completed' : 'pending' }
        };
      } else {
        // Return progress for all tasks
        return {
          completedTasks,
          taskProgress
        };
      }
    }
    
    return taskId ? { isCompleted: false, progress: { status: 'pending' } } : { completedTasks: [], taskProgress: {} };
  } catch (error) {
    console.error('Error getting task progress:', error);
    return taskId ? { isCompleted: false, progress: { status: 'pending' } } : { completedTasks: [], taskProgress: {} };
  }
};

// Function to update a feature as seen by the user
export const markFeatureAsSeen = async (userId, featureId) => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    if (userPrefsSnap.exists()) {
      const userData = userPrefsSnap.data();
      const onboarding = userData.onboarding || {};
      const lastSeenFeatures = onboarding.lastSeenFeatures || [];
      
      // Only add the feature if it's not already in the list
      if (!lastSeenFeatures.includes(featureId)) {
        await updateDoc(userPrefsRef, {
          'onboarding.lastSeenFeatures': [...lastSeenFeatures, featureId],
          'lastUpdated': new Date(),
        });
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error marking feature as seen:', error);
    return false;
  }
};
