import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Home, ShoppingCart, Package } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getTableId, buildTablePath } from '../utils/tableUtils';
import toast from 'react-hot-toast';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { getTotalItems } = useCart();
    const totalItems = getTotalItems();

    // Get tableId from URL or localStorage
    const tableId = getTableId(searchParams);

    // Determine active tab based on current path
    const isActive = (path) => {
        if (path === '/menu') {
            return location.pathname === '/' || location.pathname === '/menu';
        }
        return location.pathname === path;
    };

    const handleCartClick = () => {
        if (totalItems === 0) {
            toast.error('Your cart is empty!');
        } else {
            navigate(buildTablePath('/checkout', tableId));
        }
    };

    const handleOrdersClick = () => {
        navigate(buildTablePath('/orders', tableId));
    };

    const handleMenuClick = () => {
        navigate(buildTablePath('/menu', tableId));
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0F172A]/95 backdrop-blur-xl border-t border-white/10 z-50 max-w-md mx-auto">
            <div className="px-6 py-2 flex justify-around items-center">
                <button onClick={handleMenuClick}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${isActive('/menu') ? 'text-blue-400' : 'text-white/30 hover:text-white/60'}`}>
                    <Home size={22} strokeWidth={isActive('/menu') ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">Menu</span>
                </button>
                <button onClick={handleCartClick}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative ${isActive('/checkout') ? 'text-blue-400' : 'text-white/30 hover:text-white/60'}`}>
                    <div className="relative">
                        <ShoppingCart size={22} strokeWidth={isActive('/checkout') ? 2.5 : 2} />
                        {totalItems > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                                {totalItems}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-medium">Cart</span>
                </button>
                <button onClick={handleOrdersClick}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${isActive('/orders') ? 'text-blue-400' : 'text-white/30 hover:text-white/60'}`}>
                    <Package size={22} strokeWidth={isActive('/orders') ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">Orders</span>
                </button>
            </div>
        </nav>
    );
}
