// js/login.js

import { auth } from './firebase-init.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// DOM Elements
const emailLoginForm = document.getElementById('email-login-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const authStatusDiv = document.getElementById('auth-status');

// Helper to display status messages
function showStatus(message, type = 'info') {
    authStatusDiv.textContent = message;
    authStatusDiv.className = `suds_status_${type}`; // Using existing styles from style.css
}

// Redirect after successful login/signup
function redirectToApp() {
    window.location.href = 'index.html'; // Or 'all_configs.html' or 'planner.html'
}

// Email/Password Login
emailLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    showStatus('Logging in...', 'info');
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showStatus('Logged in successfully! Redirecting...', 'success');
        setTimeout(redirectToApp, 1000);
    } catch (error) {
        console.error("Login error:", error);
        showStatus(`Login failed: ${error.message}`, 'error');
    }
});

// Email/Password Signup
signupBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (password.length < 6) {
        showStatus('Password must be at least 6 characters long.', 'error');
        return;
    }

    showStatus('Registering account...', 'info');
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showStatus('Account created successfully! Redirecting...', 'success');
        setTimeout(redirectToApp, 1000);
    } catch (error) {
        console.error("Signup error:", error);
        showStatus(`Registration failed: ${error.message}`, 'error');
    }
});

// Google Sign-In
googleLoginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    showStatus('Signing in with Google...', 'info');
    try {
        await signInWithPopup(auth, provider);
        showStatus('Logged in with Google successfully! Redirecting...', 'success');
        setTimeout(redirectToApp, 1000);
    } catch (error) {
        console.error("Google login error:", error);
        showStatus(`Google login failed: ${error.message}`, 'error');
    }
});

// Initial check: if already logged in, redirect
// This is a basic check. More robust checks will be in main.js.
auth.onAuthStateChanged(user => {
    if (user) {
        // If a user is already logged in and on the login page, redirect them.
        console.log("Already logged in, redirecting to app...", user.uid);
        redirectToApp();
    }
});
