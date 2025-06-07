// public/js/clubs.js

// API_BASE_URL, escapeHTML, and handleAuthError are now defined in utils.js

document.addEventListener("DOMContentLoaded", () => {
  // Ensure the user is logged in to view clubs
  if (!isLoggedIn()) {
    // showToast('Please log in to view club details.', 'warning'); // Auth.js already redirects for dashboard
    return;
  }
  loadClubs();
  setInterval(() => {
    loadClubs();
  }, 5000);

  // Event delegation for join/leave buttons on the club list
  const clubList = document.getElementById("clubList");
  if (clubList) {
    clubList.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      const clubId = button.dataset.id; // Corrected to dataset.id
      const action = button.dataset.action; // 'join' or 'leave'

      if (clubId && action) {
        if (action === "join") {
          await joinClub(parseInt(clubId)); // Ensure ID is int
        } else if (action === "leave") {
          await leaveClub(parseInt(clubId)); // Ensure ID is int
        }
      }
    });
  }
});

/**
 * Loads all clubs from the backend and displays them.
 */
/**
 * Checks if there are new clubs since the last dashboard visit
 * @returns {Promise<boolean>} - True if new clubs exist, false otherwise
 */
async function hasNewClubs() {
  // Get current club list
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return false;

    const currentClubs = await response.json();
    const previousClubs =
      JSON.parse(localStorage.getItem("previousClubs")) || [];

    // Compare club IDs to detect new clubs
    const currentIds = currentClubs.map((c) => c.id);
    const previousIds = previousClubs.map((c) => c.id);

    // Find IDs that exist in current but not in previous
    const newClubIds = currentIds.filter((id) => !previousIds.includes(id));

    // Save current clubs for next check
    localStorage.setItem("previousClubs", JSON.stringify(currentClubs));

    return newClubIds.length > 0;
  } catch (error) {
    console.error("Error checking for new clubs:", error);
    return false;
  }
}
async function loadClubs() {
  const clubListDiv = document.getElementById("clubList");
  const loadingMessage = document.getElementById("loadingMessage");
  const errorMessage = document.getElementById("errorMessage");
  const noClubsMessage = document.getElementById("noClubsMessage");
  const totalClubsCount = document.getElementById("totalClubsCount");
  const joinedClubsCount = document.getElementById("joinedClubsCount");
  let saved_scroll=clubListDiv.scrollTop
  console.log(saved_scroll)

  if (!clubListDiv) return; // Exit if not on dashboard page

  // Show loading, hide others
  loadingMessage.classList.remove("hidden");
  errorMessage.classList.add("hidden");
  noClubsMessage.classList.add("hidden");
  clubListDiv.innerHTML = ""; // Clear previous content

  const currentUserId = parseInt(localStorage.getItem("userId")); // Get the logged-in user's ID
  const userRole = localStorage.getItem("userRole");

  let totalClubs = 0;
  let userJoinedClubs = 0;

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs`, {
      headers: {
        Authorization: `Bearer ${getToken()}`, // Include the token for authenticated access
      },
    });
    const clubs = await response.json();

    if (response.ok) {
      totalClubs = clubs.length;
      if (clubs.length === 0) {
        noClubsMessage.classList.remove("hidden");
      } else {
        clubs.forEach((club) => {
          // Check if the current user is a member of this club
          const isMember = club.members && club.members.includes(currentUserId);
          if (isMember) {
            userJoinedClubs++;
          }
          const clubCard = createClubCard(
            club,
            isMember,
            userRole,
            currentUserId
          ); // Pass currentUserId
          clubListDiv.appendChild(clubCard);
        });
        clubListDiv.scrollTop=saved_scroll
      }
    } else {
      errorMessage.textContent = clubs.message || "Failed to fetch clubs.";
      errorMessage.classList.remove("hidden");
      handleAuthError(response.status); // Use common error handler
    }
  } catch (error) {
    console.error("Error loading clubs:", error);
    errorMessage.textContent = "Network error. Could not load clubs.";
    errorMessage.classList.remove("hidden");
  } finally {
    loadingMessage.classList.add("hidden"); // Hide loading message
    if (totalClubsCount) totalClubsCount.textContent = totalClubs;
    if (joinedClubsCount) joinedClubsCount.textContent = userJoinedClubs;
  }
}

/**
 * Creates an HTML card element for a given club.
 * @param {Object} club - The club object.
 * @param {boolean} isMember - True if the current user is a member of this club.
 * @param {string} userRole - The role of the current user.
 * @param {number} currentUserId - The ID of the currently logged-in user.
 * @returns {HTMLElement} The created club card element.
 */
function createClubCard(club, isMember, userRole, currentUserId) {
  const card = document.createElement("div");
  card.className =
    "bg-white p-6 rounded-lg shadow-md flex flex-col items-start";

  // Default image if imageUrl is empty or null
  const imageUrl =
    club.imageUrl && club.imageUrl.startsWith("/")
      ? API_BASE_URL + club.imageUrl
      : "https://placehold.co/400x200/cccccc/333333?text=No+Image";

  let actionButtons = "";
  // Always add a "View Details" button
  actionButtons += `<button class="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition duration-300 view-details-btn" data-id="${club.id}">View Details</button>`;

  // Admin-specific buttons
  if (isAdminOrSuperAdmin()) {
    // Using helper from utils.js
    actionButtons += `
            <button class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition duration-300 edit-club-btn" data-id="${club.id}">Edit</button>
        `;
    // Superadmin can delete clubs. Regular admin can delete clubs they created.
    if (
      isSuperAdmin() ||
      (userRole === "admin" && club.creatorId === currentUserId)
    ) {
      actionButtons += `<button class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition duration-300 delete-club-btn" data-id="${club.id}">Delete</button>`;
    }

    // Superadmin can view members of any club. Regular admin can view if they are the creator.
    if (
      isSuperAdmin() ||
      (userRole === "admin" && club.creatorId === currentUserId)
    ) {
      actionButtons += `<button class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition duration-300 view-members-btn" data-id="${club.id}">View Members</button>`;
    }
  } else if (userRole === "user") {
    // Only regular users get join/leave buttons on this page
    if (isMember) {
      actionButtons += `<button data-id="${club.id}" data-action="leave" class="bg-red-400 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition duration-300 join-leave-btn">Leave Club</button>`;
    } else {
      actionButtons += `<button data-id="${club.id}" data-action="join" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition duration-300 join-leave-btn">Join Club</button>`;
    }
  }

  card.innerHTML = `
        <img src="${imageUrl}" alt="${escapeHTML(
    club.name
  )}" class="w-full h-40 object-cover rounded-md mb-4 border border-gray-200">
        <h3 class="text-xl font-semibold text-gray-800 mb-2">${escapeHTML(
          club.name
        )}</h3>
        <p class="text-gray-600 text-sm mb-2"><strong class="font-medium">Category:</strong> ${escapeHTML(
          club.category || "N/A"
        )}</p>
        <p class="text-gray-600 text-sm mb-4"><strong class="font-medium">Contact:</strong> ${escapeHTML(
          club.contact || "N/A"
        )}</p>
        <p class="text-gray-700 text-base mb-4 flex-grow">${escapeHTML(
          club.description
        )}</p>
        <div class="mt-auto pt-2 w-full flex justify-end space-x-2 flex-wrap gap-2">
            ${actionButtons}
        </div>
    `;

  // Add event listeners for buttons
  const viewDetailsButton = card.querySelector(
    `.view-details-btn[data-id="${club.id}"]`
  );
  if (viewDetailsButton) {
    viewDetailsButton.addEventListener("click", () => {
      window.location.href = `club-detail.html?id=${club.id}`;
    });
  }

  if (isAdminOrSuperAdmin()) {
    const editButton = card.querySelector(
      `.edit-club-btn[data-id="${club.id}"]`
    );
    if (editButton) {
      editButton.addEventListener("click", () => {
        window.location.href = `edit-club.html?id=${club.id}`;
      });
    }

    const deleteButton = card.querySelector(
      `.delete-club-btn[data-id="${club.id}"]`
    );
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        const confirmed = prompt(
          `Type "DELETE" to confirm deleting "${escapeHTML(club.name)}":`
        ); // Use escapeHTML here too
        if (confirmed === "DELETE") {
          deleteClub(club.id);
        } else if (confirmed !== null) {
          showToast("Deletion cancelled or incorrect confirmation.", "info"); // Use showToast
        }
      });
    }

    const viewMembersButton = card.querySelector(
      `.view-members-btn[data-id="${club.id}"]`
    );
    if (viewMembersButton) {
      viewMembersButton.addEventListener("click", () => {
        // Navigate to club-detail page and activate the members tab
        window.location.href = `club-detail.html?id=${club.id}&tab=members`;
      });
    }
  }
  // Note: The join/leave buttons are handled by event delegation on the main clubList element
  // within the DOMContentLoaded listener, so no individual listeners are needed here for them.

  return card;
}

/**
 * Handles the creation of a new club.
 * @param {Event} event - The form submission event.
 */
// async function createClub(event) {
//     event.preventDefault();
//     console.log('createClub function triggered.'); // Debugging log

//     const form = event.target;
//     const token = getToken(); // Use getToken from utils.js

//     // Client-side validation for required fields
//     const nameInput = document.getElementById('clubName');
//     const descriptionInput = document.getElementById('clubDescription');

//     const name = nameInput ? nameInput.value.trim() : '';
//     const description = descriptionInput ? descriptionInput.value.trim() : '';

//     console.log('Retrieved Club Name (client-side):', name);       // Debugging log
//     console.log('Retrieved Club Description (client-side):', description); // Debugging log

//     if (!name || !description) {
//         showToast('Please fill in both club name and description.', 'warning');
//         console.log('Client-side validation failed: Name or description is empty.'); // Debugging log
//         return; // IMPORTANT: This stops the function if validation fails
//     }

//     if (!token) {
//         showToast('You must be logged in to create a club.', 'error');
//         console.log('No authentication token found.'); // Debugging log
//         return;
//     }
//     // Server-side will also re-validate admin role and prevent superadmin creation.
//     // Client-side quick check (though create-club.html already redirects superadmin)
//     if (!isAdminOrSuperAdmin() || isSuperAdmin()) { // Use isAdminOrSuperAdmin and isSuperAdmin from utils.js
//         showToast('You do not have permission to create clubs.', 'error');
//         console.log('User does not have permission to create clubs (client-side check).'); // Debugging log
//         return;
//     }

//     const formData = new FormData(form); // Collect form data, including files
//     // You can inspect formData content in the browser's Network tab under "Request Payload"

//     try {
//         const response = await fetch(`${API_BASE_URL}/api/clubs`, {
//             method: 'POST',
//             headers: {
//                 'Authorization': `Bearer ${token}` // Send token for authentication
//             },
//             body: formData // FormData handles content-type for multipart/form-data
//         });

//         // If the server sends a 400 response, 'data' might still be readable if it's JSON
//         const data = await response.json();
//         console.log('Server response data:', data); // Debugging log

//         if (response.ok) {
//             showToast(data.message + ' Redirecting to dashboard...', 'success');
//             setTimeout(() => {
//                 window.location.href = 'dashboard.html';
//             }, 1500);
//         } else {
//             showToast(data.message || 'Failed to create club.', 'error');
//             handleAuthError(response.status);
//         }
//     } catch (error) {
//         console.error('Error creating club (fetch/JSON parsing):', error); // Debugging log
//         showToast('Network error. Could not create club.', 'error');
//     }
// }

/**
 * Fetches club data for editing and populates the form.
 * @param {number} clubId - The ID of the club to fetch.
 */
async function fetchClubForEdit(clubId) {
  const form = document.getElementById("editClubForm");
  const currentClubImage = document.getElementById("currentClubImage");
  const noImageMessage = document.getElementById("noImageMessage");

  showToast("Loading club data...", "info"); // Use showToast

  const token = getToken(); // Get the token
  if (!token) {
    showToast("Authentication token not found. Please log in.", "error");
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${clubId}`, {
      headers: {
        Authorization: `Bearer ${token}`, // Include token for authenticated access
      },
    });
    const club = await response.json();

    if (response.ok) {
      document.getElementById("clubName").value = club.name;
      document.getElementById("clubDescription").value = club.description;
      document.getElementById("clubCategory").value = club.category || "";
      document.getElementById("clubContact").value = club.contact || "";

      if (club.imageUrl) {
        currentClubImage.src = API_BASE_URL + club.imageUrl; // Ensure base URL is prepended
        currentClubImage.classList.remove("hidden");
        noImageMessage.classList.add("hidden");
      } else {
        currentClubImage.classList.add("hidden");
        noImageMessage.classList.remove("hidden");
      }

      // Store the existing image URL to send with the form data if no new image is uploaded
      form.dataset.existingImageUrl = club.imageUrl || "";
      showToast("Club data loaded.", "success");
    } else {
      showToast(club.message || "Failed to load club for editing.", "error"); // Use showToast
      handleAuthError(response.status); // Use common error handler
    }
  } catch (error) {
    console.error("Error fetching club for edit:", error);
    showToast("Network error. Could not load club data.", "error"); // Use showToast
  }
}

/**
 * Handles the update of an existing club.
 * @param {Event} event - The form submission event.
 */
async function updateClub(event) {
  event.preventDefault();

  const form = event.target;
  const token = getToken(); // Use getToken from utils.js
  const urlParams = new URLSearchParams(window.location.search);
  const clubId = urlParams.get("id");

  // Client-side validation for required fields
  const name = document.getElementById("clubName").value.trim();
  const description = document.getElementById("clubDescription").value.trim();

  if (!name || !description) {
    showToast("Please fill in both club name and description.", "warning");
    return;
  }

  if (!token) {
    showToast("You must be logged in to update a club.", "error"); // Use showToast
    return;
  }

  if (!clubId) {
    showToast("Club ID not found for update.", "error"); // Use showToast
    return;
  }
  // Client-side quick check
  if (!isAdminOrSuperAdmin()) {
    // Use isAdminOrSuperAdmin from utils.js
    showToast("You do not have permission to update clubs.", "error"); // Use showToast
    return;
  }

  const formData = new FormData(form);
  // If no new image is selected, retain the old one
  const clubImageInput = document.getElementById("clubImage");
  if (clubImageInput && !clubImageInput.files.length) {
    const existingImageUrl = form.dataset.existingImageUrl;
    if (existingImageUrl) {
      formData.append("existingImageUrl", existingImageUrl);
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${clubId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`, // Include token for authenticated access
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      showToast(data.message + " Redirecting to dashboard...", "success"); // Use showToast
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1500);
    } else {
      showToast(data.message || "Failed to update club.", "error"); // Use showToast
      handleAuthError(response.status); // Use common error handler
      setInterval(() => {
        window.location.href = "dashboard.html";
      }, 1500);
    }
  } catch (error) {
    console.error("Error updating club:", error);
    showToast("Network error. Could not update club.", "error"); // Use showToast
  }
}

/**
 * Handles the deletion of a club.
 * @param {number} clubId - The ID of the club to delete.
 */
async function deleteClub(clubId) {
  const token = getToken(); // Use getToken from utils.js
  if (!token) {
    showToast("You must be logged in to delete a club.", "warning"); // Use showToast
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${clubId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`, // Include token for authenticated access
      },
    });

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success"); // Use showToast
      loadClubs(); // Reload clubs on dashboard after deletion
      // Also update dashboard counts
      if (typeof loadClubCounts === "function") {
        loadClubCounts();
      }
    } else {
      showToast(data.message || "Failed to delete club.", "error"); // Use showToast
      handleAuthError(response.status); // Use common error handler
      setInterval(() => {
        window.location.href = "dashboard.html";
      }, 1500);
    }
  } catch (error) {
    console.error("Error deleting club:", error);
    showToast("Network error. Could not delete club.", "error"); // Use showToast
  }
}

/**
 * Handles a user joining a club.
 * @param {number} clubId - The ID of the club to join.
 */
async function joinClub(clubId) {
  // Removed clubName from arguments
  const token = getToken(); // Use getToken from utils.js
  if (!token) {
    showToast("You must be logged in to join a club.", "warning"); // Use showToast
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${clubId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Include token for authenticated access
      },
    });

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success"); // Use showToast
      loadClubs(); // Reload clubs to update button state
      // Also update dashboard counts
      if (typeof loadClubCounts === "function") {
        loadClubCounts();
      }
    } else {
      showToast(data.message || "Failed to join club.", "error"); // Use showToast
      handleAuthError(response.status); // Use common error handler
      setInterval(() => {
        window.location.href = "dashboard.html";
      }, 1500);
    }
  } catch (error) {
    console.error("Error joining club:", error);
    showToast("An error occurred. Please try again.", "error"); // Use showToast
  }
}

/**
 * Handles a user leaving a club.
 * @param {number} clubId - The ID of the club to leave.
 */
async function leaveClub(clubId) {
  // Removed clubName from arguments
  const token = getToken(); // Use getToken from utils.js
  if (!token) {
    showToast("You must be logged in to leave a club.", "warning"); // Use showToast
    window.location.href = "login.html";
    return;
  }

  // Using a simple prompt for confirmation as confirm() is restricted in some environments
  const confirmed = prompt(`Type "LEAVE" to confirm leaving the club:`); // Simplified prompt
  if (confirmed !== "LEAVE") {
    showToast("Action cancelled or incorrect confirmation.", "info"); // Use showToast
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${clubId}/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Include token for authenticated access
      },
    });

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success"); // Use showToast
      loadClubs(); // Reload clubs to update button state
      // Also update dashboard counts
      if (typeof loadClubCounts === "function") {
        loadClubCounts();
      }
    } else {
      showToast(data.message || "Failed to leave club.", "error"); // Use showToast
      handleAuthError(response.status); // Use common error handler
      setInterval(() => {
        window.location.href = "dashboard.html";
      }, 1500);
    }
  } catch (error) {
    console.error("Error leaving club:", error);
    showToast("An error occurred. Please try again.", "error"); // Use showToast
  }
}

// Event Listeners for Create/Edit forms
document.addEventListener("DOMContentLoaded", () => {
  const createClubForm = document.getElementById("createClubForm");
  if (createClubForm) {
    createClubForm.addEventListener("submit", createClub);
  }

  const editClubForm = document.getElementById("editClubForm");
  if (editClubForm) {
    editClubForm.addEventListener("submit", updateClub);
  }
});
