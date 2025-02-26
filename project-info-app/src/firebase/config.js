import { initializeApp } from 'firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from '@firebase/firestore';

const firebaseConfig = {
  // Your Firebase configuration object goes here
  apiKey: "AIzaSyCYCGXsttUJHV0QStjs_sOvgmdoisFVu-o",
  authDomain: "infrastructure-project--app.firebaseapp.com",
  projectId: "infrastructure-project--app",
  storageBucket: "infrastructure-project--app.appspot.com",
  messagingSenderId: "845897639432",
  appId: "1:845897639432:web:9e14b96fc048c7bd6313bd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence - this allows the app to work offline
enableIndexedDbPersistence(db)
  .then(() => {
    console.log('Firestore persistence enabled');
  })
  .catch((err) => {
    console.error('Error enabling Firestore persistence:', err.code, err.message);
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });

// For local development - uncomment to use emulator
// if (window.location.hostname === 'localhost') {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

export { auth, db };
