const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/user');
const { verifyToken } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/profile-pictures',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Create or update user after Firebase authentication
router.post('/users', verifyToken, async (req, res) => {
  try {
    const { email, username } = req.body;
    const firebaseUid = req.user.uid;

    let user = await User.getUserByFirebaseUid(firebaseUid);
    
    if (user) {
      user = await User.updateUser(firebaseUid, { email, username });
    } else {
      user = await User.createUser(firebaseUid, email, username);
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error in user creation/update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload profile picture
router.post('/users/profile-picture', verifyToken, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const profilePictureUrl = `/uploads/profile-pictures/${req.file.filename}`;
    await User.updateUser(req.user.uid, { profilePictureUrl });

    res.json({ profilePictureUrl });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Get user profile
router.get('/users/me', verifyToken, async (req, res) => {
  try {
    const user = await User.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/users/me', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.updateUser(req.user.uid, updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
