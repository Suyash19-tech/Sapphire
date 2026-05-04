import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getOrders, updateOrderStatus, updateOrderItems, deleteOrder, getMenu, getAnalytics, getItemAnalytics, getTrend, getPeakHours } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import {
    LayoutDashboard, UtensilsCrossed, CheckCircle, ChefHat,
    Inbox, RefreshCw, X, Receipt, Plus, Minus, Trash2,
    Pencil, Search, Bell, Volume2, VolumeX, Phone, User, Timer,
    TrendingUp, IndianRupee, ShoppingBag, BarChart2, Calendar, Award, Clock
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
    const [activeTab, setActiveTab] = useState('PENDING');
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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetOrderId, setDeleteTargetOrderId] = useState(null);

    // Analytics state
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsDate, setAnalyticsDate] = useState('');  // legacy single-date (unused in new UI)

    // Shared date range filter — drives all three analytics panels
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');

    // Item performance state
    const [itemData, setItemData] = useState(null);
    const [itemLoading, setItemLoading] = useState(false);
    const [itemPeriod, setItemPeriod] = useState('30d'); // '7d' | '30d' | 'all'

    // Trend chart state
    const [trendData, setTrendData] = useState(null);
    const [trendLoading, setTrendLoading] = useState(false);
    const [trendPeriod, setTrendPeriod] = useState('7d');
    const [hoveredDay, setHoveredDay] = useState(null);
    const [trendView, setTrendView] = useState('revenue'); // 'revenue' | 'orders'

    // Peak hours state
    const [itemView, setItemView] = useState('quantity'); // 'quantity' | 'revenue'
    const [peakData, setPeakData] = useState(null);
    const [peakLoading, setPeakLoading] = useState(false);
    const [peakPeriod, setPeakPeriod] = useState('30d');
    const [hoveredHour, setHoveredHour] = useState(null);

    const playNotificationSound = React.useCallback(() => {
        // Vibrate on mobile — single pulse for new order
        if (navigator.vibrate) navigator.vibrate(120);

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
        if (isInitialLoad) setLoading(true);
        try {
            const data = await getOrders();
            setAllOrders(data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    }, []);

    useEffect(() => { fetchOrders(true); }, [fetchOrders]);

    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_API_URL);
        return () => { socketRef.current?.disconnect(); socketRef.current = null; };
    }, []);

    useEffect(() => {
        if (!socketRef.current) return;
        const newOrderHandler = (newOrder) => {
            setAllOrders(prev => {
                // If already in state (e.g. was SCHEDULED, now promoted to PENDING),
                // update it rather than adding a duplicate
                if (prev.some(o => o._id === newOrder._id)) {
                    return prev.map(o => o._id === newOrder._id ? newOrder : o);
                }
                return [newOrder, ...prev];
            });
            setLastUpdated(new Date());
            playNotificationSound();
        };
        const updateHandler = (updatedOrder) => {
            setAllOrders(prev => {
                const existing = prev.find(o => o._id === updatedOrder._id);
                if (existing && existing.status !== updatedOrder.status) {
                    if (updatedOrder.status === 'READY') playNotificationSound();
                }
                const orderExists = prev.some(o => o._id === updatedOrder._id);
                if (orderExists) return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
                return [updatedOrder, ...prev];
            });
            setLastUpdated(new Date());
        };
        const deleteHandler = (deletedOrderId) => {
            setAllOrders(prev => prev.filter(o => o._id !== deletedOrderId));
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
        setShowPrepTimeModal(false);
        setSelectedOrderForPrep(null);
        try {
            const result = await updateOrderStatus(orderId, newStatus, extraData);
            setAllOrders(prev => prev.map(o => o._id === orderId ? { ...o, ...result } : o));
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

    const startEditingItems = (order) => {
        setEditingOrderId(order._id);
        setEditingItems(order.items.map(i => ({ ...i })));
    };
    const cancelEditingItems = () => { setEditingOrderId(null); setEditingItems([]); };
    const changeItemQty = (idx, delta) => {
        setEditingItems(prev =>
            prev.map((item, i) => i !== idx ? item : { ...item, quantity: item.quantity + delta })
                .filter(item => item.quantity > 0)
        );
    };
    const removeEditingItem = (idx) => {
        const updated = editingItems.filter((_, i) => i !== idx);
        if (updated.length === 0) { setDeleteTargetOrderId(editingOrderId); setShowDeleteModal(true); }
        else setEditingItems(updated);
    };
    const saveEditedItems = async (orderId) => {
        if (editingItems.length === 0) { setDeleteTargetOrderId(orderId); setShowDeleteModal(true); return; }
        const originalOrders = [...allOrders];
        const newTotal = editingItems.reduce((s, i) => s + i.price * i.quantity, 0);
        setAllOrders(prev => prev.map(o => o._id === orderId ? { ...o, items: editingItems, totalAmount: newTotal } : o));
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
        setShowDeleteModal(false); setDeleteTargetOrderId(null);
        setEditingOrderId(null); setEditingItems([]);
        const originalOrders = [...allOrders];
        setAllOrders(prev => prev.filter(o => o._id !== orderId));
        try { await deleteOrder(orderId); toast.success('Order deleted'); }
        catch (error) { setAllOrders(originalOrders); toast.error('Failed to delete order'); }
    };
    const openAddItemModal = async () => {
        setMenuSearch('');
        if (menuItems.length === 0) {
            try { const data = await getMenu(); setMenuItems(data); }
            catch (e) { toast.error('Failed to load menu'); }
        }
        setShowAddItemModal(true);
    };
    const addItemToEditing = (menuItem) => {
        setEditingItems(prev => {
            const idx = prev.findIndex(i => i.name === menuItem.name && i.price === menuItem.price);
            if (idx >= 0) return prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item);
            return [...prev, { name: menuItem.name, price: menuItem.price, quantity: 1 }];
        });
        setShowAddItemModal(false);
        toast.success(`${menuItem.name} added`);
    };
    const filteredMenu = menuItems.filter(m => m.isAvailable && m.name.toLowerCase().includes(menuSearch.toLowerCase()));

    // Fetch analytics
    const fetchAnalytics = React.useCallback(async (date = '', start = '', end = '') => {
        setAnalyticsLoading(true);
        try {
            const data = await getAnalytics(date || null, start || null, end || null);
            setAnalytics(data);
        } catch (e) { toast.error('Failed to load analytics'); }
        finally { setAnalyticsLoading(false); }
    }, []);

    // Fetch item performance
    const fetchItemAnalytics = React.useCallback(async (period = '30d', start = '', end = '') => {
        setItemLoading(true);
        try {
            const data = await getItemAnalytics(period, 10, start || null, end || null);
            setItemData(data);
        } catch (e) { toast.error('Failed to load item analytics'); }
        finally { setItemLoading(false); }
    }, []);

    // Fetch trend
    const fetchTrend = React.useCallback(async (period = '7d', start = '', end = '') => {
        setTrendLoading(true);
        try {
            const data = await getTrend(period, start || null, end || null);
            setTrendData(data);
        } catch (e) { toast.error('Failed to load trend data'); }
        finally { setTrendLoading(false); }
    }, []);

    // Fetch peak hours
    const fetchPeakHours = React.useCallback(async (period = '30d', start = '', end = '') => {
        setPeakLoading(true);
        try {
            const data = await getPeakHours(period, start || null, end || null);
            setPeakData(data);
        } catch (e) { toast.error('Failed to load peak hours'); }
        finally { setPeakLoading(false); }
    }, []);

    // Apply date range — refreshes all panels at once
    const applyDateRange = React.useCallback((start, end) => {
        setAnalytics(null); setItemData(null); setTrendData(null); setPeakData(null);
        setHoveredDay(null); setHoveredHour(null);
        fetchAnalytics('', start, end);
        fetchItemAnalytics(itemPeriod, start, end);
        fetchTrend(trendPeriod, start, end);
        fetchPeakHours(peakPeriod, start, end);
    }, [fetchAnalytics, fetchItemAnalytics, fetchTrend, fetchPeakHours, itemPeriod, trendPeriod, peakPeriod]);

    const clearDateRange = React.useCallback(() => {
        setRangeStart(''); setRangeEnd('');
        setAnalytics(null); setItemData(null); setTrendData(null); setPeakData(null);
        setHoveredDay(null); setHoveredHour(null);
        fetchAnalytics(); fetchItemAnalytics(itemPeriod); fetchTrend(trendPeriod); fetchPeakHours(peakPeriod);
    }, [fetchAnalytics, fetchItemAnalytics, fetchTrend, fetchPeakHours, itemPeriod, trendPeriod, peakPeriod]);

    // Load analytics when switching to ANALYTICS tab
    useEffect(() => {
        if (activeTab === 'ANALYTICS' && !analytics) fetchAnalytics('', rangeStart, rangeEnd);
        if (activeTab === 'ANALYTICS' && !itemData) fetchItemAnalytics(itemPeriod, rangeStart, rangeEnd);
        if (activeTab === 'ANALYTICS' && !trendData) fetchTrend(trendPeriod, rangeStart, rangeEnd);
        if (activeTab === 'ANALYTICS' && !peakData) fetchPeakHours(peakPeriod, rangeStart, rangeEnd);
    }, [activeTab, analytics, itemData, trendData, peakData, fetchAnalytics, fetchItemAnalytics, fetchTrend, fetchPeakHours, itemPeriod, trendPeriod, peakPeriod, rangeStart, rangeEnd]);

    // 5 sections (including SCHEDULED)
    const scheduledOrders = allOrders.filter(o => o.status === 'SCHEDULED');
    const pendingOrders = allOrders.filter(o => o.status === 'PENDING');
    const preparingOrders = allOrders.filter(o => o.status === 'PREPARING');
    const readyOrders = allOrders.filter(o => o.status === 'READY');
    const paidOrders = allOrders.filter(o => o.status === 'PAID');

    const TABS = [
        { id: 'SCHEDULED', label: 'Scheduled', count: scheduledOrders.length, icon: Calendar, accent: 'violet' },
        { id: 'PENDING', label: 'Incoming', count: pendingOrders.length, icon: Inbox, accent: 'orange' },
        { id: 'PREPARING', label: 'Preparing', count: preparingOrders.length, icon: ChefHat, accent: 'blue' },
        { id: 'READY', label: 'Ready', count: readyOrders.length, icon: Bell, accent: 'amber' },
        { id: 'PAID', label: 'Completed', count: paidOrders.length, icon: Receipt, accent: 'green' },
        { id: 'ANALYTICS', label: 'Analytics', count: null, icon: TrendingUp, accent: 'purple' },
    ];

    const getCurrentOrders = () => {
        switch (activeTab) {
            case 'SCHEDULED': return scheduledOrders;
            case 'PENDING': return pendingOrders;
            case 'PREPARING': return preparingOrders;
            case 'READY': return readyOrders;
            case 'PAID': return paidOrders;
            default: return [];
        }
    };

    const TAB_STYLES = {
        SCHEDULED: { badge: 'bg-violet-100 text-violet-700', status: 'bg-violet-50 text-violet-700 border-violet-200' },
        PENDING: { badge: 'bg-orange-100 text-orange-700', status: 'bg-orange-50 text-orange-700 border-orange-200' },
        PREPARING: { badge: 'bg-blue-100 text-blue-700', status: 'bg-blue-50 text-blue-700 border-blue-200' },
        READY: { badge: 'bg-amber-100 text-amber-700', status: 'bg-amber-50 text-amber-700 border-amber-200' },
        PAID: { badge: 'bg-green-100 text-green-700', status: 'bg-green-50 text-green-700 border-green-200' },
    };

    const STATUS_LABELS = {
        SCHEDULED: 'Scheduled',
        PENDING: 'Order Received',
        PREPARING: 'Preparing',
        READY: 'Ready for Pickup',
        PAID: 'Completed',
    };

    const currentOrders = getCurrentOrders();

    return (
        <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen bg-slate-50 font-sans antialiased lg:overflow-hidden">

            {/* Add Item Modal */}
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
                                        <span className="text-sm font-semibold text-slate-700">&#8377;{item.price}</span>
                                    </button>
                                ))}
                                {filteredMenu.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No items found</p>}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
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
                                    className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                                <button onClick={handleDeleteOrder}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Prep Time Modal */}
            <AnimatePresence>
                {showPrepTimeModal && selectedOrderForPrep && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 p-6 relative">
                            <button onClick={() => { setShowPrepTimeModal(false); setSelectedOrderForPrep(null); }}
                                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-md text-slate-500"><X size={18} /></button>
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-slate-900 mb-1">Set Preparation Time</h2>
                                <p className="text-sm text-slate-500">{selectedOrderForPrep.customerName} &middot; {selectedOrderForPrep.items.length} items</p>
                            </div>
                            {/* Customer info in modal */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
                                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                    <User size={14} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{selectedOrderForPrep.customerName || 'Guest'}</p>
                                    {selectedOrderForPrep.customerPhone && (
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Phone size={10} />{selectedOrderForPrep.customerPhone}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 lg:gap-2">
                                {[5, 10, 15, 20, 25, 30, 40, 45].map(time => (
                                    <button key={time}
                                        onClick={() => handleStatusUpdate(selectedOrderForPrep._id, 'PREPARING', { prepTime: time })}
                                        className="py-4 lg:py-3 bg-slate-50 border border-slate-200 rounded-lg text-base lg:text-sm font-semibold text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 active:bg-blue-700 active:text-white transition-colors">
                                        {time}m
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sidebar */}
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
                </nav>
                {/* Section counts in sidebar */}
                <div className="px-3 py-4 border-t border-slate-100 space-y-1">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <span className="flex items-center gap-2"><Icon size={14} />{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${TAB_STYLES[tab.id].badge}`}>{tab.count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Topbar */}
                <header className="h-14 lg:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
                    <div>
                        <h1 className="text-sm lg:text-base font-semibold text-slate-900">Order Management</h1>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Live &middot; Updated {lastUpdated.toLocaleTimeString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/kitchen')} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors lg:hidden" title="Menu Management"><ChefHat size={17} /></button>
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
                <div className="bg-white border-b border-slate-200 px-2 lg:px-6">
                    <div className="flex gap-0 overflow-x-auto scrollbar-hide">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 lg:px-4 py-3 lg:py-3.5 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
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

                {/* Orders Grid / Analytics Panel */}
                <div className="flex-1 overflow-y-auto p-3 lg:p-6">
                    {/* ── Analytics Panel ── */}
                    {activeTab === 'ANALYTICS' ? (
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Date Range Filter */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Calendar size={15} className="text-slate-500" />
                                    <span className="text-sm font-semibold text-slate-700">Date Range Filter</span>
                                    {(rangeStart || rangeEnd) && (
                                        <span className="ml-auto text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                                            Custom range active
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                                        <label className="text-xs text-slate-400 shrink-0">From</label>
                                        <input
                                            type="date"
                                            value={rangeStart}
                                            max={rangeEnd || undefined}
                                            onChange={e => setRangeStart(e.target.value)}
                                            className="flex-1 text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 bg-slate-50"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                                        <label className="text-xs text-slate-400 shrink-0">To</label>
                                        <input
                                            type="date"
                                            value={rangeEnd}
                                            min={rangeStart || undefined}
                                            onChange={e => setRangeEnd(e.target.value)}
                                            className="flex-1 text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 bg-slate-50"
                                        />
                                    </div>
                                    <button
                                        onClick={() => rangeStart && rangeEnd && applyDateRange(rangeStart, rangeEnd)}
                                        disabled={!rangeStart || !rangeEnd || analyticsLoading}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw size={13} className={analyticsLoading ? 'animate-spin' : ''} />
                                        Apply
                                    </button>
                                    {(rangeStart || rangeEnd) && (
                                        <button
                                            onClick={clearDateRange}
                                            className="px-3 py-2 text-sm text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg bg-white transition-colors flex items-center gap-1.5"
                                        >
                                            <X size={13} /> Clear
                                        </button>
                                    )}
                                </div>
                                {/* Quick presets */}
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                                    <span className="text-xs text-slate-400">Quick:</span>
                                    {[
                                        { label: 'Today', days: 0 },
                                        { label: 'Last 7d', days: 6 },
                                        { label: 'Last 30d', days: 29 },
                                        { label: 'This month', days: -1 },
                                    ].map(({ label, days }) => (
                                        <button
                                            key={label}
                                            onClick={() => {
                                                const end = new Date();
                                                end.setHours(23, 59, 59, 999);
                                                let start;
                                                if (days === -1) {
                                                    start = new Date(end.getFullYear(), end.getMonth(), 1);
                                                } else {
                                                    start = new Date(end);
                                                    start.setDate(start.getDate() - days);
                                                }
                                                start.setHours(0, 0, 0, 0);
                                                const s = start.toISOString().split('T')[0];
                                                const e = end.toISOString().split('T')[0];
                                                setRangeStart(s);
                                                setRangeEnd(e);
                                                applyDateRange(s, e);
                                            }}
                                            className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {analytics && (
                                    <p className="text-xs text-slate-400 mt-2">
                                        Showing: <span className="font-medium text-slate-600">{analytics.from || analytics.date}</span>
                                        {analytics.to && analytics.to !== analytics.from && <> → <span className="font-medium text-slate-600">{analytics.to}</span></>}
                                    </p>
                                )}
                            </div>

                            {analyticsLoading && !analytics ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                                    {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
                                </div>
                            ) : analytics ? (
                                <>
                                    {/* Revenue cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                                        {[
                                            { label: "Today's Revenue", value: analytics.todaySales, orders: analytics.todayOrders, icon: IndianRupee, color: 'blue' },
                                            { label: 'Weekly Revenue', value: analytics.weeklySales, orders: analytics.weeklyOrders, icon: BarChart2, color: 'violet' },
                                            { label: 'Monthly Revenue', value: analytics.monthlySales, orders: analytics.monthlyOrders, icon: TrendingUp, color: 'green' },
                                        ].map(({ label, value, orders, icon: Icon, color }) => (
                                            <motion.div
                                                key={label}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <p className="text-xs font-medium text-slate-500">{label}</p>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${color}-50`}>
                                                        <Icon size={15} className={`text-${color}-600`} />
                                                    </div>
                                                </div>
                                                <p className="text-2xl font-bold text-slate-900">₹{value.toLocaleString('en-IN')}</p>
                                                <p className="text-xs text-slate-400 mt-1">{orders} order{orders !== 1 ? 's' : ''} completed</p>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Average Order Value row */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                                        {[
                                            { label: 'Avg Order — Today', aov: analytics.todayAOV, orders: analytics.todayOrders },
                                            { label: 'Avg Order — Weekly', aov: analytics.weeklyAOV, orders: analytics.weeklyOrders },
                                            { label: 'Avg Order — Monthly', aov: analytics.monthlyAOV, orders: analytics.monthlyOrders },
                                        ].map(({ label, aov, orders }) => (
                                            <motion.div
                                                key={label}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3"
                                            >
                                                <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                                                    <ShoppingBag size={15} className="text-slate-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] text-slate-400 font-medium truncate">{label}</p>
                                                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                                                        {orders > 0 ? `₹${aov.toLocaleString('en-IN')}` : '—'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">per order · {orders} total</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Revenue & Order Count Trend Chart */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                                        {/* Header row */}
                                        <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-800">
                                                    {trendView === 'revenue' ? 'Revenue Trend' : 'Daily Order Count'}
                                                </h3>
                                                {trendData && (
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {trendData.from} → {trendData.to}
                                                        {trendView === 'revenue' && trendData.peakDay?.total > 0 && (
                                                            <> · Peak: <span className="text-blue-600 font-medium">₹{trendData.peakDay.total.toLocaleString('en-IN')}</span> on {trendData.peakDay.date}</>
                                                        )}
                                                        {trendView === 'orders' && trendData.peakDay?.orders > 0 && (
                                                            <> · Peak: <span className="text-violet-600 font-medium">{trendData.peakDay.orders} orders</span> on {trendData.peakDay.date}</>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* View toggle */}
                                                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-1">
                                                    <button onClick={() => setTrendView('revenue')}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${trendView === 'revenue' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                        <IndianRupee size={11} /> Revenue
                                                    </button>
                                                    <button onClick={() => setTrendView('orders')}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${trendView === 'orders' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                        <ShoppingBag size={11} /> Orders
                                                    </button>
                                                </div>
                                                {/* Period toggle */}
                                                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-1">
                                                    {[{ id: '7d', label: '7d' }, { id: '30d', label: '30d' }].map(p => (
                                                        <button key={p.id}
                                                            onClick={() => { setTrendPeriod(p.id); setTrendData(null); setHoveredDay(null); fetchTrend(p.id, rangeStart, rangeEnd); }}
                                                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${trendPeriod === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Hover info bar */}
                                        <div className="h-8 flex items-center mb-2">
                                            {hoveredDay ? (
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="font-semibold text-slate-700">{hoveredDay.date}</span>
                                                    {trendView === 'revenue' ? (
                                                        <>
                                                            <span className="text-blue-600 font-bold">₹{hoveredDay.total.toLocaleString('en-IN')}</span>
                                                            <span className="text-slate-400">{hoveredDay.orders} order{hoveredDay.orders !== 1 ? 's' : ''}</span>
                                                            {hoveredDay.aov > 0 && <span className="text-slate-400">· AOV ₹{hoveredDay.aov}</span>}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-violet-600 font-bold">{hoveredDay.orders} order{hoveredDay.orders !== 1 ? 's' : ''}</span>
                                                            {hoveredDay.total > 0 && <span className="text-slate-400">· ₹{hoveredDay.total.toLocaleString('en-IN')}</span>}
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">Hover a bar to see details</span>
                                            )}
                                        </div>

                                        {trendLoading ? (
                                            <div className="h-36 flex items-end gap-1">
                                                {Array.from({ length: trendPeriod === '7d' ? 7 : 30 }).map((_, i) => (
                                                    <div key={i} className="flex-1 bg-slate-100 rounded-t animate-pulse" style={{ height: `${20 + Math.random() * 60}%` }} />
                                                ))}
                                            </div>
                                        ) : trendData?.trend?.length > 0 ? (
                                            <>
                                                {/* Y-axis + bars */}
                                                <div className="flex gap-2">
                                                    <div className="flex flex-col justify-between text-right pr-1 shrink-0" style={{ height: 144 }}>
                                                        {(() => {
                                                            const max = trendView === 'revenue'
                                                                ? Math.max(...trendData.trend.map(d => d.total), 1)
                                                                : Math.max(...trendData.trend.map(d => d.orders), 1);
                                                            return [max, Math.round(max / 2), 0].map((v, i) => (
                                                                <span key={i} className="text-[9px] text-slate-400 leading-none">
                                                                    {trendView === 'revenue'
                                                                        ? (v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`)
                                                                        : v}
                                                                </span>
                                                            ));
                                                        })()}
                                                    </div>
                                                    <div className="flex-1 flex items-end gap-0.5" style={{ height: 144 }}>
                                                        {(() => {
                                                            const isRev = trendView === 'revenue';
                                                            const max = isRev
                                                                ? Math.max(...trendData.trend.map(d => d.total), 1)
                                                                : Math.max(...trendData.trend.map(d => d.orders), 1);
                                                            const today = new Date().toISOString().split('T')[0];
                                                            const peakVal = isRev
                                                                ? trendData.peakDay?.total
                                                                : trendData.peakDay?.orders;
                                                            return trendData.trend.map((day, i) => {
                                                                const val = isRev ? day.total : day.orders;
                                                                const pct = Math.max(val > 0 ? 3 : 0, (val / max) * 100);
                                                                const isToday = day.date === today;
                                                                const isHov = hoveredDay?.date === day.date;
                                                                const isPeak = val === peakVal && val > 0;
                                                                const base = isRev ? 'bg-blue' : 'bg-violet';
                                                                return (
                                                                    <div key={i}
                                                                        className="flex-1 flex flex-col justify-end cursor-pointer group"
                                                                        style={{ height: '100%' }}
                                                                        onMouseEnter={() => setHoveredDay(day)}
                                                                        onMouseLeave={() => setHoveredDay(null)}
                                                                    >
                                                                        <motion.div
                                                                            key={`${trendView}-${day.date}`}
                                                                            initial={{ height: 0 }}
                                                                            animate={{ height: `${pct}%` }}
                                                                            transition={{ duration: 0.4, delay: i * 0.015 }}
                                                                            className={`w-full rounded-t transition-colors ${isHov ? (isRev ? 'bg-blue-500' : 'bg-violet-500') :
                                                                                isPeak ? (isRev ? 'bg-blue-600' : 'bg-violet-600') :
                                                                                    isToday ? (isRev ? 'bg-blue-600' : 'bg-violet-600') :
                                                                                        val > 0 ? (isRev ? 'bg-blue-300 group-hover:bg-blue-400' : 'bg-violet-300 group-hover:bg-violet-400') :
                                                                                            'bg-slate-100'
                                                                                }`}
                                                                        />
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                                {/* X-axis labels */}
                                                <div className="flex gap-0.5 mt-1 pl-8">
                                                    {trendData.trend.map((day, i) => {
                                                        const total = trendData.trend.length;
                                                        const step = total <= 7 ? 1 : total <= 14 ? 2 : 5;
                                                        const show = i % step === 0 || i === total - 1;
                                                        return (
                                                            <div key={i} className="flex-1 text-center">
                                                                {show && (
                                                                    <span className="text-[8px] text-slate-400">
                                                                        {new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', total <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {/* Summary row */}
                                                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                                                    <div>
                                                        <p className="text-[10px] text-slate-400">Total Revenue</p>
                                                        <p className="text-sm font-bold text-slate-800">₹{trendData.totalRevenue.toLocaleString('en-IN')}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-slate-400">Total Orders</p>
                                                        <p className="text-sm font-bold text-slate-800">{trendData.totalOrders}</p>
                                                    </div>
                                                    {trendData.totalOrders > 0 && (
                                                        <div>
                                                            <p className="text-[10px] text-slate-400">
                                                                {trendView === 'revenue' ? 'Avg Rev / Day' : 'Avg Orders / Day'}
                                                            </p>
                                                            <p className="text-sm font-bold text-slate-800">
                                                                {trendView === 'revenue'
                                                                    ? `₹${Math.round(trendData.totalRevenue / trendData.trend.length).toLocaleString('en-IN')}`
                                                                    : Math.round(trendData.totalOrders / trendData.trend.length)
                                                                }
                                                            </p>
                                                        </div>
                                                    )}
                                                    {trendData.peakDay?.total > 0 && (
                                                        <div className="ml-auto text-right">
                                                            <p className="text-[10px] text-slate-400">Peak Day</p>
                                                            <p className={`text-sm font-bold ${trendView === 'revenue' ? 'text-blue-600' : 'text-violet-600'}`}>
                                                                {trendView === 'revenue'
                                                                    ? `₹${trendData.peakDay.total.toLocaleString('en-IN')}`
                                                                    : `${trendData.peakDay.orders} orders`
                                                                }
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="h-36 flex flex-col items-center justify-center text-center">
                                                <BarChart2 size={28} className="text-slate-300 mb-2" />
                                                <p className="text-sm text-slate-400">No data for this period</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Item Performance — Quantity & Revenue */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                                        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <Award size={16} className="text-amber-500" />
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-800">
                                                        {itemView === 'quantity' ? 'Top Items by Quantity' : 'Revenue per Item'}
                                                    </h3>
                                                    {itemData && (
                                                        <p className="text-xs text-slate-400 mt-0.5">{itemData.from} → {itemData.to}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* View toggle */}
                                                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-1">
                                                    <button onClick={() => setItemView('quantity')}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${itemView === 'quantity' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                        <ShoppingBag size={11} /> Qty
                                                    </button>
                                                    <button onClick={() => setItemView('revenue')}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${itemView === 'revenue' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                        <IndianRupee size={11} /> Revenue
                                                    </button>
                                                </div>
                                                {/* Period toggle */}
                                                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-1">
                                                    {[{ id: '7d', label: '7d' }, { id: '30d', label: '30d' }, { id: 'all', label: 'All' }].map(p => (
                                                        <button key={p.id}
                                                            onClick={() => { setItemPeriod(p.id); setItemData(null); fetchItemAnalytics(p.id, rangeStart, rangeEnd); }}
                                                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${itemPeriod === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {itemLoading ? (
                                            <div className="space-y-3">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <div key={i} className="flex items-center gap-3">
                                                        <div className="w-5 h-5 bg-slate-100 rounded-full animate-pulse shrink-0" />
                                                        <div className="flex-1 space-y-1.5">
                                                            <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                                                            <div className="h-1.5 bg-slate-100 rounded-full animate-pulse" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : itemData?.items?.length > 0 ? (() => {
                                            // Sort by the active view metric
                                            const sorted = [...itemData.items].sort((a, b) =>
                                                itemView === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity
                                            );
                                            const maxVal = sorted[0]
                                                ? (itemView === 'revenue' ? sorted[0].revenue : sorted[0].quantity)
                                                : 1;
                                            return (
                                                <>
                                                    {/* Column headers */}
                                                    <div className="flex items-center gap-3 mb-2 px-1">
                                                        <span className="w-5 shrink-0" />
                                                        <span className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 text-right">
                                                            {itemView === 'revenue' ? 'Revenue' : 'Qty Sold'}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16 text-right">
                                                            {itemView === 'revenue' ? 'Qty' : 'Revenue'}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {sorted.map((item, i) => {
                                                            const val = itemView === 'revenue' ? item.revenue : item.quantity;
                                                            const secVal = itemView === 'revenue' ? item.quantity : item.revenue;
                                                            const pct = (val / maxVal) * 100;
                                                            const medal = ['🥇', '🥈', '🥉'][i] ?? null;
                                                            const barColor = itemView === 'revenue'
                                                                ? (i === 0 ? 'bg-green-500' : 'bg-green-400')
                                                                : (i === 0 ? 'bg-amber-500' : 'bg-blue-500');
                                                            return (
                                                                <motion.div
                                                                    key={`${itemView}-${item.name}`}
                                                                    initial={{ opacity: 0, x: -8 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: i * 0.04 }}
                                                                    className="flex items-center gap-3"
                                                                >
                                                                    {/* Rank */}
                                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' :
                                                                        i === 1 ? 'bg-slate-200 text-slate-600' :
                                                                            i === 2 ? 'bg-orange-100 text-orange-600' :
                                                                                'bg-slate-50 text-slate-400'
                                                                        }`}>
                                                                        {medal ?? i + 1}
                                                                    </span>
                                                                    {/* Bar + name */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-sm font-medium text-slate-800 truncate block mb-1">{item.name}</span>
                                                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                                            <motion.div
                                                                                key={`bar-${itemView}-${item.name}`}
                                                                                className={`h-full rounded-full ${barColor}`}
                                                                                initial={{ width: 0 }}
                                                                                animate={{ width: `${pct}%` }}
                                                                                transition={{ duration: 0.5, delay: i * 0.04 }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    {/* Primary metric */}
                                                                    <span className={`text-sm font-bold w-20 text-right tabular-nums ${itemView === 'revenue' ? 'text-green-700' : 'text-slate-700'}`}>
                                                                        {itemView === 'revenue'
                                                                            ? `₹${val.toLocaleString('en-IN')}`
                                                                            : val.toLocaleString()
                                                                        }
                                                                    </span>
                                                                    {/* Secondary metric */}
                                                                    <span className="text-xs text-slate-400 w-16 text-right tabular-nums">
                                                                        {itemView === 'revenue'
                                                                            ? secVal.toLocaleString()
                                                                            : `₹${secVal.toLocaleString('en-IN')}`
                                                                        }
                                                                    </span>
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                    {/* Summary */}
                                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs">
                                                        <div>
                                                            <p className="text-[10px] text-slate-400">Total Revenue</p>
                                                            <p className="text-sm font-bold text-green-700">
                                                                ₹{sorted.reduce((s, i) => s + i.revenue, 0).toLocaleString('en-IN')}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-slate-400">Total Qty Sold</p>
                                                            <p className="text-sm font-bold text-slate-800">
                                                                {sorted.reduce((s, i) => s + i.quantity, 0).toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <div className="ml-auto text-right">
                                                            <p className="text-[10px] text-slate-400">Top {itemView === 'revenue' ? 'earner' : 'seller'}</p>
                                                            <p className={`text-sm font-bold truncate max-w-[120px] ${itemView === 'revenue' ? 'text-green-700' : 'text-amber-600'}`}>
                                                                {sorted[0]?.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })() : (
                                            <div className="py-8 text-center">
                                                <ShoppingBag size={28} className="text-slate-300 mx-auto mb-2" />
                                                <p className="text-sm text-slate-400">No sales data for this period</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Peak Hours Chart */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-800">Peak Hours</h3>
                                                {peakData && peakData.peakHour?.orders > 0 && (
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Busiest: <span className="text-blue-600 font-semibold">{peakData.peakHour.label}</span> · {peakData.peakHour.orders} orders
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                                {[{ id: '7d', label: '7 Days' }, { id: '30d', label: '30 Days' }, { id: 'all', label: 'All Time' }].map(p => (
                                                    <button key={p.id}
                                                        onClick={() => { setPeakPeriod(p.id); setPeakData(null); setHoveredHour(null); fetchPeakHours(p.id, rangeStart, rangeEnd); }}
                                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${peakPeriod === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                        {p.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Hover info */}
                                        <div className="h-7 flex items-center mb-2">
                                            {hoveredHour ? (
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="font-semibold text-slate-700">{hoveredHour.label}</span>
                                                    <span className="text-blue-600 font-bold">{hoveredHour.orders} order{hoveredHour.orders !== 1 ? 's' : ''}</span>
                                                    {hoveredHour.revenue > 0 && <span className="text-slate-400">· ₹{hoveredHour.revenue.toLocaleString('en-IN')}</span>}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">Hover a bar to see details</span>
                                            )}
                                        </div>

                                        {peakLoading ? (
                                            <div className="h-32 flex items-end gap-0.5">
                                                {Array.from({ length: 24 }).map((_, i) => (
                                                    <div key={i} className="flex-1 bg-slate-100 rounded-t animate-pulse" style={{ height: `${15 + Math.random() * 70}%` }} />
                                                ))}
                                            </div>
                                        ) : peakData?.hours?.length > 0 ? (
                                            <>
                                                <div className="flex gap-2">
                                                    {/* Y labels */}
                                                    <div className="flex flex-col justify-between text-right pr-1 shrink-0" style={{ height: 128 }}>
                                                        {(() => {
                                                            const max = Math.max(...peakData.hours.map(h => h.orders), 1);
                                                            return [max, Math.round(max / 2), 0].map((v, i) => (
                                                                <span key={i} className="text-[9px] text-slate-400 leading-none">{v}</span>
                                                            ));
                                                        })()}
                                                    </div>
                                                    {/* Bars */}
                                                    <div className="flex-1 flex items-end gap-0.5" style={{ height: 128 }}>
                                                        {(() => {
                                                            const max = Math.max(...peakData.hours.map(h => h.orders), 1);
                                                            const peakH = peakData.peakHour?.hour;
                                                            return peakData.hours.map((h, i) => {
                                                                const pct = Math.max(h.orders > 0 ? 3 : 0, (h.orders / max) * 100);
                                                                const isPeak = h.hour === peakH && h.orders > 0;
                                                                const isHov = hoveredHour?.hour === h.hour;
                                                                return (
                                                                    <div key={i}
                                                                        className="flex-1 flex flex-col justify-end cursor-pointer"
                                                                        style={{ height: '100%' }}
                                                                        onMouseEnter={() => setHoveredHour(h)}
                                                                        onMouseLeave={() => setHoveredHour(null)}
                                                                    >
                                                                        <motion.div
                                                                            initial={{ height: 0 }}
                                                                            animate={{ height: `${pct}%` }}
                                                                            transition={{ duration: 0.35, delay: i * 0.01 }}
                                                                            className={`w-full rounded-t transition-colors ${isHov ? 'bg-blue-500' :
                                                                                isPeak ? 'bg-amber-500' :
                                                                                    h.orders > 0 ? 'bg-blue-300 hover:bg-blue-400' :
                                                                                        'bg-slate-100'
                                                                                }`}
                                                                        />
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                                {/* X labels — every 3 hours */}
                                                <div className="flex gap-0.5 mt-1 pl-7">
                                                    {peakData.hours.map((h, i) => (
                                                        <div key={i} className="flex-1 text-center">
                                                            {i % 3 === 0 && (
                                                                <span className="text-[8px] text-slate-400">{h.label.replace(' ', '')}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Legend */}
                                                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-3 h-3 rounded-sm bg-amber-500" />
                                                        <span className="text-slate-500">Peak hour</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-3 h-3 rounded-sm bg-blue-300" />
                                                        <span className="text-slate-500">Active hours</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
                                                        <span className="text-slate-500">No orders</span>
                                                    </div>
                                                    {peakData.peakHour?.orders > 0 && (
                                                        <span className="ml-auto text-slate-400">
                                                            Peak: <span className="font-semibold text-amber-600">{peakData.peakHour.label}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="h-32 flex flex-col items-center justify-center text-center">
                                                <Clock size={28} className="text-slate-300 mb-2" />
                                                <p className="text-sm text-slate-400">No order data for this period</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center text-center">
                                    <TrendingUp size={36} className="text-slate-300 mb-3" />
                                    <p className="text-sm text-slate-500">No analytics data yet</p>
                                    <p className="text-xs text-slate-400 mt-1">Complete some orders to see revenue insights</p>
                                </div>
                            )}
                        </div>
                    ) : loading && allOrders.length === 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                                    <div className="h-28 bg-slate-100 rounded-lg animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : currentOrders.length === 0 ? (
                        <motion.div
                            key={`empty-${activeTab}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25 }}
                            className="h-full flex flex-col items-center justify-center text-center py-20"
                        >
                            {/* Tab-specific illustration */}
                            {activeTab === 'SCHEDULED' && (
                                <div className="w-20 h-20 bg-violet-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                                    <Calendar size={36} className="text-violet-400" />
                                </div>
                            )}
                            {activeTab === 'PENDING' && (
                                <div className="w-20 h-20 bg-orange-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                                    <Inbox size={36} className="text-orange-400" />
                                </div>
                            )}
                            {activeTab === 'PREPARING' && (
                                <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                                    <ChefHat size={36} className="text-blue-400" />
                                </div>
                            )}
                            {activeTab === 'READY' && (
                                <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                                    <Bell size={36} className="text-amber-400" />
                                </div>
                            )}
                            {activeTab === 'PAID' && (
                                <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                                    <Receipt size={36} className="text-green-400" />
                                </div>
                            )}
                            <p className="text-base font-semibold text-slate-600 mb-1">
                                {activeTab === 'SCHEDULED' && 'No scheduled orders'}
                                {activeTab === 'PENDING' && 'No incoming orders'}
                                {activeTab === 'PREPARING' && 'Nothing in preparation'}
                                {activeTab === 'READY' && 'No orders ready yet'}
                                {activeTab === 'PAID' && 'No completed orders'}
                            </p>
                            <p className="text-sm text-slate-400 max-w-xs">
                                {activeTab === 'SCHEDULED' && 'Scheduled orders will appear here when customers book ahead.'}
                                {activeTab === 'PENDING' && 'New orders will appear here instantly when customers place them.'}
                                {activeTab === 'PREPARING' && 'Accept an incoming order to start preparing it.'}
                                {activeTab === 'READY' && 'Mark a preparing order as ready when it\'s done.'}
                                {activeTab === 'PAID' && 'Completed orders will show up here after payment.'}
                            </p>
                        </motion.div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2 }}
                                layout
                                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4"
                            >
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
                                            className="bg-white border border-slate-200 rounded-xl p-4 lg:p-5 hover:shadow-md transition-shadow flex flex-col">

                                            {/* Card Header */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                                        <User size={16} className="text-blue-600" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 truncate">{order.customerName || 'Guest'}</p>
                                                        {order.customerPhone ? (
                                                            <a href={`tel:${order.customerPhone}`}
                                                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                                                                <Phone size={10} />{order.customerPhone}
                                                            </a>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 mt-0.5">No phone</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${TAB_STYLES[order.status]?.status || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {STATUS_LABELS[order.status] || order.status}
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

                                            {/* Order time */}
                                            <p className="text-xs text-slate-400 mb-3">
                                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {' · '}
                                                {new Date(order.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                            </p>

                                            {/* Items */}
                                            <div className="mb-4 flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-medium text-slate-500">Items ({displayItems.length})</p>
                                                    {isEditing && (
                                                        <button onClick={() => openAddItemModal()}
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
                                                                    <span className="text-slate-400">x{item.quantity}</span>
                                                                    <span className="font-semibold text-slate-800">&#8377;{item.price * item.quantity}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {displayItems.length === 0 && (
                                                        <p className="text-xs text-slate-400 text-center py-3">No items</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Total */}
                                            <div className="flex items-center justify-between py-3 border-t border-slate-100 mb-3">
                                                <span className="text-sm text-slate-500">Total</span>
                                                <span className="text-base font-bold text-slate-900">&#8377;{displayTotal}</span>
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

                                                    {/* SCHEDULED: show time + accept early + cancel */}
                                                    {order.status === 'SCHEDULED' && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-lg">
                                                                <Calendar size={14} className="text-violet-600 shrink-0" />
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-violet-700">Scheduled for</p>
                                                                    <p className="text-xs text-violet-600 font-mono">
                                                                        {order.scheduledFor
                                                                            ? new Date(order.scheduledFor).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                                            : '—'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleStatusUpdate(order._id, 'PENDING')}
                                                                className="w-full py-3 lg:py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-1.5">
                                                                <CheckCircle size={15} /> Accept Now (Skip Wait)
                                                            </button>
                                                            <button onClick={() => handleRejectOrder(order._id)}
                                                                className="w-full py-3 lg:py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 active:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                                                                <X size={15} /> Cancel Scheduled Order
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* PENDING: Accept / Reject */}
                                                    {order.status === 'PENDING' && (
                                                        <>
                                                            <button onClick={() => handleAcceptOrder(order)}
                                                                className="w-full py-3 lg:py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-1.5">
                                                                <CheckCircle size={15} /> Accept &amp; Set Time
                                                            </button>
                                                            <button onClick={() => handleRejectOrder(order._id)}
                                                                className="w-full py-3 lg:py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 active:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                                                                <X size={15} /> Reject Order
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* PREPARING: timer + Mark Ready */}
                                                    {order.status === 'PREPARING' && (
                                                        <>
                                                            <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                                                                <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
                                                                    <Timer size={13} /> Time remaining
                                                                </span>
                                                                <CountdownTimer estimatedCompletionTime={order.estimatedCompletionTime} currentTime={currentTime} />
                                                            </div>
                                                            <button onClick={() => handleStatusUpdate(order._id, 'READY')}
                                                                className="w-full py-3 lg:py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 active:bg-amber-700 transition-colors flex items-center justify-center gap-1.5">
                                                                <Bell size={15} /> Mark Ready &amp; Notify Customer
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* READY: waiting banner + Collected & Paid */}
                                                    {order.status === 'READY' && (
                                                        <>
                                                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                                                                <Bell size={14} className="text-amber-600 shrink-0 animate-pulse" />
                                                                <p className="text-xs font-medium text-amber-700">Waiting for customer to collect</p>
                                                            </div>
                                                            <button onClick={() => handleStatusUpdate(order._id, 'PAID')}
                                                                className="w-full py-3 lg:py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center gap-1.5">
                                                                <Receipt size={15} /> Collected &amp; Paid
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* PAID: read-only */}
                                                    {order.status === 'PAID' && (
                                                        <div className="w-full py-2.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200 flex items-center justify-center gap-1.5">
                                                            <CheckCircle size={15} /> Order Complete
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </main>
        </div>
    );
}
