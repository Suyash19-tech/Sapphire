import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, ArrowRight, Loader2, ShoppingBag } from 'lucide-react';
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

            toast.success(`Welcome back, ${data.user.name}!`);

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
        <main className="min-h-screen bg-slate-50 flex justify-center font-sans antialiased">
            <div className="w-full max-w-md bg-white shadow-2xl min-h-screen relative flex flex-col p-8 overflow-hidden">

                {/* Decorative Elements */}
                <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-orange-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
                <div className="absolute bottom-[20%] left-[-10%] w-48 h-48 bg-orange-50 rounded-full blur-2xl opacity-40 pointer-events-none" />

                <div className="relative z-10 flex-1 flex flex-col justify-center">
                    <div className="mb-10 text-center">
                        <div className="inline-flex bg-orange-500 p-4 rounded-3xl shadow-xl shadow-orange-200 mb-6">
                            <ShoppingBag className="text-white w-8 h-8" />
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
                        <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-[10px]">Sign in to continue ordering</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold border border-red-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={20} />
                                <input
                                    required
                                    type="email"
                                    placeholder="your@email.com"
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 transition-all"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={20} />
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 transition-all"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-orange-500 text-white py-5 rounded-[2rem] font-black text-sm shadow-2xl shadow-orange-200 hover:bg-orange-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-8"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Signing In...
                                </>
                            ) : (
                                <>
                                    Sign In <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-orange-600 hover:text-orange-700 underline decoration-2 underline-offset-4">Sign Up</Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
