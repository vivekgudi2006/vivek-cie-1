const express = require('express');
const router = express.Router();
const Bid = require('../models/bidsmodel');
const Gallery = require('../models/gallerymodel');
const User = require('../models/usersmodel');
const { ensureAuthenticated } = require('../config/auth');

// Show all auction items
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const allItems = await Gallery.find({ category: 'Paintings' });
        res.render('auction', {
            product: allItems,
        });
    } catch (err) {
        console.error("Error fetching auction items:", err);
        req.flash('error_msg', 'Failed to load auction items');
        res.redirect('/');
    }
});

// Live auctions route
router.get('/live', ensureAuthenticated, async (req, res) => {
    try {
        // Assuming you have an 'active' field in your Gallery model
        // or you can define your own criteria for "live" auctions
        const liveAuctions = await Gallery.find({ 
            category: 'Paintings',
            // Add more criteria as needed for "live" status
        });
        
        res.render('live-auction', { 
            auctions: liveAuctions 
        });
    } catch (err) {
        console.error("Error fetching live auctions:", err);
        req.flash('error_msg', 'Failed to load live auctions');
        res.redirect('/auction');
    }
});

// Show specific auction item
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const auctionItem = await Gallery.findById(req.params.id)
            .populate({
                path: 'bid',
                options: { sort: { 'amt': -1 } } // Sort bids in descending order
            });
        
        if (!auctionItem) {
            req.flash('error_msg', 'Auction item not found');
            return res.redirect('/auction');
        }
        
        res.render('show', {
            data: auctionItem,
            highestBid: auctionItem.bid && auctionItem.bid.length > 0 ? auctionItem.bid[0].amt : auctionItem.minbid
        });
    } catch (err) {
        console.error("Error fetching auction item:", err);
        req.flash('error_msg', 'Failed to load auction item');
        res.redirect('/auction');
    }
});

// Place a bid
router.post('/:id/bid', ensureAuthenticated, async (req, res) => {
    try {
        const foundProduct = await Gallery.findById(req.params.id).populate('bid');
        
        if (!foundProduct) {
            return res.status(404).json({ error: 'Auction item not found' });
        }
        
        // Get current highest bid
        let currentHighestBid = foundProduct.minbid;
        if (foundProduct.bid && foundProduct.bid.length > 0) {
            const highestBid = foundProduct.bid.reduce((prev, current) => 
                (prev.amt > current.amt) ? prev : current, { amt: foundProduct.minbid });
            currentHighestBid = highestBid.amt;
        }
        
        // Check if new bid is higher than current highest
        const bidAmount = parseFloat(req.body.amt);
        if (isNaN(bidAmount) || bidAmount <= currentHighestBid) {
            return res.status(400).json({ 
                error: 'Your bid must be higher than the current highest bid',
                currentHighest: currentHighestBid
            });
        }
        
        // Create new bid
        const newBid = await Bid.create({
            amt: bidAmount,
            name: {
                id: req.user._id,
                username: req.user.name
            }
        });
        
        // Add bid to product and save
        foundProduct.bid.push(newBid);
        await foundProduct.save();
        
        // Emit socket event with updated data
        // This will be picked up by the client to update UI in real-time
        
        res.json({ 
            success: true, 
            name: req.user.name,
            amount: bidAmount,
            newHighestBid: bidAmount
        });
        
    } catch (err) {
        console.error("Error processing bid:", err);
        res.status(500).json({ error: 'Server error while processing bid' });
    }
});

module.exports = router;