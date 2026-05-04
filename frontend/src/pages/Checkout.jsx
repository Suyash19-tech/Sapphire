import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Info, Loader2, Phone, User, CheckCircle, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { createOrder } from '../api';
import { useCart } from '../context/CartContext';
import { getTableId, validateTableId, buildTablePath } from '../utils/tableUtils';

export default function Checkout() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { cart: cartItems, getTotalPrice, clearCart } = useCart();
    const totalPrice = getTotalPrice();

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tableId, setTableId] = useState(null);

    useEffect(() => {
        const currentTableId = getTableId(searchParams);
        if (!validateTableId(currentTableId, navigate)) return;
        setTableId(currentTableId);
    }, [searchParams, navigate]);

    useEffect(() => {
        if (cartItems.length === 0 && tableId) navigate(buildTablePath('/menu', tableId));
    }, [cartItems, navigate, tableId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tableId) { toast.error('Table information missing'); return; }

        setIsSubmitting(true);
        try {
            await createOrder({
                tableId: Number(tableId),
                customerName: customerName.trim() || 'Guest',
                customerPhone: customerPhone.trim() || '',
                items: cartItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                totalAmount: totalPrice
            });
            toast.success('Order placed!');
            clearCart();
            navigate(buildTablePath('/orders', tableId));
        } catch (error) {
            toast.error(error.message || 'Failed to place order. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!tableId) return null;

    const canSubmit = !isSubmitting;

    return (
        <main className="min-h-screen bg-[#0F172A] flex justify-center font-sans antialiased">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md min-h-screen flex flex-col"
            >
                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#0F172A]/95 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center gap-3">
                    <button onClick={() => navigate(buildTablePath('/menu', tableId))}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white">Checkout</h1>
                        <p className="text-xs text-white/40">Table {tableId} · ₹{totalPrice}</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 pb-32">

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

                    {/* Info */}
                    <div className="flex items-start gap-3 p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                        <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-300 leading-relaxed">
                            No payment needed now. Your order goes straight to the Sapphire kitchen — pay at the table when you're done.
                        </p>
                    </div>

                    {/* Guest Details */}
                    <section>
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Your Details <span className="normal-case font-normal text-white/25">(optional)</span></p>
                        <div className="space-y-3">
                            <div className="relative">
                                <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Your name (optional)"
                                    className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                                />
                            </div>
                            <div className="relative">
                                <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    placeholder="Mobile number (optional)"
                                    maxLength="10"
                                    className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sticky Footer */}
                <div className="sticky bottom-0 bg-[#0F172A]/95 backdrop-blur-xl border-t border-white/5 px-5 py-4">
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={`w-full py-4 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${canSubmit
                            ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98] shadow-xl shadow-blue-600/30'
                            : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'
                            }`}
                    >
                        {isSubmitting
                            ? <><Loader2 size={16} className="animate-spin" /> Placing Order...</>
                            : <><CheckCircle size={16} /> Place Order <ChevronRight size={16} /></>
                        }
                    </button>
                    <p className="text-center text-xs text-white/20 mt-2.5 flex items-center justify-center gap-1.5">
                        <ShieldCheck size={12} /> Sapphire Restaurant
                    </p>
                </div>
            </motion.div>
        </main>
    );
}
