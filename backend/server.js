const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const Order = require('./models/Order');
const MenuItem = require('./models/MenuItem');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const auth = require('./middleware/auth');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow images to be served
}));

// Rate Limiting (Prevent brute force/DoS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);

// Performance & Logging
app.use(compression()); // Gzip compression
app.use(morgan('dev')); // Log requests

// Standard Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1d', // Cache uploads for 1 day
    immutable: true
}));

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campuscraves')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Initialize Master Admin
        try {
            const adminEmail = '23cd3047@rgipt.ac.in';
            const existingAdmin = await User.findOne({ email: adminEmail });

            if (!existingAdmin) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('admin', salt);

                const masterAdmin = new User({
                    name: 'Suyash (Admin)',
                    email: adminEmail,
                    password: hashedPassword,
                    isAdmin: true,
                    tokenNumber: 0
                });

                await masterAdmin.save();
                console.log('Master Admin created successfully');
            }
        } catch (adminErr) {
            console.error('Error creating Master Admin:', adminErr);
        }
    })
    .catch((err) => console.error('Error connecting to MongoDB:', err));

// Routes
app.get('/', (req, res) => {
    res.send('CampusCraves API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Menu Management Routes
app.get('/api/menu', async (req, res) => {
    try {
        const menuItems = await MenuItem.find().sort({ category: 1, name: 1 });
        res.json(menuItems);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch menu items' });
    }
});

app.post('/api/menu', async (req, res) => {
    try {
        const { name, price, category, popular } = req.body;
        console.log('Creating new menu item:', { name, price, category, popular });
        const newItem = new MenuItem({ name, price, category, popular });
        const savedItem = await newItem.save();
        res.status(201).json(savedItem);
    } catch (err) {
        console.error('Error creating menu item:', err);
        res.status(500).json({ error: err.message || 'Failed to create menu item' });
    }
});

app.patch('/api/menu/:id', async (req, res) => {
    try {
        const updatedItem = await MenuItem.findByIdAndUpdate(
            req.params.id,
            req.body,
            { returnDocument: 'after' }
        );
        res.json(updatedItem);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update menu item' });
    }
});

// Create a new order (with screenshot upload)
app.post('/api/orders', auth, upload.single('paymentScreenshot'), async (req, res) => {
    try {
        const { items, totalAmount, cookingInstructions } = req.body;

        const newOrder = new Order({
            user: req.user.id,
            items: JSON.parse(items), // Assuming items are sent as JSON string
            totalAmount,
            cookingInstructions,
            paymentScreenshot: req.file ? req.file.path : null,
        });

        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (err) {
        console.error('Error creating order:', err);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Get all active orders (not completed or rejected)
app.get('/api/orders/active', async (req, res) => {
    try {
        const orders = await Order.find({
            status: { $nin: ['COMPLETED', 'REJECTED'] }
        }).populate('user', 'name phone tokenNumber').sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch active orders' });
    }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().populate('user', 'name phone tokenNumber').sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get user's own orders
app.get('/api/orders/my-orders', auth, async (req, res) => {
    try {
        console.log('Fetching orders for user:', req.user.id);
        const orders = await Order.find({ user: req.user.id })
            .populate('user', 'name phone tokenNumber')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch your orders' });
    }
});

// Update order status (with optional extra fields)
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const { status, estimatedTime, prepTime } = req.body;
        const updateData = { status };

        if (estimatedTime !== undefined) {
            updateData.estimatedTime = estimatedTime;
        }

        if (status === 'PREPARING' && prepTime !== undefined) {
            updateData.estimatedTime = prepTime;
            updateData.estimatedCompletionTime = new Date(Date.now() + prepTime * 60000);
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { returnDocument: 'after' }
        );
        res.json(updatedOrder);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
