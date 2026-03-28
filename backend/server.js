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
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
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

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Storage Configuration (Cloudinary)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'CampusCraves',
        resource_type: 'auto',
        // removed allowed_formats to be more flexible
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Wrapper to catch Multer errors specifically
const uploadMiddleware = (req, res, next) => {
    console.log('Incoming file upload request...');
    const uploadSingle = upload.single('paymentScreenshot');
    uploadSingle(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).json({ error: 'File upload error', details: err.message });
        } else if (err) {
            console.error('Cloudinary/Upload Error Details:', JSON.stringify(err, null, 2));
            console.error('Unknown Upload Error:', err);
            return res.status(500).json({ error: 'Unknown file upload error', details: err.message || err.toString() });
        }
        console.log('File upload successful:', req.file ? req.file.path : 'No file');
        next();
    });
};

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

// Menu Cache Variables
let menuCache = null;
let menuCacheTimeout = null;

const clearMenuCache = () => {
    menuCache = null;
    if (menuCacheTimeout) {
        clearTimeout(menuCacheTimeout);
        menuCacheTimeout = null;
    }
};

// Menu Management Routes
app.get('/api/menu', async (req, res) => {
    try {
        if (menuCache) {
            return res.json(menuCache);
        }

        const menuItems = await MenuItem.find().sort({ category: 1, name: 1 });

        // Set cache
        menuCache = menuItems;
        menuCacheTimeout = setTimeout(() => {
            menuCache = null;
        }, 5 * 60 * 1000); // 5 minutes

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
        clearMenuCache(); // Clear cache on update
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
        clearMenuCache(); // Clear cache on update
        res.json(updatedItem);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update menu item' });
    }
});

app.delete('/api/menu/:id', async (req, res) => {
    try {
        await MenuItem.findByIdAndDelete(req.params.id);
        clearMenuCache(); // Clear cache on update
        res.json({ message: 'Menu item deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete menu item' });
    }
});

// Rate Limiting for specific sensitive routes
const orderLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: 5, // Limit each IP to 5 order creations per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many orders created from this IP, please try again after 10 minutes' }
});

// Create a new order (with screenshot upload)
app.post('/api/orders', auth, orderLimiter, uploadMiddleware, async (req, res) => {
    try {
        console.log('Order creation request body:', JSON.stringify(req.body, null, 2));
        console.log('Order creation request file:', req.file ? JSON.stringify(req.file, null, 2) : 'No file');

        if (!req.file) {
            console.log('Warning: No file uploaded or Multer failed to process it.');
        }

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
        console.error('Error creating order details:', err);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        if (err.name === 'ValidationError') {
            console.error('Validation errors:', Object.values(err.errors).map(e => e.message));
        }
        res.status(500).json({ error: 'Failed to create order', details: err.message });
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
