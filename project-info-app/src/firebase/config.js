import { initializeApp } from 'firebase/app';
import { getAuth, browserSessionPersistence, setPersistence, browserLocalPersistence } from '@firebase/auth';
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  connectFirestoreEmulator, 
  CACHE_SIZE_UNLIMITED,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  disableNetwork,
  enableNetwork
} from '@firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Preload Firebase SDK
const preloadFirebase = () => {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://firestore.googleapis.com';
  document.head.appendChild(link);
  
  const link2 = document.createElement('link');
  link2.rel = 'preconnect';
  link2.href = 'https://identitytoolkit.googleapis.com';
  document.head.appendChild(link2);
};

// Preload Firebase connections for faster initial load
preloadFirebase();

const firebaseConfig = {
  // Use environment variables for all sensitive information
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  BUILDING_INFO_API_KEY: process.env.BUILDING_INFO_API_KEY,
  BUILDING_INFO_USER_KEY: process.env.BUILDING_INFO_USER_KEY
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firebase Functions
const functions = getFunctions(app);

// For local development, connect to Firebase emulators if needed
if (window.location.hostname === 'localhost') {
  try {
    // Uncomment these lines to connect to local emulators when testing
    // connectFunctionsEmulator(functions, "localhost", 5001);
    // console.log('Connected to Functions emulator');
  } catch (error) {
    console.error('Error connecting to Functions emulator:', error);
  }
}

// Set LOCAL persistence for better offline support
const configureAuthPersistence = async () => {
  try {
    console.log('Configuring auth persistence to local...');
    // Using browserLocalPersistence for maximum offline support
    await setPersistence(auth, browserLocalPersistence);
    console.log('Auth persistence set to local - this provides the best offline experience');
  } catch (error) {
    console.error('Error setting auth persistence to local:', error);
    
    // Fallback to session persistence if local fails
    try {
      console.log('Falling back to session persistence...');
      await setPersistence(auth, browserSessionPersistence);
      console.log('Auth persistence set to session');
    } catch (fallbackError) {
      console.error('Even fallback persistence failed:', fallbackError);
    }
  }
};

// Start persistence configuration immediately but don't wait for it
configureAuthPersistence();

// Initialize Firestore with optimized settings for faster loading
let db;
try {
  console.log('Initializing Firestore with optimized settings...');
  
  // In production (deployed version), use more conservative settings
  const isProduction = window.location.hostname !== 'localhost';
  
  if (isProduction) {
    console.log('Using production Firestore configuration with simplified settings');
    
    // Try to detect the hosting environment for better debugging
    const hostEnvironment = window.location.hostname.includes('vercel') ? 'Vercel' : 
                           window.location.hostname.includes('netlify') ? 'Netlify' : 
                           'Unknown production';
    console.log(`Detected hosting environment: ${hostEnvironment}`);
    
    // Use the most basic configuration for production - no experimental flags
    db = getFirestore(app);
    
    // Force enable network after a short delay to ensure connection is established
    setTimeout(() => {
      console.log('Ensuring Firestore network connection...');
      enableNetwork(db)
        .then(() => console.log('✅ Firestore network connection confirmed'))
        .catch(err => console.error('Failed to ensure Firestore network connection:', err));
    }, 2000);
  } else {
    // In development, use unlimited cache for better debugging
    console.log('Using development Firestore configuration with unlimited cache');
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      })
    });
  }
  
  // Enable offline persistence in the background
  const enableOfflinePersistence = async () => {
    try {
      console.log('Enabling Firestore offline persistence...');
      await enableIndexedDbPersistence(db);
      console.log('Firestore offline persistence enabled successfully');
    } catch (error) {
      if (error.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time
        console.warn('Firestore persistence failed: Multiple tabs open');
      } else if (error.code === 'unimplemented') {
        // The current browser doesn't support persistence
        console.warn('Firestore persistence is not available in this browser');
      } else {
        console.error('Unknown error enabling Firestore persistence:', error);
      }
    }
  };
  
  // Start persistence setup but don't block rendering
  setTimeout(() => {
    enableOfflinePersistence();
  }, 1000);
  
} catch (error) {
  console.error('Error initializing Firestore with optimized settings:', error);
  console.log('Falling back to default Firestore configuration');
  // Fallback to standard initialization if optimized settings fail
  db = getFirestore(app);
}

const storage = getStorage(app);

// Enhanced online/offline handling for Firestore
let isNetworkEnabled = true;

// Function to toggle Firestore network connection
const toggleFirestoreNetwork = async (isOnline) => {
  try {
    if (isOnline && !isNetworkEnabled) {
      console.log('Enabling Firestore network connection...');
      await enableNetwork(db);
      isNetworkEnabled = true;
      console.log('Firestore network connection enabled');
    } else if (!isOnline && isNetworkEnabled) {
      console.log('Disabling Firestore network connection...');
      await disableNetwork(db);
      isNetworkEnabled = false;
      console.log('Firestore network connection disabled, using cache only');
    }
  } catch (error) {
    console.error('Error toggling Firestore network:', error);
  }
};

// Handle online/offline state for the entire application
window.addEventListener('online', () => {
  console.log('Network connection restored. Reconnecting to Firebase...');
  toggleFirestoreNetwork(true);
});

window.addEventListener('offline', () => {
  console.log('Network connection lost. Switching to offline mode...');
  toggleFirestoreNetwork(false);
});

// Log Firebase connection status for debugging
console.log("Firebase app initialized with project ID:", firebaseConfig.projectId);

export { auth, db, storage, functions };
