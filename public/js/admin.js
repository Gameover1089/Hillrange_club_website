// public/js/admin.js

// API_BASE_URL, escapeHTML, and handleAuthError are now defined in utils.js

/**
 * Fetches and displays all users for admin management.
 */
async function loadUsersForAdmin() {
    const userListTableBody = document.querySelector('#userList tbody');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const noUsersMessage = document.getElementById('noUsersMessage');
    const token = localStorage.getItem('token');
    const currentUserId = parseInt(localStorage.getItem('userId')); // Get current user ID

    if (!userListTableBody) return; // Exit if not on manage-admins page

    // Show loading, hide others
    loadingMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    noUsersMessage.classList.add('hidden');
    userListTableBody.innerHTML = ''; // Clear previous content

    if (!token) {
        errorMessage.textContent = 'Authentication token missing. Please log in.';
        errorMessage.classList.remove('hidden');
        loadingMessage.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const users = await response.json();

        if (response.ok) {
            if (users.length === 0) {
                noUsersMessage.classList.remove('hidden');
            } else {
                users.forEach(user => {
                    const userRow = createUserRow(user, currentUserId);
                    userListTableBody.appendChild(userRow);
                });
            }
        } else {
            errorMessage.textContent = users.message || 'Failed to fetch users.';
            errorMessage.classList.remove('hidden');
            handleAuthError(response.status); // Use common error handler
        }
    } catch (error) {
        console.error('Error loading users:', error);
        errorMessage.textContent = 'Network error. Could not load users.';
        errorMessage.classList.remove('hidden');
    } finally {
        loadingMessage.classList.add('hidden');
    }
}

/**
 * Creates an HTML table row for a given user.
 * @param {Object} user - The user object.
 * @param {number} currentUserId - The ID of the currently logged-in user to prevent self-demotion/deletion.
 * @returns {HTMLElement} The created table row element.
 */
function createUserRow(user, currentUserId) {
    const row = document.createElement('tr');
    row.className = 'bg-white';
    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHTML(user.username)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHTML(user.role)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            ${user.role === 'user' ? `
                <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition duration-300 promote-btn" data-id="${user.id}">Promote to Admin</button>
                <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition duration-300 delete-user-btn" data-id="${user.id}">Remove User</button>
            ` : ''}
            ${user.role === 'admin' && user.id !== currentUserId ? `
                <button class="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition duration-300 demote-btn" data-id="${user.id}">Demote to User</button>
            ` : ''}
            ${user.id === currentUserId ? `
                <span class="text-gray-500 text-xs italic">You</span>
            ` : ''}
        </td>
    `;

    // Add event listeners
    const promoteButton = row.querySelector(`.promote-btn[data-id="${user.id}"]`);
    if (promoteButton) {
        promoteButton.addEventListener('click', () => promoteUser(user.id, user.username));
    }

    const demoteButton = row.querySelector(`.demote-btn[data-id="${user.id}"]`);
    if (demoteButton) {
        demoteButton.addEventListener('click', () => demoteUser(user.id, user.username));
    }

    const deleteUserButton = row.querySelector(`.delete-user-btn[data-id="${user.id}"]`);
    if (deleteUserButton) {
        deleteUserButton.addEventListener('click', () => deleteUser(user.id, user.username));
    }

    return row;
}

/**
 * Promotes a user to an admin role.
 * @param {number} userId - The ID of the user to promote.
 * @param {string} username - The username of the user to promote.
 */
async function promoteUser(userId, username) {
    // Using prompt for confirmation as confirm() is restricted in some environments
    const confirmed = prompt(`Type "PROMOTE" to confirm promoting ${username} to admin:`);
    if (confirmed !== 'PROMOTE') {
        alert('Action cancelled or incorrect confirmation.');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Authentication token missing. Please log in.');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/promote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId: userId })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            loadUsersForAdmin(); // Reload the list
        } else {
            alert(data.message || 'Failed to promote user.');
            handleAuthError(response.status); // Use common error handler
        }
    } catch (error) {
        console.error('Error promoting user:', error);
        alert('Network error. Could not promote user.');
    }
}

/**
 * Demotes an admin back to a regular user role.
 * @param {number} userId - The ID of the user to demote.
 * @param {string} username - The username of the user to demote.
 */
async function demoteUser(userId, username) {
    // Using prompt for confirmation as confirm() is restricted in some environments
    const confirmed = prompt(`Type "DEMOTE" to confirm demoting ${username} to a regular user:`);
    if (confirmed !== 'DEMOTE') {
        alert('Action cancelled or incorrect confirmation.');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Authentication token missing. Please log in.');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/demote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId: userId })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            loadUsersForAdmin(); // Reload the list
        } else {
            alert(data.message || 'Failed to demote user.');
            handleAuthError(response.status); // Use common error handler
        }
    } catch (error) {
        console.error('Error demoting user:', error);
        alert('Network error. Could not demote user.');
    }
}

/**
 * Deletes a regular user.
 * @param {number} userId - The ID of the user to delete.
 * @param {string} username - The username of the user to delete.
 */
async function deleteUser(userId, username) {
    // Using prompt for confirmation
    const confirmed = prompt(`Type "DELETE" to confirm deleting user "${username}". This action cannot be undone.`);
    if (confirmed !== 'DELETE') {
        alert('Deletion cancelled or incorrect confirmation.');
        return;
    }

    const token = localStorage.getItem('token');
    const currentUserId = parseInt(localStorage.getItem('userId'));

    if (!token) {
        alert('Authentication token missing. Please log in.');
        window.location.href = 'login.html';
        return;
    }

    if (userId === currentUserId) {
        alert('You cannot delete your own account from here.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            loadUsersForAdmin(); // Reload the user list after deletion
        } else {
            alert(data.message || 'Failed to delete user.');
            handleAuthError(response.status); // Use common error handler
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Network error. Could not delete user.');
    }
}
