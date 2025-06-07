// public/js/club-detail.js

// API_BASE_URL, escapeHTML, and handleAuthError are now provided by utils.js

let currentClubId = null; // Store the current club ID
let clubData = null; // Store fetched club data globally for access across functions
let currentUserId = null; // Store current logged-in user ID
let userRole = null; // Store current logged-in user role
let isMemberOfClub = false; // Flag to check if current user is a member
let lastDisplayedMessageId = 0; // Track last displayed chat message ID
let chatInputState = {
  // Track chat input state
  value: "",
  hasFocus: false,
};

// --- DOM Elements ---
const clubNameElem = document.getElementById("clubName");
const clubImageElem = document.getElementById("clubImage");
const clubCategoryElem = document.getElementById("clubCategory");
const clubContactElem = document.getElementById("clubContact");
const clubDescriptionElem = document.getElementById("clubDescription");
const fullDescriptionElem = document.getElementById("fullDescription");
const createdAtElem = document.getElementById("createdAt");
const updatedAtElem = document.getElementById("updatedAt");
const creatorUsernameElem = document.getElementById("creatorUsername");

const joinLeaveBtn = document.getElementById("joinLeaveBtn");
const editClubBtn = document.getElementById("editClubBtn");
const deleteClubBtn = document.getElementById("deleteClubBtn");
const viewMembersBtn = document.getElementById("viewMembersBtn");

const detailsTab = document.getElementById("detailsTab");
const membersTab = document.getElementById("membersTab");
const announcementsTab = document.getElementById("announcementsTab");
const chatTab = document.getElementById("chatTab");

const detailsContent = document.getElementById("detailsContent");
const membersContent = document.getElementById("membersContent");
const announcementsContent = document.getElementById("announcementsContent");
const chatContent = document.getElementById("chatContent");

const membersCountSpan = document.getElementById("membersCount");
const announcementsCountSpan = document.getElementById("announcementsCount");

const membersListDiv = document.getElementById("membersList");
const noMembersMessage = document.getElementById("noMembersMessage");
const membersAccessMessage = document.getElementById("membersAccessMessage");

const announcementFormContainer = document.getElementById(
  "announcementFormContainer"
);
const announcementForm = document.getElementById("announcementForm");
const announcementText = document.getElementById("announcementText");
const announcementMessage = document.getElementById("announcementMessage");
const announcementsList = document.getElementById("announcementsList");
const noAnnouncementsMessage = document.getElementById(
  "noAnnouncementsMessage"
);

const chatBox = document.getElementById("chatBox");
const chatMessageInput = document.getElementById("chatMessageInput");
const sendChatMessageBtn = document.getElementById("sendChatMessageBtn");
const chatInputContainer = document.getElementById("chatInputContainer");
const chatMessageStatus = document.getElementById("chatMessageStatus");
const noChatMessages = document.getElementById("noChatMessages");
const chatAccessMessage = document.getElementById("chatAccessMessage");

// --- Initialization on Load ---
document.addEventListener("DOMContentLoaded", () => {
  currentUserId = parseInt(localStorage.getItem("userId"));
  userRole = localStorage.getItem("userRole");

  // Get club ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentClubId = urlParams.get("id");
  if (!currentClubId) {
    showToast("No club ID provided! Redirecting to dashboard.", "error");
    window.location.href = "dashboard.html";
    return;
  }

  loadClubDetails(); // Load initial club data

  // Setup tab click listeners
  detailsTab.addEventListener("click", () => showTab("details"));
  membersTab.addEventListener("click", () => showTab("members"));
  announcementsTab.addEventListener("click", () => showTab("announcements"));
  chatTab.addEventListener("click", () => showTab("chat"));

  // Setup Join/Leave Button Listener
  if (joinLeaveBtn) {
    joinLeaveBtn.addEventListener("click", handleJoinLeave);
  }
  // Setup Admin Buttons Listeners
  if (editClubBtn) {
    editClubBtn.addEventListener(
      "click",
      () => (window.location.href = `edit-club.html?id=${currentClubId}`)
    );
  }
  if (deleteClubBtn) {
    deleteClubBtn.addEventListener("click", handleDeleteClub);
  }
  if (viewMembersBtn) {
    viewMembersBtn.addEventListener("click", () => showTab("members")); // Just switch to members tab
  }

  // Setup Announcement Form Listener
  if (announcementForm) {
    announcementForm.addEventListener("submit", handlePostAnnouncement);
  }

  // Setup Chat Send Button Listener
  if (sendChatMessageBtn) {
    sendChatMessageBtn.addEventListener("click", handleSendChatMessage);
    chatMessageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Prevent new line in input
        handleSendChatMessage();
      }
    });
  }

  // Track chat input focus
  chatMessageInput.addEventListener("focus", () => {
    chatInputState.hasFocus = true;
  });

  chatMessageInput.addEventListener("blur", () => {
    chatInputState.hasFocus = false;
  });

  // Check URL for initial tab to open
  const initialTab = urlParams.get("tab");
  if (initialTab) {
    showTab(initialTab);
  } else {
    showTab("details"); // Default tab
  }

  // Set up polling for chat messages (every 5 seconds)
  // Only set up polling if user is logged in, to avoid unnecessary requests for non-members
  if (currentUserId) {
    setInterval(fetchChatMessages, 1000);
  }
});

// --- Core Functions ---

/**
 * Fetches and displays comprehensive details for the current club.
 */
async function loadClubDetails() {
  try {
    const token = getToken(); // Get token from utils.js
    const response = await fetch(
      `${API_BASE_URL}/api/clubs/${currentClubId}/details`,
      {
        headers: {
          Authorization: `Bearer ${token}`, // Include the token
        },
      }
    );
    const data = await response.json();

    if (response.ok) {
      clubData = data; // Store data globally
      isMemberOfClub = clubData.members.some(
        (member) => member.id === currentUserId
      );

      // Populate static club info
      clubNameElem.textContent = clubData.name;
      clubImageElem.src =
        clubData.imageUrl && clubData.imageUrl.startsWith("/")
          ? API_BASE_URL + clubData.imageUrl
          : "https://placehold.co/400x250/cccccc/333333?text=Club+Image";
      clubCategoryElem.innerHTML = `<i class="fas fa-tag mr-2"></i>Category: ${escapeHTML(
        clubData.category || "N/A"
      )}`;
      clubContactElem.innerHTML = `<i class="fas fa-envelope mr-2"></i>Contact: ${escapeHTML(
        clubData.contact || "N/A"
      )}`;
      clubDescriptionElem.textContent = escapeHTML(clubData.description);
      fullDescriptionElem.textContent = escapeHTML(clubData.description);
      createdAtElem.textContent = new Date(
        clubData.createdAt
      ).toLocaleDateString();
      updatedAtElem.textContent = new Date(
        clubData.updatedAt
      ).toLocaleDateString();
      creatorUsernameElem.textContent = escapeHTML(
        clubData.creatorUsername || "N/A"
      );

      updateButtonsVisibility();
      updateTabCounts();

      // Load content for active tab
      const activeTabButton = document.querySelector(
        ".border-b-2.text-blue-600"
      );
      const activeTabName = activeTabButton
        ? activeTabButton.dataset.tabName
        : "details";
      showTab(activeTabName);
    } else {
      showToast(data.message || "Failed to load club details.", "error");
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error("Error loading club details:", error);
    showToast("Network error. Could not load club details.", "error");
    window.location.href = "dashboard.html";
  }
}

/**
 * Updates the visibility and text of action buttons based on user role and membership.
 */
function updateButtonsVisibility() {
  if (!currentUserId || !userRole) {
    // Not logged in
    joinLeaveBtn.classList.remove("hidden");
    joinLeaveBtn.textContent = "Login to Join";
    joinLeaveBtn.disabled = true; // Cannot join if not logged in
    editClubBtn.classList.add("hidden");
    deleteClubBtn.classList.add("hidden");
    viewMembersBtn.classList.add("hidden");
    return;
  }

  // Hide all buttons initially then show relevant ones
  joinLeaveBtn.classList.add("hidden");
  editClubBtn.classList.add("hidden");
  deleteClubBtn.classList.add("hidden");
  viewMembersBtn.classList.add("hidden");

  if (userRole === "admin" || userRole === "superadmin") {
    // Admins and Superadmins can edit/delete
    editClubBtn.classList.remove("hidden");
    deleteClubBtn.classList.remove("hidden");

    // Only club creator admin or superadmin can view members from here
    if (
      isSuperAdmin() ||
      (userRole === "admin" && clubData && clubData.creatorId === currentUserId)
    ) {
      viewMembersBtn.classList.remove("hidden");
    }
  }

  // Superadmin does NOT get a join/leave button (per requirements, they just "view activities")
  if (isSuperAdmin()) {
    joinLeaveBtn.classList.add("hidden");
  } else if (
    userRole === "user" ||
    (userRole === "admin" && clubData.creatorId !== currentUserId)
  ) {
    // Regular user or admin who is not creator gets join/leave button
    joinLeaveBtn.classList.remove("hidden");
    if (isMemberOfClub) {
      joinLeaveBtn.innerHTML = `<i class="fas fa-minus-circle"></i> Leave Club`;
      joinLeaveBtn.classList.remove("bg-blue-500", "hover:bg-blue-600");
      joinLeaveBtn.classList.add("bg-red-500", "hover:bg-red-600");
    } else {
      joinLeaveBtn.innerHTML = `<i class="fas fa-plus-circle"></i> Join Club`;
      joinLeaveBtn.classList.remove("bg-red-500", "hover:bg-red-600");
      joinLeaveBtn.classList.add("bg-blue-500", "hover:bg-blue-600");
    }
    joinLeaveBtn.disabled = false;
  }

  // Admin who is creator also needs Join/Leave if they haven't joined their own club
  if (userRole === "admin" && clubData.creatorId === currentUserId) {
    if (!isMemberOfClub) {
      joinLeaveBtn.classList.remove("hidden");
      joinLeaveBtn.innerHTML = `<i class="fas fa-plus-circle"></i> Join Club`;
      joinLeaveBtn.classList.remove("bg-red-500", "hover:bg-red-600");
      joinLeaveBtn.classList.add("bg-blue-500", "hover:bg-blue-600");
      joinLeaveBtn.disabled = false;
    } else {
      // If admin is creator and is a member, they still see edit/delete.
      // Join/Leave button for creator is hidden if already a member, as they have other management roles.
      joinLeaveBtn.classList.add("hidden");
    }
  }
}

/**
 * Handles the click event for the Join/Leave Club button.
 */
async function handleJoinLeave() {
  if (isMemberOfClub) {
    await leaveClub(currentClubId);
  } else {
    await joinClub(currentClubId);
  }
}

/**
 * Handles the deletion of the club.
 */
async function handleDeleteClub() {
  const confirmed = prompt(
    `Type "DELETE" to confirm deleting "${clubData.name}". This action cannot be undone:`
  );
  if (confirmed === "DELETE") {
    const token = getToken(); // Get token from utils.js
    if (!token) {
      showToast("Authentication required.", "error");
      window.location.href = "login.html";
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/clubs/${currentClubId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        showToast(data.message, "success");
        window.location.href = "dashboard.html"; // Redirect after successful deletion
      } else {
        showToast(data.message || "Failed to delete club.", "error");
        handleAuthError(response.status); // Use common error handler
      }
    } catch (error) {
      console.error("Error deleting club:", error);
      showToast("Network error. Could not delete club.", "error");
    }
  } else if (confirmed !== null) {
    showToast("Deletion cancelled or incorrect confirmation.", "info");
  }
}

/**
 * Switches between tabs and loads content dynamically.
 * @param {string} tabName - The name of the tab to show ('details', 'members', 'announcements', 'chat').
 */
async function showTab(tabName) {
  // Reset all tabs and content
  const allTabs = [detailsTab, membersTab, announcementsTab, chatTab];
  const allContents = [
    detailsContent,
    membersContent,
    announcementsContent,
    chatContent,
  ];

  allTabs.forEach((tab) => {
    // Ensure data-tab-name exists for comparison
    if (tab.dataset.tabName) {
      tab.classList.remove("text-blue-600", "border-blue-500");
      tab.classList.add(
        "text-gray-500",
        "hover:text-gray-700",
        "hover:border-gray-300"
      );
    }
  });
  allContents.forEach((content) => content.classList.add("hidden"));

  // Activate selected tab and content
  let selectedTab;
  let selectedContent;

  switch (tabName) {
    case "details":
      selectedTab = detailsTab;
      selectedContent = detailsContent;
      break;
    case "members":
      selectedTab = membersTab;
      selectedContent = membersContent;
      await loadMembers();
      break;
    case "announcements":
      selectedTab = announcementsTab;
      selectedContent = announcementsContent;
      await loadAnnouncements();
      break;
    case "chat":
      selectedTab = chatTab;
      selectedContent = chatContent;
      // Reset chat state when switching to chat tab
      lastDisplayedMessageId = 0;
      await fetchChatMessages(); // Initial load for chat
      break;
    default:
      selectedTab = detailsTab;
      selectedContent = detailsContent;
  }

  selectedTab.classList.add("text-blue-600", "border-blue-500");
  selectedTab.classList.remove(
    "text-gray-500",
    "hover:text-gray-700",
    "hover:border-gray-300"
  );
  selectedContent.classList.remove("hidden");
}

/**
 * Updates the member and announcement counts in the tabs.
 */
function updateTabCounts() {
  if (clubData) {
    membersCountSpan.textContent = clubData.members
      ? clubData.members.length
      : 0;
    announcementsCountSpan.textContent = clubData.announcements
      ? clubData.announcements.length
      : 0;
  }
}

/**
 * Loads and displays club members.
 */
async function loadMembers() {
  membersListDiv.innerHTML = ""; // Clear previous members
  noMembersMessage.classList.add("hidden");
  membersAccessMessage.classList.add("hidden");

  if (!currentClubId) return;

  // Permissions check: Club creator or any club member can view members.
  // Superadmin can view members of any club.
  if (!currentUserId) {
    // Not logged in
    membersAccessMessage.textContent = "Please log in to view club members.";
    membersAccessMessage.classList.remove("hidden");
    return;
  }

  // If the current user is the creator OR if they are a member OR if they are a Superadmin
  if (
    clubData.creatorId === currentUserId ||
    isMemberOfClub ||
    isSuperAdmin()
  ) {
    // We already have detailed members in clubData fetched by /details endpoint
    if (clubData.members && clubData.members.length > 0) {
      clubData.members.forEach((member) => {
        const memberCard = document.createElement("div");
        memberCard.className =
          "bg-white p-4 rounded-lg shadow-sm flex items-center space-x-3 border border-gray-200";
        memberCard.innerHTML = `
                    <div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-semibold text-lg">
                        ${getInitial(member.username)}
                    </div>
                    <div>
                        <p class="font-bold text-gray-800">${escapeHTML(
                          member.username
                        )}</p>
                        <p class="text-sm text-gray-500">${escapeHTML(
                          member.role
                        )}</p>
                    </div>
                `;
        membersListDiv.appendChild(memberCard);
      });
    } else {
      noMembersMessage.classList.remove("hidden");
    }
  } else {
    membersAccessMessage.textContent =
      "You must be a member of this club to view its members.";
    membersAccessMessage.classList.remove("hidden");
  }
}

/**
 * Loads and displays club announcements.
 */
async function loadAnnouncements() {
  announcementsList.innerHTML = ""; // Clear previous announcements
  noAnnouncementsMessage.classList.add("hidden");
  announcementFormContainer.classList.add("hidden");
  announcementMessage.textContent = ""; // Clear form message

  if (!currentClubId) return;

  // Show announcement form only if the current user is the club creator (admin)
  // Superadmin cannot post announcements (per requirement)
  if (clubData.creatorId === currentUserId && userRole === "admin") {
    announcementFormContainer.classList.remove("hidden");
  } else {
    announcementFormContainer.classList.add("hidden");
  }

  const token = getToken(); // Get the token

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/clubs/${currentClubId}/announcements`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const announcements = await response.json();

    if (response.ok) {
      if (announcements.length === 0) {
        noAnnouncementsMessage.classList.remove("hidden");
      } else {
        announcements.forEach((announcement) => {
          const announcementCard = document.createElement("div");
          announcementCard.className =
            "bg-white p-4 rounded-lg shadow-sm border border-gray-200";
          announcementCard.innerHTML = `
                        <p class="text-gray-800 leading-relaxed">${escapeHTML(
                          announcement.message
                        )}</p>
                        <p class="text-sm text-gray-500 mt-2 text-right">
                            <span class="font-semibold">${escapeHTML(
                              announcement.username
                            )}</span>
                            on ${new Date(
                              announcement.timestamp
                            ).toLocaleDateString()} at ${new Date(
            announcement.timestamp
          ).toLocaleTimeString()}
                        </p>
                    `;
          announcementsList.appendChild(announcementCard);
        });
      }
    } else {
      showToast(
        announcements.message || "Error loading announcements.",
        "error"
      );
      announcementsList.innerHTML = `<p class="text-red-500 italic">Error loading announcements: ${escapeHTML(
        announcements.message || "Server error"
      )}</p>`;
      handleAuthError(response.status);
    }
  } catch (error) {
    console.error("Error loading announcements:", error);
    announcementsList.innerHTML = `<p class="text-red-500 italic">Network error. Could not load announcements.</p>`;
    showToast("Network error. Could not load announcements.", "error");
  }
}

/**
 * Handles posting a new announcement.
 * @param {Event} event - The form submission event.
 */
async function handlePostAnnouncement(event) {
  event.preventDefault();
  announcementMessage.textContent = ""; // Clear previous message

  const message = announcementText.value.trim();
  if (!message) {
    announcementMessage.textContent = "Announcement cannot be empty.";
    announcementMessage.classList.add("text-red-500");
    return;
  }

  const token = getToken(); // Get token from utils.js
  if (!token) {
    showToast("You must be logged in to post an announcement.", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/clubs/${currentClubId}/announcements`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      }
    );

    const data = await response.json();
    if (response.ok) {
      showToast("Announcement posted successfully!", "success");
      announcementText.value = ""; // Clear input
      await loadAnnouncements(); // Reload announcements
      updateTabCounts(); // Update announcements count
    } else {
      showToast(data.message || "Failed to post announcement.", "error");
      handleAuthError(response.status); // Use common error handler
    }
  } catch (error) {
    console.error("Error posting announcement:", error);
    showToast("Network error. Could not post announcement.", "error");
  }
}

/**
 * Creates a chat message element
 * @param {Object} msg - The chat message object
 * @returns {HTMLElement} - The message element
 */
function createChatMessageElement(msg) {
  const messageElement = document.createElement("div");
  const isCurrentUser = msg.userId === currentUserId;
  messageElement.className = `p-3 rounded-lg max-w-xs md:max-w-md ${
    isCurrentUser
      ? "bg-blue-500 text-white self-end text-right"
      : "bg-gray-200 text-gray-800 self-start text-left"
  }`;
  messageElement.innerHTML = `
        <p class="font-semibold text-sm ${
          isCurrentUser ? "text-blue-100" : "text-gray-700"
        }">${escapeHTML(msg.username)}</p>
        <p class="text-base break-words">${escapeHTML(msg.message)}</p>
        <p class="text-xs mt-1 ${
          isCurrentUser ? "text-blue-200" : "text-gray-500"
        }">${new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}</p>
    `;
  return messageElement;
}

/**
 * Checks if chat is scrolled to bottom
 * @returns {boolean} - True if scrolled to bottom
 */
function isScrolledToBottom() {
  return chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 1;
}

/**
 * Fetches and displays chat messages for the club.
 */
async function fetchChatMessages() {
  // Save current input state before any DOM changes
  chatInputState.value = chatMessageInput.value;
  const wasScrolledToBottom = isScrolledToBottom();

  noChatMessages.classList.add("hidden");
  chatAccessMessage.classList.add("hidden");
  chatInputContainer.classList.add("hidden"); // Hide input by default
  // chatMessageInput.disabled = false;
  sendChatMessageBtn.disabled = true;

  if (!currentClubId) return;

  const token = getToken(); // Get token from utils.js

  if (!token) {
    chatAccessMessage.textContent =
      "Please log in to view and send chat messages.";
    chatAccessMessage.classList.remove("hidden");
    return;
  }

  // Superadmin can always chat. Other users must be members.
  if (!isSuperAdmin() && !isMemberOfClub) {
    chatAccessMessage.textContent =
      "You must be a member of this club to participate in chat.";
    chatAccessMessage.classList.remove("hidden");
    return;
  } else {
    chatAccessMessage.classList.add("hidden");
    chatInputContainer.classList.remove("hidden"); // Show chat input
    chatMessageInput.disabled = false;
    sendChatMessageBtn.disabled = false;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/clubs/${currentClubId}/chat`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const messages = await response.json();

    if (response.ok) {
      let hasNewMessages = false;
      let maxId = lastDisplayedMessageId;

      // Only add new messages that haven't been displayed
      messages.forEach((msg) => {
        if (msg.id > lastDisplayedMessageId) {
          const messageElement = createChatMessageElement(msg);
          chatBox.appendChild(messageElement);
          hasNewMessages = true;
          if (msg.id > maxId) {
            maxId = msg.id;
          }
        }
      });

      // Update last displayed ID
      if (maxId > lastDisplayedMessageId) {
        lastDisplayedMessageId = maxId;
      }

      // Update no messages display
      if (chatBox.children.length === 0) {
        noChatMessages.classList.remove("hidden");
      } else {
        noChatMessages.classList.add("hidden");
      }

      // Scroll to bottom if new messages were added and user was at bottom
      if (hasNewMessages && wasScrolledToBottom) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
      if (hasNewMessages) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    } else {
      // If not authorized to view chat
      showToast(messages.message || "Failed to load chat messages.", "error");
      chatAccessMessage.textContent =
        messages.message || "Failed to load chat messages.";
      chatAccessMessage.classList.remove("hidden");
      chatInputContainer.classList.add("hidden");
      handleAuthError(response.status);
      setInterval(() => {
        window.location.href = "dashboard.html";
      }, 1000);
    }
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    showToast("Network error. Could not load chat messages.", "error");
    chatAccessMessage.textContent =
      "Network error. Could not load chat messages.";
    chatAccessMessage.classList.remove("hidden");
    chatInputContainer.classList.add("hidden");
  } finally {
    // Restore input state after DOM updates
    chatMessageInput.value = chatInputState.value;
    if (chatInputState.hasFocus) {
      chatMessageInput.focus();
    }
  }
}

/**
 * Handles sending a new chat message.
 */
async function handleSendChatMessage() {
  const message = chatMessageInput.value.trim();
  chatMessageStatus.textContent = "";

  if (!message) {
    chatMessageStatus.textContent = "Message cannot be empty.";
    chatMessageStatus.classList.add("text-red-500");
    return;
  }

  const token = getToken(); // Get token from utils.js
  if (!token) {
    showToast("You are not logged in.", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/clubs/${currentClubId}/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      }
    );

    const data = await response.json();
    if (response.ok) {
      chatMessageInput.value = ""; // Clear input
      chatMessageStatus.textContent = ""; // Clear status
      chatInputState.value = ""; // Reset stored value

      // Force refresh chat messages
      lastDisplayedMessageId = 0;
      await fetchChatMessages();
    } else {
      showToast(data.message || "Failed to send message.", "error");
      chatMessageStatus.textContent = data.message || "Failed to send message.";
      chatMessageStatus.classList.add("text-red-500");
      handleAuthError(response.status);
      if (chatMessageStatus != "Failed to send message.") {
        setInterval(() => {
          window.location.href = "dashboard.html";
        }, 1000);
      }
    }
  } catch (error) {
    console.error("Error sending chat message:", error);
    showToast("Network error. Could not send message.", "error");
    chatMessageStatus.textContent = "Network error. Could not send message.";
    chatMessageStatus.classList.add("text-red-500");
  }
}

// NOTE: The joinClub and leaveClub functions are copied from clubs.js
// to ensure they work here directly without relying on clubs.js being fully loaded
// or conflicts. They also use the global API_BASE_URL and handleAuthError from utils.js now.

/**
 * Handles a user joining a club.
 * @param {number} clubId - The ID of the club to join.
 */
async function joinClub(clubId) {
  const token = getToken(); // Get token from utils.js
  if (!token) {
    showToast("You must be logged in to join a club.", "warning");
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${clubId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success");
      // After successful join, reload club details to update state and counts
      loadClubDetails();
    } else {
      showToast(data.message || "Failed to join club.", "error");
      handleAuthError(response.status);
    }
  } catch (error) {
    console.error("Error joining club:", error);
    showToast("Network error. Could not join club.", "error");
  }
}

/**
 * Handles a user leaving a club.
 * @param {number} clubId - The ID of the club to leave.
 */
async function leaveClub(clubId) {
  const token = getToken(); // Get token from utils.js
  if (!token) {
    showToast("You must be logged in to leave a club.", "warning");
    window.location.href = "login.html";
    return;
  }

  // Using a simple prompt for confirmation as confirm() is restricted in some environments
  const confirmed = prompt(`Type "LEAVE" to confirm leaving the club:`);
  if (confirmed !== "LEAVE") {
    showToast("Action cancelled or incorrect confirmation.", "info");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${clubId}/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success");
      // After successful leave, reload club details to update state and counts
      loadClubDetails();
    } else {
      showToast(data.message || "Failed to leave club.", "error");
      handleAuthError(response.status);
      
    }
  } catch (error) {
    console.error("Error leaving club:", error);
    showToast("Network error. Could not leave club.", "error");
  }
}

// Event Listeners for Create/Edit forms (these are typically on create-club.html and edit-club.html)
// Keeping them here for completeness if this file were to handle form submissions directly.
// In this setup, these parts would primarily be used by other pages that import them.
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
