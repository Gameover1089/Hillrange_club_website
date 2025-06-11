// details.js
firebase.auth().onAuthStateChanged(user => {
    if (!user) return window.location = 'login.html';

    // Extract club ID
    const params = new URLSearchParams(window.location.search);
    const clubId = params.get('id');

    // Dummy club data
    const clubData = {
        science: { name: 'Science Club', desc: 'Explore experiments and scientific discoveries' },
        drama: { name: 'Drama Club', desc: 'Rehearse plays and perform on stage' },
        coding: { name: 'Coding Club', desc: 'Collaborate on coding projects' }
    };

    const data = clubData[clubId] || { name: 'Unknown', desc: 'No info available.' };
    document.getElementById('clubName').textContent = data.name;
    document.getElementById('clubDescription').textContent = data.desc;

    // Join button logic
    const joinBtn = document.getElementById('joinBtn');
    const chatBox = document.getElementById('chatBox');
    let joined = false;
    joinBtn.addEventListener('click', () => {
        joined = true;
        joinBtn.classList.add('hidden');
        chatBox.classList.remove('hidden');
        chatBox.classList.add('animate-fade-in');
    });

    // Chat send logic (dummy)
    document.getElementById('sendBtn').addEventListener('click', () => {
        const msgInput = document.getElementById('msgInput');
        const msg = msgInput.value.trim();
        if (!msg) return;
        const div = document.createElement('div');
        div.textContent = msg;
        document.getElementById('messages').appendChild(div);
        msgInput.value = '';
    });
});