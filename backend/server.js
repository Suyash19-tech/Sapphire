const express = require('express');
const http = require('http');
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
const cache = require('./cache');

// ── Per-phone rate limiting: max 5 orders/minute ──────────────────────────────
// Map<phone → [timestamps]>
const phoneOrderLog = new Map();
function isPhoneRateLimited(phone) {
    const now = Date.now();
    const window = 60 * 1000; // 1 minute
    const max = 5;
    const timestamps = (phoneOrderLog.get(phone) || []).filter(t => now - t < window);
    if (timestamps.length >= max) return true;
    timestamps.push(now);
    phoneOrderLog.set(phone, timestamps);
    return false;
}

// ── Concurrency lock: prevent duplicate orders from same phone ────────────────
// Set<phone> — phones currently being processed
const processingPhones = new Set();

// Clean up stale phone log entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [phone, timestamps] of phoneOrderLog.entries()) {
        const fresh = timestamps.filter(t => now - t < 60000);
        if (fresh.length === 0) phoneOrderLog.delete(phone);
        else phoneOrderLog.set(phone, fresh);
    }
}, 5 * 60 * 1000);

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const auth = require('./middleware/auth');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);
const PORT = process.env.PORT || 5001;

// Trust proxy for rate limiting on Render
app.set('trust proxy', 1);

// CORS Configuration to allow Vercel frontend and local development
const corsOptions = {
    origin: [
        'http://localhost:5173', // Vite dev server
        'https://campus-craves.vercel.app' // Vercel deployment
    ],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Security Middlewares
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow images to be served
}));

// Rate Limiting (Prevent brute force/DoS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Raised from 100 — each page load makes ~10 requests
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);

// Performance & Logging
app.use(compression()); // Gzip compression
app.use(morgan('dev')); // Log requests

// Standard Middleware
app.use(express.json());

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary multer storage
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'Sapphire',
        resource_type: 'auto',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Wrapper to catch Multer errors
const uploadMiddleware = (req, res, next) => {
    const uploadSingle = upload.single('paymentScreenshot');
    uploadSingle(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).json({ error: 'File upload error', details: err.message });
        } else if (err) {
            console.error('Upload Error:', err.message);
            return res.status(500).json({ error: 'Upload failed', details: err.message });
        }
        next();
    });
};

// Database Connection — tuned connection pool for concurrent load
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campuscraves', {
    maxPoolSize: 50,   // max simultaneous connections (default 5)
    minPoolSize: 10,   // keep 10 warm connections ready
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
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
app.use('/api/customers', customerRoutes);

// Menu Management Routes
const MENU_CACHE_KEY = 'menu:all';
const MENU_TTL = 10 * 60 * 1000; // 10 minutes

const clearMenuCache = () => cache.del(MENU_CACHE_KEY);

app.get('/api/menu', async (req, res) => {
    try {
        const cached = cache.get(MENU_CACHE_KEY);
        if (cached) return res.json(cached);

        const menuItems = await MenuItem.find()
            .sort({ category: 1, name: 1 })
            .lean(); // lean() returns plain JS objects — ~30% faster

        cache.set(MENU_CACHE_KEY, menuItems, MENU_TTL);
        res.json(menuItems);
    } catch (err) {
        console.error('❌ [Menu] Error:', err);
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

// Upload image for a menu item
app.patch('/api/menu/:id/image', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Cloudinary returns the URL in req.file.path
        const imageUrl = req.file.path;

        const updatedItem = await MenuItem.findByIdAndUpdate(
            req.params.id,
            { image: imageUrl },
            { returnDocument: 'after', new: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        clearMenuCache();
        console.log(`✅ [Menu Image] Updated image for ${updatedItem.name}: ${imageUrl}`);
        res.json(updatedItem);
    } catch (err) {
        console.error('❌ [Menu Image] Error:', err);
        res.status(500).json({ error: 'Failed to upload image' });
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

// Rate Limiting for admin routes only
const adminLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: 50, // Limit each IP to 50 admin actions per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many admin actions from this IP, please try again after 10 minutes' }
});

// Create a new order
app.post('/api/orders', async (req, res) => {
    try {
        const { items, totalAmount, cookingInstructions, customerName, customerPhone, customerId, scheduledFor } = req.body;

        // ── Per-phone rate limit: 5 orders/minute ─────────────────────────────
        const phone = customerPhone || 'unknown';
        if (isPhoneRateLimited(phone)) {
            console.warn(`🚫 [Rate Limit] Phone ${phone} exceeded 5 orders/min`);
            return res.status(429).json({ error: 'Too many orders. Please wait a minute before ordering again.' });
        }

        // ── Concurrency lock: reject duplicate in-flight requests ─────────────
        if (processingPhones.has(phone)) {
            return res.status(409).json({ error: 'Your previous order is still being processed. Please wait.' });
        }
        processingPhones.add(phone);

        try {
            const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

            if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
                return res.status(400).json({ error: 'Items are required' });
            }
            if (!totalAmount || totalAmount <= 0) {
                return res.status(400).json({ error: 'Valid total amount is required' });
            }

            // Determine if this is a scheduled order
            let isScheduled = false;
            let scheduledDate = null;
            let status = 'PENDING';

            if (scheduledFor) {
                scheduledDate = new Date(scheduledFor);
                if (isNaN(scheduledDate)) {
                    return res.status(400).json({ error: 'Invalid scheduledFor date' });
                }
                if (scheduledDate > new Date()) {
                    isScheduled = true;
                    status = 'SCHEDULED';
                    console.log(`📅 [Order Creation] Scheduled for: ${scheduledDate.toISOString()}`);
                }
            }

            const newOrder = new Order({
                customerId: customerId || null,
                items: parsedItems,
                totalAmount,
                cookingInstructions: cookingInstructions || '',
                customerName: customerName || 'Guest',
                customerPhone: phone,
                status,
                isScheduled,
                scheduledFor: scheduledDate,
            });

            const savedOrder = await newOrder.save();
            console.log(`✅ [Order Creation] New ${status} order created:`, savedOrder._id);

            // Invalidate order caches so next fetch is fresh
            cache.del('orders:admin');
            cache.del('orders:active');
            cache.del('analytics:summary:*'); // analytics will recompute on next request

            if (status === 'PENDING') {
                req.app.get('io').emit('admin_newOrder', savedOrder);
            }

            res.status(201).json(savedOrder);
        } finally {
            // Always release the lock
            processingPhones.delete(phone);
        }
    } catch (err) {
        console.error('❌ [Order Creation] Error:', err);
        res.status(500).json({ error: 'Failed to create order', details: err.message });
    }
});

// Get all active orders (status != PAID, != SCHEDULED)
app.get('/api/orders/active', async (req, res) => {
    try {
        const CACHE_KEY = 'orders:active';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);

        const orders = await Order.find({
            status: { $nin: ['PAID', 'SCHEDULED'] }
        }).sort({ createdAt: -1 }).lean();

        cache.set(CACHE_KEY, orders, 4000); // 4-second TTL
        console.log(`📋 [Active Orders] Found ${orders.length} active orders`);
        res.json(orders);
    } catch (err) {
        console.error('❌ [Active Orders] Error:', err);
        res.status(500).json({ error: 'Failed to fetch active orders' });
    }
});

// Get all orders (admin view or by customerId)
app.get('/api/orders', async (req, res) => {
    try {
        const { customerId } = req.query;

        if (customerId) {
            // Customer view — no cache (personal data, changes frequently)
            const orders = await Order.find({
                customerId,
                status: { $ne: 'PAID' }
            }).sort({ createdAt: -1 }).lean();
            console.log(`📋 [Orders - Customer] ${orders.length} active orders for ${customerId}`);
            return res.json(orders);
        }

        // Admin view — short cache (3 s) to absorb burst refreshes
        const CACHE_KEY = 'orders:admin';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);

        const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
        cache.set(CACHE_KEY, orders, 3000);
        console.log(`📋 [Orders - Admin] ${orders.length} orders`);
        res.json(orders);
    } catch (err) {
        console.error('❌ [Orders] Error:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get user's own orders (optional - for logged-in users)
app.get('/api/orders/my-orders', auth, async (req, res) => {
    try {
        console.log('📋 [My Orders] Fetching orders for user:', req.user.id);
        const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error('❌ [My Orders] Error:', err);
        res.status(500).json({ error: 'Failed to fetch your orders' });
    }
});

// Get ALL orders for a customer (active + history) — used by customer orders page
app.get('/api/orders/customer/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        console.log(`📋 [Customer Orders] Fetching all orders for customer: ${customerId}`);
        const orders = await Order.find({ customerId }).sort({ createdAt: -1 }).lean();
        console.log(`✅ [Customer Orders] Found ${orders.length} orders`);
        res.json(orders);
    } catch (err) {
        console.error('❌ [Customer Orders] Error:', err);
        res.status(500).json({ error: 'Failed to fetch customer orders' });
    }
});

// Update order status — Takeaway flow: PENDING → PREPARING → READY → PAID
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const { status, prepTime } = req.body;
        const io = req.app.get('io');

        const validStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        console.log(`📝 [Status] ${order.status} → ${status}  order=${order._id}`);

        // ── REJECT (PENDING only) ──────────────────────────────────────────────
        if (status === 'REJECTED') {
            if (order.status !== 'PENDING') {
                return res.status(400).json({ error: 'Only PENDING orders can be rejected' });
            }
            await Order.findByIdAndDelete(order._id);
            cache.del('orders:admin'); cache.del('orders:active');
            io.emit('order_deleted', order._id.toString());
            io.emit('user_orderUpdated', { _id: order._id, status: 'REJECTED', deleted: true });
            console.log(`❌ [Reject] Order ${order._id} deleted`);
            return res.json({ rejected: true, orderId: order._id });
        }

        // ── PROMOTE SCHEDULED → PENDING (manual early accept) ────────────────
        if (status === 'PENDING' && order.status === 'SCHEDULED') {
            order.status = 'PENDING';
            order.isScheduled = false;
            await order.save();
            cache.del('orders:admin'); cache.del('orders:active');
            io.emit('admin_newOrder', order);
            io.emit('user_orderUpdated', order);
            console.log(`✅ [Early Accept] Order ${order._id} SCHEDULED → PENDING`);
            return res.json(order);
        }

        // ── ACCEPT (PENDING → PREPARING) ──────────────────────────────────────
        if (status === 'PREPARING' && order.status === 'PENDING') {
            order.status = 'PREPARING';
            if (prepTime) {
                order.estimatedTime = prepTime;
                order.estimatedCompletionTime = new Date(Date.now() + prepTime * 60000);
            }
            await order.save();
            cache.del('orders:admin'); cache.del('orders:active');
            io.emit('user_orderUpdated', order);
            console.log(`✅ [Accept] Order ${order._id} → PREPARING (${prepTime || 0}m)`);
            return res.json(order);
        }

        // ── MARK READY (PREPARING → READY) ────────────────────────────────────
        if (status === 'READY' && order.status === 'PREPARING') {
            order.status = 'READY';
            await order.save();
            cache.del('orders:admin'); cache.del('orders:active');
            io.emit('user_orderUpdated', order);
            io.emit('order_ready', {
                _id: order._id,
                customerId: order.customerId,
                customerName: order.customerName,
                items: order.items,
                totalAmount: order.totalAmount,
            });
            console.log(`✅ [Ready] Order ${order._id} → READY  (order_ready emitted)`);
            return res.json(order);
        }

        // ── MARK PAID (READY → PAID) ───────────────────────────────────────────
        if (status === 'PAID' && order.status === 'READY') {
            order.status = 'PAID';
            await order.save();
            cache.del('orders:admin'); cache.del('orders:active');
            io.emit('user_orderUpdated', order);
            console.log(`✅ [Paid] Order ${order._id} → PAID`);
            return res.json(order);
        }

        // ── FALLBACK ───────────────────────────────────────────────────────────
        order.status = status;
        await order.save();
        cache.del('orders:admin'); cache.del('orders:active');
        io.emit('user_orderUpdated', order);
        console.log(`✅ [Status] Order ${order._id} → ${status}`);
        return res.json(order);

    } catch (err) {
        console.error('❌ [Status Update] Error:', err);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Update order items (admin only)
app.patch('/api/orders/:id/items', async (req, res) => {
    try {
        const { items } = req.body;

        console.log(`📝 [Items Update] Updating items for order ${req.params.id}`);

        // Get the order
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Don't allow editing PAID orders
        if (order.status === 'PAID') {
            return res.status(400).json({ error: 'Cannot edit paid orders' });
        }

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items are required' });
        }

        // Calculate new total
        const newTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Update order
        order.items = items;
        order.totalAmount = newTotal;
        await order.save();

        cache.del('orders:admin'); cache.del('orders:active');
        console.log(`✅ [Items Update] Order ${req.params.id} items updated`);
        console.log(`   Total items: ${items.length}, New total: ₹${newTotal}`);

        // Emit to connected clients
        req.app.get('io').emit('user_orderUpdated', order);

        res.json(order);
    } catch (err) {
        console.error('❌ [Items Update] Error:', err);
        res.status(500).json({ error: 'Failed to update order items' });
    }
});

// Delete an order completely (admin only — used when order has 0 items)
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (order.status === 'PAID') {
            return res.status(400).json({ error: 'Cannot delete a paid order' });
        }

        await Order.findByIdAndDelete(req.params.id);

        cache.del('orders:admin'); cache.del('orders:active');
        req.app.get('io').emit('order_deleted', req.params.id);
        req.app.get('io').emit('user_orderUpdated', { _id: req.params.id, status: 'DELETED', deleted: true });

        console.log(`🗑️  [Delete] Order ${req.params.id} deleted by admin`);
        res.json({ deleted: true, orderId: req.params.id });
    } catch (err) {
        console.error('❌ [Delete Order] Error:', err);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// ==================== ANALYTICS ====================

// Helper: build date range from period string
function periodRange(period) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (period === '7d') { start.setDate(start.getDate() - 6); }
    if (period === '30d') { start.setDate(start.getDate() - 29); }
    if (period === 'all') { start.setFullYear(2000); }

    return { start, end };
}

// GET /api/analytics/items?period=7d|30d|all&limit=N  OR  ?startDate=&endDate=&limit=N
// Returns items sorted by quantity sold descending
app.get('/api/analytics/items', async (req, res) => {
    try {
        let start, end, period;

        if (req.query.startDate && req.query.endDate) {
            start = new Date(req.query.startDate); start.setHours(0, 0, 0, 0);
            end = new Date(req.query.endDate); end.setHours(23, 59, 59, 999);
            period = 'custom';
            if (isNaN(start) || isNaN(end) || start > end)
                return res.status(400).json({ error: 'Invalid date range' });
        } else {
            period = ['7d', '30d', 'all'].includes(req.query.period) ? req.query.period : '30d';
            ({ start, end } = periodRange(period));
        }

        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const items = await Order.aggregate([
            { $match: { status: 'PAID', createdAt: { $gte: start, $lte: end } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.name',
                    quantity: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                    avgPrice: { $avg: '$items.price' },
                    orders: { $sum: 1 },
                }
            },
            { $sort: { quantity: -1 } },
            { $limit: limit },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    quantity: 1,
                    revenue: 1,
                    avgPrice: { $round: ['$avgPrice', 0] },
                    orders: 1,
                }
            }
        ]);

        console.log(`📊 [Analytics/Items] period=${period} limit=${limit} → ${items.length} items`);
        res.json({ period, from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0], items });
    } catch (err) {
        console.error('❌ [Analytics/Items] Error:', err);
        res.status(500).json({ error: 'Failed to fetch item analytics' });
    }
});

// GET /api/analytics/trend?period=7d|30d  OR  ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns daily { date, total, orders, aov } with zero-filled gaps
app.get('/api/analytics/trend', async (req, res) => {
    try {
        let start, end, label;

        if (req.query.startDate && req.query.endDate) {
            // Custom date range
            start = new Date(req.query.startDate); start.setHours(0, 0, 0, 0);
            end = new Date(req.query.endDate); end.setHours(23, 59, 59, 999);
            label = 'custom';
        } else {
            const period = req.query.period === '7d' ? '7d' : '30d';
            const days = period === '7d' ? 7 : 30;
            end = new Date(); end.setHours(23, 59, 59, 999);
            start = new Date(); start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - (days - 1));
            label = period;
        }

        if (isNaN(start) || isNaN(end) || start > end) {
            return res.status(400).json({ error: 'Invalid date range' });
        }

        // Aggregate revenue + order count per calendar day
        const rows = await Order.aggregate([
            { $match: { status: 'PAID', createdAt: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    total: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                    aov: { $avg: '$totalAmount' },
                }
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', total: 1, orders: 1, aov: { $round: ['$aov', 0] } } }
        ]);

        // Fill every day in the range with zeros for missing days
        const map = Object.fromEntries(rows.map(r => [r.date, r]));
        const trend = [];
        const msPerDay = 86400000;
        const days = Math.round((end - start) / msPerDay) + 1;
        for (let i = 0; i < days; i++) {
            const d = new Date(start.getTime() + i * msPerDay);
            const key = d.toISOString().split('T')[0];
            trend.push(map[key] ?? { date: key, total: 0, orders: 0, aov: 0 });
        }

        const totalRevenue = trend.reduce((s, d) => s + d.total, 0);
        const totalOrders = trend.reduce((s, d) => s + d.orders, 0);
        const peakDay = trend.reduce((a, b) => b.total > a.total ? b : a, trend[0]);

        console.log(`📈 [Analytics/Trend] ${label} ${start.toISOString().split('T')[0]}→${end.toISOString().split('T')[0]} revenue=₹${totalRevenue}`);
        res.json({
            period: label,
            from: start.toISOString().split('T')[0],
            to: end.toISOString().split('T')[0],
            trend,
            totalRevenue,
            totalOrders,
            peakDay,
        });
    } catch (err) {
        console.error('❌ [Analytics/Trend] Error:', err);
        res.status(500).json({ error: 'Failed to fetch trend data' });
    }
});

// GET /api/analytics/peak-hours?period=7d|30d|all  OR  ?startDate=&endDate=
// Returns orders grouped by hour of day (0-23), sorted by hour
app.get('/api/analytics/peak-hours', async (req, res) => {
    try {
        let start, end;
        if (req.query.startDate && req.query.endDate) {
            start = new Date(req.query.startDate); start.setHours(0, 0, 0, 0);
            end = new Date(req.query.endDate); end.setHours(23, 59, 59, 999);
            if (isNaN(start) || isNaN(end) || start > end)
                return res.status(400).json({ error: 'Invalid date range' });
        } else {
            ({ start, end } = periodRange(req.query.period || '30d'));
        }

        const rows = await Order.aggregate([
            { $match: { status: 'PAID', createdAt: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $hour: '$createdAt' },
                    orders: { $sum: 1 },
                    revenue: { $sum: '$totalAmount' },
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill all 24 hours with zeros so the chart has no gaps
        const map = Object.fromEntries(rows.map(r => [r._id, r]));
        const hours = Array.from({ length: 24 }, (_, h) => {
            const r = map[h] ?? { orders: 0, revenue: 0 };
            const suffix = h < 12 ? 'AM' : 'PM';
            const display = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
            return { hour: h, label: display, orders: r.orders, revenue: r.revenue };
        });

        const peakHour = hours.reduce((a, b) => b.orders > a.orders ? b : a, hours[0]);
        console.log(`⏰ [Analytics/PeakHours] peak=${peakHour.label} (${peakHour.orders} orders)`);

        res.json({
            from: start.toISOString().split('T')[0],
            to: end.toISOString().split('T')[0],
            hours,
            peakHour,
        });
    } catch (err) {
        console.error('❌ [Analytics/PeakHours] Error:', err);
        res.status(500).json({ error: 'Failed to fetch peak hours' });
    }
});

app.get('/api/analytics/summary', async (req, res) => {
    try {
        // Cache analytics for 2 minutes (expensive — 7 parallel aggregations)
        const cacheKey = `analytics:summary:${req.query.startDate || ''}:${req.query.endDate || ''}:${req.query.date || ''}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const dayStart = (d) => { const s = new Date(d); s.setHours(0, 0, 0, 0); return s; };
        const dayEnd = (d) => { const e = new Date(d); e.setHours(23, 59, 59, 999); return e; };
        const aov = (revenue, count) => count > 0 ? Math.round(revenue / count) : 0;

        // Custom date range takes priority
        if (req.query.startDate && req.query.endDate) {
            const rangeStart = dayStart(new Date(req.query.startDate));
            const rangeEnd = dayEnd(new Date(req.query.endDate));
            if (isNaN(rangeStart) || isNaN(rangeEnd) || rangeStart > rangeEnd)
                return res.status(400).json({ error: 'Invalid date range' });

            const [rangeAgg, rangeCount, topItems] = await Promise.all([
                Order.aggregate([
                    { $match: { status: 'PAID', createdAt: { $gte: rangeStart, $lte: rangeEnd } } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
                ]),
                Order.countDocuments({ status: 'PAID', createdAt: { $gte: rangeStart, $lte: rangeEnd } }),
                Order.aggregate([
                    { $match: { status: 'PAID', createdAt: { $gte: rangeStart, $lte: rangeEnd } } },
                    { $unwind: '$items' },
                    { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
                    { $sort: { qty: -1 } }, { $limit: 5 },
                    { $project: { _id: 0, name: '$_id', qty: 1, revenue: 1 } }
                ])
            ]);
            const rangeRevenue = rangeAgg[0]?.total ?? 0;
            const result = {
                mode: 'custom',
                from: rangeStart.toISOString().split('T')[0],
                to: rangeEnd.toISOString().split('T')[0],
                todaySales: rangeRevenue, weeklySales: rangeRevenue, monthlySales: rangeRevenue,
                todayOrders: rangeCount, weeklyOrders: rangeCount, monthlyOrders: rangeCount,
                todayAOV: aov(rangeRevenue, rangeCount), weeklyAOV: aov(rangeRevenue, rangeCount), monthlyAOV: aov(rangeRevenue, rangeCount),
                topItems, dailyBreakdown: [],
            };
            cache.set(cacheKey, result, 2 * 60 * 1000);
            return res.json(result);
        }

        // Default: fixed today / 7-day / 30-day windows
        const baseDate = req.query.date ? new Date(req.query.date) : new Date();
        const todayStart = dayStart(baseDate);
        const todayEnd = dayEnd(baseDate);
        const weekStart = dayStart(new Date(baseDate)); weekStart.setDate(weekStart.getDate() - 6);
        const monthStart = dayStart(new Date(baseDate)); monthStart.setDate(monthStart.getDate() - 29);

        const [todayAgg, weekAgg, monthAgg, todayCount, weekCount, monthCount, topItems] = await Promise.all([
            Order.aggregate([{ $match: { status: 'PAID', createdAt: { $gte: todayStart, $lte: todayEnd } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Order.aggregate([{ $match: { status: 'PAID', createdAt: { $gte: weekStart, $lte: todayEnd } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Order.aggregate([{ $match: { status: 'PAID', createdAt: { $gte: monthStart, $lte: todayEnd } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Order.countDocuments({ status: 'PAID', createdAt: { $gte: todayStart, $lte: todayEnd } }),
            Order.countDocuments({ status: 'PAID', createdAt: { $gte: weekStart, $lte: todayEnd } }),
            Order.countDocuments({ status: 'PAID', createdAt: { $gte: monthStart, $lte: todayEnd } }),
            Order.aggregate([
                { $match: { status: 'PAID', createdAt: { $gte: monthStart, $lte: todayEnd } } },
                { $unwind: '$items' },
                { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
                { $sort: { qty: -1 } }, { $limit: 5 },
                { $project: { _id: 0, name: '$_id', qty: 1, revenue: 1 } }
            ])
        ]);

        const dailyBreakdown = await Order.aggregate([
            { $match: { status: 'PAID', createdAt: { $gte: weekStart, $lte: todayEnd } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', revenue: 1, orders: 1 } }
        ]);

        const todayRevenue = todayAgg[0]?.total ?? 0;
        const weeklyRevenue = weekAgg[0]?.total ?? 0;
        const monthlyRevenue = monthAgg[0]?.total ?? 0;

        const result = {
            mode: 'default',
            date: baseDate.toISOString().split('T')[0],
            todaySales: todayRevenue, weeklySales: weeklyRevenue, monthlySales: monthlyRevenue,
            todayOrders: todayCount, weeklyOrders: weekCount, monthlyOrders: monthCount,
            todayAOV: aov(todayRevenue, todayCount), weeklyAOV: aov(weeklyRevenue, weekCount), monthlyAOV: aov(monthlyRevenue, monthCount),
            topItems, dailyBreakdown,
        };
        cache.set(cacheKey, result, 2 * 60 * 1000); // 2-minute cache
        res.json(result);
    } catch (err) {
        console.error('❌ [Analytics] Error:', err);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// ==================== SCHEDULED ORDER PROCESSOR ====================
// Runs every 60 seconds — promotes due SCHEDULED orders to PENDING
function startScheduler(ioInstance) {
    const INTERVAL_MS = 60 * 1000; // 1 minute

    const tick = async () => {
        try {
            const now = new Date();
            const due = await Order.find({
                status: 'SCHEDULED',
                scheduledFor: { $lte: now }
            });

            if (due.length === 0) return;

            console.log(`⏰ [Scheduler] ${due.length} scheduled order(s) due — promoting to PENDING`);

            for (const order of due) {
                order.status = 'PENDING';
                await order.save();

                // Notify admin dashboard — appears as a fresh incoming order
                ioInstance.emit('admin_newOrder', order);
                // Notify the customer's orders page — updates the existing SCHEDULED card to PENDING
                // (use user_orderUpdated so the customer page deduplicates correctly)
                ioInstance.emit('user_orderUpdated', order);

                console.log(`✅ [Scheduler] Order ${order._id} → PENDING (was scheduled for ${order.scheduledFor.toISOString()})`);
            }
        } catch (err) {
            console.error('❌ [Scheduler] Error:', err);
        }
    };

    // Run immediately on startup to catch any missed orders (e.g. server restart)
    tick();
    const handle = setInterval(tick, INTERVAL_MS);
    console.log('⏰ [Scheduler] Started — checking every 60s for due scheduled orders');
    return handle;
}

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startScheduler(io);
});
