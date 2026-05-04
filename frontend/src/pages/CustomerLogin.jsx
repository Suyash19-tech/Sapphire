import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, User, ArrowRight, Loader2, UtensilsCrossed } from 'lucide-react';
import toast from 'react-hot-toast';
import { customerAuth } from '../api';

export default function CustomerLogin() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState('');

    // Already logged in → go to menu
    useEffect(() => {
        if (localStorage.getItem('customerToken')) {
            navigate('/menu', { replace: true });
        }
    }, [navigate]);

    const handlePhoneChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
        setPhone(val);
        if (val.length > 0 && val.length < 10) {
            setPhoneError('Enter a valid 10-digit number');
        } else {
            setPhoneError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (phone.length !== 10) {
            setPhoneError('Enter a valid 10-digit number');
            return;
        }
        setLoading(true);
        try {
            const data = await customerAuth({ name: name.trim(), phone });
            localStorage.setItem('customerToken', data.token);
            localStorage.setItem('customer', JSON.stringify(data.customer));
            toast.success(`Welcome, ${data.customer.name}!`);
            navigate('/menu', { replace: true });
        } catch (err) {
            toast.error(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#0F172A] flex items-center justify-center font-sans antialiased px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm"
            >
                {/* Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/30 mb-4">
                        <UtensilsCrossed className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Witchers Burrito</h1>
                    <p className="text-sm text-white/40 mt-1">Enter your details to start ordering</p>
                </div>

                {/* Form card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="text-xs font-medium text-white/50 mb-1.5 block">Your Name</label>
                            <div className="relative">
                                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Rahul"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="text-xs font-medium text-white/50 mb-1.5 block">Mobile Number</label>
                            <div className="relative">
                                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    required
                                    type="tel"
                                    inputMode="numeric"
                                    placeholder="10-digit number"
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/25 focus:outline-none transition-all ${phoneError
                                        ? 'border-red-500/50 focus:border-red-500/70'
                                        : 'border-white/10 focus:border-blue-500/50'
                                        }`}
                                />
                            </div>
                            {phoneError && (
                                <p className="text-xs text-red-400 mt-1.5 ml-1">{phoneError}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !name.trim() || phone.length !== 10}
                            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading
                                ? <><Loader2 size={16} className="animate-spin" /> Please wait — server waking up...</>
                                : <>Continue <ArrowRight size={16} /></>
                            }
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-white/20 mt-5">
                    Your number is used only to track your orders
                </p>
            </motion.div>
        </main>
    );
}
