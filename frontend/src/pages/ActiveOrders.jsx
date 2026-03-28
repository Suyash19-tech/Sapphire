import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock, AlertCircle, CheckCircle2, Circle, UtensilsCrossed, Flame, ShoppingBag, Loader2, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { getMyOrders } from '../api';
import { io } from 'socket.io-client';

export default function ActiveOrders() {
    const navigate = useNavigate();
    const location = useLocation();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [tokenNumber, setTokenNumber] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) {
            setTokenNumber(storedUser.tokenNumber);
        }

        const fetchOrders = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }
            try {
                const data = await getMyOrders(token);
                setOrders(data);
            } catch (error) {
                console.error('Failed to fetch orders:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_API_URL, { transports: ['websocket'] });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!socketRef.current) return;

        const handler = (updatedOrder) => {
            // Check if updatedOrder.user.tokenNumber matches the current logged-in user's token number
            const storedUser = JSON.parse(localStorage.getItem('user'));
            if (storedUser && updatedOrder.user && updatedOrder.user.tokenNumber === storedUser.tokenNumber) {
                setOrders(prevOrders => {
                    return prevOrders.map(order => {
                        if (order._id === updatedOrder._id) {
                            return {
                                ...order,
                                status: updatedOrder.status,
                                estimatedCompletionTime: updatedOrder.estimatedCompletionTime
                            };
                        }
                        return order;
                    });
                });
            }
        };

        socketRef.current.on('user_orderUpdated', handler);
        return () => {
            socketRef.current?.off('user_orderUpdated', handler);
        };
    }, []);

    useEffect(() => {
        const latestOrder = orders[0];
        if (!latestOrder || latestOrder.status !== 'PREPARING' || !latestOrder.estimatedCompletionTime) {
            setRemainingSeconds(0);
            return;
        }

        const timer = setInterval(() => {
            const end = new Date(latestOrder.estimatedCompletionTime).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, Math.floor((end - now) / 1000));
            setRemainingSeconds(diff);
        }, 1000);

        return () => clearInterval(timer);
    }, [orders]);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    // For progress, we'll assume a default of 15 mins if estimatedTime is missing, or use estimatedTime
    const totalTimeSeconds = (orders[0]?.estimatedTime || 15) * 60;
    const progress = Math.min(100, (remainingSeconds / totalTimeSeconds) * 100);

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 flex justify-center font-sans antialiased">
                <div className="w-full max-w-md bg-white shadow-2xl min-h-screen relative flex flex-col overflow-hidden pb-20">
                    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
                        <div className="px-6 py-6 flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse"></div>
                            <div className="space-y-2">
                                <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
                                <div className="h-3 w-20 bg-slate-200 rounded animate-pulse"></div>
                            </div>
                        </div>
                    </header>
                    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
                        <div className="h-24 bg-slate-200 rounded-3xl animate-pulse"></div>
                        <div className="space-y-4">
                            <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
                            <div className="h-64 bg-slate-200 rounded-3xl animate-pulse"></div>
                        </div>
                        <div className="space-y-4">
                            <div className="h-8 w-32 bg-slate-200 rounded animate-pulse"></div>
                            <div className="h-32 bg-slate-200 rounded-3xl animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    const latestOrder = orders[0]; // For demo, show most recent

    return (
        <main className="min-h-screen bg-slate-50 flex justify-center font-sans antialiased overflow-x-hidden">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="w-full max-w-md bg-white shadow-2xl min-h-screen relative flex flex-col overflow-hidden pb-20"
            >

                {/* Header */}
                <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
                    <div className="px-6 py-6 flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all active:scale-90"
                        >
                            <ArrowLeft size={20} className="text-slate-800" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Track Order</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {latestOrder ? `Token #${latestOrder.user?.tokenNumber || '...'}` : 'No active orders'}
                            </p>
                        </div>
                    </div>
                </header>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
                    {/* Token Badge */}
                    {tokenNumber && (
                        <div className="bg-orange-500 rounded-3xl p-6 shadow-xl shadow-orange-100 flex items-center justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-xl" />
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-orange-100 uppercase tracking-[0.2em] mb-1">Your Permanent Token</p>
                                <h2 className="text-3xl font-black text-white tracking-tight">#{tokenNumber}</h2>
                            </div>
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <Hash size={24} className="text-white" />
                            </div>
                        </div>
                    )}

                    {!latestOrder ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <ShoppingBag size={48} className="text-slate-200 mb-4" />
                            <h3 className="text-slate-900 font-bold">No active orders</h3>
                            <p className="text-slate-400 text-sm mt-1">Place an order to see it here!</p>
                        </div>
                    ) : (
                        <>
                            {/* Status Tracking Steps */}
                            <div className="relative">
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100" />
                                <div className="space-y-8 relative">
                                    <div className="flex items-center gap-4 group">
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-100 relative z-10">
                                            <CheckCircle2 size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 leading-none">Order Placed</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                {new Date(latestOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`flex items-center gap-4 group ${latestOrder.status === 'PENDING_VERIFICATION' ? 'opacity-40' : ''}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white relative z-10 ${latestOrder.status !== 'PENDING_VERIFICATION' ? 'bg-orange-500 shadow-lg shadow-orange-100 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                            <Flame size={16} fill="currentColor" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 leading-none">Preparing Food</p>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${latestOrder.status !== 'PENDING_VERIFICATION' ? 'text-orange-500' : 'text-slate-400'}`}>
                                                {latestOrder.status === 'PREPARING' ? 'In Progress' : latestOrder.status === 'PENDING_VERIFICATION' ? 'Awaiting Verification' : 'Done'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`flex items-center gap-4 group ${['READY', 'COMPLETED'].includes(latestOrder.status) ? '' : 'opacity-40'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 ${['READY', 'COMPLETED'].includes(latestOrder.status) ? 'bg-green-500 text-white shadow-lg shadow-green-100' : 'bg-slate-100 text-slate-400'}`}>
                                            <ShoppingBag size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 leading-none">Ready for Pickup</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                {latestOrder.status === 'READY' ? 'Ready Now!' : 'Pending'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hero Section: Countdown or Ready Badge */}
                            {['PENDING_VERIFICATION', 'PREPARING', 'READY'].includes(latestOrder.status) && (
                                <div className={`rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden text-center transition-all duration-500 ${latestOrder.status === 'READY' ? 'bg-green-500 shadow-green-200' : 'bg-slate-900 shadow-slate-300'}`}>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16 blur-2xl" />

                                    <div className="relative z-10">
                                        {latestOrder.status === 'READY' ? (
                                            <motion.div
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: [1, 1.05, 1], opacity: 1 }}
                                                transition={{
                                                    scale: { repeat: Infinity, duration: 2 },
                                                    opacity: { duration: 0.5 }
                                                }}
                                            >
                                                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                                                    <CheckCircle2 size={40} className="text-white" />
                                                </div>
                                                <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em] mb-2">Your Order is</p>
                                                <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Ready for Pickup!</h2>
                                                <p className="text-white/60 text-xs font-bold mt-4">Please show your token at the counter</p>
                                            </motion.div>
                                        ) : (
                                            <>
                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Estimated Ready In</p>
                                                <div className="text-7xl font-black text-white font-mono tracking-tighter mb-8 tabular-nums">
                                                    {String(minutes).padStart(2, '0')}<span className="text-orange-500 animate-pulse">:</span>{String(seconds).padStart(2, '0')}
                                                </div>
                                                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden shadow-inner mb-2">
                                                    <div
                                                        className="bg-orange-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Order Details */}
                            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Order Summary</h3>
                                    <div className="bg-slate-50 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        {latestOrder.items.length} Items
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {latestOrder.items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center group">
                                            <span className="text-sm font-bold text-slate-700">{item.name} x {item.qty}</span>
                                            <span className="text-sm font-black text-slate-900">₹{item.price * item.qty}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-6 border-t border-dashed border-slate-200 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount Paid</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">₹{latestOrder.totalAmount}</p>
                                    </div>
                                    <div className="bg-green-50 text-green-600 p-3 rounded-2xl">
                                        <CheckCircle2 size={24} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Sticky Footer Info */}
                <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-6 py-6 bg-white/80 backdrop-blur-lg border-t border-slate-100">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-4 rounded-2xl font-black text-sm bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-transform transform active:scale-95"
                    >
                        Return to Home
                    </button>
                </div>
            </motion.div>
        </main>
    );
}