import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getOrders, updateOrderStatus, updateOrderItems, deleteOrder, getMenu } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import {
    LayoutDashboard,
    UtensilsCrossed,
    CheckCircle,
    Clock,
    ChefHat,
    Inbox,
    RefreshCw,
    X,
    Truck,
    Receipt,
    Grid2x2,
    Plus,
    Minus,
    Trash2,
    Pencil,
    Search,
    Bell,
    Volume2,
    VolumeX,
    Phone,
    User,
    Timer
} from 'lucide-react';

const CountdownTimer = ({ estimatedCompletionTime, currentTime }) => {
    const timeLeft = estimatedCompletionTime
        ? Math.max(0, new Date(estimatedCompletionTime).getTime() - currentTime)
        : 0;
    const remainingSeconds = Math.floor(timeLeft / 1000);
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const isExpired = remainingSeconds === 0;

    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm font-semibold tabular-nums border ${isExpired ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
            <Timer size={14} />
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
    );
};

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [allOrders, setAllOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [activeTab, setActiveTab] = useState('ORDERS');
    const [showPrepTimeModal, setShowPrepTimeModal] = useState(false);
    const [selectedOrderForPrep, setSelectedOrderForPrep] = useState(null);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const socketRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Item editing state
    const [editingOrderId, setEditingOrderId] = useState(null);
    const [editingItems, setEditingItems] = useState([]);
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [menuItems, setMenuItems] = useState([]);
    const [menuSearch, setMenuSearch] = useState('');
    // Delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetOrderId, setDeleteTargetOrderId] = useState(null);

    // Notification Sound Function
    const playNotificationSound = React.useCallback(() => {
        if (!audioEnabled) return;
        try {
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (error) {
            console.error('Audio Playback failed:', error);
        }
    }, [audioEnabled]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchOrders = React.useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) {
            setLoading(true);
        }
        try {
            console.log('📋 [AdminDashboard] Fetching ALL orders (admin view)');
            const data = await getOrders(); // No tableId = admin view (all orders)
            console.log('✅ [AdminDashboard] Received orders:', data.length);

            setAllOrders(data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            if (isInitialLoad) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchOrders(true);
    }, [fetchOrders]);

    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_API_URL);
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!socketRef.current) return;

        // Handler for new orders
        const newOrderHandler = (newOrder) => {
            setAllOrders((prev) => [newOrder, ...prev]);
            setLastUpdated(new Date());
            playNotificationSound();
        };

        // Handler for order updates
        const updateHandler = (updatedOrder) => {
            setAllOrders((prev) => {
                const existing = prev.find(o => o._id === updatedOrder._id);

                // Play sound on status change
                if (existing && existing.status !== updatedOrder.status) {
                    if (['READY', 'SERVED'].includes(updatedOrder.status)) {
                        playNotificationSound();
                    }
                }

                // Check if order exists in list
                const orderExists = prev.some(o => o._id === updatedOrder._id);
                if (orderExists) {
                    return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
                } else {
                    return [updatedOrder, ...prev];
                }
            });
            setLastUpdated(new Date());
        };

        // Handler for order deletion (when merged)
        const deleteHandler = (deletedOrderId) => {
            setAllOrders((prev) => prev.filter(o => o._id !== deletedOrderId));
            setLastUpdated(new Date());
        };

        socketRef.current.on('admin_newOrder', newOrderHandler);
        socketRef.current.on('user_orderUpdated', updateHandler);
        socketRef.current.on('order_deleted', deleteHandler);

        return () => {
            socketRef.current?.off('admin_newOrder', newOrderHandler);
            socketRef.current?.off('user_orderUpdated', updateHandler);
            socketRef.current?.off('order_deleted', deleteHandler);
        };
    }, [playNotificationSound]);

    const handleStatusUpdate = async (orderId, newStatus, extraData = {}) => {
        const originalOrders = [...allOrders];

        // Close modals immediately
        setShowPrepTimeModal(false);
        setSelectedOrderForPrep(null);

        try {
            const result = await updateOrderStatus(orderId, newStatus, extraData);

            // If backend merged orders, update state to reflect the merge
            if (result.merged) {
                setAllOrders(prev => {
                    // Remove the deleted (merged-away) order
                    const withoutDeleted = prev.filter(o => o._id !== result.deletedOrderId);
                    // Update the target order with merged data
                    return withoutDeleted.map(o =>
                        o._id === result.order._id ? result.order : o
                    );
                });
            } else {
                // Normal update — replace the order in state
                setAllOrders(prev => prev.map(o =>
                    o._id === orderId ? { ...o, ...result } : o
                ));
            }
            setLastUpdated(new Date());
        } catch (error) {
            setAllOrders(originalOrders);
            toast.error('Update failed. Please try again.');
        }
    };

    const handleAcceptOrder = (order) => {
        setSelectedOrderForPrep(order);
        setShowPrepTimeModal(true);
    };

    const handleRejectOrder = async (orderId) => {
        if (!window.confirm('Reject this order? This cannot be undone.')) return;
        const originalOrders = [...allOrders];
        setAllOrders(prev => prev.filter(o => o._id !== orderId));
        try {
            await updateOrderStatus(orderId, 'REJECTED');
            toast.success('Order rejected');
        } catch (error) {
            setAllOrders(originalOrders);
            toast.error('Failed to reject order');
        }
    };

    // ── Item Editing ──────────────────────────────────────────────
    const startEditingItems = (order) => {
        setEditingOrderId(order._id);
        setEditingItems(order.items.map(i => ({ ...i })));
    };

    const cancelEditingItems = () => {
        setEditingOrderId(null);
        setEditingItems([]);
    };

    const changeItemQty = (idx, delta) => {
        setEditingItems(prev => {
            const updated = prev.map((item, i) => {
                if (i !== idx) return item;
                return { ...item, quantity: item.quantity + delta };
            }).filter(item => item.quantity > 0);
            return updated;
        });
    };

    const removeEditingItem = (idx) => {
        const updated = editingItems.filter((_, i) => i !== idx);
        if (updated.length === 0) {
            // Last item removed — prompt to delete the whole order
            setDeleteTargetOrderId(editingOrderId);
            setShowDeleteModal(true);
        } else {
            setEditingItems(updated);
        }
    };

    const saveEditedItems = async (orderId) => {
        if (editingItems.length === 0) {
            // Shouldn't normally reach here (removeEditingItem catches it), but safety net
            setDeleteTargetOrderId(orderId);
            setShowDeleteModal(true);
            return;
        }
        const originalOrders = [...allOrders];
        const newTotal = editingItems.reduce((s, i) => s + i.price * i.quantity, 0);
        setAllOrders(prev => prev.map(o =>
            o._id === orderId ? { ...o, items: editingItems, totalAmount: newTotal } : o
        ));
        setEditingOrderId(null);
        setEditingItems([]);
        try {
            await updateOrderItems(orderId, editingItems);
            toast.success('Order updated');
        } catch (error) {
            setAllOrders(originalOrders);
            toast.error('Failed to update order');
        }
    };

    const handleDeleteOrder = async () => {
        if (!deleteTargetOrderId) return;
        const orderId = deleteTargetOrderId;
        setShowDeleteModal(false);
        setDeleteTargetOrderId(null);
        setEditingOrderId(null);
        setEditingItems([]);

        const originalOrders = [...allOrders];
        setAllOrders(prev => prev.filter(o => o._id !== orderId));
        try {
            await deleteOrder(orderId);
            toast.success('Order deleted');
        } catch (error) {
            setAllOrders(originalOrders);
            toast.error('Failed to delete order');
        }
    };

    // ── Add Item Modal ────────────────────────────────────────────
    const openAddItemModal = async (orderId) => {
        setMenuSearch('');
        if (menuItems.length === 0) {
            try {
                const data = await getMenu();
                setMenuItems(data);
            } catch (e) {
                toast.error('Failed to load menu');
            }
        }
        setShowAddItemModal(true);
    };

    const addItemToEditing = (menuItem) => {
        setEditingItems(prev => {
            const idx = prev.findIndex(i => i.name === menuItem.name && i.price === menuItem.price);
            if (idx >= 0) {
                return prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { name: menuItem.name, price: menuItem.price, quantity: 1 }];
        });
        setShowAddItemModal(false);
        toast.success(`${menuItem.name} added`);
    };

    const filteredMenu = menuItems.filter(m =>
        m.isAvailable && m.name.toLowerCase().includes(menuSearch.toLowerCase())
    );

    // Filter orders by status for each tab
    // ACTIVE = PREPARING only (timer running)
    // READY orders show in Active too but with "Mark as Served" button (no timer)
    const ordersTab = allOrders.filter(o => o.status === 'PENDING');
    const activeTab_orders = allOrders.filter(o => ['PREPARING', 'READY'].includes(o.status));
    const dispatchedTab = allOrders.filter(o => o.status === 'SERVED');
    const completedTab = allOrders.filter(o => o.status === 'PAID');

    const getTabConfig = () => {
        return [
            { id: 'ORDERS', label: 'Incoming Orders', count: ordersTab.length, icon: Inbox },
            { id: 'ACTIVE', label: 'Kitchen Orders', count: activeTab_orders.length, icon: ChefHat },
            { id: 'DISPATCHED', label: 'Served Orders', count: dispatchedTab.length, icon: Truck },
            { id: 'COMPLETED', label: 'Closed Bills', count: completedTab.length, icon: Receipt }
        ];
    };

    const getCurrentOrders = () => {
        switch (activeTab) {
            case 'ORDERS': return ordersTab;
            case 'ACTIVE': return activeTab_orders;
            case 'DISPATCHED': return dispatchedTab;
            case 'COMPLETED': return completedTab;
            default: return [];
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'PREPARING': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'READY': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'SERVED': return 'bg-green-50 text-green-700 border-green-200';
            case 'PAID': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'PENDING': return 'Order Received';
            case 'PREPARING': return 'Preparing';
            case 'READY': return 'Ready to Serve';
            case 'SERVED': return 'Served';
            case 'PAID': return 'Closed';
            default: return status;
        }
    };

    const currentOrders = getCurrentOrders();

    // ── JSX ──────────────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-slate-50 font-sans antialiased overflow-hidden">

            {/* ── Add Item Modal ─────────────────────────────────── */}
            <AnimatePresence>
                {showAddItemModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-md rounded-xl shadow-xl border border-slate-200 p-6 max-h-[80vh] flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-semibold text-slate-900">Add Item to Order</h2>
                                <button onClick={() => setShowAddItemModal(false)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"><X size={18} /></button>
                            </div>
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                <input type="text" placeholder="Search menu items..." value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                            </div>
                            <div className="overflow-y-auto flex-1 space-y-1">
                                {filteredMenu.map(item => (
                                    <button key={item._id} onClick={() => addItemToEditing(item)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 rounded-lg transition-colors text-left">
                                        <span className="text-sm font-medium text-slate-800">{item.name}</span>
                                        <span className="text-sm font-semibold text-slate-700">₹{item.price}</span>
                                    </button>
                                ))}
                                {filteredMenu.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No items found</p>}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Delete Confirmation Modal ─────────────────────── */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 p-6 text-center">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={22} className="text-red-600" />
                            </div>
                            <h2 className="text-base font-semibold text-slate-900 mb-1">Delete Order?</h2>
                            <p className="text-sm text-slate-500 mb-5">This order has no items. Remove it completely?</p>
                            <div className="flex gap-2">
                                <button onClick={() => { setShowDeleteModal(false); setDeleteTargetOrderId(null); }}
                                    className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleDeleteOrder}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Prep Time Modal ───────────────────────────────── */}
            <AnimatePresence>
                {showPrepTimeModal && selectedOrderForPrep && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 p-6 relative">
                            <button onClick={() => { setShowPrepTimeModal(false); setSelectedOrderForPrep(null); }}
                                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-md text-slate-500">
                                <X size={18} />
                            </button>
                            <h2 className="text-base font-semibold text-slate-900 mb-1">Set Preparation Time</h2>
                            <p className="text-sm text-slate-500 mb-4">Table {selectedOrderForPrep.tableId} · {selectedOrderForPrep.items.length} items</p>
                            <div className="grid grid-cols-4 gap-2">
                                {[5, 10, 15, 20, 25, 30, 40, 45].map(time => (
                                    <button key={time}
                                        onClick={() => handleStatusUpdate(selectedOrderForPrep._id, 'PREPARING', { prepTime: time })}
                                        className="py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors">
                                        {time}m
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Sidebar ──────────────────────────────────────── */}
            <aside className="w-60 bg-white border-r border-slate-200 flex-col hidden lg:flex shrink-0">
                <div className="px-5 py-6 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <UtensilsCrossed className="text-white w-4 h-4" />
                        </div>
                        <span className="font-bold text-base text-slate-900">Sapphire</span>
                    </div>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    <button className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
                        <LayoutDashboard size={17} /> Dashboard
                    </button>
                    <button onClick={() => navigate('/kitchen')} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-sm font-medium transition-colors">
                        <ChefHat size={17} /> Menu Management
                    </button>
                    <button onClick={() => navigate('/tables')} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-sm font-medium transition-colors">
                        <Grid2x2 size={17} /> Tables
                    </button>
                </nav>
                <div className="px-3 py-4 border-t border-slate-100">
                    <div className="px-3 py-2.5 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500 font-medium">Sapphire Restaurant</p>
                        <p className="text-xs text-slate-400 mt-0.5">Staff Portal</p>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────── */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Topbar */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
                    <div>
                        <h1 className="text-base font-semibold text-slate-900">Order Management</h1>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Live · Updated {lastUpdated.toLocaleTimeString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setAudioEnabled(v => !v)}
                            className={`p-2 rounded-lg border text-sm transition-colors ${audioEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                            title={audioEnabled ? 'Mute alerts' : 'Enable alerts'}>
                            {audioEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
                        </button>
                        <button onClick={() => fetchOrders(false)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
                            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                {/* Tabs */}
                <div className="bg-white border-b border-slate-200 px-6">
                    <div className="flex gap-0 overflow-x-auto scrollbar-hide">
                        {getTabConfig().map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                                    <Icon size={16} />
                                    {tab.label}
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Orders Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && allOrders.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                                    <div className="h-28 bg-slate-100 rounded-lg animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : currentOrders.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <Inbox size={40} className="text-slate-300 mb-3" />
                            <p className="text-sm font-medium text-slate-500">No orders in this section</p>
                            <p className="text-xs text-slate-400 mt-1">Orders will appear here when available</p>
                        </div>
                    ) : (
                        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentOrders.map(order => {
                                const isEditing = editingOrderId === order._id;
                                const isPaid = order.status === 'PAID';
                                const displayItems = isEditing ? editingItems : order.items;
                                const displayTotal = isEditing
                                    ? editingItems.reduce((s, i) => s + i.price * i.quantity, 0)
                                    : order.totalAmount;

                                return (
                                    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        key={order._id}
                                        className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">

                                        {/* Card Header */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <p className="text-xs text-slate-400 font-medium mb-0.5">Table</p>
                                                <p className="text-lg font-bold text-slate-900">Table {order.tableId || '—'}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getStatusBadge(order.status)}`}>
                                                    {getStatusLabel(order.status)}
                                                </span>
                                                {!isPaid && (
                                                    <button
                                                        onClick={() => isEditing ? cancelEditingItems() : startEditingItems(order)}
                                                        className={`p-1.5 rounded-md transition-colors ${isEditing ? 'bg-slate-100 text-slate-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                                                        title={isEditing ? 'Cancel' : 'Edit items'}>
                                                        {isEditing ? <X size={14} /> : <Pencil size={14} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Customer */}
                                        <div className="flex items-center gap-2 mb-4 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                            <User size={14} className="text-slate-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{order.customerName || 'Guest'}</p>
                                                {order.customerPhone && (
                                                    <a href={`tel:${order.customerPhone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                                                        <Phone size={11} />{order.customerPhone}
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* Items */}
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-medium text-slate-500">Items ({displayItems.length})</p>
                                                {isEditing && (
                                                    <button onClick={() => openAddItemModal(order._id)}
                                                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                                                        <Plus size={12} /> Add item
                                                    </button>
                                                )}
                                            </div>
                                            <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto">
                                                {displayItems.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between px-3 py-2 gap-2">
                                                        <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button onClick={() => changeItemQty(idx, -1)}
                                                                    className="w-6 h-6 bg-slate-100 hover:bg-red-100 hover:text-red-600 rounded flex items-center justify-center transition-colors">
                                                                    <Minus size={11} />
                                                                </button>
                                                                <span className="w-5 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                                                                <button onClick={() => changeItemQty(idx, 1)}
                                                                    className="w-6 h-6 bg-slate-100 hover:bg-green-100 hover:text-green-600 rounded flex items-center justify-center transition-colors">
                                                                    <Plus size={11} />
                                                                </button>
                                                                <button onClick={() => removeEditingItem(idx)}
                                                                    className="w-6 h-6 bg-red-50 hover:bg-red-500 hover:text-white text-red-400 rounded flex items-center justify-center transition-colors ml-1">
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 shrink-0 text-sm">
                                                                <span className="text-slate-400">×{item.quantity}</span>
                                                                <span className="font-semibold text-slate-800">₹{item.price * item.quantity}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {displayItems.length === 0 && (
                                                    <p className="text-xs text-slate-400 text-center py-3">No items — add some above</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Total */}
                                        <div className="flex items-center justify-between py-3 border-t border-slate-100 mb-3">
                                            <span className="text-sm text-slate-500">Total</span>
                                            <span className="text-base font-bold text-slate-900">₹{displayTotal}</span>
                                        </div>

                                        {/* Save edits */}
                                        {isEditing && (
                                            <button onClick={() => saveEditedItems(order._id)}
                                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 mb-2">
                                                <CheckCircle size={15} /> Save Changes
                                            </button>
                                        )}

                                        {/* Action Buttons */}
                                        {!isEditing && (
                                            <div className="space-y-2">
                                                {activeTab === 'ORDERS' && order.status === 'PENDING' && (
                                                    <>
                                                        <button onClick={() => handleAcceptOrder(order)}
                                                            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5">
                                                            <CheckCircle size={15} /> Accept Order
                                                        </button>
                                                        <button onClick={() => handleRejectOrder(order._id)}
                                                            className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                                                            <X size={15} /> Reject
                                                        </button>
                                                    </>
                                                )}
                                                {activeTab === 'ACTIVE' && order.status === 'PREPARING' && (
                                                    <>
                                                        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg mb-1">
                                                            <span className="text-xs font-medium text-blue-700 flex items-center gap-1"><Timer size={13} /> Time remaining</span>
                                                            <CountdownTimer estimatedCompletionTime={order.estimatedCompletionTime} currentTime={currentTime} />
                                                        </div>
                                                        <button onClick={() => handleStatusUpdate(order._id, 'READY')}
                                                            className="w-full py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-1.5">
                                                            <Bell size={15} /> Mark Ready
                                                        </button>
                                                    </>
                                                )}
                                                {activeTab === 'ACTIVE' && order.status === 'READY' && (
                                                    <>
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg mb-1">
                                                            <Bell size={14} className="text-amber-600" />
                                                            <p className="text-xs font-medium text-amber-700">Ready to serve</p>
                                                        </div>
                                                        <button onClick={() => handleStatusUpdate(order._id, 'SERVED')}
                                                            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5">
                                                            <Truck size={15} /> Serve to Table
                                                        </button>
                                                    </>
                                                )}
                                                {activeTab === 'DISPATCHED' && order.status === 'SERVED' && (
                                                    <button onClick={() => handleStatusUpdate(order._id, 'PAID')}
                                                        className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5">
                                                        <Receipt size={15} /> Close Bill
                                                    </button>
                                                )}
                                                {activeTab === 'COMPLETED' && order.status === 'PAID' && (
                                                    <div className="w-full py-2.5 bg-slate-50 text-slate-500 rounded-lg text-sm font-medium border border-slate-200 flex items-center justify-center gap-1.5">
                                                        <CheckCircle size={15} className="text-green-500" /> Bill Closed
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </div>
            </main>
        </div>
    );
}
