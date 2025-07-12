// // dashboard.js
// firebase.auth().onAuthStateChanged((user) => {
//     if (user) {
//         const email = user.email;
//         document.getElementById("userEmail").textContent = email;

//         // Fetch or determine role — here we assume student
//         const role = "Student";
//         document.getElementById("accountRole").textContent = role;

//         // Populate clubs (dummy data for now)
//         const clubs = ["Science Club", "Drama Club", "Coding Club", "Math Club", "Art Club", "Music Club"];
//         const clubsGrid = document.getElementById("clubsGrid");

//         clubs.forEach(club => {
//             const div = document.createElement("div");
//             div.className = "club-card";
//             div.textContent = club;
//             clubsGrid.appendChild(div);
//         });

//     } else {
//         // Not logged in, redirect to login page
//         window.location.href = "login.html";
//     }
// });
// dashboard.js
// dashboard.js

const clubs = [
  {
    id: "coding-club",
    name: "Coding Club",
  },
  {
    id: "sports-club",
    name: "Sports Club",
  },
  {
    id: "music-club",
    name: "Music Club",
  },
  {
    id: "graph-club",
    name: "Graphic Design Club",
  },
  {
    id: "stem-club",
    name: "STEM Club",
  },
  {
    id: "chess-club",
    name: "Chess Club",
  },
  // Add more clubs as needed
];

const clubsGrid = document.getElementById("clubsGrid");

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Show user email top right
  document.getElementById("userEmail").textContent = user.email;
  document.getElementById("accountRole").textContent = user.email;

  // Populate clubs
  clubsGrid.innerHTML = "";
  clubs.forEach(club => {
    const card = document.createElement("div");
    card.className = `club-card cursor-pointer rounded-xl bg-white shadow-md p-6 flex flex-col justify-center items-center
                        transition-transform transform hover:scale-105 hover:shadow-lg text-center text-lg font-semibold`;
    card.textContent = club.name;
    card.addEventListener("click", () => {
      window.location.href = `club-details.html?id=${club.id}`;
    });
    clubsGrid.appendChild(card);
  });
});
