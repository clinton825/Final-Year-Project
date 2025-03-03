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

const firebaseConfig = {
  // Use environment variables if available, otherwise use the hardcoded values
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCYCGXsttUJHV0QStjs_sOvgmdoisFVu-o",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "infrastructure-project--app.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "infrastructure-project--app",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "infrastructure-project--app.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "845897639432",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:845897639432:web:9e14b96fc048c7bd6313bd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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

configureAuthPersistence();

// Initialize Firestore with optimized settings for Vercel deployment and offline support
let db;
try {
  console.log('Initializing Firestore with persistent cache...');
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    })
  });
  
  // Enable offline persistence with better error handling
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
  
  enableOfflinePersistence();
  
} catch (error) {
  console.error('Error initializing Firestore with persistent cache:', error);
  console.log('Falling back to default Firestore configuration');
  // Fallback to standard initialization if persistent cache fails
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
console.log("Firebase auth domain:", firebaseConfig.authDomain);

export { auth, db, storage };
