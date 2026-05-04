const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

// POST /api/customers/auth
// Login or register a customer by phone number
router.post('/auth', async (req, res) => {
    try {
        const { name, phone } = req.body;

        // Validate inputs
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (!phone || !/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
        }

        let customer = await Customer.findOne({ phone });
        let isNew = false;

        if (!customer) {
            // New customer — create record
            customer = new Customer({ name: name.trim(), phone });
            await customer.save();
            isNew = true;
            console.log(`🆕 [Customer] New customer registered: ${name} (${phone})`);
        } else {
            console.log(`✅ [Customer] Existing customer logged in: ${customer.name} (${phone})`);
        }

        // Sign JWT — 30 day expiry
        const token = jwt.sign(
            { id: customer._id, phone: customer.phone },
            process.env.JWT_SECRET || 'sapphire_jwt_secret_2024',
            { expiresIn: '30d' }
        );

        res.status(isNew ? 201 : 200).json({
            token,
            customer: {
                _id: customer._id,
                name: customer.name,
                phone: customer.phone
            }
        });
    } catch (err) {
        console.error('❌ [Customer Auth] Error:', err);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// GET /api/customers/me — get current customer profile
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token provided' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sapphire_jwt_secret_2024');

        const customer = await Customer.findById(decoded.id).select('-__v');
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        res.json(customer);
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
