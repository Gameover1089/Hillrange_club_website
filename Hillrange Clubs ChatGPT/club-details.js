// club-details.js

const clubs = {
    "coding-club": {
        name: "Coding Club",
        description: "Build websites, games, and apps. Beginners welcome!",
        about: "The Coding Club brings together students who are passionate about web design, game design, and coding in general. We host coding sessions, mini-competitions, and even school projects.",
        leaders: ["Dumto Okonkwo – President", "Chibuikem Onuigbo – Vice President"],
        schedule: "Every Thursday @ 3:00 PM in Junior Lab",
        gallery: "https://i.ibb.co/7p0X3V6/coding-club.jpg",
    },
    "sports-club": {
        name: "Sports Club",
        description: "Get active and join sports tournaments.",
        about: "We play football, basketball, and more. Open to all skill levels.",
        leaders: ["John Doe – Captain", "Jane Smith – Vice Captain"],
        schedule: "Every Monday and Friday @ 4:00 PM on Field",
        gallery: "https://i.ibb.co/8MM5c7s/sports-club.jpg",
    },
    "music-club": {
        name: "Music Club",
        description: "Express yourself through music and performances.",
        about: "From choir to bands, join us to learn and perform music.",
        leaders: ["Alice Johnson – Lead Singer", "Bob Brown – Instrumentalist"],
        schedule: "Every Wednesday @ 5:00 PM in Music Room",
        gallery: "https://i.ibb.co/1L4f2FT/music-club.jpg",
    }
};

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const clubId = getQueryParam("id");
    if (!clubId || !clubs[clubId]) {
        alert("Club not found!");
        window.location.href = "index.html";
        return;
    }

    const club = clubs[clubId];

    document.getElementById("clubName").textContent = club.name;
    document.getElementById("clubDescription").textContent = club.description;
    document.getElementById("clubAbout").textContent = club.about;

    const leadersUl = document.getElementById("clubLeaders");
    leadersUl.innerHTML = "";
    club.leaders.forEach(leader => {
        const li = document.createElement("li");
        li.textContent = leader;
        leadersUl.appendChild(li);
    });

    document.getElementById("clubSchedule").textContent = club.schedule;
    document.getElementById("clubGallery").src = club.gallery;

    const joinBtn = document.getElementById("joinBtn");
    const chatbox = document.getElementById("chatbox");

    // Use localStorage as mock "joined clubs" for demo; replace with DB logic
    const joinedClubs = JSON.parse(localStorage.getItem("joinedClubs") || "[]");

    if (joinedClubs.includes(clubId)) {
        joinBtn.style.display = "none";
        chatbox.classList.remove("hidden");
        setupChat(user, clubId);
    } else {
        joinBtn.style.display = "inline-block";
        chatbox.classList.add("hidden");

        joinBtn.onclick = () => {
            joinedClubs.push(clubId);
            localStorage.setItem("joinedClubs", JSON.stringify(joinedClubs));
            joinBtn.style.display = "none";
            chatbox.classList.remove("hidden");
            setupChat(user, clubId);
            alert(`You joined the ${club.name}!`);
        };
    }
});

// Simple chatbox with localStorage per club
function setupChat(user, clubId) {
    const messagesDiv = document.getElementById("messages");
    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");

    function loadMessages() {
        const allMessages = JSON.parse(localStorage.getItem(`chat_${clubId}`) || "[]");
        messagesDiv.innerHTML = "";
        allMessages.forEach(msg => {
            const div = document.createElement("div");
            div.className = "mb-1";
            div.innerHTML = `<strong>${msg.user}:</strong> ${msg.text}`;
            messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    sendBtn.onclick = () => {
        const text = chatInput.value.trim();
        if (!text) return;
        const allMessages = JSON.parse(localStorage.getItem(`chat_${clubId}`) || "[]");
        allMessages.push({ user: user.email, text });
        localStorage.setItem(`chat_${clubId}`, JSON.stringify(allMessages));
        chatInput.value = "";
        loadMessages();
    };

    loadMessages();
}
