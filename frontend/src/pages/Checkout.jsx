import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ShieldCheck, Info, Loader2, CheckCircle,
    ChevronRight, UtensilsCrossed, Calendar, Clock, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { createOrder } from '../api';
import { useCart } from '../context/CartContext';

// Build the minimum datetime string for the input (5 min from now)
function minScheduleTime() {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    // datetime-local needs "YYYY-MM-DDTHH:MM"
    return d.toISOString().slice(0, 16);
}

export default function Checkout() {
    const navigate = useNavigate();
    const { cart: cartItems, getTotalPrice, clearCart } = useCart();
    const totalPrice = getTotalPrice();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Schedule state
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduledFor, setScheduledFor] = useState('');
    const [minTime] = useState(minScheduleTime);

    const customer = JSON.parse(localStorage.getItem('customer') || '{}');

    useEffect(() => {
        if (!customer._id) { navigate('/login', { replace: true }); return; }
        if (cartItems.length === 0) navigate('/menu', { replace: true });
    }, [cartItems, navigate, customer._id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!customer._id) { toast.error('Please log in first'); return; }

        // Validate scheduled time if set
        if (isScheduling && scheduledFor) {
            const scheduled = new Date(scheduledFor);
            if (scheduled <= new Date()) {
                toast.error('Scheduled time must be in the future');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const orderPayload = {
                customerId: customer._id,
                customerName: customer.name,
                customerPhone: customer.phone,
                items: cartItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                totalAmount: totalPrice,
            };

            if (isScheduling && scheduledFor) {
                orderPayload.scheduledFor = new Date(scheduledFor).toISOString();
            }

            await createOrder(orderPayload);

            if (isScheduling && scheduledFor) {
                const d = new Date(scheduledFor);
                toast.success(
                    `Order scheduled for ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`,
                    { duration: 4000 }
                );
            } else {
                toast.success('Order placed!');
            }

            clearCart();
            navigate('/orders', { replace: true });
        } catch (error) {
            toast.error(error.message || 'Failed to place order. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!customer._id) return null;

    const isScheduled = isScheduling && !!scheduledFor;

    return (
        <main className="min-h-screen bg-[#0F172A] flex justify-center font-sans antialiased">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md min-h-screen flex flex-col"
            >
                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#0F172A]/95 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center gap-3">
                    <button onClick={() => navigate('/menu')}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white">Checkout</h1>
                        <p className="text-xs text-white/40">₹{totalPrice} · {cartItems.length} items</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 pb-36">

                    {/* Order Summary */}
                    <section>
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Your Order</p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                            {cartItems.map((item, idx) => (
                                <div key={idx} className={`flex items-center justify-between px-4 py-3.5 ${idx < cartItems.length - 1 ? 'border-b border-white/5' : ''}`}>
                                    <div>
                                        <p className="text-sm font-medium text-white">{item.name}</p>
                                        <p className="text-xs text-white/40 mt-0.5">×{item.quantity} · ₹{item.price} each</p>
                                    </div>
                                    <span className="text-sm font-bold text-white">₹{item.price * item.quantity}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-3.5 bg-blue-600/10 border-t border-blue-500/20">
                                <span className="text-sm font-semibold text-blue-300">Total</span>
                                <span className="text-lg font-bold text-white">₹{totalPrice}</span>
                            </div>
                        </div>
                    </section>

                    {/* Customer identity */}
                    <section>
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Ordering as</p>
                        <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center shrink-0">
                                <UtensilsCrossed size={18} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">{customer.name}</p>
                                <p className="text-xs text-white/40 mt-0.5">{customer.phone}</p>
                            </div>
                        </div>
                    </section>

                    {/* Schedule Order */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Schedule</p>
                            <button
                                onClick={() => { setIsScheduling(v => !v); setScheduledFor(''); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isScheduling
                                        ? 'bg-violet-600/20 border border-violet-500/40 text-violet-300'
                                        : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80'
                                    }`}
                            >
                                <Calendar size={13} />
                                {isScheduling ? 'Cancel' : 'Schedule for later'}
                            </button>
                        </div>

                        <AnimatePresence>
                            {isScheduling && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 bg-violet-600/10 border border-violet-500/20 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Clock size={15} className="text-violet-400 shrink-0" />
                                            <p className="text-sm font-semibold text-violet-300">Pick a time</p>
                                        </div>
                                        <input
                                            type="datetime-local"
                                            value={scheduledFor}
                                            min={minTime}
                                            onChange={e => setScheduledFor(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 [color-scheme:dark]"
                                        />
                                        {scheduledFor && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex items-center gap-2 text-xs text-violet-300"
                                            >
                                                <CheckCircle size={13} />
                                                Order will be sent to kitchen at{' '}
                                                <span className="font-bold">
                                                    {new Date(scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {' '}on{' '}
                                                <span className="font-bold">
                                                    {new Date(scheduledFor).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                                </span>
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {!isScheduling && (
                            <p className="text-xs text-white/30">
                                Order now for immediate preparation, or schedule for a specific time.
                            </p>
                        )}
                    </section>

                    {/* Info */}
                    <div className="flex items-start gap-3 p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                        <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-300 leading-relaxed">
                            {isScheduled
                                ? 'Your order will automatically enter the kitchen queue at the scheduled time.'
                                : 'This is a takeaway order. Come to the counter to collect and pay when your order is ready.'
                            }
                        </p>
                    </div>
                </div>

                {/* Sticky Footer */}
                <div className="sticky bottom-0 bg-[#0F172A]/95 backdrop-blur-xl border-t border-white/5 px-5 py-4 space-y-2">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (isScheduling && !scheduledFor)}
                        className={`w-full py-4 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-xl disabled:opacity-50 ${isScheduled
                                ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-violet-600/30'
                                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/30'
                            }`}
                    >
                        {isSubmitting ? (
                            <><Loader2 size={16} className="animate-spin" /> {isScheduled ? 'Scheduling...' : 'Placing Order...'}</>
                        ) : isScheduled ? (
                            <><Calendar size={16} /> Schedule Order <ChevronRight size={16} /></>
                        ) : (
                            <><CheckCircle size={16} /> Place Order <ChevronRight size={16} /></>
                        )}
                    </button>
                    {isScheduling && !scheduledFor && (
                        <p className="text-center text-xs text-white/30">Pick a time above to schedule</p>
                    )}
                    <p className="text-center text-xs text-white/20 flex items-center justify-center gap-1.5">
                        <ShieldCheck size={12} /> Witchers Burrito
                    </p>
                </div>
            </motion.div>
        </main>
    );
}
