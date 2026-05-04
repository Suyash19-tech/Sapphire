import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ChevronRight } from 'lucide-react';
import { io } from 'socket.io-client';

// Plays a pleasant two-tone chime using the Web Audio API
function playReadySound() {
    // Vibrate on mobile — 3 short pulses
    if (navigator.vibrate) navigator.vibrate([100, 80, 100, 80, 200]);

    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        const playTone = (freq, startAt, duration, vol = 0.18) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
            gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
            gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + startAt + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + startAt);
            osc.stop(ctx.currentTime + startAt + duration);
        };

        // Two ascending tones — friendly "ding-dong"
        playTone(880, 0, 0.35);
        playTone(1100, 0.3, 0.5);
    } catch (_) {
        // Audio not available — silently ignore
    }
}

export default function OrderReadyNotification() {
    const navigate = useNavigate();
    const socketRef = useRef(null);
    const timerRef = useRef(null);

    // Queue of ready orders waiting to be shown
    const [queue, setQueue] = useState([]);
    // Currently displayed notification
    const [current, setCurrent] = useState(null);

    const customer = JSON.parse(localStorage.getItem('customer') || '{}');

    // Pop next from queue whenever current clears
    useEffect(() => {
        if (!current && queue.length > 0) {
            const [next, ...rest] = queue;
            setCurrent(next);
            setQueue(rest);
        }
    }, [current, queue]);

    // Auto-dismiss after 8 seconds
    useEffect(() => {
        if (!current) return;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCurrent(null), 8000);
        return () => clearTimeout(timerRef.current);
    }, [current]);

    const dismiss = useCallback(() => {
        clearTimeout(timerRef.current);
        setCurrent(null);
    }, []);

    const goToOrders = useCallback(() => {
        dismiss();
        navigate('/orders');
    }, [dismiss, navigate]);

    // Socket connection
    useEffect(() => {
        if (!customer._id) return;

        socketRef.current = io(import.meta.env.VITE_API_URL);

        socketRef.current.on('order_ready', (order) => {
            // Only react to this customer's orders
            if (String(order.customerId) !== String(customer._id)) return;

            playReadySound();

            const notification = {
                id: order._id,
                itemCount: order.items?.length ?? 0,
                totalAmount: order.totalAmount,
                items: order.items ?? [],
            };

            setCurrent(prev => {
                if (prev) {
                    // Already showing one — queue this
                    setQueue(q => [...q, notification]);
                    return prev;
                }
                return notification;
            });
        });

        return () => {
            socketRef.current?.disconnect();
            socketRef.current = null;
        };
    }, [customer._id]);

    return (
        <AnimatePresence>
            {current && (
                <>
                    {/* Backdrop — subtle, doesn't block interaction */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm pointer-events-none"
                    />

                    {/* Notification card — slides in from top */}
                    <motion.div
                        key="card"
                        initial={{ y: -120, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -120, opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4"
                    >
                        <div className="bg-[#1a1f2e] border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-500/20 overflow-hidden">

                            {/* Pulsing amber top bar */}
                            <motion.div
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ repeat: Infinity, duration: 1.2 }}
                                className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400"
                            />

                            <div className="p-4">
                                {/* Header row */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-3">
                                        {/* Animated bell icon */}
                                        <motion.div
                                            animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                                            transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 1 }}
                                            className="w-10 h-10 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-center shrink-0"
                                        >
                                            <Bell size={20} className="text-amber-400" />
                                        </motion.div>
                                        <div>
                                            <p className="text-sm font-bold text-white leading-tight">
                                                Your order is ready!
                                            </p>
                                            <p className="text-xs text-amber-400/80 mt-0.5">
                                                Please collect from the counter
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={dismiss}
                                        className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors shrink-0 mt-0.5"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Items preview */}
                                {current.items.length > 0 && (
                                    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 mb-3 space-y-1.5">
                                        {current.items.slice(0, 3).map((item, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs">
                                                <span className="text-white/70 truncate">{item.name}</span>
                                                <span className="text-white/40 ml-2 shrink-0">×{item.quantity}</span>
                                            </div>
                                        ))}
                                        {current.items.length > 3 && (
                                            <p className="text-xs text-white/30">
                                                +{current.items.length - 3} more item{current.items.length - 3 > 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Total + CTA */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                                        <p className="text-xs text-white/40">Total</p>
                                        <p className="text-sm font-bold text-white">₹{current.totalAmount}</p>
                                    </div>
                                    <button
                                        onClick={goToOrders}
                                        className="flex items-center gap-1.5 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-amber-500/30"
                                    >
                                        View Order <ChevronRight size={15} />
                                    </button>
                                </div>

                                {/* Auto-dismiss progress bar */}
                                <motion.div
                                    className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden"
                                >
                                    <motion.div
                                        className="h-full bg-amber-500/50 rounded-full"
                                        initial={{ width: '100%' }}
                                        animate={{ width: '0%' }}
                                        transition={{ duration: 8, ease: 'linear' }}
                                    />
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
