import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getMenu, updateMenuItem, addMenuItem, uploadMenuItemImage } from '../api';
import {
    ShoppingBag, LayoutDashboard, ChefHat, Plus, Edit2, Save,
    X, ToggleLeft, ToggleRight, Search, RefreshCw,
    ImagePlus, Camera, Loader2
} from 'lucide-react';

const CATEGORIES = [
    'Non-Veg Rolls', 'Veg Rolls', 'Tacos', 'Starters', 'Beverages', 'Add-ons'
];

// Inline image upload button for each row
const ImageUploadCell = ({ item, onUploaded }) => {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const updated = await uploadMenuItemImage(item._id, file);
            onUploaded(updated);
            toast.success('Image updated');
        } catch {
            toast.error('Failed to upload image');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    : <span className="text-lg">🍽️</span>
                }
            </div>
            {/* Upload button */}
            <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                title="Upload image"
            >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
    );
};

export default function Kitchen() {
    const navigate = useNavigate();
    const [menu, setMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editPrice, setEditPrice] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Quick Snacks', popular: false });
    const [newItemImage, setNewItemImage] = useState(null);
    const [newItemImagePreview, setNewItemImagePreview] = useState(null);
    const [addingItem, setAddingItem] = useState(false);
    const imageInputRef = useRef(null);

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

    useEffect(() => { fetchMenuData(); }, []);

    const handleToggleAvailability = async (item) => {
        try {
            await updateMenuItem(item._id, { isAvailable: !item.isAvailable });
            setMenu(prev => prev.map(m => m._id === item._id ? { ...m, isAvailable: !m.isAvailable } : m));
            toast.success(`${item.name} ${!item.isAvailable ? 'enabled' : 'disabled'}`);
        } catch {
            toast.error('Failed to update availability');
        }
    };

    const handleSavePrice = async (id) => {
        try {
            await updateMenuItem(id, { price: Number(editPrice) });
            setMenu(prev => prev.map(m => m._id === id ? { ...m, price: Number(editPrice) } : m));
            toast.success('Price updated');
            setEditingId(null);
        } catch {
            toast.error('Failed to update price');
        }
    };

    const handleImageSelected = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setNewItemImage(file);
        setNewItemImagePreview(URL.createObjectURL(file));
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        setAddingItem(true);
        try {
            const saved = await addMenuItem({ ...newItem, price: Number(newItem.price) });
            // Upload image if selected
            if (newItemImage) {
                const withImage = await uploadMenuItemImage(saved._id, newItemImage);
                setMenu(prev => [withImage, ...prev]);
            } else {
                setMenu(prev => [saved, ...prev]);
            }
            toast.success(`${saved.name} added to menu`);
            setShowAddModal(false);
            setNewItem({ name: '', price: '', category: 'Quick Snacks', popular: false });
            setNewItemImage(null);
            setNewItemImagePreview(null);
        } catch (error) {
            toast.error('Failed to add item. Name may already exist.');
        } finally {
            setAddingItem(false);
        }
    };

    const handleImageUploaded = (updatedItem) => {
        setMenu(prev => prev.map(m => m._id === updatedItem._id ? updatedItem : m));
    };

    const filteredMenu = menu.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen bg-slate-50 font-sans antialiased lg:overflow-hidden">
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
                    <button className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
                        <ChefHat size={17} /> Menu Management
                    </button>
                </nav>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6 py-3 lg:py-0 lg:h-16 shrink-0">
                    <div>
                        <h1 className="text-base font-semibold text-slate-900">Menu Management</h1>
                        <p className="text-xs text-slate-400 mt-0.5">Manage items, prices, availability & images</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 min-w-[140px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input type="text" placeholder="Search..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
                        </div>
                        <button onClick={() => setShowAddModal(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                            <Plus size={16} /> Add Item
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-3 lg:p-6">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <RefreshCw size={28} className="animate-spin text-slate-300" />
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Image</th>
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Status</th>
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Edit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredMenu.map(item => (
                                            <tr key={item._id} className={`hover:bg-slate-50/50 transition-colors ${!item.isAvailable ? 'opacity-50' : ''}`}>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-900 text-sm">{item.name}</span>
                                                        {item.popular && <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">Popular</span>}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <ImageUploadCell item={item} onUploaded={handleImageUploaded} />
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-500">{item.category}</td>
                                                <td className="px-5 py-4">
                                                    {editingId === item._id ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm text-slate-500">₹</span>
                                                            <input type="number" value={editPrice}
                                                                onChange={e => setEditPrice(e.target.value)}
                                                                className="w-20 border border-slate-200 rounded-lg py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm font-semibold text-slate-900">₹{item.price}</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-center">
                                                        <button onClick={() => handleToggleAvailability(item)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${item.isAvailable
                                                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                                }`}>
                                                            {item.isAvailable ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                                                            {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {editingId === item._id ? (
                                                        <div className="flex justify-end gap-1.5">
                                                            <button onClick={() => handleSavePrice(item._id)} className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Save size={14} /></button>
                                                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"><X size={14} /></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => { setEditingId(item._id); setEditPrice(item.price); }}
                                                            className="p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"><Edit2 size={14} /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile card list */}
                            <div className="lg:hidden space-y-3">
                                {filteredMenu.map(item => (
                                    <div key={item._id} className={`bg-white rounded-xl border border-slate-200 p-4 ${!item.isAvailable ? 'opacity-60' : ''}`}>
                                        <div className="flex items-start gap-3">
                                            {/* Thumbnail */}
                                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center text-2xl">
                                                {item.image
                                                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                    : '🍽️'
                                                }
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-semibold text-slate-900 text-sm">{item.name}</p>
                                                    {item.popular && <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">Popular</span>}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                                                {/* Price row */}
                                                <div className="flex items-center gap-2 mt-2">
                                                    {editingId === item._id ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm text-slate-500">₹</span>
                                                            <input type="number" value={editPrice}
                                                                onChange={e => setEditPrice(e.target.value)}
                                                                className="w-20 border border-slate-200 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                                            <button onClick={() => handleSavePrice(item._id)} className="p-1.5 bg-green-600 text-white rounded-lg active:bg-green-700"><Save size={14} /></button>
                                                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg active:bg-slate-200"><X size={14} /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base font-bold text-slate-900">₹{item.price}</span>
                                                            <button onClick={() => { setEditingId(item._id); setEditPrice(item.price); }}
                                                                className="p-1.5 text-slate-400 bg-slate-50 rounded-lg active:bg-blue-50 active:text-blue-600">
                                                                <Edit2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Image upload */}
                                            <ImageUploadCell item={item} onUploaded={handleImageUploaded} />
                                        </div>
                                        {/* Bottom row: availability toggle */}
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <button onClick={() => handleToggleAvailability(item)}
                                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] ${item.isAvailable
                                                    ? 'bg-green-50 text-green-700 active:bg-green-100'
                                                    : 'bg-red-50 text-red-600 active:bg-red-100'
                                                    }`}>
                                                {item.isAvailable ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                                                {item.isAvailable ? 'In Stock — tap to disable' : 'Out of Stock — tap to enable'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {filteredMenu.length === 0 && (
                                    <div className="text-center py-16 text-slate-400">
                                        <p className="font-medium">No items found</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-xl border border-slate-200 p-5 sm:p-6 max-h-[95vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-base font-semibold text-slate-900">Add Menu Item</h2>
                            <button onClick={() => { setShowAddModal(false); setNewItemImage(null); setNewItemImagePreview(null); }}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleAddItem} className="space-y-4">
                            {/* Image upload area */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Photo (optional)</label>
                                <div
                                    onClick={() => imageInputRef.current?.click()}
                                    className={`mt-1.5 w-full h-32 rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center transition-colors ${newItemImagePreview
                                        ? 'border-blue-300 bg-blue-50'
                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                        }`}
                                >
                                    {newItemImagePreview ? (
                                        <div className="relative w-full h-full">
                                            <img src={newItemImagePreview} alt="preview" className="w-full h-full object-cover rounded-xl" />
                                            <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <span className="text-white text-xs font-medium">Change photo</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <ImagePlus size={24} className="text-slate-300 mb-2" />
                                            <p className="text-xs text-slate-400">Click to upload a photo</p>
                                            <p className="text-xs text-slate-300 mt-0.5">JPG, PNG up to 10MB</p>
                                        </>
                                    )}
                                </div>
                                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
                            </div>

                            {/* Name */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Name</label>
                                <input required type="text" placeholder="e.g. Masala Dosa"
                                    className="w-full mt-1.5 border border-slate-200 rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                            </div>

                            {/* Price + Category */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Price (₹)</label>
                                    <input required type="number" placeholder="0"
                                        className="w-full mt-1.5 border border-slate-200 rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                        value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</label>
                                    <select className="w-full mt-1.5 border border-slate-200 rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                        value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Popular */}
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={newItem.popular}
                                    onChange={e => setNewItem({ ...newItem, popular: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" />
                                <span className="text-sm text-slate-700">Mark as Popular</span>
                            </label>

                            <button type="submit" disabled={addingItem}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                {addingItem ? <><Loader2 size={15} className="animate-spin" /> Adding...</> : 'Add to Menu'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
