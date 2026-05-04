const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    tableNumber: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'BLOCKED'],
        default: 'ACTIVE',
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastOrderAt: {
        type: Date,
        default: null
    },
    totalOrders: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Table', tableSchema);
