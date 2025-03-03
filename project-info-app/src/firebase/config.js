import { initializeApp } from 'firebase/app';
import { getAuth } from '@firebase/auth';
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

// Initialize Firestore with improved settings for multi-region and offline support
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
});

const storage = getStorage(app);

// Log Firebase connection status for debugging
console.log("Firebase app initialized with project ID:", firebaseConfig.projectId);
console.log("Firebase auth domain:", firebaseConfig.authDomain);

// For local development - uncomment to use emulator
// if (window.location.hostname === 'localhost') {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

// Add retry logic for failed connections
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

window.addEventListener('online', () => {
  console.log('Network connection restored. Reconnecting to Firebase...');
  // Firebase should reconnect automatically
});

window.addEventListener('offline', () => {
  console.log('Network connection lost. Firebase will use cached data if available.');
});

export { auth, db, storage };
