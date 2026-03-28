import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Search, Plus, Minus, Star, Flame, Loader2 } from 'lucide-react';
import { getMenu } from '../api';

export default function Menu() {
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState({});
    const [menuData, setMenuData] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const fetchAndCacheMenu = async () => {
            // Instantly load from cache if available
            const cachedMenu = localStorage.getItem('cachedMenu');
            if (cachedMenu) {
                setMenuData(JSON.parse(cachedMenu));
                setLoading(false);
            }

            // Fetch fresh data and update cache
            try {
                const data = await getMenu();
                setMenuData(data);
                localStorage.setItem('cachedMenu', JSON.stringify(data));
            } catch (error) {
                console.error('Failed to fetch menu:', error);
            } finally {
                // If there was no cache, loading will still be true, so turn it off
                if (loading) {
                    setLoading(false);
                }
            }
        };
        fetchAndCacheMenu();
    }, []);

    const categories = ['All', ...new Set(menuData.map(item => item.category))];

    const getMenuItems = () => {
        let items = menuData;
        if (selectedCategory !== 'All') {
            items = items.filter(item => item.category === selectedCategory);
        }

        if (searchQuery) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return items;
    };

    const addToCart = (item) => {
        if (!item.isAvailable) return;
        setCart(prev => ({
            ...prev,
            [item._id]: (prev[item._id] || 0) + 1
        }));
    };

    const updateQuantity = (itemId, quantity) => {
        if (quantity <= 0) {
            setCart(prev => {
                const newCart = { ...prev };
                delete newCart[itemId];
                return newCart;
            });
        } else {
            setCart(prev => ({
                ...prev,
                [itemId]: quantity
            }));
        }
    };

    const cartItems = Object.entries(cart).map(([itemId, quantity]) => {
        const item = menuData.find(i => i._id === itemId);
        return { ...item, quantity };
    });

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 size={40} className="text-orange-500 animate-spin" />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 flex justify-center font-sans antialiased">
            <div className="w-full max-w-md bg-white shadow-2xl min-h-screen relative flex flex-col pb-32 overflow-hidden">

                {/* Header */}
                <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
                    <div className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all active:scale-90"
                            >
                                <ArrowLeft size={20} className="text-slate-800" />
                            </button>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Canteen Menu</h1>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kitchen Open</p>
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <button className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                                <ShoppingCart size={20} />
                                {totalItems > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                        {totalItems}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="px-6 pb-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search your favorite food..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="px-6 pb-4 overflow-hidden">
                        <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {categories.map(category => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-300 ${selectedCategory === category
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 scale-105'
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* Menu Items */}
                <div className="flex-1 px-6 py-6 space-y-6">
                    {getMenuItems().length > 0 ? (
                        getMenuItems().map(item => {
                            const quantity = cart[item.id] || 0;
                            return (
                                <div
                                    key={item._id}
                                    className={`group relative bg-white border border-slate-50 rounded-[2rem] p-4 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all duration-500 overflow-hidden ${!item.isAvailable ? 'grayscale opacity-60' : ''}`}
                                >
                                    <div className="flex gap-4 items-center">
                                        {/* Image Placeholder */}
                                        <div className="w-24 h-24 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
                                            {item.popular && (
                                                <div className="absolute top-0 left-0 bg-orange-500 text-white p-1.5 rounded-br-xl z-10">
                                                    <Flame size={12} fill="currentColor" />
                                                </div>
                                            )}
                                            {!item.isAvailable && (
                                                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-20">
                                                    <span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-900 px-2 py-1 rounded-full">Out of Stock</span>
                                                </div>
                                            )}
                                            <span className="relative z-0">
                                                {item.name.includes('Samosa') ? '🥟' :
                                                    item.name.includes('Burger') ? '🍔' :
                                                        item.name.includes('Sandwich') ? '🥪' :
                                                            item.name.includes('Coffee') || item.name.includes('Tea') ? '☕️' :
                                                                item.name.includes('Maggi') || item.name.includes('Pasta') ? '🍜' :
                                                                    item.name.includes('Pizza') ? '🍕' :
                                                                        item.name.includes('Dosa') || item.name.includes('Uttapam') ? '🥞' :
                                                                            item.name.includes('Rice') || item.name.includes('Poha') ? '🍚' : '🍲'}
                                            </span>
                                        </div>

                                        <div className="flex-1 py-1">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className="flex items-center gap-0.5 text-orange-500">
                                                    <Star size={12} fill="currentColor" />
                                                    <span className="text-[10px] font-black">{item.rating || 4.5}</span>
                                                </div>
                                                {item.popular && (
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">• Popular</span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-slate-900 text-base group-hover:text-orange-600 transition-colors">{item.name}</h3>
                                            <div className="flex items-center justify-between mt-3">
                                                <p className="text-xl font-black text-slate-900">₹{item.price}</p>

                                                {/* ADD / Counter Button */}
                                                {quantity === 0 ? (
                                                    <button
                                                        onClick={() => addToCart(item)}
                                                        disabled={!item.isAvailable}
                                                        className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-slate-200 ${item.isAvailable
                                                                ? 'bg-slate-900 text-white hover:bg-orange-600 active:scale-95'
                                                                : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                                            }`}
                                                    >
                                                        {item.isAvailable ? 'ADD' : 'SOLD OUT'}
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-2 py-1.5 shadow-lg shadow-slate-200">
                                                        <button
                                                            onClick={() => updateQuantity(item._id, quantity - 1)}
                                                            className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors"
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <span className="font-black text-white text-sm w-4 text-center">{quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item._id, quantity + 1)}
                                                            className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Search size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-slate-900 font-bold">No items found</h3>
                            <p className="text-slate-400 text-sm mt-1">Try searching for something else!</p>
                        </div>
                    )}
                </div>

                {/* Floating Checkout Bar */}
                {totalItems > 0 && (
                    <div className="fixed bottom-8 left-0 right-0 max-w-[calc(100%-3rem)] w-full mx-auto z-50">
                        <button
                            onClick={() => navigate('/checkout', { state: { cartItems, totalPrice } })}
                            className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-bold shadow-2xl shadow-slate-400 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-4">
                                <div className="bg-white/10 p-3 rounded-2xl relative">
                                    <ShoppingCart size={20} />
                                    <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-900">
                                        {totalItems}
                                    </span>
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Total Price</p>
                                    <p className="text-xl font-black">₹{totalPrice}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-orange-500 px-6 py-3 rounded-2xl shadow-lg">
                                <span className="text-sm font-black uppercase tracking-tight">Checkout</span>
                                <ArrowLeft size={18} className="rotate-180" />
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}