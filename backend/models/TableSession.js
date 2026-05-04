const mongoose = require('mongoose');

const tableSessionSchema = new mongoose.Schema({
    tableId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    currentSessionId: {
        type: String,
        required: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TableSession', tableSessionSchema);
