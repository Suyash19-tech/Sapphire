const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    tableId: {
        type: Number,
        required: false, // Optional for non-table orders
        index: true
    },
    sessionId: {
        type: String,
        required: false, // Generated for table orders
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
        enum: ['PENDING', 'PREPARING', 'READY', 'SERVED', 'PAID'],
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
