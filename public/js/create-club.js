// public/js/create-club.js

// API_BASE_URL, isAdminOrSuperAdmin, isSuperAdmin, showToast, getToken, handleAuthError are provided by utils.js

document.addEventListener('DOMContentLoaded', () => {
    // Client-side redirection checks. Server-side will re-validate.
    if (!isLoggedIn()) {
        showToast('Please log in to create a club.', 'warning');
        window.location.href = 'login.html';
        return;
    }
    if (isSuperAdmin()) {
        showToast('Superadmins cannot create clubs.', 'error');
        window.location.href = 'dashboard.html'; // Redirect superadmins away
        return;
    }
    if (!isAdminOrSuperAdmin()) { // Only admins and superadmins can create clubs (but superadmin is redirected above)
        showToast('You must be an Admin to create a club.', 'error');
        window.location.href = 'dashboard.html';
        return;
    }

    const createClubForm = document.getElementById('createClubForm');
    if (createClubForm) {
        // Attach the handleCreateClub function to the form's submit event
        createClubForm.addEventListener('submit', handleCreateClub);
    }
});

/**
 * Handles the creation of a new club.
 * This function is specifically for the create-club.html form.
 * @param {Event} event - The form submission event.
 */
async function handleCreateClub(event) {
    event.preventDefault(); // Prevent default form submission

    const name = document.getElementById('clubName').value.trim();
    const description = document.getElementById('clubDescription').value.trim();
    const category = document.getElementById('clubCategory').value.trim(); // Optional field
    const contact = document.getElementById('clubContact').value.trim();   // Optional field

    // Client-side validation for required fields
    if (!name || !description) {
        showToast('Please fill in both club name and description.', 'warning');
        return; // Stop execution if validation fails
    }

    const token = getToken(); // Get the authentication token from utils.js
    if (!token) {
        showToast('Authentication token not found. Please log in.', 'error');
        window.location.href = 'login.html'; // Redirect to login if token is missing
        return; // Stop execution
    }

    // Prepare FormData object for multipart/form-data (for file uploads)
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('contact', contact);

    const clubImageInput = document.getElementById('clubImage');
    // Check if a file has been selected for upload
    if (clubImageInput && clubImageInput.files.length > 0) {
        formData.append('clubImage', clubImageInput.files[0]); // Append the selected file
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/clubs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}` // Attach the JWT token
                // Do NOT manually set 'Content-Type': 'multipart/form-data'.
                // fetch API does this automatically when body is a FormData object.
            },
            body: formData // Send the FormData object
        });

        const data = await response.json(); // Parse the JSON response from the server

        if (response.ok) {
            // Club created successfully
            showToast(data.message || 'Club created successfully!', 'success');
            document.getElementById('createClubForm').reset(); // Clear the form fields
            // Redirect to the dashboard after a short delay
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            // Handle server-side errors (e.g., 400 Bad Request, 403 Forbidden)
            showToast(data.message || 'Failed to create club. Please try again.', 'error');
            handleAuthError(response.status); // Use utils.js helper for common auth errors
        }
    } catch (error) {
        // Handle network errors or issues with JSON parsing
        console.error('Error creating club:', error);
        showToast('An unexpected error occurred. Please check your network connection and try again.', 'error');
    }
}
