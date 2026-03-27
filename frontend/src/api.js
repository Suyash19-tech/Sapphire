const BASE_URL = 'http://localhost:5001/api';

export const signup = async (userData) => {
    try {
        const response = await fetch(`${BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Signup failed');
        return data;
    } catch (error) {
        console.error('Error in signup:', error);
        throw error;
    }
};

export const login = async (userData) => {
    try {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Login failed');
        return data;
    } catch (error) {
        console.error('Error in login:', error);
        throw error;
    }
};

export const getMenu = async () => {
    try {
        const response = await fetch(`${BASE_URL}/menu`);
        if (!response.ok) {
            throw new Error('Failed to fetch menu');
        }
        return await response.json();
    } catch (error) {
        console.error('Error in getMenu:', error);
        throw error;
    }
};

export const updateMenuItem = async (id, data) => {
    try {
        const response = await fetch(`${BASE_URL}/menu/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update menu item');
        return await response.json();
    } catch (error) {
        console.error('Error updating menu item:', error);
        throw error;
    }
};

export const addMenuItem = async (data) => {
    try {
        const response = await fetch(`${BASE_URL}/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to add menu item');
        return await response.json();
    } catch (error) {
        console.error('Error adding menu item:', error);
        throw error;
    }
};

export const getUserProfile = async (token) => {
    try {
        const response = await fetch(`${BASE_URL}/users/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch profile');
        return data;
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        throw error;
    }
};

export const updateUserProfile = async (token, userData) => {
    try {
        const response = await fetch(`${BASE_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update profile');
        return data;
    } catch (error) {
        console.error('Error in updateUserProfile:', error);
        throw error;
    }
};

export const createOrder = async (orderData) => {
    try {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('items', JSON.stringify(orderData.items));
        formData.append('totalAmount', orderData.totalAmount);
        formData.append('cookingInstructions', orderData.cookingInstructions || '');
        formData.append('paymentScreenshot', orderData.paymentScreenshot);

        const response = await fetch(`${BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Failed to create order');
        }

        return await response.json();
    } catch (error) {
        console.error('Error in createOrder:', error);
        throw error;
    }
};

export const getActiveOrders = async () => {
    try {
        const response = await fetch(`${BASE_URL}/orders/active`);
        if (!response.ok) {
            throw new Error('Failed to fetch active orders');
        }
        return await response.json();
    } catch (error) {
        console.error('Error in getActiveOrders:', error);
        throw error;
    }
};

export const getOrders = async () => {
    try {
        const response = await fetch(`${BASE_URL}/orders`);
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        return await response.json();
    } catch (error) {
        console.error('Error in getOrders:', error);
        throw error;
    }
};

export const getMyOrders = async (token) => {
    try {
        const response = await fetch(`${BASE_URL}/orders/my-orders`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch your orders');
        return data;
    } catch (error) {
        console.error('Error in getMyOrders:', error);
        throw error;
    }
};

export const updateOrderStatus = async (orderId, status, extraData = {}) => {
    try {
        const response = await fetch(`${BASE_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status, ...extraData }),
        });

        if (!response.ok) {
            throw new Error('Failed to update order status');
        }

        return await response.json();
    } catch (error) {
        console.error('Error in updateOrderStatus:', error);
        throw error;
    }
};
