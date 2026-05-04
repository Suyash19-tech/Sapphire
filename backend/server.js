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
const Order = require('./models/Order');
const MenuItem = require('./models/MenuItem');
const User = require('./models/User');
const TableSession = require('./models/TableSession');
const Table = require('./models/Table');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
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
app.use(express.json());

// Local disk storage for uploaded images
const uploadsDir = path.join(__dirname, 'uploads');
if (!require('fs').existsSync(uploadsDir)) {
    require('fs').mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
            allowed.test(file.mimetype);
        if (ok) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));

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

// Upload image for a menu item
app.patch('/api/menu/:id/image', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Build the public URL for the uploaded file
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
        const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;

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

// Helper function: Get or create session for a table
async function getOrCreateTableSession(tableId) {
    try {
        let tableSession = await TableSession.findOne({ tableId });

        if (!tableSession) {
            // Create new session for this table
            const newSessionId = `session_${tableId}_${Date.now()}`;
            tableSession = new TableSession({
                tableId,
                currentSessionId: newSessionId
            });
            await tableSession.save();
            console.log(`🆕 [Session] Created new session for table ${tableId}: ${newSessionId}`);
        }

        return tableSession.currentSessionId;
    } catch (error) {
        console.error('❌ [Session] Error getting/creating session:', error);
        // Fallback: generate session ID without saving
        return `session_${tableId}_${Date.now()}`;
    }
}

// Helper function: Reset table session (called when all orders are PAID)
async function resetTableSession(tableId) {
    try {
        const newSessionId = `session_${tableId}_${Date.now()}`;

        await TableSession.findOneAndUpdate(
            { tableId },
            {
                currentSessionId: newSessionId,
                lastUpdated: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`🔄 [Session] Reset session for table ${tableId}: ${newSessionId}`);
        return newSessionId;
    } catch (error) {
        console.error('❌ [Session] Error resetting session:', error);
        return null;
    }
}

// Create a new order (guest-friendly, no payment screenshot required)
app.post('/api/orders', async (req, res) => {
    try {
        console.log('📝 [Order Creation] Request body:', JSON.stringify(req.body, null, 2));

        const { items, totalAmount, cookingInstructions, tableId, customerName, customerPhone } = req.body;

        // Parse items if sent as string
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

        // Convert tableId to Number if provided
        const parsedTableId = tableId ? Number(tableId) : null;

        // Validate required fields
        if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
            return res.status(400).json({ error: 'Items are required' });
        }

        if (!totalAmount || totalAmount <= 0) {
            return res.status(400).json({ error: 'Valid total amount is required' });
        }

        // CHECK TABLE STATUS: Block order if table is blocked
        if (parsedTableId) {
            const table = await Table.findOne({ tableNumber: parsedTableId });
            if (table && table.status === 'BLOCKED') {
                console.log(`🚫 [Order Creation] Table ${parsedTableId} is BLOCKED`);
                return res.status(403).json({
                    error: 'Table unavailable',
                    message: 'This table is currently unavailable. Please contact staff.'
                });
            }
        }

        // Get or create session for table orders
        let sessionId = null;
        if (parsedTableId) {
            sessionId = await getOrCreateTableSession(parsedTableId);
        }

        // NO AUTO-MERGE: Always create new PENDING order
        // Merging will happen when admin accepts the order
        const newOrder = new Order({
            tableId: parsedTableId,
            sessionId: sessionId,
            items: parsedItems,
            totalAmount,
            cookingInstructions: cookingInstructions || '',
            customerName: customerName || 'Guest',
            customerPhone: customerPhone || '',
            status: 'PENDING'
        });

        const savedOrder = await newOrder.save();
        console.log('✅ [Order Creation] New PENDING order created:', savedOrder._id, 'for table:', parsedTableId, 'session:', sessionId);

        // Update table stats
        if (parsedTableId) {
            await Table.findOneAndUpdate(
                { tableNumber: parsedTableId },
                {
                    $inc: { totalOrders: 1 },
                    $set: { lastOrderAt: new Date() }
                },
                { upsert: true }
            );
        }

        // Emit to admin dashboard
        req.app.get('io').emit('admin_newOrder', savedOrder);

        res.status(201).json(savedOrder);
    } catch (err) {
        console.error('❌ [Order Creation] Error:', err);
        res.status(500).json({ error: 'Failed to create order', details: err.message });
    }
});

// Get all active orders (status != PAID)
app.get('/api/orders/active', async (req, res) => {
    try {
        const orders = await Order.find({
            status: { $ne: 'PAID' }
        }).sort({ createdAt: -1 });

        console.log(`📋 [Active Orders] Found ${orders.length} active orders`);
        res.json(orders);
    } catch (err) {
        console.error('❌ [Active Orders] Error:', err);
        res.status(500).json({ error: 'Failed to fetch active orders' });
    }
});

// Get all orders (with table filtering for users)
app.get('/api/orders', async (req, res) => {
    try {
        const { tableId } = req.query;

        let query = {};

        if (tableId) {
            // USER VIEW: Filter by table, current session, and exclude PAID orders
            const parsedTableId = Number(tableId);

            // Get current session for this table
            const tableSession = await TableSession.findOne({ tableId: parsedTableId });

            if (tableSession) {
                query.tableId = parsedTableId;
                query.sessionId = tableSession.currentSessionId;
                query.status = { $ne: 'PAID' }; // Exclude paid orders for user view
                console.log(`📋 [Orders - User] Fetching orders for table: ${parsedTableId}, session: ${tableSession.currentSessionId}`);
            } else {
                // No session exists yet, return empty array
                console.log(`📋 [Orders - User] No session found for table: ${parsedTableId}`);
                return res.json([]);
            }
        } else {
            // ADMIN VIEW: Return all orders (no filtering)
            console.log(`📋 [Orders - Admin] Fetching all orders`);
        }

        const orders = await Order.find(query).sort({ createdAt: -1 });
        console.log(`✅ [Orders] Found ${orders.length} orders`);
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

// ─── Helper: merge items arrays ───────────────────────────────────────────────
function mergeItems(baseItems, newItems) {
    const merged = baseItems.map(i => ({ ...i.toObject ? i.toObject() : i }));
    for (const ni of newItems) {
        const idx = merged.findIndex(i => i.name === ni.name && i.price === ni.price);
        if (idx >= 0) {
            merged[idx].quantity += ni.quantity;
        } else {
            merged.push({ name: ni.name, price: ni.price, quantity: ni.quantity });
        }
    }
    return merged;
}

function calcTotal(items) {
    return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

// Update order status with validation
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const { status, prepTime } = req.body;
        const io = req.app.get('io');

        const validStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'PAID', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        console.log(`📝 [Status] ${order.status} → ${status}  order=${order._id}  table=${order.tableId}`);

        // ── RULE: REJECT (PENDING only) ────────────────────────────────────────
        if (status === 'REJECTED') {
            if (order.status !== 'PENDING') {
                return res.status(400).json({ error: 'Only PENDING orders can be rejected' });
            }
            await Order.findByIdAndDelete(order._id);
            io.emit('order_deleted', order._id.toString());
            io.emit('user_orderUpdated', { _id: order._id, status: 'REJECTED', deleted: true });
            console.log(`❌ [Reject] Order ${order._id} deleted`);
            return res.json({ rejected: true, orderId: order._id });
        }

        // ── RULE: ACCEPT (PENDING → PREPARING) ────────────────────────────────
        // Merge ONLY into an existing PREPARING order whose timer is still running.
        // If the existing order is READY (timer done, waiting for pickup) → do NOT merge.
        // Create a fresh PREPARING entry for the new items instead.
        if (status === 'PREPARING' && order.status === 'PENDING') {
            const { tableId, sessionId } = order;

            // Only merge into PREPARING orders with time still remaining
            const preparingOrder = await Order.findOne({
                tableId, sessionId, status: 'PREPARING', _id: { $ne: order._id }
            }).sort({ createdAt: 1 });

            if (preparingOrder) {
                // Check if timer is still running (has remaining time)
                const now = Date.now();
                const timeRemaining = preparingOrder.estimatedCompletionTime
                    ? new Date(preparingOrder.estimatedCompletionTime).getTime() - now
                    : 0;
                const timerStillRunning = timeRemaining > 0;

                if (timerStillRunning) {
                    // Timer running → merge items and add prep time on top
                    const mergedItems = mergeItems(preparingOrder.items, order.items);
                    preparingOrder.items = mergedItems;
                    preparingOrder.totalAmount = calcTotal(mergedItems);

                    if (prepTime) {
                        preparingOrder.estimatedTime = (preparingOrder.estimatedTime || 0) + prepTime;
                        preparingOrder.estimatedCompletionTime = new Date(now + timeRemaining + prepTime * 60000);
                        console.log(`   ⏱️  +${prepTime}m added on top of ${Math.ceil(timeRemaining / 60000)}m remaining`);
                    }
                    if (order.cookingInstructions) {
                        preparingOrder.cookingInstructions = preparingOrder.cookingInstructions
                            ? `${preparingOrder.cookingInstructions}; ${order.cookingInstructions}`
                            : order.cookingInstructions;
                    }
                    await preparingOrder.save();
                    await Order.findByIdAndDelete(order._id);

                    io.emit('user_orderUpdated', preparingOrder);
                    io.emit('order_deleted', order._id.toString());
                    console.log(`✅ [Merge→PREPARING] ${order._id} merged into ${preparingOrder._id}, ₹${preparingOrder.totalAmount}`);
                    return res.json({ merged: true, order: preparingOrder, deletedOrderId: order._id });
                }
                // Timer expired on existing PREPARING order → fall through to create fresh PREPARING
                console.log(`⏰ [No Merge] Existing PREPARING order timer expired — creating fresh PREPARING for new items`);
            }

            // No active PREPARING order (or timer expired) → move this order to PREPARING fresh
            order.status = 'PREPARING';
            if (prepTime) {
                order.estimatedTime = prepTime;
                order.estimatedCompletionTime = new Date(Date.now() + prepTime * 60000);
            }
            await order.save();
            io.emit('user_orderUpdated', order);
            console.log(`✅ [Accept] Order ${order._id} → PREPARING (fresh, no merge)`);
            return res.json(order);
        }

        // ── RULE: MARK AS SERVED (READY → SERVED) ─────────────────────────────
        // Merge into existing SERVED order for same table/session if one exists.
        if (status === 'SERVED' && order.status === 'READY') {
            const { tableId, sessionId } = order;

            const servedOrder = await Order.findOne({
                tableId, sessionId, status: 'SERVED', _id: { $ne: order._id }
            }).sort({ createdAt: 1 });

            if (servedOrder) {
                const mergedItems = mergeItems(servedOrder.items, order.items);
                servedOrder.items = mergedItems;
                servedOrder.totalAmount = calcTotal(mergedItems);
                if (order.cookingInstructions) {
                    servedOrder.cookingInstructions = servedOrder.cookingInstructions
                        ? `${servedOrder.cookingInstructions}; ${order.cookingInstructions}`
                        : order.cookingInstructions;
                }
                await servedOrder.save();
                await Order.findByIdAndDelete(order._id);

                io.emit('user_orderUpdated', servedOrder);
                io.emit('order_deleted', order._id.toString());
                console.log(`✅ [Merge→SERVED] ${order._id} merged into ${servedOrder._id}, ₹${servedOrder.totalAmount}`);
                return res.json({ merged: true, order: servedOrder, deletedOrderId: order._id });
            }

            // No existing SERVED order — move normally
            order.status = 'SERVED';
            await order.save();
            io.emit('user_orderUpdated', order);
            console.log(`✅ [Served] Order ${order._id} → SERVED`);
            return res.json(order);
        }

        // ── RULE: MARK AS PAID ─────────────────────────────────────────────────
        // Mark paid, then reset session so next customer starts fresh.
        if (status === 'PAID') {
            order.status = 'PAID';
            await order.save();
            io.emit('user_orderUpdated', order);
            console.log(`✅ [Paid] Order ${order._id} → PAID`);

            // Reset session — all future orders for this table get a new session
            if (order.tableId && order.sessionId) {
                const remaining = await Order.find({
                    tableId: order.tableId,
                    sessionId: order.sessionId,
                    status: { $ne: 'PAID' }
                });
                if (remaining.length === 0) {
                    await resetTableSession(order.tableId);
                    console.log(`🔄 [Session] Reset for table ${order.tableId}`);
                }
            }
            return res.json(order);
        }

        // ── ALL OTHER STATUS TRANSITIONS (PREPARING→READY, etc.) ──────────────
        order.status = status;
        await order.save();
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

        req.app.get('io').emit('order_deleted', req.params.id);
        req.app.get('io').emit('user_orderUpdated', { _id: req.params.id, status: 'DELETED', deleted: true });

        console.log(`🗑️  [Delete] Order ${req.params.id} deleted by admin`);
        res.json({ deleted: true, orderId: req.params.id });
    } catch (err) {
        console.error('❌ [Delete Order] Error:', err);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// ==================== TABLE MANAGEMENT ====================

// Get all tables
app.get('/api/tables', async (req, res) => {
    try {
        console.log('📋 [Tables] Fetching all tables');
        const tables = await Table.find().sort({ tableNumber: 1 });

        // If no tables exist, create default tables (1-20)
        if (tables.length === 0) {
            console.log('🆕 [Tables] No tables found, creating default tables');
            const defaultTables = [];
            for (let i = 1; i <= 20; i++) {
                defaultTables.push({
                    tableNumber: i,
                    status: 'ACTIVE'
                });
            }
            await Table.insertMany(defaultTables);
            const newTables = await Table.find().sort({ tableNumber: 1 });
            console.log(`✅ [Tables] Created ${newTables.length} default tables`);
            return res.json(newTables);
        }

        console.log(`✅ [Tables] Found ${tables.length} tables`);
        res.json(tables);
    } catch (err) {
        console.error('❌ [Tables] Error:', err);
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
});

// Toggle table status (ACTIVE <-> BLOCKED)
app.patch('/api/tables/:tableNumber/toggle', async (req, res) => {
    try {
        const tableNumber = Number(req.params.tableNumber);
        console.log(`📝 [Table Toggle] Toggling status for table ${tableNumber}`);

        let table = await Table.findOne({ tableNumber });

        if (!table) {
            // Create table if it doesn't exist
            table = new Table({
                tableNumber,
                status: 'BLOCKED' // Default to blocked when manually toggling non-existent table
            });
            await table.save();
            console.log(`🆕 [Table Toggle] Created new table ${tableNumber} with status BLOCKED`);
        } else {
            // Toggle status
            table.status = table.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
            await table.save();
            console.log(`✅ [Table Toggle] Table ${tableNumber} status changed to ${table.status}`);
        }

        res.json(table);
    } catch (err) {
        console.error('❌ [Table Toggle] Error:', err);
        res.status(500).json({ error: 'Failed to toggle table status' });
    }
});

// Check if table is available (used before order creation)
app.get('/api/tables/:tableNumber/status', async (req, res) => {
    try {
        const tableNumber = Number(req.params.tableNumber);
        console.log(`🔍 [Table Status] Checking status for table ${tableNumber}`);

        const table = await Table.findOne({ tableNumber });

        // If table doesn't exist, it's available (will be created on first order)
        if (!table) {
            console.log(`✅ [Table Status] Table ${tableNumber} not found, assuming ACTIVE`);
            return res.json({ tableNumber, status: 'ACTIVE', available: true });
        }

        const available = table.status === 'ACTIVE';
        console.log(`✅ [Table Status] Table ${tableNumber} is ${table.status} (available: ${available})`);

        res.json({
            tableNumber: table.tableNumber,
            status: table.status,
            available
        });
    } catch (err) {
        console.error('❌ [Table Status] Error:', err);
        res.status(500).json({ error: 'Failed to check table status' });
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
