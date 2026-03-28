import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Flame, ShoppingBag, Hash, Receipt } from 'lucide-react';
import { motion } from 'framer-motion';
import { getMyOrders } from '../api';
import { io } from 'socket.io-client';

const CountdownHero = ({ order }) => {
    const [remainingSeconds, setRemainingSeconds] = useState(0);

    useEffect(() => {
        if (order.status !== 'PREPARING' || !order.estimatedCompletionTime) {
            setRemainingSeconds(0);
            return;
        }

        const calculateTime = () => {
            const end = new Date(order.estimatedCompletionTime).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, Math.floor((end - now) / 1000));
            setRemainingSeconds(diff);
        };

        calculateTime();
        const timer = setInterval(calculateTime, 1000);
        return () => clearInterval(timer);
    }, [order.status, order.estimatedCompletionTime]);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const totalTimeSeconds = (order.estimatedTime || 15) * 60;
    const progress = Math.min(100, (remainingSeconds / totalTimeSeconds) * 100);

    return (
        <div className={`rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-center transition-all duration-500 ${order.status === 'READY' ? 'bg-green-500 shadow-green-200' : 'bg-slate-900 shadow-slate-300'}`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16 blur-2xl" />

            <div className="relative z-10">
                {order.status === 'READY' || (order.status === 'PREPARING' && remainingSeconds === 0) ? (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: [1, 1.05, 1], opacity: 1 }}
                        transition={{
                            scale: { repeat: Infinity, duration: 2 },
                            opacity: { duration: 0.5 }
                        }}
                    >
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                            <CheckCircle2 size={32} className="text-white" />
                        </div>
                        <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em] mb-1">Order Ready</p>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Pick it up!</h2>
                    </motion.div>
                ) : (
                    <>
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">Estimated Ready In</p>
                        <div className="text-5xl font-black text-white font-mono tracking-tighter mb-6 tabular-nums">
                            {String(minutes).padStart(2, '0')}<span className="text-orange-500 animate-pulse">:</span>{String(seconds).padStart(2, '0')}
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden shadow-inner mb-1">
                            <div
                                className="bg-orange-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const OrderCard = ({ order }) => {
    return (
        <div className="space-y-6">
            {/* Status Tracking Steps */}
            <div className="relative px-2">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-100" />
                <div className="space-y-6 relative">
                    <div className="flex items-center gap-4 group">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-100 relative z-10">
                            <CheckCircle2 size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 leading-none">Order Placed</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-4 group ${order.status === 'PENDING_VERIFICATION' ? 'opacity-40' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white relative z-10 ${order.status !== 'PENDING_VERIFICATION' ? 'bg-orange-500 shadow-lg shadow-orange-100 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                            <Flame size={16} fill="currentColor" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 leading-none">Preparing Food</p>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${order.status !== 'PENDING_VERIFICATION' ? 'text-orange-500' : 'text-slate-400'}`}>
                                {order.status === 'PREPARING' ? 'In Progress' : order.status === 'PENDING_VERIFICATION' ? 'Awaiting Verification' : 'Done'}
                            </p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-4 group ${['READY', 'COMPLETED'].includes(order.status) ? '' : 'opacity-40'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 ${['READY', 'COMPLETED'].includes(order.status) ? 'bg-green-500 text-white shadow-lg shadow-green-100' : 'bg-slate-100 text-slate-400'}`}>
                            <ShoppingBag size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 leading-none">Ready for Pickup</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {order.status === 'READY' ? 'Ready Now!' : 'Pending'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hero Section: Countdown or Ready Badge */}
            {['PENDING_VERIFICATION', 'PREPARING', 'READY'].includes(order.status) && (
                <CountdownHero order={order} />
            )}

            {/* Order Details */}
            <div className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Order Summary</h3>
                    <div className="bg-slate-50 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {order.items.length} Items
                    </div>
                </div>

                <div className="space-y-3">
                    {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center group">
                            <span className="text-sm font-bold text-slate-700">{item.name} x {item.qty}</span>
                            <span className="text-sm font-black text-slate-900">₹{item.price * item.qty}</span>
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount Paid</p>
                        <p className="text-xl font-black text-slate-900 mt-1">₹{order.totalAmount}</p>
                    </div>
                    <div className="bg-green-50 text-green-600 p-2.5 rounded-2xl">
                        <CheckCircle2 size={20} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function ActiveOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
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

        const handler = (updatedOrder) => {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            if (storedUser && updatedOrder.user && (updatedOrder.user.tokenNumber === storedUser.tokenNumber || updatedOrder.user === storedUser._id)) {
                setOrders(prevOrders => {
                    const orderExists = prevOrders.some(o => o._id === updatedOrder._id);
                    if (orderExists) {
                        return prevOrders.map(order =>
                            order._id === updatedOrder._id ? { ...order, ...updatedOrder } : order
                        );
                    } else {
                        // If it's a new order (though usually fetched on mount/refresh)
                        return [updatedOrder, ...prevOrders];
                    }
                });
            }
        };

        socketRef.current.on('user_orderUpdated', handler);
        socketRef.current.on('admin_newOrder', (newOrder) => {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            if (storedUser && newOrder.user && (newOrder.user._id === storedUser._id || newOrder.user === storedUser._id)) {
                setOrders(prev => [newOrder, ...prev]);
            }
        });

        return () => {
            socketRef.current?.off('user_orderUpdated', handler);
            socketRef.current?.off('admin_newOrder');
        };
    }, []);

    const liveOrders = orders.filter(o => ['PENDING_VERIFICATION', 'PREPARING', 'READY'].includes(o.status));
    const pastOrders = orders.filter(o => ['COMPLETED', 'REJECTED'].includes(o.status));

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
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 flex justify-center font-sans antialiased overflow-x-hidden">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white shadow-2xl min-h-screen relative flex flex-col overflow-hidden pb-24"
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
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Your Orders</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                {liveOrders.length} active • {pastOrders.length} completed
                            </p>
                        </div>
                    </div>
                </header>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-12">
                    {/* Token Badge */}
                    {tokenNumber && (
                        <div className="bg-orange-500 rounded-3xl p-6 shadow-xl shadow-orange-100 flex items-center justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-xl" />
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-orange-100 uppercase tracking-[0.2em] mb-1">Permanent Token</p>
                                <h2 className="text-3xl font-black text-white tracking-tight">#{tokenNumber}</h2>
                            </div>
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <Hash size={24} className="text-white" />
                            </div>
                        </div>
                    )}

                    {/* Live Orders Section */}
                    <div className="space-y-8">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Flame size={20} className="text-orange-500" /> Live Status
                            </h2>
                        </div>

                        {liveOrders.length === 0 ? (
                            <div className="bg-slate-50 rounded-4xl p-10 text-center border border-dashed border-slate-200">
                                <ShoppingBag size={40} className="text-slate-300 mx-auto mb-4" />
                                <p className="text-sm font-bold text-slate-500">No active orders right now</p>
                            </div>
                        ) : (
                            <div className="space-y-12">
                                {liveOrders.map(order => (
                                    <OrderCard key={order._id} order={order} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Past Orders Section */}
                    {pastOrders.length > 0 && (
                        <div className="space-y-6 pt-4">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    <Receipt size={20} className="text-slate-400" /> Today's Receipts
                                </h2>
                            </div>

                            <div className="space-y-4">
                                {pastOrders.map(order => (
                                    <div key={order._id} className="bg-slate-50 rounded-3xl p-6 border border-slate-100 opacity-75 grayscale-[0.5] hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Completed</p>
                                                <p className="text-xs font-bold text-slate-500">{new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                {order.status}
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-4">
                                            {order.items.map((item, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs font-medium text-slate-600">
                                                    <span>{item.name} x {item.qty}</span>
                                                    <span>₹{item.price * item.qty}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                                            <span className="text-sm font-black text-slate-900">Total Paid</span>
                                            <span className="text-sm font-black text-slate-900">₹{order.totalAmount}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Footer Info */}
                <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-6 py-6 bg-white/80 backdrop-blur-lg border-t border-slate-100 z-50">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-4 rounded-2xl font-black text-sm bg-slate-900 text-white shadow-xl shadow-slate-200 hover:bg-orange-600 transition-all transform active:scale-95"
                    >
                        Return to Home
                    </button>
                </div>
            </motion.div>
        </main>
    );
}