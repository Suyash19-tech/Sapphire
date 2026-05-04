import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ShoppingBag, Hash, Timer, Bell, ChefHat, Utensils, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOrders } from '../api';
import { io } from 'socket.io-client';
import { getTableId, validateTableId, buildTablePath } from '../utils/tableUtils';

const STATUS_CONFIG = {
    PENDING: { label: 'Order Received', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', step: 0 },
    PREPARING: { label: 'Preparing in Kitchen', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', step: 1 },
    READY: { label: 'Ready to Serve', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', step: 2 },
    SERVED: { label: 'Served to Table', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', step: 3 },
};

const CountdownBlock = ({ order, currentTime }) => {
    const timeLeft = (order.status === 'PREPARING' && order.estimatedCompletionTime)
        ? Math.max(0, new Date(order.estimatedCompletionTime).getTime() - currentTime)
        : 0;
    const remainingSeconds = Math.floor(timeLeft / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const totalSecs = (order.estimatedTime || 15) * 60;
    const progress = totalSecs > 0 ? Math.min(100, (1 - remainingSeconds / totalSecs) * 100) : 100;

    if (order.status === 'PENDING') return (
        <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="w-10 h-10 bg-slate-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Timer size={18} className="text-slate-400" />
            </div>
            <div>
                <p className="text-sm font-semibold text-white">Awaiting confirmation</p>
                <p className="text-xs text-white/40 mt-0.5">Sapphire kitchen will accept shortly</p>
            </div>
        </div>
    );

    if (order.status === 'READY') return (
        <motion.div
            initial={{ scale: 0.97 }} animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
        >
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Bell size={18} className="text-amber-400" />
            </div>
            <div>
                <p className="text-sm font-bold text-amber-300">Your order is ready!</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Please collect from the counter</p>
            </div>
        </motion.div>
    );

    if (order.status === 'SERVED') return (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle size={18} className="text-green-400" />
            </div>
            <div>
                <p className="text-sm font-bold text-green-300">Served to your table</p>
                <p className="text-xs text-green-400/70 mt-0.5">Enjoy your meal!</p>
            </div>
        </div>
    );

    // PREPARING
    return (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ChefHat size={15} className="text-blue-400" />
                    <span className="text-xs font-medium text-blue-300">Estimated ready in</span>
                </div>
                <span className="font-mono text-lg font-bold text-white tabular-nums">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <motion.div className="bg-blue-500 h-full rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1 }} />
            </div>
            <p className="text-xs text-blue-400/60 mt-1.5 text-right">{Math.round(progress)}% complete</p>
        </div>
    );
};

const OrderCard = ({ order, currentTime }) => {
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
    const steps = [
        { label: 'Placed', icon: CheckCircle },
        { label: 'Preparing', icon: ChefHat },
        { label: 'Ready', icon: Bell },
        { label: 'Served', icon: Utensils },
    ];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
        >
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <span className="text-xs text-white/40">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.bg} ${config.color}`}>
                    {config.label}
                </span>
            </div>

            <div className="p-4 space-y-4">
                {/* Progress steps */}
                <div className="flex items-center">
                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        const done = i < config.step;
                        const active = i === config.step;
                        return (
                            <div key={i} className="flex items-center flex-1 last:flex-none">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${done ? 'bg-blue-600' : active ? 'bg-blue-600 ring-2 ring-blue-400/30' : 'bg-white/5 border border-white/10'
                                    }`}>
                                    <Icon size={13} className={done || active ? 'text-white' : 'text-white/20'} />
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={`flex-1 h-px mx-1 ${i < config.step ? 'bg-blue-600' : 'bg-white/10'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

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
};

export default function ActiveOrders() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tableId, setTableId] = useState(null);
    const socketRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const currentTableId = getTableId(searchParams);
        if (!validateTableId(currentTableId, navigate)) return;
        setTableId(currentTableId);
        const fetchOrders = async () => {
            try {
                const data = await getOrders(Number(currentTableId));
                setOrders(data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchOrders();
    }, [searchParams, navigate]);

    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_API_URL);
        return () => { socketRef.current?.disconnect(); };
    }, []);

    useEffect(() => {
        if (!socketRef.current || !tableId) return;
        const updateHandler = (updatedOrder) => {
            if (updatedOrder.tableId !== tableId) return;
            setOrders(prev => {
                if (updatedOrder.status === 'PAID') return prev.filter(o => o._id !== updatedOrder._id);
                const exists = prev.some(o => o._id === updatedOrder._id);
                if (exists) return prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o);
                return [updatedOrder, ...prev];
            });
        };
        const deleteHandler = (id) => setOrders(prev => prev.filter(o => o._id !== id));
        const newOrderHandler = (newOrder) => {
            if (newOrder.tableId === tableId) setOrders(prev => [newOrder, ...prev]);
        };
        socketRef.current.on('user_orderUpdated', updateHandler);
        socketRef.current.on('order_deleted', deleteHandler);
        socketRef.current.on('admin_newOrder', newOrderHandler);
        return () => {
            socketRef.current?.off('user_orderUpdated', updateHandler);
            socketRef.current?.off('order_deleted', deleteHandler);
            socketRef.current?.off('admin_newOrder', newOrderHandler);
        };
    }, [tableId]);

    const liveOrders = orders.filter(o => ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(o.status));

    if (loading) return (
        <main className="min-h-screen bg-[#0F172A] flex justify-center font-sans antialiased">
            <div className="w-full max-w-md p-5 space-y-3 pt-20">
                {[1, 2].map(i => <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />)}
            </div>
        </main>
    );

    return (
        <main className="min-h-screen bg-[#0F172A] flex justify-center font-sans antialiased">
            <div className="w-full max-w-md min-h-screen flex flex-col">

                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#0F172A]/95 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center gap-3">
                    <button onClick={() => navigate(buildTablePath('/menu', tableId))}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-white">Your Orders</h1>
                        <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                            Live Kitchen Updates · {liveOrders.length} active
                        </p>
                    </div>
                    {tableId && (
                        <div className="flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/30 px-3 py-1.5 rounded-xl">
                            <Hash size={13} className="text-blue-400" />
                            <span className="text-xs font-semibold text-blue-300">Table {tableId}</span>
                        </div>
                    )}
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 pb-24">
                    <AnimatePresence>
                        {liveOrders.length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-5">
                                    <ShoppingBag size={26} className="text-white/20" />
                                </div>
                                <p className="text-white/60 font-semibold mb-1">No active orders</p>
                                <p className="text-white/30 text-sm mb-6">Explore our menu and place your first order</p>
                                <button onClick={() => navigate(buildTablePath('/menu', tableId))}
                                    className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30">
                                    <Plus size={15} /> Explore Menu
                                </button>
                            </motion.div>
                        ) : (
                            liveOrders.map(order => (
                                <OrderCard key={order._id} order={order} currentTime={currentTime} />
                            ))
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-[#0F172A]/95 backdrop-blur-xl border-t border-white/5 px-5 py-4">
                    <button onClick={() => navigate(buildTablePath('/menu', tableId))}
                        className="w-full py-3.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-medium hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                        <Utensils size={15} /> Order More
                    </button>
                </div>
            </div>
        </main>
    );
}
