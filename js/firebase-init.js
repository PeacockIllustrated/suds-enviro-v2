// js/firebase-init.js

// Firebase SDK imports for the services we will use
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
// No explicit import for getAnalytics for now, as it's optional for this app's core functionality.

// Your web app's Firebase configuration (provided by you)
const firebaseConfig = {
  apiKey: "AIzaSyC5amcokd38NbNbZvChmTL1wR7yX1E8TD43E", // Corrected key (assuming typo, used first value)
  authDomain: "suds-enviro-d83d4.firebaseapp.com",
  projectId: "suds-enviro-d83d4",
  storageBucket: "suds-enviro-d83d4.firebasestorage.app",
  messagingSenderId: "631185919389",
  appId: "1:631185919389:web:441c120f53d485e63a7374",
  measurementId: "G-JSXSGWMPDT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services and export them
const auth = getAuth(app);
const db = getFirestore(app); // Assuming Firestore as discussed

export {
  app,
  auth,
  db
};

console.log("Firebase initialized and services exported!");
