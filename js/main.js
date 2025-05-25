// js/main.js

import { auth } from './firebase-init.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');
    const logoutButtonContainer = document.createElement('li'); // Create a list item for the logout button
    const logoutButton = document.createElement('a'); // Create an anchor-like button for logout
    logoutButton.href = '#'; // Prevent actual navigation for JS handling
    logoutButton.textContent = 'Logout';
    logoutButton.id = 'logout-btn'; // Assign an ID for easy targeting
    logoutButton.classList.add('nav-link-logout'); // Add a class for specific styling if needed

    logoutButtonContainer.appendChild(logoutButton);


    if (mobileMenuToggle && navLinks) {
        // Append logout button to the navLinks list (desktop and mobile view)
        navLinks.appendChild(logoutButtonContainer);

        mobileMenuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
            const isExpanded = navLinks.classList.contains('active');
            mobileMenuToggle.setAttribute('aria-expanded', isExpanded);
        });

        // Close mobile menu if a link is clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    if (mobileMenuToggle) {
                        mobileMenuToggle.classList.remove('active');
                        mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    }
                }
            });
        });
    }

    // --- Authentication State Listener ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            console.log("User logged in:", user.email);
            // Optionally update UI to show user's email or status
            // e.g., document.getElementById('user-email').textContent = user.email;
        } else {
            // User is signed out.
            console.log("User logged out or not authenticated. Redirecting to login.");
            // Redirect to login page if not already on it
            if (window.location.pathname !== '/login.html' && !window.location.pathname.includes('/login.html')) {
                window.location.href = 'login.html';
            }
        }
    });

    // --- Logout Functionality ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault(); // Prevent default link behavior
            try {
                await signOut(auth);
                // Redirect will be handled by onAuthStateChanged listener
                console.log("Sign out successful.");
            } catch (error) {
                console.error("Error signing out:", error);
                alert("Error signing out: " + error.message);
            }
        });
    }
});

// Export any functions if needed by other modules (e.g., if you want to trigger logout from somewhere else)
export { }; // Empty export for now, but good practice if needed later
