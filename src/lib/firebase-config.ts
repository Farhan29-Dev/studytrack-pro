// ============================================
// FIREBASE CONFIGURATION FILE
// ============================================
// 
// Enter your Firebase project configuration below.
// You can find these values in your Firebase Console:
// 1. Go to https://console.firebase.google.com
// 2. Select your project (or create a new one)
// 3. Click the gear icon ⚙️ → Project Settings
// 4. Scroll down to "Your apps" section
// 5. If no web app exists, click "Add app" → Web
// 6. Copy the config values below
//
// ============================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  // Optional: Add measurementId if you have Analytics enabled
  // measurementId: "YOUR_MEASUREMENT_ID"
};

// ============================================
// IMPORTANT NOTES:
// ============================================
// 
// 1. Enable Firestore Database:
//    - Go to Firebase Console → Build → Firestore Database
//    - Click "Create database"
//    - Choose production or test mode
//
// 2. Enable Storage:
//    - Go to Firebase Console → Build → Storage
//    - Click "Get Started"
//
// 3. Security Rules (for development, update for production):
//    
//    Firestore rules (Firestore → Rules):
//    ```
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /chat_messages/{document=**} {
//          allow read, write: if request.auth != null;
//        }
//      }
//    }
//    ```
//
//    Storage rules (Storage → Rules):
//    ```
//    rules_version = '2';
//    service firebase.storage {
//      match /b/{bucket}/o {
//        match /chat-images/{allPaths=**} {
//          allow read, write: if request.auth != null;
//        }
//      }
//    }
//    ```
//
// 4. Enable Authentication:
//    - Go to Firebase Console → Build → Authentication
//    - Click "Get Started"
//    - Enable Email/Password provider
//
// ============================================
