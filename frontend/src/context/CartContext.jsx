import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within CartProvider');
    }
    return context;
};

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);

    // Load cart from localStorage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            try {
                const parsedCart = JSON.parse(savedCart);
                setCart(parsedCart);
                console.log('🛒 [Cart] Loaded from localStorage:', parsedCart.length, 'items');
            } catch (error) {
                console.error('❌ [Cart] Failed to parse cart from localStorage:', error);
                localStorage.removeItem('cart');
            }
        }
    }, []);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        if (cart.length > 0) {
            localStorage.setItem('cart', JSON.stringify(cart));
            console.log('💾 [Cart] Saved to localStorage:', cart.length, 'items');
        } else {
            localStorage.removeItem('cart');
            console.log('🗑️ [Cart] Cleared from localStorage');
        }
    }, [cart]);

    // Add item to cart
    const addToCart = (item) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(cartItem => cartItem.name === item.name);
            if (existingItem) {
                return prevCart.map(cartItem =>
                    cartItem.name === item.name
                        ? { ...cartItem, quantity: cartItem.quantity + 1 }
                        : cartItem
                );
            }
            return [...prevCart, { ...item, quantity: 1 }];
        });
    };

    // Remove item from cart
    const removeFromCart = (itemName) => {
        setCart(prevCart => prevCart.filter(item => item.name !== itemName));
        toast.success('Item removed from cart', { icon: '🗑️', id: `remove-${itemName}` });
    };

    // Update item quantity
    const updateQuantity = (itemName, newQuantity) => {
        if (newQuantity <= 0) {
            removeFromCart(itemName);
            return;
        }
        setCart(prevCart =>
            prevCart.map(item =>
                item.name === itemName ? { ...item, quantity: newQuantity } : item
            )
        );
    };

    // Increase quantity
    const increaseQuantity = (itemName) => {
        setCart(prevCart =>
            prevCart.map(item =>
                item.name === itemName ? { ...item, quantity: item.quantity + 1 } : item
            )
        );
    };

    // Decrease quantity — removes item when reaching 0
    const decreaseQuantity = (itemName) => {
        setCart(prevCart => {
            const item = prevCart.find(i => i.name === itemName);
            if (!item) return prevCart;
            if (item.quantity <= 1) {
                // Remove from cart — fire toast with dedup id
                toast.success('Item removed from cart', { icon: '🗑️', id: `remove-${itemName}` });
                return prevCart.filter(i => i.name !== itemName);
            }
            return prevCart.map(i =>
                i.name === itemName ? { ...i, quantity: i.quantity - 1 } : i
            );
        });
    };

    // Clear entire cart
    const clearCart = () => {
        setCart([]);
        localStorage.removeItem('cart');
        console.log('🗑️ [Cart] Cleared completely');
    };

    // Get total items count
    const getTotalItems = () => {
        return cart.reduce((total, item) => total + item.quantity, 0);
    };

    // Get total price
    const getTotalPrice = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const value = {
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        increaseQuantity,
        decreaseQuantity,
        clearCart,
        getTotalItems,
        getTotalPrice
    };

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};
