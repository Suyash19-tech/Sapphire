import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Minus, Loader2, ShoppingCart, ChevronRight, Sparkles, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getMenu } from '../api';
import { useCart } from '../context/CartContext';
import BottomNav from '../components/BottomNav';
import { getTableId, validateTableId, buildTablePath } from '../utils/tableUtils';

// Food emoji map
const getFoodEmoji = (name) => {
    const n = name.toLowerCase();
    if (n.includes('dosa') || n.includes('uttapam')) return '🥞';
    if (n.includes('idli')) return '🫓';
    if (n.includes('burger')) return '🍔';
    if (n.includes('pizza')) return '🍕';
    if (n.includes('sandwich')) return '🥪';
    if (n.includes('coffee')) return '☕';
    if (n.includes('tea')) return '🍵';
    if (n.includes('pasta') || n.includes('maggi')) return '🍜';
    if (n.includes('rice') || n.includes('poha')) return '🍚';
    if (n.includes('samosa')) return '🥟';
    if (n.includes('paratha')) return '🫓';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('noodle') || n.includes('chow')) return '🍝';
    if (n.includes('juice') || n.includes('shake') || n.includes('lassi')) return '🥤';
    if (n.includes('soup')) return '🍲';
    if (n.includes('roll')) return '🌯';
    return '🍽️';
};

// Gradient map per category
const getCategoryGradient = (category) => {
    const map = {
        'South Indian': 'from-amber-900/60 to-orange-950/80',
        'North Indian': 'from-red-900/60 to-rose-950/80',
        'Quick Snacks': 'from-yellow-900/60 to-amber-950/80',
        'Beverages': 'from-cyan-900/60 to-blue-950/80',
        'Pizza & Burger': 'from-red-900/60 to-orange-950/80',
        'Chinese': 'from-red-900/60 to-pink-950/80',
        'Sandwich': 'from-green-900/60 to-emerald-950/80',
        'Paratha': 'from-yellow-900/60 to-orange-950/80',
        'Pasta & Maggi': 'from-orange-900/60 to-amber-950/80',
    };
    return map[category] || 'from-blue-900/60 to-slate-950/80';
};

const MenuItemCard = ({ item, qty, onAdd, onIncrease, onDecrease }) => {
    const [expanded, setExpanded] = useState(false);

    const handleCardClick = (e) => {
        // Don't toggle if clicking the +/- buttons
        if (e.target.closest('button')) return;
        if (!item.isAvailable) return;
        setExpanded(v => !v);
    };

    return (
        <motion.div
            layout
            onClick={handleCardClick}
            className={`relative overflow-hidden rounded-2xl border cursor-pointer select-none transition-colors ${!item.isAvailable
                ? 'opacity-50 border-white/5 bg-white/3'
                : qty > 0
                    ? 'border-blue-500/40 bg-blue-500/5'
                    : 'border-white/10 bg-white/5 active:bg-white/8'
                }`}
            animate={{ scale: expanded ? 1 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
            {/* ── Expanded image panel ── */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        key="image-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 200, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                        className="w-full relative overflow-hidden"
                    >
                        {/* Full-cover image or gradient fallback */}
                        {item.image ? (
                            <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                style={{ height: 200 }}
                            />
                        ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${getCategoryGradient(item.category)} flex items-center justify-center`}
                                style={{ height: 200 }}>
                                <div className="absolute inset-0 opacity-20">
                                    <div className="absolute top-2 right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                                    <div className="absolute bottom-2 left-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                                </div>
                                <motion.span
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                    transition={{ delay: 0.05, type: 'spring', stiffness: 300 }}
                                    className="text-8xl relative z-10"
                                    style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))' }}
                                >
                                    {getFoodEmoji(item.name)}
                                </motion.span>
                            </div>
                        )}

                        {/* Gradient overlay at bottom for text legibility */}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />

                        {/* Popular badge */}
                        {item.popular && (
                            <motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg"
                            >
                                <Star size={10} fill="currentColor" /> Popular
                            </motion.div>
                        )}

                        {/* Category label over image */}
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-3 left-3 text-xs text-white/80 font-medium"
                        >
                            {item.category}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main row ── */}
            <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Thumbnail (only when collapsed) */}
                <AnimatePresence>
                    {!expanded && (
                        <motion.div
                            key="thumb"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            className={`w-20 h-20 rounded-xl shrink-0 relative overflow-hidden flex items-center justify-center text-3xl ${qty > 0 ? 'bg-blue-600/20' : 'bg-white/5'}`}
                        >
                            {item.popular && (
                                <div className="absolute top-0 left-0 bg-amber-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-br-lg leading-tight z-10">
                                    HOT
                                </div>
                            )}
                            {item.image
                                ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                : getFoodEmoji(item.name)
                            }
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm leading-tight truncate">{item.name}</p>
                    {expanded && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs text-white/40 mt-0.5"
                        >
                            {item.category}
                        </motion.p>
                    )}
                    <p className="text-base font-bold text-white mt-1">₹{item.price}</p>
                </div>

                {/* Add / Counter */}
                <div onClick={e => e.stopPropagation()}>
                    {qty === 0 ? (
                        <button
                            onClick={() => { if (item.isAvailable) { onAdd(item); setExpanded(false); } }}
                            disabled={!item.isAvailable}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${item.isAvailable
                                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30'
                                : 'bg-white/5 text-white/20 cursor-not-allowed'
                                }`}
                        >
                            {item.isAvailable ? 'Add' : 'N/A'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-blue-600 rounded-xl px-2 py-1.5 shadow-lg shadow-blue-600/30">
                            <button
                                onClick={() => onDecrease(item.name)}
                                className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-colors active:scale-90"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="font-bold text-white text-sm w-5 text-center tabular-nums">{qty}</span>
                            <button
                                onClick={() => onIncrease(item.name)}
                                className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-colors active:scale-90"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Unavailable overlay */}
            {!item.isAvailable && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-black/60 text-white/60 text-xs font-semibold px-3 py-1 rounded-full">
                        Currently Unavailable
                    </span>
                </div>
            )}
        </motion.div>
    );
};

export default function Menu() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { cart: cartItems, addToCart, increaseQuantity, decreaseQuantity, getTotalItems, getTotalPrice } = useCart();
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [menuData, setMenuData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tableId, setTableId] = useState(null);
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const currentTableId = getTableId(searchParams);
        if (!currentTableId) { validateTableId(null, navigate); return; }
        setTableId(currentTableId);
        const hasShownWelcome = sessionStorage.getItem(`welcomed_table_${currentTableId}`);
        if (!hasShownWelcome) {
            toast.success(`Welcome to Sapphire — Table ${currentTableId}`, { icon: '🍽️', duration: 3000 });
            sessionStorage.setItem(`welcomed_table_${currentTableId}`, 'true');
        }
    }, [searchParams, navigate]);

    useEffect(() => {
        const fetchAndCacheMenu = async () => {
            const cachedMenu = localStorage.getItem('cachedMenu');
            if (cachedMenu) { setMenuData(JSON.parse(cachedMenu)); setLoading(false); }
            try {
                const data = await getMenu();
                setMenuData(data);
                localStorage.setItem('cachedMenu', JSON.stringify(data));
            } catch (error) {
                console.error('Failed to fetch menu:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAndCacheMenu();
    }, []);

    const categories = ['All', ...new Set(menuData.map(item => item.category))];

    const getMenuItems = () => {
        let items = menuData;
        if (selectedCategory !== 'All') items = items.filter(i => i.category === selectedCategory);
        if (searchQuery) items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
        return items;
    };

    const getItemQuantity = (item) => {
        const cartItem = cartItems.find(ci => ci.name === item.name);
        return cartItem ? cartItem.quantity : 0;
    };

    const totalItems = getTotalItems();
    const totalPrice = getTotalPrice();

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0F172A] flex items-center justify-center">
                <Loader2 size={36} className="text-blue-400 animate-spin" />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#0F172A] flex justify-center font-sans antialiased overflow-x-hidden">
            <div className="w-full max-w-md min-h-screen relative flex flex-col pb-24">

                {/* ── Sticky Header ── */}
                <header className="sticky top-0 z-50 bg-[#0F172A]/95 backdrop-blur-xl border-b border-white/5">
                    {/* Top bar */}
                    <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                <span className="text-xs font-medium text-green-400 tracking-wide">Kitchen Open</span>
                                {tableId && <>
                                    <span className="text-white/20">·</span>
                                    <span className="text-xs font-semibold text-blue-400">Table {tableId}</span>
                                </>}
                            </div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Sapphire Menu</h1>
                        </div>
                        <div className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
                            <Sparkles size={16} className="text-blue-400" />
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-4 pb-3">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15} />
                            <input
                                type="text"
                                placeholder="Search dishes..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="px-4 pb-3 overflow-hidden">
                        <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                            {categories.map(cat => (
                                <button key={cat} onClick={() => setSelectedCategory(cat)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${selectedCategory === cat
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                        : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                                        }`}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* ── Menu Items ── */}
                <div className="flex-1 px-4 py-4 space-y-2.5">
                    <AnimatePresence mode="popLayout">
                        {getMenuItems().length > 0 ? (
                            getMenuItems().map((item, index) => (
                                <motion.div
                                    key={item._id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{ delay: index * 0.03, duration: 0.25 }}
                                >
                                    <MenuItemCard
                                        item={item}
                                        qty={getItemQuantity(item)}
                                        onAdd={addToCart}
                                        onIncrease={increaseQuantity}
                                        onDecrease={decreaseQuantity}
                                    />
                                </motion.div>
                            ))
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-20 text-center">
                                <Search size={28} className="text-white/20 mb-3" />
                                <p className="text-white/50 font-medium text-sm">No dishes found</p>
                                <p className="text-white/30 text-xs mt-1">Try a different search</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Floating Cart Bar ── */}
                <AnimatePresence>
                    {totalItems > 0 && tableId && (
                        <motion.div
                            initial={{ y: 80, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 80, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="fixed bottom-[72px] left-0 right-0 max-w-md mx-auto px-4 z-40"
                        >
                            <button
                                onClick={() => navigate(buildTablePath('/checkout', tableId))}
                                className="w-full bg-blue-600 text-white px-5 py-3.5 rounded-2xl font-semibold shadow-2xl shadow-blue-600/40 hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <ShoppingCart size={19} />
                                        <span className="absolute -top-2 -right-2 bg-white text-blue-600 text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                                            {totalItems}
                                        </span>
                                    </div>
                                    <span className="text-sm">View Cart</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-base font-bold">₹{totalPrice}</span>
                                    <ChevronRight size={17} />
                                </div>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <BottomNav />
        </main>
    );
}
