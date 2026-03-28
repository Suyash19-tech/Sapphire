const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    cookingInstructions: {
        type: String,
        default: ''
    },
    paymentScreenshot: {
        type: String, // Stores file path
        required: true
    },
    status: {
        type: String,
        default: 'PENDING_VERIFICATION',
        enum: ['PENDING_VERIFICATION', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED'],
        index: true
    },
    estimatedTime: {
        type: Number, // In minutes
        default: 0
    },
    estimatedCompletionTime: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Order', orderSchema);
