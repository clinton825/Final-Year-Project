import { initializeApp } from 'firebase/app';
import { getAuth, browserSessionPersistence, setPersistence } from '@firebase/auth';
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  connectFirestoreEmulator, 
  CACHE_SIZE_UNLIMITED,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
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

// Set session persistence fallback for environments where local persistence fails (like Vercel)
const configureAuthPersistence = async () => {
  try {
    console.log('Configuring auth persistence...');
    // Try to use browser local persistence first
    await setPersistence(auth, browserSessionPersistence);
    console.log('Auth persistence set to session');
  } catch (error) {
    console.error('Error setting auth persistence:', error);
  }
};

configureAuthPersistence();

// Initialize Firestore with optimized settings for Vercel deployment
let db;
try {
  console.log('Initializing Firestore with persistent cache...');
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    })
  });
} catch (error) {
  console.error('Error initializing Firestore with persistent cache:', error);
  console.log('Falling back to default Firestore configuration');
  // Fallback to standard initialization if persistent cache fails
  db = getFirestore(app);
}

const storage = getStorage(app);

// Log Firebase connection status for debugging
console.log("Firebase app initialized with project ID:", firebaseConfig.projectId);
console.log("Firebase auth domain:", firebaseConfig.authDomain);

// Handle online/offline state
window.addEventListener('online', () => {
  console.log('Network connection restored. Reconnecting to Firebase...');
  // Firebase should reconnect automatically
});

window.addEventListener('offline', () => {
  console.log('Network connection lost. Firebase will use cached data if available.');
});

export { auth, db, storage };
