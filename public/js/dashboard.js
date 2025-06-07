// public/js/dashboard.js

// API_BASE_URL, isLoggedIn, isAdminOrSuperAdmin, isSuperAdmin, showToast, getToken, getInitial, handleAuthError are from utils.js

document.addEventListener('DOMContentLoaded', async () => {
    if (!isLoggedIn()) {
        showToast('Please log in to view your dashboard.', 'warning');
        window.location.href = 'login.html';
        return;
    }

    await loadDashboardUserProfile();
    // await loadDashboardClubCounts();
    
    const adminCreateClubBtn = document.getElementById('adminCreateClubBtn');
    if (adminCreateClubBtn) {
        adminCreateClubBtn.addEventListener('click', () => {
            window.location.href = 'create-club.html';
        });
    }

    const adminManageUsersBtn = document.getElementById('adminManageUsersBtn');
    if (adminManageUsersBtn) {
        adminManageUsersBtn.addEventListener('click', () => {
            window.location.href = 'manage-admins.html';
        });
    }

    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            window.location.href = 'edit-profile.html';
        });
    }
});

async function loadDashboardUserProfile() {
    const dashboardUsernameElem = document.getElementById('dashboardUsername');
    const dashboardRoleElem = document.getElementById('dashboardRole');
    const userProfilePictureElem = document.getElementById('userProfilePicture');
    const profileInitialsElem = document.getElementById('profileInitials');
    const adminActionsDiv = document.getElementById('adminActions');

    const token = getToken();

    if (!token) {
        showToast('Authentication missing. Please log in.', 'error');
        return;
    }

    try {
        // UPDATED ENDPOINT
        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user profile');
        }
        
        const userData = await response.json();

        if (dashboardUsernameElem) {
            dashboardUsernameElem.textContent = `Welcome, ${escapeHTML(userData.username)}!`;
        }
        if (dashboardRoleElem) {
            dashboardRoleElem.textContent = `Role: ${escapeHTML(userData.role)}`;
        }

        if (userProfilePictureElem && profileInitialsElem) {
            if (userData.profilePictureUrl) {
                userProfilePictureElem.src = `${API_BASE_URL}${userData.profilePictureUrl}`;
                userProfilePictureElem.classList.remove('hidden');
                profileInitialsElem.classList.add('hidden');
            } else {
                profileInitialsElem.textContent = getInitial(userData.username);
                profileInitialsElem.classList.remove('hidden');
                userProfilePictureElem.classList.add('hidden');
            }
        }

        if (adminActionsDiv) {
            if (isAdminOrSuperAdmin()) {
                adminActionsDiv.classList.remove('hidden');
                if (isSuperAdmin()) {
                    const createClubBtn = document.getElementById('adminCreateClubBtn');
                    if (createClubBtn) createClubBtn.classList.add('hidden');
                }
            } else {
                adminActionsDiv.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error loading dashboard user profile:', error);
        showToast('Network error loading profile. Please refresh.', 'error');
    }
}

// async function loadDashboardClubCounts() {
//     const totalClubsCountElem = document.getElementById('totalClubsCount');
//     const joinedClubsCountElem = document.getElementById('joinedClubsCount');
//     const token = getToken();

//     if (!token) {
//         showToast('Authentication missing for club counts.', 'error');
//         return;
//     }

//     // try {
//     //     // UPDATED ENDPOINT
//     //     const totalClubsResponse = await fetch(`${API_BASE_URL}/api/clubs/count`, {
//     //         headers: { 'Authorization': `Bearer ${token}` }
//     //     });
        
//     //     if (!totalClubsResponse.ok) {
//     //         throw new Error('Failed to fetch total clubs count');
//     //     }
        
//     //     const totalClubsData = await totalClubsResponse.json();
//     //     if (totalClubsCountElem) {
//     //         totalClubsCountElem.textContent = totalClubsData.count;
//     //     }

//     //     // UPDATED ENDPOINT
//     //     const joinedClubsResponse = await fetch(`${API_BASE_URL}/api/user/joined-clubs/count`, {
//     //         headers: { 'Authorization': `Bearer ${token}` }
//     //     });
        
//     //     if (!joinedClubsResponse.ok) {
//     //         throw new Error('Failed to fetch joined clubs count');
//     //     }
        
//     //     const joinedClubsData = await joinedClubsResponse.json();
//     //     if (joinedClubsCountElem) {
//     //         joinedClubsCountElem.textContent = joinedClubsData.count;
//     //     }
//     // } catch (error) {
//     //     console.error('Network error loading club counts:', error);
//     //     showToast('Network error loading club counts.', 'error');
//     // }
// }