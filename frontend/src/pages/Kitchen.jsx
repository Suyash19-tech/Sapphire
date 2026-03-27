import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getMenu, updateMenuItem, addMenuItem } from '../api';
import {
    ShoppingBag,
    LayoutDashboard,
    ChefHat,
    Plus,
    Edit2,
    Save,
    X,
    ToggleLeft,
    ToggleRight,
    Search,
    RefreshCw
} from 'lucide-react';

export default function Kitchen() {
    const navigate = useNavigate();
    const [menu, setMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editPrice, setEditPrice] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Quick Snacks', popular: false });

    const fetchMenuData = async () => {
        try {
            const data = await getMenu();
            setMenu(data);
        } catch (error) {
            console.error('Failed to fetch menu:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMenuData();
    }, []);

    const handleToggleAvailability = async (item) => {
        try {
            await updateMenuItem(item._id, { isAvailable: !item.isAvailable });
            toast.success('Availability updated!');
            fetchMenuData();
        } catch (error) {
            toast.error('Failed to update availability');
        }
    };

    const handleStartEdit = (item) => {
        setEditingId(item._id);
        setEditPrice(item.price);
    };

    const handleSavePrice = async (id) => {
        try {
            await updateMenuItem(id, { price: Number(editPrice) });
            toast.success('Price updated!');
            setEditingId(null);
            fetchMenuData();
        } catch (error) {
            toast.error('Failed to update price');
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            const itemToSave = {
                ...newItem,
                price: Number(newItem.price)
            };
            await addMenuItem(itemToSave);
            toast.success('New item added!');
            setShowAddModal(false);
            setNewItem({ name: '', price: '', category: 'Quick Snacks', popular: false });
            fetchMenuData();
        } catch (error) {
            console.error('Add item error:', error);
            toast.error('Failed to add item. Check if the name already exists.');
        }
    };

    const filteredMenu = menu.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-50 font-sans antialiased overflow-hidden">
            {/* Sidebar (Same as Admin) */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
                <div className="p-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500 p-2 rounded-xl shadow-lg shadow-orange-200">
                            <ShoppingBag className="text-white w-5 h-5" />
                        </div>
                        <span className="font-black text-xl tracking-tight text-slate-800">CampusCraves</span>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-1">
                    <button onClick={() => navigate('/admin')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-bold text-sm transition-all">
                        <LayoutDashboard size={20} /> Dashboard
                    </button>
                    <button onClick={() => navigate('/kitchen')} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 transition-all">
                        <ChefHat size={20} /> Kitchen Management
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Kitchen Management</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update Menu Availability & Prices</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search menu..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium w-64 focus:ring-2 focus:ring-slate-200 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-orange-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Plus size={18} /> Add New Item
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <RefreshCw size={48} className="animate-spin mb-4" />
                            <p className="font-bold">Loading kitchen menu...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Availability</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredMenu.map((item) => (
                                        <tr key={item._id} className={`hover:bg-slate-50/50 transition-colors ${!item.isAvailable ? 'opacity-60' : ''}`}>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl">
                                                        {item.name.includes('Samosa') ? '🥟' : item.name.includes('Burger') ? '🍔' : '🍲'}
                                                    </div>
                                                    <span className="font-bold text-slate-900">{item.name}</span>
                                                    {item.popular && <span className="bg-orange-100 text-orange-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Popular</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-sm font-medium text-slate-500">{item.category}</td>
                                            <td className="px-8 py-5">
                                                {editingId === item._id ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-slate-900 text-sm">₹</span>
                                                        <input
                                                            type="number"
                                                            value={editPrice}
                                                            onChange={(e) => setEditPrice(e.target.value)}
                                                            className="w-20 bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-sm font-black text-slate-900 focus:ring-2 focus:ring-orange-500/20"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="font-black text-slate-900">₹{item.price}</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => handleToggleAvailability(item)}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all ${item.isAvailable
                                                                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                            }`}
                                                    >
                                                        {item.isAvailable ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                        {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                {editingId === item._id ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleSavePrice(item._id)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"><Save size={16} /></button>
                                                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-all"><X size={16} /></button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => handleStartEdit(item)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-orange-500 hover:text-white transition-all"><Edit2 size={16} /></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Add Menu Item</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddItem} className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Name</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Masala Dosa"
                                    className="w-full mt-1 bg-slate-50 border-none rounded-2xl py-3.5 px-5 text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Price (₹)</label>
                                    <input
                                        required
                                        type="number"
                                        placeholder="0"
                                        className="w-full mt-1 bg-slate-50 border-none rounded-2xl py-3.5 px-5 text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
                                        value={newItem.price}
                                        onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                                    <select
                                        className="w-full mt-1 bg-slate-50 border-none rounded-2xl py-3.5 px-5 text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                    >
                                        <option>Quick Snacks</option>
                                        <option>Sandwich</option>
                                        <option>Pizza & Burger</option>
                                        <option>Chinese</option>
                                        <option>North Indian</option>
                                        <option>South Indian</option>
                                        <option>Paratha</option>
                                        <option>Pasta & Maggi</option>
                                        <option>Beverages</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 py-2">
                                <input
                                    type="checkbox"
                                    id="popular"
                                    checked={newItem.popular}
                                    onChange={e => setNewItem({ ...newItem, popular: e.target.checked })}
                                    className="w-5 h-5 rounded-lg border-slate-200 text-orange-500 focus:ring-orange-500/20"
                                />
                                <label htmlFor="popular" className="text-sm font-bold text-slate-700">Mark as Popular</label>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-orange-600 transition-all active:scale-95 mt-4"
                            >
                                Create Menu Item
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
