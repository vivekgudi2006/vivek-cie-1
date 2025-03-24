const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');

const User = require('../models/usersmodel');
const { ensureAuthenticated } = require('../config/auth');

// Login form
router.get('/login', (req, res) => {
    res.render('login');
});

// Register form
router.get('/register', (req, res) => {
    res.render('register');
});

// Profile page
router.get('/profile', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.render('profile', { user });
    } catch (err) {
        console.error("Error fetching user profile:", err);
        req.flash('error_msg', 'Error loading profile');
        res.redirect('/');
    }
});

// Register handle
router.post('/register', async (req, res) => {
    const { name, email, password, password2, admincode } = req.body;
    let errors = [];

    // Validation checks
    if (!name || !email || !password || !password2) {
        errors.push({ msg: 'Please fill in all fields' });
    }

    if (password !== password2) {
        errors.push({ msg: 'Passwords do not match' });
    }

    if (password.length < 6) {
        errors.push({ msg: 'Password should be at least 6 characters' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errors.push({ msg: 'Please provide a valid email address' });
    }

    if (errors.length > 0) {
        return res.render('register', {
            errors,
            name,
            email
        });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: email });
        
        if (existingUser) {
            errors.push({ msg: 'Email already registered' });
            return res.render('register', {
                errors,
                name,
                email
            });
        }

        // Create new user
        const newUser = new User({
            name,
            email,
            password
        });

        // Check for admin code
        if (admincode === 'Team3') {
            newUser.isAdmin = true;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        newUser.password = hash;

        // Save user
        await newUser.save();
        
        req.flash('success_msg', 'You are now registered and can log in');
        res.redirect('/users/login');
        
    } catch (err) {
        console.error("Registration error:", err);
        req.flash('error_msg', 'Registration failed');
        res.redirect('/users/register');
    }
});

// Login handle
router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/users/login',
        failureFlash: true
    })(req, res, next);
});

// Update profile
router.post('/profile/update', ensureAuthenticated, async (req, res) => {
    try {
        const { name, currentPassword, newPassword, newPassword2 } = req.body;
        const userId = req.user._id;
        const user = await User.findById(userId);
        
        const updateData = {};
        let errors = [];
        
        // Update name if provided
        if (name && name !== user.name) {
            updateData.name = name;
        }
        
        // Update password if provided
        if (currentPassword && newPassword) {
            // Verify current password
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            
            if (!isMatch) {
                errors.push({ msg: 'Current password is incorrect' });
            } else if (newPassword !== newPassword2) {
                errors.push({ msg: 'New passwords do not match' });
            } else if (newPassword.length < 6) {
                errors.push({ msg: 'New password should be at least 6 characters' });
            } else {
                // Hash new password
                const salt = await bcrypt.genSalt(10);
                updateData.password = await bcrypt.hash(newPassword, salt);
            }
        }
        
        if (errors.length > 0) {
            return res.render('profile', {
                user,
                errors
            });
        }
        
        // Update user if there are changes
        if (Object.keys(updateData).length > 0) {
            await User.findByIdAndUpdate(userId, { $set: updateData });
            req.flash('success_msg', 'Profile updated successfully');
        } else {
            req.flash('info_msg', 'No changes were made');
        }
        
        res.redirect('/users/profile');
        
    } catch (err) {
        console.error("Profile update error:", err);
        req.flash('error_msg', 'Error updating profile');
        res.redirect('/users/profile');
    }
});

// Logout handle
router.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) {
            console.error("Logout error:", err);
            return next(err);
        }
        req.flash('success_msg', 'You are logged out');
        res.redirect('/');
    });
});

module.exports = router;