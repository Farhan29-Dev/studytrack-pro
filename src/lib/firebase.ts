import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './firebase-config';

// Check if Firebase is configured
const isFirebaseConfigured = () => {
  return (
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID" &&
    firebaseConfig.apiKey &&
    firebaseConfig.projectId
  );
};

// Initialize Firebase only if configured
let app;
let db;
let storage;
let auth;

if (isFirebaseConfigured()) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
} else {
  console.warn(
    '⚠️ Firebase is not configured. Please update src/lib/firebase-config.ts with your Firebase credentials.'
  );
}

export { app, db, storage, auth, isFirebaseConfigured };
