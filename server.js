// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Superadmin initial setup
const INITIAL_SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME || 'superadmin';
const INITIAL_SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'superpass123';

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Helper functions
const readDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], clubs: [] }, null, 2));
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database file:', error);
        return { users: [], clubs: [] };
    }
};

const writeDb = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing to database file:', error);
    }
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No Token Provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Access Denied: Token Expired' });
            }
            return res.status(403).json({ message: 'Access Denied: Invalid Token' });
        }
        req.user = user;
        next();
    });
};

// Middleware for role-based authorization
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden. You do not have the necessary permissions.' });
        }
        next();
    };
};

// --- AUTHENTICATION ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    const db = readDb();

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    if (db.users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
        return res.status(409).json({ message: 'Username already exists' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        let newUserRole = 'user';
        
        // Special logic for initial superadmin registration
        if (db.users.length === 0 && username === INITIAL_SUPERADMIN_USERNAME && password === INITIAL_SUPERADMIN_PASSWORD) {
            newUserRole = 'superadmin';
            console.log(`Initial Super Admin "${INITIAL_SUPERADMIN_USERNAME}" registered successfully!`);
        }

        const newUser = {
            id: db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
            username,
            password: hashedPassword,
            role: newUserRole,
            profilePictureUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        db.users.push(newUser);
        writeDb(db);
        res.status(201).json({ 
            message: 'User registered successfully', 
            userId: newUser.id, 
            role: newUserRole 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const db = readDb();

    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ 
            message: 'Login successful', 
            token, 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// --- USER PROFILE ROUTES ---
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const db = readDb();
    const user = db.users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    
    const { password, ...userData } = user;
    res.status(200).json(userData);
});

app.put('/api/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
    const userId = req.user.id;
    const { newPassword } = req.body;
    const db = readDb();

    const userIndex = db.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    try {
        if (newPassword) {
            if (newPassword.length < 6) {
                return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.users[userIndex].password = hashedPassword;
        }

        if (req.file) {
            const newProfilePictureUrl = `/uploads/${req.file.filename}`;

            // Delete old profile picture if exists
            if (db.users[userIndex].profilePictureUrl) {
                const oldImagePath = path.join(__dirname, db.users[userIndex].profilePictureUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlink(oldImagePath, (err) => {
                        if (err) console.error('Error deleting old profile picture:', err);
                    });
                }
            }
            db.users[userIndex].profilePictureUrl = newProfilePictureUrl;
        }

        db.users[userIndex].updatedAt = new Date().toISOString();
        writeDb(db);
        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error during profile update' });
    }
});

// --- ADMIN USER MANAGEMENT ROUTES ---
app.get('/api/admin/users', authenticateToken, authorizeRole(['admin', 'superadmin']), (req, res) => {
    const db = readDb();
    const users = db.users.map(({ password, ...user }) => user);
    res.status(200).json(users);
});

app.post('/api/admin/promote', authenticateToken, authorizeRole(['admin', 'superadmin']), (req, res) => {
    const { userId } = req.body;
    const db = readDb();
    const targetUserIndex = db.users.findIndex(u => u.id === userId);

    if (targetUserIndex === -1) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const targetUser = db.users[targetUserIndex];

    if (req.user.role === 'admin' && (targetUser.role === 'admin' || targetUser.role === 'superadmin')) {
        return res.status(403).json({ message: 'Admin cannot promote another admin or superadmin.' });
    }

    if (targetUser.role === 'superadmin') {
        return res.status(400).json({ message: 'Cannot promote a superadmin.' });
    }

    db.users[targetUserIndex].role = 'admin';
    db.users[targetUserIndex].updatedAt = new Date().toISOString();
    writeDb(db);
    res.status(200).json({ message: `User ${targetUser.username} promoted to admin.` });
});

app.post('/api/admin/demote', authenticateToken, authorizeRole(['admin', 'superadmin']), (req, res) => {
    const { userId } = req.body;
    const db = readDb();
    const targetUserIndex = db.users.findIndex(u => u.id === userId);

    if (targetUserIndex === -1) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const targetUser = db.users[targetUserIndex];

    if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: 'You cannot demote yourself.' });
    }
    if (targetUser.role === 'superadmin') {
        return res.status(403).json({ message: 'Cannot demote a superadmin.' });
    }
    if (req.user.role === 'admin' && targetUser.role === 'admin') {
        return res.status(403).json({ message: 'You do not have permission to demote another admin.' });
    }

    db.users[targetUserIndex].role = 'user';
    db.users[targetUserIndex].updatedAt = new Date().toISOString();
    writeDb(db);
    res.status(200).json({ message: `Admin ${targetUser.username} demoted to user.` });
});

app.delete('/api/admin/users/:id', authenticateToken, authorizeRole(['admin', 'superadmin']), (req, res) => {
    const userId = parseInt(req.params.id);
    const db = readDb();
    const userIndex = db.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const userToDelete = db.users[userIndex];

    if (userToDelete.id === req.user.id) {
        return res.status(400).json({ message: 'You cannot delete your own account from here.' });
    }

    if (userToDelete.role === 'superadmin' && req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmin cannot delete another superadmin.' });
    }

    if (req.user.role === 'admin' && (userToDelete.role === 'admin' || userToDelete.role === 'superadmin')) {
        return res.status(403).json({ message: 'Admin cannot delete other admins or superadmins.' });
    }

    db.users.splice(userIndex, 1);

    // Remove user from all clubs
    db.clubs.forEach(club => {
        club.members = club.members.filter(memberId => memberId !== userId);
        club.announcements = club.announcements.filter(ann => ann.userId !== userId);
        club.chatMessages = club.chatMessages.filter(msg => msg.userId !== userId);
    });

    writeDb(db);
    res.status(200).json({ message: `User ${userToDelete.username} deleted successfully.` });
});

// --- SUPERADMIN SPECIFIC ROUTES ---
app.put('/api/superadmin/users/:userId/password-reset', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
    const targetUserId = parseInt(req.params.userId);
    const { newPassword } = req.body;
    const db = readDb();

    const userIndex = db.users.findIndex(u => u.id === targetUserId);

    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found.' });
    }
    const targetUser = db.users[userIndex];

    if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: 'You cannot reset your own password via this interface.' });
    }
    if (targetUser.role === 'superadmin') {
        return res.status(403).json({ message: 'Cannot reset password for another superadmin.' });
    }

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.users[userIndex].password = hashedPassword;
        db.users[userIndex].updatedAt = new Date().toISOString();
        writeDb(db);
        res.status(200).json({ message: `Password for ${targetUser.username} reset successfully.` });
    } catch (error) {
        console.error('Superadmin password reset error:', error);
        res.status(500).json({ message: 'Server error during password reset.' });
    }
});

app.put('/api/superadmin/users/:userId/username-change', authenticateToken, authorizeRole(['superadmin']), (req, res) => {
    const targetUserId = parseInt(req.params.userId);
    const { newUsername } = req.body;
    const db = readDb();

    const userIndex = db.users.findIndex(u => u.id === targetUserId);

    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found.' });
    }
    const targetUser = db.users[userIndex];

    if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: 'You cannot change your own username via this interface.' });
    }
    if (targetUser.role === 'superadmin') {
        return res.status(403).json({ message: 'Cannot change username for another superadmin.' });
    }

    if (!newUsername || newUsername.trim() === '') {
        return res.status(400).json({ message: 'New username cannot be empty.' });
    }
    if (db.users.some(u => u.username === newUsername && u.id !== targetUserId)) {
        return res.status(400).json({ message: 'Username already taken.' });
    }

    const oldUsername = targetUser.username;
    db.users[userIndex].username = newUsername.trim();
    db.users[userIndex].updatedAt = new Date().toISOString();

    // Update username in clubs
    db.clubs.forEach(club => {
        club.announcements.forEach(ann => {
            if (ann.userId === targetUserId) {
                ann.username = newUsername.trim();
            }
        });
        club.chatMessages.forEach(msg => {
            if (msg.userId === targetUserId) {
                msg.username = newUsername.trim();
            }
        });
    });

    writeDb(db);
    res.status(200).json({ message: `Username for ${oldUsername} changed to ${newUsername.trim()} successfully.` });
});

// --- CLUB MANAGEMENT ROUTES ---
app.post('/api/clubs', authenticateToken, upload.single('clubImage'), authorizeRole(['admin']), (req, res) => {
    if (req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmins cannot create clubs.' });
    }

    const { name, description, category, contact } = req.body;
    const db = readDb();

    if (!name || !description) {
        return res.status(400).json({ message: 'Club name and description are required.' });
    }

    if (db.clubs.some(c => c.name === name)) {
        return res.status(400).json({ message: 'A club with this name already exists.' });
    }

    const newClub = {
        id: db.clubs.length > 0 ? Math.max(...db.clubs.map(c => c.id)) + 1 : 1,
        name,
        description,
        category: category || 'General',
        contact: contact || 'N/A',
        imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
        members: [req.user.id],
        creatorId: req.user.id,
        announcements: [],
        chatMessages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    db.clubs.push(newClub);
    writeDb(db);
    res.status(201).json({ message: 'Club created successfully!', club: newClub });
});

app.get('/api/clubs', (req, res) => {
    const db = readDb();
    res.status(200).json(db.clubs);
});

app.get('/api/clubs/:id', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }
    res.status(200).json(club);
});

app.get('/api/clubs/:id/details', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    // Get creator's username
    const creator = db.users.find(u => u.id === club.creatorId);
    const creatorUsername = creator ? creator.username : 'Unknown';

    // Get full details for members
    const detailedMembers = club.members.map(memberId => {
        const user = db.users.find(u => u.id === memberId);
        return user ? { 
            id: user.id, 
            username: user.username, 
            role: user.role,
            profilePictureUrl: user.profilePictureUrl || null 
        } : null;
    }).filter(m => m !== null);

    res.status(200).json({
        ...club,
        creatorUsername: creatorUsername,
        members: detailedMembers
    });
});

app.put('/api/clubs/:id', authenticateToken, upload.single('clubImage'), authorizeRole(['admin', 'superadmin']), (req, res) => {
    const clubId = parseInt(req.params.id);
    const { name, description, category, contact, existingImageUrl } = req.body;
    const db = readDb();
    const clubIndex = db.clubs.findIndex(c => c.id === clubId);

    if (clubIndex === -1) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    const club = db.clubs[clubIndex];

    if (req.user.role === 'admin' && club.creatorId !== req.user.id) {
        return res.status(403).json({ message: 'You are not authorized to update this club.' });
    }

    if (!name || !description) {
        return res.status(400).json({ message: 'Club name and description are required.' });
    }

    if (db.clubs.some(c => c.name === name && c.id !== clubId)) {
        return res.status(400).json({ message: 'A club with this name already exists.' });
    }

    club.name = name;
    club.description = description;
    club.category = category || club.category;
    club.contact = contact || club.contact;

    if (req.file) {
        const newImageUrl = `/uploads/${req.file.filename}`;
        if (club.imageUrl) {
            const oldImagePath = path.join(__dirname, club.imageUrl);
            if (fs.existsSync(oldImagePath)) {
                fs.unlink(oldImagePath, (err) => {
                    if (err) console.error('Error deleting old club image:', err);
                });
            }
        }
        club.imageUrl = newImageUrl;
    } else if (existingImageUrl === '') {
        if (club.imageUrl) {
            const oldImagePath = path.join(__dirname, club.imageUrl);
            if (fs.existsSync(oldImagePath)) {
                fs.unlink(oldImagePath, (err) => {
                    if (err) console.error('Error deleting old club image:', err);
                });
            }
        }
        club.imageUrl = '';
    }

    club.updatedAt = new Date().toISOString();
    writeDb(db);
    res.status(200).json({ message: 'Club updated successfully!', club });
});

app.delete('/api/clubs/:id', authenticateToken, authorizeRole(['admin', 'superadmin']), (req, res) => {
    const clubId = parseInt(req.params.id);
    const db = readDb();
    const clubIndex = db.clubs.findIndex(c => c.id === clubId);

    if (clubIndex === -1) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    const clubToDelete = db.clubs[clubIndex];

    if (req.user.role === 'admin' && clubToDelete.creatorId !== req.user.id) {
        return res.status(403).json({ message: 'You are not authorized to delete this club.' });
    }

    if (clubToDelete.imageUrl) {
        const imagePath = path.join(__dirname, clubToDelete.imageUrl);
        if (fs.existsSync(imagePath)) {
            fs.unlink(imagePath, (err) => {
                if (err) console.error('Error deleting club image file:', err);
            });
        }
    }

    db.clubs.splice(clubIndex, 1);
    writeDb(db);
    res.status(200).json({ message: 'Club deleted successfully.' });
});

// --- CLUB MEMBERSHIP ROUTES ---
app.post('/api/clubs/:id/join', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const userId = req.user.id;
    const db = readDb();

    const club = db.clubs.find(c => c.id === clubId);
    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    if (req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmins cannot join clubs.' });
    }

    if (club.members.includes(userId)) {
        return res.status(400).json({ message: 'You are already a member of this club.' });
    }

    club.members.push(userId);
    club.updatedAt = new Date().toISOString();
    writeDb(db);
    res.status(200).json({ message: `Successfully joined ${club.name}.` });
});

app.post('/api/clubs/:id/leave', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const userId = req.user.id;
    const db = readDb();

    const club = db.clubs.find(c => c.id === clubId);
    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    if (req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmins cannot leave clubs.' });
    }

    const memberIndex = club.members.indexOf(userId);
    if (memberIndex === -1) {
        return res.status(400).json({ message: 'You are not a member of this club.' });
    }

    club.members.splice(memberIndex, 1);
    club.updatedAt = new Date().toISOString();
    writeDb(db);
    res.status(200).json({ message: `Successfully left ${club.name}.` });
});

app.get('/api/user/joined-clubs/count', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const db = readDb();
    
    if (req.user.role === 'superadmin') {
        return res.status(200).json({ count: 0 });
    }
    
    const joinedClubsCount = db.clubs.filter(club => club.members.includes(userId)).length;
    res.status(200).json({ count: joinedClubsCount });
});

app.get('/api/user/joined-clubs', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const db = readDb();
    
    if (req.user.role === 'superadmin') {
        return res.status(200).json([]);
    }
    
    const joinedClubs = db.clubs.filter(club => club.members.includes(userId));
    res.status(200).json(joinedClubs);
});

app.get('/api/clubs/count', authenticateToken, (req, res) => {
    const db = readDb();
    res.status(200).json({ count: db.clubs.length });
});

// --- ANNOUNCEMENTS & CHAT ROUTES ---
app.get('/api/clubs/:id/announcements', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    res.status(200).json(club.announcements);
});

app.post('/api/clubs/:id/announcements', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const clubId = parseInt(req.params.id);
    const { message } = req.body;
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    if (req.user.role === 'admin' && club.creatorId !== req.user.id) {
        return res.status(403).json({ message: 'You are not authorized to post announcements for this club.' });
    }
    if (req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmins cannot post announcements.' });
    }

    if (!message || message.trim() === '') {
        return res.status(400).json({ message: 'Announcement message cannot be empty.' });
    }

    const newAnnouncement = {
        id: club.announcements.length > 0 ? Math.max(...club.announcements.map(a => a.id)) + 1 : 1,
        userId: req.user.id,
        username: req.user.username,
        message: message.trim(),
        timestamp: new Date().toISOString()
    };

    club.announcements.push(newAnnouncement);
    writeDb(db);
    res.status(201).json({ message: 'Announcement posted successfully!', announcement: newAnnouncement });
});

app.get('/api/clubs/:id/chat', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const userId = req.user.id;
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    if (req.user.role !== 'superadmin' && !club.members.includes(userId)) {
        return res.status(403).json({ message: 'You must be a member of this club to view chat messages.' });
    }

    res.status(200).json(club.chatMessages);
});

app.post('/api/clubs/:id/chat', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const userId = req.user.id;
    const { message } = req.body;
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    if (req.user.role !== 'superadmin' && !club.members.includes(userId)) {
        return res.status(403).json({ message: 'You must be a member of this club to send chat messages.' });
    }

    if (!message || message.trim() === '') {
        return res.status(400).json({ message: 'Chat message cannot be empty.' });
    }

    const newChatMessage = {
        id: club.chatMessages.length > 0 ? Math.max(...club.chatMessages.map(m => m.id)) + 1 : 1,
        userId: req.user.id,
        username: req.user.username,
        message: message.trim(),
        timestamp: new Date().toISOString()
    };

    club.chatMessages.push(newChatMessage);
    writeDb(db);
    res.status(201).json({ message: 'Message sent successfully!', chatMessage: newChatMessage });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err.stack);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        message: err.message || 'An unexpected server error occurred.',
        error: process.env.NODE_ENV === 'production' ? {} : err.stack
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (!fs.existsSync(DB_FILE)) {
        writeDb({ users: [], clubs: [] });
        console.log('db.json created with initial structure.');
    }
});