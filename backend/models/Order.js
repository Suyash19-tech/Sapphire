const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    tableId: {
        type: Number,
        required: false,
        index: true
    },
    sessionId: {
        type: String,
        required: false,
        index: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: false,
        index: true
    },
    items: [{
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    customerName: {
        type: String,
        required: false,
        default: 'Guest'
    },
    customerPhone: {
        type: String,
        required: false,
        default: ''
    },
    cookingInstructions: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        default: 'PENDING',
        enum: ['PENDING', 'PREPARING', 'READY', 'PAID', 'SCHEDULED'],
        index: true
    },
    isScheduled: {
        type: Boolean,
        default: false
    },
    scheduledFor: {
        type: Date,
        default: null
    },
    estimatedTime: {
        type: Number,
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
