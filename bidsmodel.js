const mongoose = require('mongoose');

const bidSchema = mongoose.Schema({
    name: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        username: String,
    },
    amt: { 
        type: Number, 
        required: true 
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Bids', bidSchema);