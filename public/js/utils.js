// public/js/utils.js

// API Base URL - Explicitly set for local development
const API_BASE_URL = 'http://localhost:3000'; // Changed from window.location.origin

/**
 * Simple escape HTML function to prevent XSS.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHTML(str) {
    if (typeof str !== 'string') {
        return ''; // Or handle non-string input as needed
    }
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * Displays a toast notification to the user.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'warning'|'info'} type - The type of toast (affects styling).
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} px-4 py-2 rounded shadow-md text-white`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Automatically remove the toast after a few seconds
    setTimeout(() => {
        toast.remove();
    }, 4000); // Toast disappears after 4 seconds
}

/**
 * Creates the toast container if it doesn't exist.
 * @returns {HTMLElement} The toast container element.
 */
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    // Adjusted 'top-4' to 'top-20' to move the toast further down, preventing overlap with the header.
    container.className = 'fixed top-20 right-4 z-50 flex flex-col space-y-2';
    document.body.appendChild(container);
    return container;
}


/**
 * Retrieves the JWT token from local storage.
 * @returns {string|null} The JWT token or null if not found.
 */
function getToken() {
    return localStorage.getItem('token');
}

/**
 * Stores the JWT token and user role in local storage.
 * This function is typically called after a successful login/registration.
 * @param {string} token - The JWT token.
 * @param {string} role - The user's role (e.g., 'user', 'admin', 'superadmin').
 * @param {string} username - The user's username.
 * @param {number} userId - The user's ID.
 */
function setAuthData(token, role, username, userId) {
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', role);
    localStorage.setItem('username', username);
    localStorage.setItem('userId', userId);
}

/**
 * Clears authentication data from local storage.
 * This function is typically called on logout.
 */
function clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
}

/**
 * Checks if a user is currently logged in based on the presence of a token.
 * @returns {boolean} True if a token exists, false otherwise.
 */
function isLoggedIn() {
    return !!getToken();
}

/**
 * Retrieves the user's role from local storage.
 * @returns {string|null} The user's role or null if not found.
 */
function getUserRole() {
    return localStorage.getItem('userRole');
}

/**
 * Checks if the current user has an 'admin' or 'superadmin' role.
 * @returns {boolean} True if the user is an admin or superadmin, false otherwise.
 */
function isAdminOrSuperAdmin() {
    const role = getUserRole();
    return role === 'admin' || role === 'superadmin';
}

/**
 * Checks if the current user has a 'superadmin' role.
 * @returns {boolean} True if the user is a superadmin, false otherwise.
 */
function isSuperAdmin() {
    return getUserRole() === 'superadmin';
}

/**
 * Handles authentication errors (e.g., 401 Unauthorized, 403 Forbidden).
 * Redirects to login page if token is invalid or expired.
 * @param {number} statusCode - The HTTP status code of the response.
 */
function handleAuthError(statusCode) {
    if (statusCode === 401 || statusCode === 403) {
        showToast('Session expired or unauthorized. Please log in again.', 'error');
        clearAuthData(); // Clear invalid token
        window.location.href = 'login.html'; // Redirect to login page
    }
}

/**
 * Fetches current user data from the API.
 * This can be used to verify token validity and get up-to-date user info.
 * @returns {Promise<Object|null>} A promise that resolves with user data or null on error.
 */
async function fetchUserData() {
    const token = getToken();
    if (!token) {
        return null; // No token, no user data
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            handleAuthError(response.status);
            return null;
        }
        const userData = await response.json();
        // Update local storage in case role/username was changed by superadmin
        setAuthData(token, userData.role, userData.username, userData.id);
        return userData;
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

/**
 * Gets the initials from a username for display.
 * @param {string} username - The username.
 * @returns {string} The initials (e.g., "JD" for John Doe).
 */
function getInitial(username) {
    if (!username) return '';
    const parts = username.split(' ');
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return username[0].toUpperCase();
}

// Global navigation update logic (called by auth.js)
function updateNavBar() {
    const navLoginLink = document.getElementById('nav-login-link');
    const navRegisterLink = document.getElementById('nav-register-link');
    const navDashboardLink = document.getElementById('nav-dashboard-link');
    const navCreateClubLink = document.getElementById('nav-create-club-link');
    const navManageAdminsLink = document.getElementById('nav-manage-admins-link');
    const navLogoutLink = document.getElementById('nav-logout-link');

    const loggedIn = isLoggedIn();
    const role = getUserRole();

    // Reset visibility for all links
    [navLoginLink, navRegisterLink, navDashboardLink, navCreateClubLink, navManageAdminsLink, navLogoutLink]
        .forEach(link => {
            if (link) link.classList.add('hidden');
        });

    if (loggedIn) {
        if (navDashboardLink) navDashboardLink.classList.remove('hidden');
        if (navLogoutLink) navLogoutLink.classList.remove('hidden');

        if (isAdminOrSuperAdmin()) {
            // Admin can create clubs, Superadmin cannot
            if (isSuperAdmin()) {
                // Superadmin specific: No "Create Club" link
                if (navCreateClubLink) navCreateClubLink.classList.add('hidden');
            } else {
                // Regular Admin: Can create clubs
                if (navCreateClubLink) navCreateClubLink.classList.remove('hidden');
            }
            if (navManageAdminsLink) navManageAdminsLink.classList.remove('hidden');
        }
    } else {
        if (navLoginLink) navLoginLink.classList.remove('hidden');
        if (navRegisterLink) navRegisterLink.classList.remove('hidden');
    }
}

// Ensure updateNavBar runs on initial load
document.addEventListener('DOMContentLoaded', updateNavBar);
