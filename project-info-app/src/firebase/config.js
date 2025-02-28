import { initializeApp } from 'firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED } from '@firebase/firestore';

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
const db = getFirestore(app);

// Enable offline persistence with better configuration
enableIndexedDbPersistence(db, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED  // Use unlimited cache size for better offline performance
})
  .then(() => {
    console.log('Firestore persistence enabled with unlimited cache size');
  })
  .catch((err) => {
    console.error('Error enabling Firestore persistence:', err.code, err.message);
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time. This may affect offline capabilities.');
      alert('For best experience, please close other tabs of this application.');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('The current browser does not support all of the features required to enable persistence. This may affect offline capabilities.');
      alert('Your browser doesn\'t fully support offline capabilities. Some features may not work properly when offline.');
    }
  });

// For local development - uncomment to use emulator
// if (window.location.hostname === 'localhost') {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

export { auth, db };
