import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle, ShoppingBag, Timer, Bell,
    ChefHat, Utensils, Plus, Clock, Package, History, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCustomerOrders } from '../api';
import { io } from 'socket.io-client';
// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
    PENDING: { label: 'Order Received', step: 0, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
    PREPARING: { label: 'Preparing', step: 1, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    READY: { label: 'Ready for Pickup', step: 2, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    PAID: { label: 'Collected & Paid', step: 3, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    SCHEDULED: { label: 'Scheduled', step: 0, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
};

const STEPS = [
    { label: 'Placed', Icon: CheckCircle },
    { label: 'Preparing', Icon: ChefHat },
    { label: 'Ready', Icon: Bell },
    { label: 'Paid', Icon: Package },
];

// ── Countdown block ───────────────────────────────────────────────────────────
function CountdownBlock({ order, currentTime }) {
    const cfg = STATUS[order.status] || STATUS.PENDING;

    if (order.status === 'PENDING') return (
        <div className="flex items-center gap-3 p-3.5 bg-white/5 border border-white/10 rounded-xl">
            <div className="w-9 h-9 bg-slate-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Timer size={16} className="text-slate-400" />
            </div>
            <div>
                <p className="text-sm font-semibold text-white">Awaiting confirmation</p>
                <p className="text-xs text-white/40 mt-0.5">Kitchen will accept shortly</p>
            </div>
        </div>
    );

    if (order.status === 'SCHEDULED') {
        const timeUntil = order.scheduledFor
            ? Math.max(0, new Date(order.scheduledFor).getTime() - currentTime)
            : 0;
        const totalSecs = Math.floor(timeUntil / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return (
            <div className="p-3.5 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-violet-400" />
                        <span className="text-xs font-medium text-violet-300">Sends to kitchen in</span>
                    </div>
                    <span className="font-mono text-base font-bold text-white tabular-nums">
                        {hrs > 0 && `${String(hrs).padStart(2, '0')}:`}{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                    </span>
                </div>
                {order.scheduledFor && (
                    <p className="text-xs text-violet-400/60">
                        Scheduled for {new Date(order.scheduledFor).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                )}
            </div>
        );
    }

    if (order.status === 'READY') return (
        <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-3 p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl"
        >
            <div className="w-9 h-9 bg-amber-500/25 rounded-xl flex items-center justify-center shrink-0">
                <Bell size={16} className="text-amber-400" />
            </div>
            <div>
                <p className="text-sm font-bold text-amber-300">Your order is ready!</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Please collect from the counter</p>
            </div>
        </motion.div>
    );

    if (order.status === 'PAID') return (
        <div className="flex items-center gap-3 p-3.5 bg-green-500/10 border border-green-500/30 rounded-xl">
            <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle size={16} className="text-green-400" />
            </div>
            <div>
                <p className="text-sm font-bold text-green-300">Collected &amp; paid</p>
                <p className="text-xs text-green-400/70 mt-0.5">Enjoy your meal!</p>
            </div>
        </div>
    );

    // PREPARING — countdown
    const timeLeft = order.estimatedCompletionTime
        ? Math.max(0, new Date(order.estimatedCompletionTime).getTime() - currentTime)
        : 0;
    const remainingSeconds = Math.floor(timeLeft / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const totalSecs = (order.estimatedTime || 15) * 60;
    const progress = totalSecs > 0 ? Math.min(100, (1 - remainingSeconds / totalSecs) * 100) : 100;

    return (
        <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                    <ChefHat size={13} className="text-blue-400" />
                    <span className="text-xs font-medium text-blue-300">Ready in</span>
                </div>
                <span className="font-mono text-lg font-bold text-white tabular-nums">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <motion.div className="bg-blue-500 h-full rounded-full"
                    animate={{ width: `${progress}%` }} transition={{ duration: 1 }} />
            </div>
            <p className="text-xs text-blue-400/50 mt-1.5 text-right">{Math.round(progress)}% complete</p>
        </div>
    );
}

// ── Single order card ─────────────────────────────────────────────────────────
function OrderCard({ order, currentTime, isHistory, isFlashing, cardRef }) {
    const cfg = STATUS[order.status] || STATUS.PENDING;
    const isReady = order.status === 'READY';

    return (
        <motion.div
            ref={cardRef}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl overflow-hidden border transition-all duration-300 ${isFlashing
                ? 'bg-amber-500/10 border-amber-400 shadow-xl shadow-amber-500/30'
                : isReady
                    ? 'bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/10'
                    : 'bg-white/5 border-white/10'
                }`}>

            {/* READY banner */}
            {isReady && (
                <motion.div
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
                    <Bell size={14} className="text-amber-400 shrink-0" />
                    <p className="text-xs font-bold text-amber-300 tracking-wide">
                        YOUR ORDER IS READY — PLEASE COLLECT FROM THE COUNTER
                    </p>
                </motion.div>
            )}

            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <span className="text-xs text-white/40">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {new Date(order.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                </span>
            </div>

            <div className="p-4 space-y-3.5">
                {/* Progress steps — only for active orders */}
                {!isHistory && (
                    <div className="flex items-center">
                        {STEPS.map((step, i) => {
                            const { Icon } = step;
                            const done = i < cfg.step;
                            const active = i === cfg.step;
                            return (
                                <div key={i} className="flex items-center flex-1 last:flex-none">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${done ? 'bg-blue-600' :
                                        active ? 'bg-blue-600 ring-2 ring-blue-400/30' :
                                            'bg-white/5 border border-white/10'
                                        }`}>
                                        <Icon size={13} className={done || active ? 'text-white' : 'text-white/20'} />
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`flex-1 h-px mx-1 ${i < cfg.step ? 'bg-blue-600' : 'bg-white/10'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Status block */}
                <CountdownBlock order={order} currentTime={currentTime} />

                {/* Items */}
                <div>
                    <p className="text-xs font-medium text-white/40 mb-2">Items ({order.items.length})</p>
                    <div className="bg-white/3 border border-white/5 rounded-xl divide-y divide-white/5">
                        {order.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2.5">
                                <span className="text-sm text-white/80">{item.name}</span>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-white/30">×{item.quantity}</span>
                                    <span className="font-semibold text-white">₹{item.price * item.quantity}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-sm text-white/40">Total</span>
                    <span className="text-base font-bold text-white">₹{order.totalAmount}</span>
                </div>
            </div>
        </motion.div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ActiveOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('active'); // 'active' | 'history'
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [flashId, setFlashId] = useState(null); // order id to flash/highlight
    const socketRef = useRef(null);
    const orderRefs = useRef({});  // map of orderId → DOM ref for scroll

    const customer = JSON.parse(localStorage.getItem('customer') || '{}');

    // Tick every second for countdowns
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // Redirect if not logged in
    useEffect(() => {
        if (!customer._id) navigate('/login', { replace: true });
    }, [customer._id, navigate]);

    // Initial fetch
    useEffect(() => {
        if (!customer._id) return;
        (async () => {
            try {
                const data = await getCustomerOrders(customer._id);
                setOrders(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer._id]);

    // Socket — real-time updates
    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_API_URL);
        return () => { socketRef.current?.disconnect(); };
    }, []);

    useEffect(() => {
        if (!socketRef.current || !customer._id) return;

        const onUpdate = (updated) => {
            if (String(updated.customerId) !== String(customer._id)) return;
            setOrders(prev => {
                if (updated.deleted) return prev.filter(o => o._id !== updated._id);
                const exists = prev.some(o => o._id === updated._id);
                if (exists) return prev.map(o => o._id === updated._id ? { ...o, ...updated } : o);
                return [updated, ...prev];
            });
        };
        const onDelete = (id) => setOrders(prev => prev.filter(o => o._id !== id));
        const onNew = (order) => {
            if (String(order.customerId) !== String(customer._id)) return;
            // Only add if not already in state (prevents duplicate when scheduler promotes SCHEDULED → PENDING)
            setOrders(prev => {
                if (prev.some(o => o._id === order._id)) return prev;
                return [order, ...prev];
            });
        };
        // order_ready: switch to active tab, flash the card
        const onReady = (order) => {
            if (String(order.customerId) !== String(customer._id)) return;
            // Vibrate on mobile — 3 strong pulses to get attention
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
            setTab('active');
            setFlashId(order._id);
            // Clear flash after 4 s
            setTimeout(() => setFlashId(null), 4000);
            // Scroll to the card after a short render delay
            setTimeout(() => {
                orderRefs.current[order._id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        };

        socketRef.current.on('user_orderUpdated', onUpdate);
        socketRef.current.on('order_deleted', onDelete);
        socketRef.current.on('admin_newOrder', onNew);
        socketRef.current.on('order_ready', onReady);
        return () => {
            socketRef.current?.off('user_orderUpdated', onUpdate);
            socketRef.current?.off('order_deleted', onDelete);
            socketRef.current?.off('admin_newOrder', onNew);
            socketRef.current?.off('order_ready', onReady);
        };
    }, [customer._id]);

    // Split orders
    const activeOrders = orders.filter(o => ['PENDING', 'PREPARING', 'READY', 'SCHEDULED'].includes(o.status));
    const historyOrders = orders.filter(o => o.status === 'PAID');
    const readyCount = activeOrders.filter(o => o.status === 'READY').length;

    const displayOrders = tab === 'active' ? activeOrders : historyOrders;

    if (loading) return (
        <main className="min-h-screen bg-[#0F172A] flex justify-center font-sans antialiased">
            <div className="w-full max-w-md p-5 space-y-3 pt-20">
                {[1, 2].map(i => <div key={i} className="h-52 bg-white/5 rounded-2xl animate-pulse" />)}
            </div>
        </main>
    );

    return (
        <main className="min-h-screen bg-[#0F172A] flex justify-center font-sans antialiased">
            <div className="w-full max-w-md min-h-screen flex flex-col">

                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#0F172A]/95 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center gap-3">
                    <button onClick={() => navigate('/menu')}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-white">My Orders</h1>
                        <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                            Live Updates · {activeOrders.length} active
                        </p>
                    </div>
                    <div className="bg-blue-600/20 border border-blue-500/30 px-3 py-1.5 rounded-xl">
                        <span className="text-xs font-semibold text-blue-300">{customer.name}</span>
                    </div>
                </header>

                {/* READY alert banner */}
                <AnimatePresence>
                    {readyCount > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden">
                            <motion.div
                                animate={{ opacity: [1, 0.7, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="mx-5 mt-4 flex items-center gap-3 p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl">
                                <div className="w-9 h-9 bg-amber-500/25 rounded-xl flex items-center justify-center shrink-0">
                                    <Bell size={18} className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-amber-300">
                                        {readyCount === 1 ? 'Your order is ready!' : `${readyCount} orders are ready!`}
                                    </p>
                                    <p className="text-xs text-amber-400/70 mt-0.5">Please collect from the counter</p>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tabs */}
                <div className="flex gap-2 px-5 pt-4 pb-1">
                    <button onClick={() => setTab('active')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'active'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                            : 'bg-white/5 text-white/50 hover:text-white/80 border border-white/10'
                            }`}>
                        <Clock size={14} />
                        Active
                        {activeOrders.length > 0 && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${tab === 'active' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
                                {activeOrders.length}
                            </span>
                        )}
                    </button>
                    <button onClick={() => setTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'history'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                            : 'bg-white/5 text-white/50 hover:text-white/80 border border-white/10'
                            }`}>
                        <History size={14} />
                        History
                        {historyOrders.length > 0 && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${tab === 'history' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
                                {historyOrders.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Orders list */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-28">
                    <AnimatePresence mode="wait">
                        {displayOrders.length === 0 ? (
                            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-5">
                                    {tab === 'active'
                                        ? <ShoppingBag size={26} className="text-white/20" />
                                        : <History size={26} className="text-white/20" />
                                    }
                                </div>
                                <p className="text-white/60 font-semibold mb-1">
                                    {tab === 'active' ? 'No active orders' : 'No order history yet'}
                                </p>
                                <p className="text-white/30 text-sm mb-6">
                                    {tab === 'active' ? 'Place an order to track it here' : 'Completed orders will appear here'}
                                </p>
                                {tab === 'active' && (
                                    <button onClick={() => navigate('/menu')}
                                        className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30">
                                        <Plus size={15} /> Browse Menu
                                    </button>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="space-y-4">
                                {displayOrders.map(order => (
                                    <OrderCard
                                        key={order._id}
                                        order={order}
                                        currentTime={currentTime}
                                        isHistory={tab === 'history'}
                                        isFlashing={flashId === order._id}
                                        cardRef={el => { orderRefs.current[order._id] = el; }}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer CTA */}
                <div className="sticky bottom-0 bg-[#0F172A]/95 backdrop-blur-xl border-t border-white/5 px-5 py-4">
                    <button onClick={() => navigate('/menu')}
                        className="w-full py-3.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-medium hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                        <Utensils size={15} /> Order More
                    </button>
                </div>
            </div>
        </main>
    );
}
