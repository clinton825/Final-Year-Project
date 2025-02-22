import { initializeApp } from 'firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';

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

export { auth, db };
