// public/js/user.js

// API_BASE_URL, escapeHTML, handleAuthError, showToast, getToken, getInitial are defined in utils.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if logged in. If not, redirect to login.
    if (!isLoggedIn()) {
        showToast('Please log in to edit your profile.', 'warning');
        window.location.href = 'login.html';
        return;
    }

    loadUserProfile(); // Load profile data when the page loads
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleProfileUpdate); // Attach form submission handler
    }
});

/**
 * Loads the current user's profile data from the API and populates the form fields.
 */
async function loadUserProfile() {
    const usernameElem = document.getElementById('username'); // Corrected ID to match HTML
    const currentProfilePictureElem = document.getElementById('currentProfilePicture');
    const userId = parseInt(localStorage.getItem('userId')); // Get user ID from local storage

    if (!userId) {
        showToast('User ID not found in local storage.', 'error');
        window.location.href = 'dashboard.html'; // Redirect if user ID is missing
        return;
    }

    try {
        const token = getToken(); // Get the authentication token
        if (!token) {
            showToast('Authentication token missing. Please log in.', 'error');
            window.location.href = 'login.html';
            return;
        }

        // Fetch user profile data using the /api/users/:id endpoint
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}` // Include the JWT token
            }
        });

        const userData = await response.json();

        if (response.ok) {
            if (usernameElem) {
                usernameElem.value = escapeHTML(userData.username || ''); // Use .value for input
            }
            if (currentProfilePictureElem) {
                if (userData.profilePictureUrl) {
                    currentProfilePictureElem.src = `${API_BASE_URL}${userData.profilePictureUrl}`;
                } else {
                    // Fallback to initials placeholder if no profile picture
                    currentProfilePictureElem.src = `https://placehold.co/100x100/cccccc/333333?text=${getInitial(userData.username)}`;
                }
            }
            showToast('Profile data loaded successfully!', 'info');
        } else {
            // Handle specific API errors from the backend
            showToast(userData.message || 'Failed to load user profile.', 'error');
            handleAuthError(response.status); // Use common error handler for auth issues
        }
    } catch (error) {
        console.error('Network error fetching user profile:', error);
        showToast('Network error fetching user profile. Please try again.', 'error');
    }
}

/**
 * Handles the update of user profile information (password and profile picture).
 * @param {Event} event - The form submission event.
 */
async function handleProfileUpdate(event) {
    event.preventDefault(); // Prevent default form submission and page reload

    const form = event.target;
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const profilePictureInput = document.getElementById('profilePicture');

    const newPassword = newPasswordInput.value.trim();
    const confirmNewPassword = confirmNewPasswordInput.value.trim();
    const token = getToken(); // Use helper function from utils.js

    if (!token) {
        showToast('You are not logged in. Please log in to update your profile.', 'error');
        return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
        showToast('New passwords do not match.', 'error');
        return;
    }

    if (newPassword && newPassword.length < 6) {
        showToast('New password must be at least 6 characters long.', 'error');
        return;
    }

    const formData = new FormData(); // Use FormData for file uploads

    let hasChanges = false;

    if (newPassword) {
        formData.append('newPassword', newPassword);
        hasChanges = true;
    }
    if (profilePictureInput.files.length > 0) {
        formData.append('profilePicture', profilePictureInput.files[0]);
        hasChanges = true;
    }

    // If no changes were made to password or picture, prevent empty submission
    if (!hasChanges) {
        showToast('No changes to save.', 'info');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
            method: 'PUT',
            headers: {
                // IMPORTANT: Do NOT set 'Content-Type': 'application/json' when using FormData,
                // the browser sets it automatically with the correct boundary.
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message + ' Redirecting to dashboard...', 'success');
            // Clear fields only if they were successfully updated
            newPasswordInput.value = '';
            confirmNewPasswordInput.value = '';
            profilePictureInput.value = ''; // Clear file input
            
            // Reload user profile immediately after successful update to reflect new picture
            // This is especially useful if the image source needs to be updated.
            await loadUserProfile();

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000); // Redirect after 2 seconds
        } else {
            showToast(data.message || 'Failed to update profile.', 'error');
            handleAuthError(response.status); // Use common error handler
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Network error. Please try again.', 'error');
    }
}
