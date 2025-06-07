// public/js/auth.js

// API_BASE_URL is now defined in utils.js

document.addEventListener('DOMContentLoaded', () => {
    // Handle Register Form Submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Handle Login Form Submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Global logout listener for the navigation bar
    const navLogoutLink = document.getElementById('nav-logout-link');
    if (navLogoutLink) {
        navLogoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    // Update the navigation bar when the page loads (defined in utils.js)
    updateNavBar();
});

/**
 * Handles user registration form submission.
 * @param {Event} event - The submit event object.
 */
async function handleRegister(event) {
    event.preventDefault(); // Prevent default form submission

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, { // CORRECTED API PATH
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message + ' Redirecting to login...', 'success');
            // Redirect to login page after successful registration
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000); // Redirect after 2 seconds
        } else {
            showToast(data.message || 'Registration failed.', 'error');
        }
    } catch (error) {
        console.error('Error during registration:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/**
 * Handles user login form submission.
 * @param {Event} event - The submit event object.
 */
async function handleLogin(event) {
    event.preventDefault(); // Prevent default form submission

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, { // CORRECTED API PATH
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            setAuthData(data.token, data.user.role, data.user.username, data.user.id); // Use utils.js helper
            showToast(data.message + ' Redirecting to dashboard...', 'success');
            // Redirect to dashboard after successful login
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500); // Redirect after 1.5 seconds
        } else {
            showToast(data.message || 'Login failed. Invalid credentials.', 'error');
        }
    } catch (error) {
        console.error('Error during login:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/**
 * Handles user logout.
 */
function handleLogout() {
    clearAuthData(); // Use utils.js helper
    showToast('You have been logged out.', 'info');
    window.location.href = 'index.html'; // Redirect to home page
}
