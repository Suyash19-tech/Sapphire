import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTables, toggleTableStatus } from '../api';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    ShoppingBag,
    ChefHat,
    Grid3x3,
    Lock,
    Unlock,
    RefreshCw,
    AlertCircle,
    CheckCircle
} from 'lucide-react';

export default function Tables() {
    const navigate = useNavigate();
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingTable, setUpdatingTable] = useState(null);

    const fetchTables = async () => {
        try {
            const data = await getTables();
            setTables(data);
        } catch (error) {
            console.error('Failed to fetch tables:', error);
            toast.error('Failed to load tables');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTables();
    }, []);

    const handleToggleStatus = async (tableNumber) => {
        setUpdatingTable(tableNumber);
        try {
            const updatedTable = await toggleTableStatus(tableNumber);

            // Update local state
            setTables(prevTables =>
                prevTables.map(t =>
                    t.tableNumber === tableNumber ? updatedTable : t
                )
            );

            const statusText = updatedTable.status === 'ACTIVE' ? 'enabled' : 'blocked';
            toast.success(`Table ${tableNumber} ${statusText}`, {
                icon: updatedTable.status === 'ACTIVE' ? '✅' : '🚫'
            });
        } catch (error) {
            console.error('Failed to toggle table status:', error);
            toast.error('Failed to update table status');
        } finally {
            setUpdatingTable(null);
        }
    };

    const activeCount = tables.filter(t => t.status === 'ACTIVE').length;
    const blockedCount = tables.filter(t => t.status === 'BLOCKED').length;

    return (
        <div className="flex h-screen bg-slate-50 font-sans antialiased overflow-hidden">
            {/* Sidebar */}
            <aside className="w-60 bg-white border-r border-slate-200 flex-col hidden lg:flex shrink-0">
                <div className="px-5 py-6 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <ShoppingBag className="text-white w-4 h-4" />
                        </div>
                        <span className="font-bold text-base text-slate-900">Sapphire</span>
                    </div>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    <button onClick={() => navigate('/admin')} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-sm font-medium transition-colors">
                        <LayoutDashboard size={17} /> Dashboard
                    </button>
                    <button onClick={() => navigate('/kitchen')} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-sm font-medium transition-colors">
                        <ChefHat size={17} /> Menu Management
                    </button>
                    <button className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
                        <Grid3x3 size={17} /> Tables
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Topbar */}
                <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Table Management</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Sapphire Restaurant • {activeCount} Active • {blockedCount} Blocked
                        </p>
                    </div>

                    <button
                        onClick={fetchTables}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-transform transform text-slate-600"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </header>

                {/* Info Banner */}
                <div className="bg-blue-50 border-b border-blue-100 px-8 py-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-blue-900">Table Access Control</p>
                            <p className="text-xs text-blue-700 mt-1">
                                Block tables to prevent QR code misuse. Blocked tables cannot place new orders at Sapphire.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tables Grid */}
                <div className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                    <div className="h-24 bg-slate-200 rounded animate-pulse"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <motion.div
                            layout
                            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
                        >
                            {tables.map((table) => {
                                const isActive = table.status === 'ACTIVE';
                                const isUpdating = updatingTable === table.tableNumber;

                                return (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        key={table.tableNumber}
                                        className={`bg-white border-2 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden ${isActive
                                            ? 'border-green-200 hover:border-green-300'
                                            : 'border-red-200 hover:border-red-300'
                                            }`}
                                    >
                                        {/* Status Indicator */}
                                        <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'
                                            } animate-pulse`} />

                                        {/* Table Number */}
                                        <div className="text-center mb-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Table</p>
                                            <h3 className="text-3xl font-black text-slate-900 mt-1">
                                                {table.tableNumber}
                                            </h3>
                                        </div>

                                        {/* Status Badge */}
                                        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-center mb-4 ${isActive
                                            ? 'bg-green-50 text-green-600 border border-green-200'
                                            : 'bg-red-50 text-red-600 border border-red-200'
                                            }`}>
                                            {isActive ? (
                                                <span className="flex items-center justify-center gap-1">
                                                    <CheckCircle size={12} /> Active
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center gap-1">
                                                    <Lock size={12} /> Blocked
                                                </span>
                                            )}
                                        </div>

                                        {/* Stats */}
                                        <div className="text-center mb-4 text-xs text-slate-500">
                                            <p>{table.totalOrders || 0} orders</p>
                                        </div>

                                        {/* Toggle Button */}
                                        <button
                                            onClick={() => handleToggleStatus(table.tableNumber)}
                                            disabled={isUpdating}
                                            className={`w-full py-3 rounded-xl font-bold text-sm transition-all transform active:scale-95 flex items-center justify-center gap-2 ${isActive
                                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-100'
                                                : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-100'
                                                } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isUpdating ? (
                                                <RefreshCw size={16} className="animate-spin" />
                                            ) : isActive ? (
                                                <>
                                                    <Lock size={16} /> Block
                                                </>
                                            ) : (
                                                <>
                                                    <Unlock size={16} /> Enable
                                                </>
                                            )}
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </div>
            </main>
        </div>
    );
}
