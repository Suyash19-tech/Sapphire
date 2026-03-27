import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, User, Mail, Phone, Edit2, Check, LogOut, Loader2 } from 'lucide-react';
import { getUserProfile, updateUserProfile } from '../api';

export default function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }
            try {
                const data = await getUserProfile(token);
                setUser(data);
                setPhone(data.phone || '');
            } catch (error) {
                console.error('Failed to fetch profile:', error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [navigate]);

    const handleUpdatePhone = async () => {
        const token = localStorage.getItem('token');
        setSaving(true);
        try {
            const updatedUser = await updateUserProfile(token, { phone });
            setUser(updatedUser);
            setIsEditingPhone(false);
            toast.success('Phone number updated!');
            // Update local storage too
            const storedUser = JSON.parse(localStorage.getItem('user'));
            localStorage.setItem('user', JSON.stringify({ ...storedUser, phone }));
        } catch (error) {
            toast.error('Failed to update phone number');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        toast.success('Logged out successfully');
        navigate('/login');
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 size={40} className="text-orange-500 animate-spin" />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 flex justify-center font-sans antialiased">
            <div className="w-full max-w-md bg-white shadow-2xl min-h-screen relative flex flex-col overflow-hidden">

                {/* Header */}
                <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
                    <div className="px-6 py-6 flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all active:scale-90"
                        >
                            <ArrowLeft size={20} className="text-slate-800" />
                        </button>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">My Profile</h1>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-10 space-y-10">
                    {/* User Hero */}
                    <div className="flex flex-col items-center text-center">
                        <div className="w-32 h-32 bg-orange-100 rounded-[2.5rem] flex items-center justify-center text-orange-500 mb-6 shadow-xl shadow-orange-50 border-4 border-white">
                            <User size={64} strokeWidth={1.5} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{user?.name}</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">CampusCraves Student</p>
                    </div>

                    {/* Account Details */}
                    <div className="space-y-6 bg-slate-50 rounded-[2.5rem] p-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 opacity-60">
                                <Mail size={20} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700">{user?.email}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100">
                                <Phone size={20} className="text-slate-400" />
                                {isEditingPhone ? (
                                    <div className="flex-1 flex items-center gap-2">
                                        <input
                                            type="tel"
                                            className="flex-1 bg-slate-50 border-none rounded-lg py-1 px-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500/20"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleUpdatePhone}
                                            disabled={saving}
                                            className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                                        >
                                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-700">{user?.phone || 'Not set'}</span>
                                        <button
                                            onClick={() => setIsEditingPhone(true)}
                                            className="p-1.5 text-slate-400 hover:text-orange-500 transition-all"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Support & Actions */}
                    <div className="space-y-4">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-3 py-5 bg-red-50 text-red-600 rounded-[2rem] font-black text-sm hover:bg-red-100 transition-all active:scale-95"
                        >
                            <LogOut size={20} />
                            Sign Out Account
                        </button>
                    </div>
                </div>

                {/* Footer Brand */}
                <div className="p-8 text-center opacity-20">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">CampusCraves v1.0</p>
                </div>
            </div>
        </main>
    );
}
