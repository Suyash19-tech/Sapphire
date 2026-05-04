import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, ArrowRight, Loader2, UtensilsCrossed, ShieldCheck } from 'lucide-react';
import { login } from '../api';

export default function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await login(formData);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('isAdmin', data.user.isAdmin);

            toast.success(`Welcome, ${data.user.name}!`);

            if (data.user.isAdmin === true) {
                navigate('/admin');
            } else {
                navigate('/');
            }
        } catch (err) {
            const msg = err.message || 'Invalid email or password';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#0F172A] flex items-center justify-center font-sans antialiased px-4">
            <div className="w-full max-w-sm">

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/30 mb-4">
                        <UtensilsCrossed className="text-white w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Sapphire</h1>
                    <p className="text-sm text-white/40 mt-1">Staff Portal</p>
                </div>

                {/* Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-base font-semibold text-white mb-1">Sign in</h2>
                    <p className="text-xs text-white/40 mb-5">Access the restaurant dashboard</p>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-white/50 mb-1.5 block">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15} />
                                <input
                                    required
                                    type="email"
                                    placeholder="staff@sapphire.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-white/50 mb-1.5 block">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15} />
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-600/30 disabled:opacity-50"
                        >
                            {loading
                                ? <><Loader2 className="animate-spin" size={16} /> Signing in — may take ~30s on first load...</>
                                : <>Sign In <ArrowRight size={16} /></>
                            }
                        </button>
                    </form>
                </div>

                {/* Footer note */}
                <div className="flex items-center justify-center gap-2 mt-5 text-xs text-white/25">
                    <ShieldCheck size={13} />
                    <span>Sapphire Restaurant — Staff access only</span>
                </div>
            </div>
        </main>
    );
}
