const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    isAvailable: {
        type: Boolean,
        default: true,
        index: true
    },
    rating: {
        type: Number,
        default: 4.5
    },
    popular: {
        type: Boolean,
        default: false
    },
    image: {
        type: String,
        default: null  // Cloudinary URL
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
