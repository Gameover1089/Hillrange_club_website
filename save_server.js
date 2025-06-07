// server.js
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors'); // Import cors

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const SECRET_KEY = 'your_jwt_secret_key'; // CHANGE THIS IN PRODUCTION!

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'))); // ADDED THIS LINE
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve static files from 'uploads'

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Helper Functions ---
function readDb() {
    if (!fs.existsSync(DB_FILE)) {
        return { users: [], clubs: [] };
    }
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
}

function writeDb(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
        req.user = user; // Set authenticated user payload to req.user
        next();
    });
}

// Middleware to check user roles
function authorizeRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden. You do not have the necessary permissions.' });
        }
        next();
    };
}


// --- Routes ---

// Public Routes (Login, Register)
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    const db = readDb();

    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Username already exists.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
            username,
            password: hashedPassword,
            role: 'user', // Default role for new registrations
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        db.users.push(newUser);
        writeDb(db);
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const db = readDb();

    const user = db.users.find(u => u.username === username);
    if (!user) {
        return res.status(400).json({ message: 'Invalid credentials.' });
    }

    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.status(200).json({
            message: 'Login successful!',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// User Profile Routes (Authenticated)
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const db = readDb();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }
    // Return user data, excluding the password hash
    const { password, ...userData } = user;
    res.status(200).json(userData);
});

// Update User Profile (e.g., password, profile picture)
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

        // Handle profile picture upload
        if (req.file) {
            const newProfilePictureUrl = `/uploads/${req.file.filename}`;

            // Optional: Delete old profile picture if it exists
            if (db.users[userIndex].profilePictureUrl) {
                const oldImagePath = path.join(__dirname, db.users[userIndex].profilePictureUrl);
                // Check if the old path exists before trying to delete
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


// Admin/Superadmin User Management Routes
app.get('/api/admin/users', authenticateToken, authorizeRole(['admin', 'superadmin']), (req, res) => {
    const db = readDb();
    // Do not send passwords
    const users = db.users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
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

    // Admin can only promote users, not other admins or superadmins
    if (req.user.role === 'admin' && (targetUser.role === 'admin' || targetUser.role === 'superadmin')) {
        return res.status(403).json({ message: 'Admin cannot promote another admin or superadmin.' });
    }

    // Superadmin can promote any user to admin
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
    // Only superadmin can demote other admins. Regular admins cannot demote other admins.
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

    // Superadmin cannot delete other superadmins
    if (userToDelete.role === 'superadmin' && req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmin cannot delete another superadmin.' });
    }

    // Regular admin can only delete regular users
    if (req.user.role === 'admin' && (userToDelete.role === 'admin' || userToDelete.role === 'superadmin')) {
        return res.status(403).json({ message: 'Admin cannot delete other admins or superadmins.' });
    }

    // Remove the user
    db.users.splice(userIndex, 1);

    // Also remove user from all club members lists and chat messages
    db.clubs.forEach(club => {
        club.members = club.members.filter(memberId => memberId !== userId);
        club.announcements = club.announcements.filter(ann => ann.userId !== userId);
        club.chatMessages = club.chatMessages.filter(msg => msg.userId !== userId);
    });

    writeDb(db);
    res.status(200).json({ message: `User ${userToDelete.username} deleted successfully.` });
});


// Superadmin Specific Routes
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

    // Update username in clubs where this user is creator or in chat/announcements
    db.clubs.forEach(club => {
        if (club.creatorId === targetUserId) {
            // No direct field for creatorUsername in current club schema to update,
            // but this could be extended if needed.
        }
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


// Club Management Routes
// Get all clubs (accessible to all authenticated users)
app.get('/api/clubs', authenticateToken, (req, res) => {
    const db = readDb();
    // For listing, we might not need full member details on each club.
    // We can send a simplified version or the full data based on frontend needs.
    // For now, sending the full club object.
    res.status(200).json(db.clubs);
});

// Get a single club by ID (Crucial for edit-club.html and club-detail.html)
app.get('/api/clubs/:id', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }
    res.status(200).json(club);
});


// Get comprehensive club details (for club-detail page)
app.get('/api/clubs/:id/details', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    // Enhance club data with full member objects and creator username
    const membersWithDetails = club.members.map(memberId => {
        const user = db.users.find(u => u.id === memberId);
        return user ? { id: user.id, username: user.username, role: user.role } : null;
    }).filter(m => m !== null); // Filter out any nulls if member not found

    const creator = db.users.find(u => u.id === club.creatorId);
    const creatorUsername = creator ? creator.username : 'Unknown';

    const detailedClub = {
        ...club,
        members: membersWithDetails,
        creatorUsername: creatorUsername
    };

    res.status(200).json(detailedClub);
});


// Create a new club (Admin only, not Superadmin)
app.post('/api/clubs', authenticateToken, upload.single('clubImage'), authorizeRole(['admin']), (req, res) => {
    // Check if the authenticated user is a superadmin, superadmins cannot create clubs
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
        imageUrl: req.file ? `/uploads/${req.file.filename}` : '', // Save path to uploaded image
        members: [req.user.id], // Admin creator is automatically a member
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

// Update a club (Admin only, or Superadmin)
app.put('/api/clubs/:id', authenticateToken, upload.single('clubImage'), authorizeRole(['admin', 'superadmin']), (req, res) => {
    const clubId = parseInt(req.params.id);
    const { name, description, category, contact, existingImageUrl } = req.body;
    const db = readDb();
    const clubIndex = db.clubs.findIndex(c => c.id === clubId);

    if (clubIndex === -1) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    const club = db.clubs[clubIndex];

    // Regular admin can only update clubs they created
    if (req.user.role === 'admin' && club.creatorId !== req.user.id) {
        return res.status(403).json({ message: 'You are not authorized to update this club.' });
    }

    // Superadmin can update any club
    // (no specific check needed here as authorizeRole already allows superadmin)

    if (!name || !description) {
        return res.status(400).json({ message: 'Club name and description are required.' });
    }

    // Check if new name already exists for another club
    if (db.clubs.some(c => c.name === name && c.id !== clubId)) {
        return res.status(400).json({ message: 'A club with this name already exists.' });
    }

    club.name = name;
    club.description = description;
    club.category = category || club.category;
    club.contact = contact || club.contact;

    // Handle image update
    if (req.file) { // New image uploaded
        const newImageUrl = `/uploads/${req.file.filename}`;
        // Delete old image if it exists
        if (club.imageUrl) {
            const oldImagePath = path.join(__dirname, club.imageUrl);
            if (fs.existsSync(oldImagePath)) {
                fs.unlink(oldImagePath, (err) => {
                    if (err) console.error('Error deleting old club image:', err);
                });
            }
        }
        club.imageUrl = newImageUrl;
    } else if (existingImageUrl === '') { // Existing image was explicitly cleared
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
    // If req.file is null and existingImageUrl is not empty, means no new upload and keep current image

    club.updatedAt = new Date().toISOString();
    writeDb(db);
    res.status(200).json({ message: 'Club updated successfully!', club });
});

// Delete a club (Admin only, but superadmin can delete any club)
app.delete('/api/clubs/:id', authenticateToken, authorizeRole(['admin', 'superadmin']), (req, res) => {
    const clubId = parseInt(req.params.id);
    const db = readDb();
    const clubIndex = db.clubs.findIndex(c => c.id === clubId);

    if (clubIndex === -1) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    const clubToDelete = db.clubs[clubIndex];

    // Regular admin can only delete clubs they created
    if (req.user.role === 'admin' && clubToDelete.creatorId !== req.user.id) {
        return res.status(403).json({ message: 'You are not authorized to delete this club.' });
    }

    // Superadmin can delete any club (no specific check needed here)

    // Remove associated image file if it exists
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

// Join Club
app.post('/api/clubs/:id/join', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const userId = req.user.id;
    const db = readDb();

    const club = db.clubs.find(c => c.id === clubId);
    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    // Superadmin cannot join clubs, they only monitor activities
    if (req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmins cannot join clubs.' });
    }

    if (club.members.includes(userId)) {
        return res.status(400).json({ message: 'You are already a member of this club.' });
    }

    club.members.push(userId);
    writeDb(db);
    res.status(200).json({ message: `Successfully joined ${club.name}.` });
});

// Leave Club
app.post('/api/clubs/:id/leave', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const userId = req.user.id;
    const db = readDb();

    const club = db.clubs.find(c => c.id === clubId);
    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    // Superadmin cannot leave clubs as they are not members to begin with
    if (req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmins cannot leave clubs.' });
    }

    const memberIndex = club.members.indexOf(userId);
    if (memberIndex === -1) {
        return res.status(400).json({ message: 'You are not a member of this club.' });
    }

    club.members.splice(memberIndex, 1);
    writeDb(db);
    res.status(200).json({ message: `Successfully left ${club.name}.` });
});

// Get user's joined clubs count
app.get('/api/user/joined-clubs/count', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const db = readDb();
    // Superadmin is not considered a member
    if (req.user.role === 'superadmin') {
        return res.status(200).json({ count: 0 });
    }
    const joinedClubsCount = db.clubs.filter(club => club.members.includes(userId)).length;
    res.status(200).json({ count: joinedClubsCount });
});

// Get user's joined clubs (list)
app.get('/api/user/joined-clubs', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const db = readDb();
    // Superadmin is not considered a member
    if (req.user.role === 'superadmin') {
        return res.status(200).json([]);
    }
    const joinedClubs = db.clubs.filter(club => club.members.includes(userId));
    res.status(200).json(joinedClubs);
});

// Get total clubs count (for dashboard)
app.get('/api/clubs/count', authenticateToken, (req, res) => {
    const db = readDb();
    res.status(200).json({ count: db.clubs.length });
});

// Announcements
app.get('/api/clubs/:id/announcements', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    // Announcements are visible to all authenticated users
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

    // Only the creator of the club who is an admin can post announcements
    if (req.user.role === 'admin' && club.creatorId !== req.user.id) {
        return res.status(403).json({ message: 'You are not authorized to post announcements for this club.' });
    }
    // Superadmin cannot post announcements
    if (req.user.role === 'superadmin') {
        return res.status(403).json({ message: 'Superadmins cannot post announcements.' });
    }


    if (!message || message.trim() === '') {
        return res.status(400).json({ message: 'Announcement message cannot be empty.' });
    }

    const newAnnouncement = {
        id: club.announcements.length > 0 ? Math.max(...club.announcements.map(a => a.id)) + 1 : 1,
        userId: req.user.id,
        username: req.user.username, // Store username for display
        message: message.trim(),
        timestamp: new Date().toISOString()
    };

    club.announcements.push(newAnnouncement);
    writeDb(db);
    res.status(201).json({ message: 'Announcement posted successfully!', announcement: newAnnouncement });
});


// Chat Messages
app.get('/api/clubs/:id/chat', authenticateToken, (req, res) => {
    const clubId = parseInt(req.params.id);
    const userId = req.user.id;
    const db = readDb();
    const club = db.clubs.find(c => c.id === clubId);

    if (!club) {
        return res.status(404).json({ message: 'Club not found.' });
    }

    // Superadmin can view chat. Regular users/admins must be members to view chat.
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

    // Superadmin can chat. Regular users/admins must be members to chat.
    if (req.user.role !== 'superadmin' && !club.members.includes(userId)) {
        return res.status(403).json({ message: 'You must be a member of this club to send chat messages.' });
    }

    if (!message || message.trim() === '') {
        return res.status(400).json({ message: 'Chat message cannot be empty.' });
    }

    const newChatMessage = {
        id: club.chatMessages.length > 0 ? Math.max(...club.chatMessages.map(m => m.id)) + 1 : 1,
        userId: req.user.id,
        username: req.user.username, // Store username for display
        message: message.trim(),
        timestamp: new Date().toISOString()
    };

    club.chatMessages.push(newChatMessage);
    writeDb(db);
    res.status(201).json({ message: 'Message sent successfully!', chatMessage: newChatMessage });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Initialize db.json if it doesn't exist
    if (!fs.existsSync(DB_FILE)) {
        writeDb({ users: [], clubs: [] });
        console.log('db.json created with initial structure.');
    }
});




