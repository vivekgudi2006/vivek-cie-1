const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Gallery = require('../models/gallerymodel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureAuthenticated } = require('../config/auth');

// Make sure uploads directory exists
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // Add timestamp to prevent filename collisions
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for image validation
const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB limit
    },
    fileFilter: fileFilter
});

// Show all gallery items
router.get('/', async (req, res) => {
    try {
        const allItems = await Gallery.find({});
        res.render('gallery', {
            product: allItems,
            cat: 'Collections',
        });
    } catch (err) {
        console.error("Error fetching gallery:", err);
        req.flash('error_msg', 'Failed to load gallery');
        res.redirect('/');
    }
});

// Filter by category
router.get('/category/:category', async (req, res) => {
    try {
        const category = req.params.category;
        const validCategories = ['Paintings', 'Sculptures', 'Photographs', 'Sketches'];
        
        if (validCategories.includes(category)) {
            const items = await Gallery.find({ category: category });
            res.render('gallery', {
                product: items,
                cat: category,
            });
        } else {
            // If category is invalid, show all items
            const allItems = await Gallery.find({});
            res.render('gallery', {
                product: allItems,
                cat: 'Collections',
            });
        }
    } catch (err) {
        console.error("Error fetching category:", err);
        req.flash('error_msg', 'Failed to load category');
        res.redirect('/gallery');
    }
});

// Show form to add new product
router.get('/addProduct', ensureAuthenticated, (req, res) => {
    res.render('productCreation');
});

// Add new product
router.post('/addProduct', ensureAuthenticated, upload.single('image'), async (req, res) => {
    try {
        // Validate image upload
        if (!req.file) {
            return res.render('productCreation', {
                error_msg: 'Please upload an image',
                formData: req.body
            });
        }

        // Validate required fields
        const { name, description, category, minbid } = req.body;
        if (!name || !description || !category || !minbid) {
            return res.render('productCreation', {
                error_msg: 'All fields are required',
                formData: req.body
            });
        }

        // Create new product object
        const newProduct = {
            name: name,
            description: description,
            category: category,
            minbid: parseFloat(minbid),
            owner: req.body.owner || req.user.name,
            image: '/uploads/' + req.file.filename,
        };

        // Save to database
        await Gallery.create(newProduct);
        req.flash('success_msg', 'Product added successfully');
        res.redirect('/gallery');
        
    } catch (err) {
        console.error("Error adding product:", err);
        res.render('productCreation', {
            error_msg: 'Error adding product: ' + err.message,
            formData: req.body
        });
    }
});

// View specific product
router.get('/:productId', async (req, res) => {
    try {
        const product = await Gallery.findById(req.params.productId);
        
        if (!product) {
            req.flash('error_msg', 'Product not found');
            return res.redirect('/gallery');
        }
        
        res.render('viewProduct', { reqProduct: product });
        
    } catch (err) {
        console.error("Error viewing product:", err);
        req.flash('error_msg', 'Error loading product');
        res.redirect('/gallery');
    }
});

// Show form to update product
router.get('/update/:productId', ensureAuthenticated, async (req, res) => {
    try {
        const product = await Gallery.findById(req.params.productId);
        
        if (!product) {
            req.flash('error_msg', 'Product not found');
            return res.redirect('/gallery');
        }
        
        res.render('edit-Product', { element: product });
        
    } catch (err) {
        console.error("Error loading product for edit:", err);
        req.flash('error_msg', 'Error loading product for edit');
        res.redirect('/gallery');
    }
});

// Update product
router.post('/update/:productId', ensureAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const productId = req.params.productId;
        const updateData = {
            name: req.body.name,
            description: req.body.description,
            minbid: parseFloat(req.body.minbid),
        };
        
        // If a new image was uploaded, update the image path
        if (req.file) {
            updateData.image = '/uploads/' + req.file.filename;
            
            // Optional: delete old image file
            const oldProduct = await Gallery.findById(productId);
            if (oldProduct && oldProduct.image) {
                const oldImagePath = path.join(__dirname, '../../public', oldProduct.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        }
        
        await Gallery.findByIdAndUpdate(productId, { $set: updateData });
        
        req.flash('success_msg', 'Product updated successfully');
        res.redirect('/gallery/' + productId);
        
    } catch (err) {
        console.error("Error updating product:", err);
        req.flash('error_msg', 'Error updating product');
        res.redirect('/gallery');
    }
});

// Delete product
router.get('/delete/:productId', ensureAuthenticated, async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Gallery.findById(productId);
        
        if (!product) {
            req.flash('error_msg', 'Product not found');
            return res.redirect('/gallery');
        }
        
        // Delete associated image file
        if (product.image) {
            const imagePath = path.join(__dirname, '../../public', product.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await Gallery.findByIdAndDelete(productId);
        
        req.flash('success_msg', 'Product deleted successfully');
        res.redirect('/gallery');
        
    } catch (err) {
        console.error("Error deleting product:", err);
        req.flash('error_msg', 'Error deleting product');
        res.redirect('/gallery');
    }
});

module.exports = router;