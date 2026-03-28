import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getActiveOrders, updateOrderStatus } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import {
    LayoutDashboard,
    ShoppingBag,
    CheckCircle,
    XCircle,
    Clock,
    ChefHat,
    AlertCircle,
    Eye,
    Search,
    RefreshCw,
    X,
    ExternalLink
} from 'lucide-react';

const CountdownTimer = ({ estimatedCompletionTime, currentTime }) => {
    const timeLeft = estimatedCompletionTime
        ? Math.max(0, new Date(estimatedCompletionTime).getTime() - currentTime)
        : 0;

    const remainingSeconds = Math.floor(timeLeft / 1000);
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    return (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-black text-xl tabular-nums ${remainingSeconds === 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-900 text-white'}`}>
            <Clock size={18} className={remainingSeconds > 0 ? 'animate-pulse' : ''} />
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
    );
};

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showPrepTime, setShowPrepTime] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const socketRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Notification Sound Function using Web Audio API (No external file needed)
    const playNotificationSound = React.useCallback(() => {
        if (!audioEnabled) return;

        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.type = 'sine'; // Clean beep
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (error) {
            console.error('Audio Playback failed:', error);
            // Fallback to HTML5 Audio if context fails
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => { });
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
            const data = await getActiveOrders();
            const sortedData = [...data].sort((a, b) => {
                if (a.status === 'PENDING_VERIFICATION' && b.status !== 'PENDING_VERIFICATION') return -1;
                if (a.status !== 'PENDING_VERIFICATION' && b.status === 'PENDING_VERIFICATION') return 1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            setOrders(sortedData);
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
            setOrders((prev) => [newOrder, ...prev]);
            setLastUpdated(new Date());
            playNotificationSound();
        };

        // Handler for order updates (sync multiple admins + play completion sound)
        const updateHandler = (updatedOrder) => {
            setOrders((prev) => {
                const existing = prev.find(o => o._id === updatedOrder._id);

                // If the status changed to READY or COMPLETED, play the "Ping"
                if (existing && existing.status !== updatedOrder.status) {
                    if (['READY', 'COMPLETED'].includes(updatedOrder.status)) {
                        playNotificationSound();
                    }
                }

                // If COMPLETED or REJECTED, remove from active list
                if (['COMPLETED', 'REJECTED'].includes(updatedOrder.status)) {
                    return prev.filter(o => o._id !== updatedOrder._id);
                }

                // Otherwise update the object
                return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
            });
            setLastUpdated(new Date());
        };

        socketRef.current.on('admin_newOrder', newOrderHandler);
        socketRef.current.on('user_orderUpdated', updateHandler);

        return () => {
            socketRef.current?.off('admin_newOrder', newOrderHandler);
            socketRef.current?.off('user_orderUpdated', updateHandler);
        };
    }, [playNotificationSound]);

    const handleStatusUpdate = async (orderId, newStatus, extraData = {}) => {
        const originalOrders = [...orders];
        const orderIndex = originalOrders.findIndex(o => o._id === orderId);
        if (orderIndex === -1) return;

        // Optimistically update UI
        let updatedOrders;
        if (newStatus === 'COMPLETED' || newStatus === 'REJECTED') {
            updatedOrders = originalOrders.filter(o => o._id !== orderId);
        } else {
            updatedOrders = originalOrders.map(o => {
                if (o._id === orderId) {
                    const updatedOrder = { ...o, status: newStatus };
                    if (newStatus === 'PREPARING' && extraData.prepTime) {
                        updatedOrder.estimatedTime = extraData.prepTime;
                        updatedOrder.estimatedCompletionTime = new Date(Date.now() + extraData.prepTime * 60000);
                    }
                    return updatedOrder;
                }
                return o;
            });
        }

        setOrders(updatedOrders);
        setSelectedOrder(null);
        setShowPrepTime(false);

        try {
            await updateOrderStatus(orderId, newStatus, extraData);
            // Success is silent, as the UI has already updated.
        } catch (error) {
            // Revert on failure
            setOrders(originalOrders);
            toast.error('Network Error: Update Failed. Please try again.');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PENDING_VERIFICATION': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'PREPARING': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'READY': return 'bg-green-50 text-green-700 border-green-200';
            default: return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans antialiased overflow-hidden relative">
            <AnimatePresence>
                {selectedOrder && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden relative"
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => { setSelectedOrder(null); setShowPrepTime(false); }}
                                className="absolute top-6 right-6 z-10 p-3 bg-white/80 backdrop-blur-md text-slate-900 rounded-2xl hover:bg-slate-100 transition-all shadow-lg"
                            >
                                <X size={24} />
                            </button>

                            {/* Screenshot Section */}
                            <div className="flex-1 bg-slate-100 relative group overflow-hidden">
                                <img
                                    src={selectedOrder.paymentScreenshot}
                                    alt="Payment Screenshot"
                                    className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Expected Total</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">₹{selectedOrder.totalAmount}</p>
                                    </div>
                                    <button
                                        onClick={() => window.open(selectedOrder.paymentScreenshot, '_blank')}
                                        className="p-3 bg-slate-900 text-white rounded-xl hover:bg-orange-600 transition-all"
                                    >
                                        <ExternalLink size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Details & Actions Section */}
                            <div className="w-full md:w-[400px] p-8 flex flex-col bg-white">
                                <div className="mb-8">
                                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Action Required</p>
                                    <h2 className="text-3xl font-black text-slate-900 mt-1">Token #{selectedOrder.user?.tokenNumber || 'N/A'}</h2>
                                    <p className="text-slate-400 text-sm font-medium mt-2">Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                                </div>

                                {/* Customer Details */}
                                <div className="mb-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Customer Details</h3>
                                    <div className="space-y-1">
                                        <p className="text-base font-black text-slate-900">{selectedOrder.user?.name || 'Unknown'}</p>
                                        {selectedOrder.user?.phone && (
                                            <a
                                                href={`tel:${selectedOrder.user.phone}`}
                                                className="text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
                                            >
                                                {selectedOrder.user.phone}
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 space-y-6 overflow-y-auto pr-2 scrollbar-hide">
                                    <div>
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Order Summary</h3>
                                        <div className="space-y-3 bg-slate-50 rounded-3xl p-6">
                                            {selectedOrder.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center">
                                                    <span className="text-sm font-bold text-slate-700">{item.name} x {item.qty}</span>
                                                    <span className="text-sm font-black text-slate-900">₹{item.price * item.qty}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedOrder.cookingInstructions && (
                                        <div>
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Instructions</h3>
                                            <div className="bg-orange-50 text-orange-700 p-5 rounded-3xl text-sm font-medium leading-relaxed border border-orange-100">
                                                {selectedOrder.cookingInstructions}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Area */}
                                <div className="mt-8 pt-8 border-t border-slate-100">
                                    {!showPrepTime ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => handleStatusUpdate(selectedOrder._id, 'REJECTED')}
                                                className="bg-red-50 text-red-600 py-5 rounded-[2rem] font-black text-sm hover:bg-red-100 transition-transform transform active:scale-95 flex flex-col items-center gap-2"
                                            >
                                                <XCircle size={24} /> Reject
                                            </button>
                                            <button
                                                onClick={() => setShowPrepTime(true)}
                                                className="bg-green-500 text-white py-5 rounded-[2rem] font-black text-sm shadow-2xl shadow-green-200 hover:bg-green-600 transition-transform transform active:scale-95 flex flex-col items-center gap-2"
                                            >
                                                <CheckCircle size={24} /> Verify & Accept
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="animate-in slide-in-from-bottom-4 duration-300">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Select Prep Time</h3>
                                                <button onClick={() => setShowPrepTime(false)} className="text-slate-400 hover:text-slate-900 font-bold text-xs uppercase">Back</button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                {[5, 10, 15, 20, 25, 30, 45].map(time => (
                                                    <button
                                                        key={time}
                                                        onClick={() => handleStatusUpdate(selectedOrder._id, 'PREPARING', { prepTime: time })}
                                                        className="bg-slate-50 border border-slate-100 py-4 rounded-2xl font-black text-slate-700 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-transform transform active:scale-90"
                                                    >
                                                        {time}m
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
                <div className="p-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500 p-2 rounded-xl shadow-lg shadow-orange-200">
                            <ShoppingBag className="text-white w-5 h-5" />
                        </div>
                        <span className="font-black text-xl tracking-tight text-slate-800">CampusCraves</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <button className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 transition-all">
                        <LayoutDashboard size={20} /> Dashboard
                    </button>
                    <button onClick={() => navigate('/kitchen')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-bold text-sm transition-transform transform">
                        <ChefHat size={20} /> Kitchen
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100 mt-auto">
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Access</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">Gwalior Canteen</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Topbar */}
                <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Active Orders</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Live Updates • Last updated: {lastUpdated.toLocaleTimeString()}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={audioEnabled}
                                    onChange={(e) => setAudioEnabled(e.target.checked)}
                                    className="accent-orange-500 w-4 h-4 rounded"
                                />
                                Audio Alerts
                            </label>
                            {audioEnabled && (
                                <button
                                    onClick={playNotificationSound}
                                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-orange-500"
                                    title="Test Notification Sound"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search Token #"
                                className="bg-slate-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium w-64 focus:ring-2 focus:ring-slate-200 transition-all"
                            />
                        </div>
                        <button
                            onClick={fetchOrders}
                            className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-transform transform text-slate-600"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                {/* Orders Grid */}
                <div className="flex-1 overflow-y-auto p-8">
                    {loading && orders.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="space-y-2">
                                            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse"></div>
                                            <div className="h-8 w-32 bg-slate-200 rounded animate-pulse"></div>
                                        </div>
                                        <div className="h-8 w-24 bg-slate-200 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="space-y-3 mb-6">
                                        <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                                        <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                                    </div>
                                    <div className="h-12 w-full bg-slate-200 rounded-xl animate-pulse"></div>
                                </div>
                            ))}
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <ShoppingBag size={64} className="mb-4" />
                            <h3 className="text-xl font-bold text-slate-900">No active orders</h3>
                            <p className="text-sm font-medium">All orders have been completed or rejected.</p>
                        </div>
                    ) : (
                        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {orders.map((order) => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    key={order._id}
                                    onClick={() => order.status === 'PENDING_VERIFICATION' && setSelectedOrder(order)}
                                    className={`bg-white border rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 relative overflow-hidden group ${order.status === 'PENDING_VERIFICATION' ? 'border-amber-400 ring-4 ring-amber-50 cursor-pointer scale-[1.01]' : 'border-slate-100 opacity-90'
                                        }`}
                                >
                                    {/* Order Header */}
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Token Number</p>
                                            <h3 className="text-2xl font-black text-slate-900">#{order.user?.tokenNumber || 'N/A'}</h3>
                                        </div>
                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </div>
                                    </div>

                                    {/* Customer Details */}
                                    <div className="mb-6 p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 group-hover:bg-white transition-colors duration-300">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                                        <p className="text-sm font-black text-slate-900 leading-tight">{order.user?.name || 'Unknown'}</p>
                                        {order.user?.phone && (
                                            <a
                                                href={`tel:${order.user.phone}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1 mt-1"
                                            >
                                                {order.user.phone}
                                            </a>
                                        )}
                                    </div>

                                    {/* Order Items */}
                                    <div className="space-y-3 mb-6">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Items ({order.items.length})</p>
                                        <div className="bg-slate-50 rounded-2xl p-4 max-h-40 overflow-y-auto">
                                            {order.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0 border-b border-slate-200 last:border-none">
                                                    <span className="text-sm font-bold text-slate-700">{item.name} x {item.qty}</span>
                                                    <span className="text-sm font-black text-slate-900">₹{item.price * item.qty}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Footer Details */}
                                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount</p>
                                            <p className="text-xl font-black text-slate-900">₹{order.totalAmount}</p>
                                        </div>
                                        {order.status === 'PENDING_VERIFICATION' && (
                                            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 animate-pulse">
                                                <AlertCircle size={20} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions for Non-Pending Orders */}
                                    {order.status !== 'PENDING_VERIFICATION' && (
                                        <div className="mt-6 space-y-4">
                                            {order.status === 'PREPARING' && (
                                                <>
                                                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Left</p>
                                                        <CountdownTimer estimatedCompletionTime={order.estimatedCompletionTime} currentTime={currentTime} />
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order._id, 'READY'); }}
                                                        className="w-full bg-blue-500 text-white py-4 rounded-[1.5rem] font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <ChefHat size={18} /> Mark as Ready
                                                    </button>
                                                </>
                                            )}
                                            {order.status === 'READY' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order._id, 'COMPLETED'); }}
                                                    className="w-full bg-green-500 text-white py-4 rounded-[1.5rem] font-black text-sm shadow-lg shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle size={18} /> Complete Order
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </main>
        </div>
    );
}
