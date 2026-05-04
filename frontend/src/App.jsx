import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Utensils, Clock, User, Coffee, ArrowRight, MapPin, ShoppingBag } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Menu from './pages/Menu';
import Checkout from './pages/Checkout';
import ActiveOrders from './pages/ActiveOrders';
import AdminDashboard from './pages/AdminDashboard';
import Kitchen from './pages/Kitchen';
import CustomerLogin from './pages/CustomerLogin';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import OrderReadyNotification from './components/OrderReadyNotification';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to home if already logged in)
const PublicRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

// Customer Route — requires customerToken
const CustomerRoute = ({ children }) => {
  const isCustomer = !!localStorage.getItem('customerToken');
  return isCustomer ? children : <Navigate to="/login" replace />;
};

// Customer Public Route — redirect to menu if already logged in
const CustomerPublicRoute = ({ children }) => {
  const isCustomer = !!localStorage.getItem('customerToken');
  return isCustomer ? <Navigate to="/menu" replace /> : children;
};

// Admin Route Component
const AdminRoute = ({ children }) => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  return isAdmin ? children : <Navigate to="/admin/login" replace />;
};

// This is your mobile Dashboard UI
function Dashboard() {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (storedUser) {
      setUserName(storedUser.name);
    }

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex justify-center font-sans antialiased">
      <div className="w-full max-w-md bg-white shadow-2xl min-h-screen relative flex flex-col overflow-hidden">

        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-orange-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute bottom-[20%] left-[-10%] w-48 h-48 bg-orange-50 rounded-full blur-2xl opacity-40 pointer-events-none" />

        {/* Top Navigation Bar */}
        <nav className="px-6 pt-8 pb-4 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-2 rounded-xl shadow-lg shadow-orange-200">
              <ShoppingBag className="text-white w-5 h-5" />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-800">Sapphire</span>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 bg-white shadow-xl shadow-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-orange-500 hover:scale-105 active:scale-90 transition-all"
          >
            <User size={20} />
          </button>
        </nav>

        {/* Hero Section */}
        <header className="px-6 py-8 relative z-10">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {greeting}, {userName || 'Guest'}! 👋
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Welcome to Sapphire Restaurant</p>
          </div>
        </header>

        {/* Featured Card */}
        <div className="px-6 mb-8 relative z-10">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2.5rem] p-8 shadow-xl shadow-orange-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl transition-transform group-hover:scale-110" />
            <div className="relative z-10">
              <span className="bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-md">
                Limited Offer
              </span>
              <h3 className="text-2xl font-bold text-white mt-4 leading-tight">
                Fresh Poha & <br />Special Tea
              </h3>
              <p className="text-orange-100 text-sm mt-2 font-medium opacity-90">Only at ₹40</p>
              <button
                onClick={() => navigate('/menu')}
                className="mt-6 bg-white text-orange-600 px-6 py-2.5 rounded-2xl font-bold text-sm shadow-lg hover:shadow-white/20 transition-all active:scale-95 flex items-center gap-2"
              >
                Claim Now <ArrowRight size={16} />
              </button>
            </div>
            <div className="absolute bottom-4 right-6 text-7xl opacity-20 transform rotate-12 transition-transform group-hover:rotate-0">
              ☕️
            </div>
          </div>
        </div>

        {/* Main Navigation Grid */}
        <div className="px-6 flex-grow relative z-10">
          <h3 className="text-slate-800 font-bold text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/menu')}
              className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-slate-200 transition-all duration-300 active:scale-95 flex flex-col items-center gap-4 text-center group"
            >
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-300">
                <Utensils className="text-orange-500 w-7 h-7 group-hover:text-white transition-colors duration-300" />
              </div>
              <div>
                <span className="block font-bold text-slate-800 text-base">Explore Menu</span>
                <span className="text-slate-400 text-xs mt-1">Prepared by Sapphire Kitchen</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/orders')}
              className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-slate-200 transition-all duration-300 active:scale-95 flex flex-col items-center gap-4 text-center group"
            >
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-slate-800 transition-colors duration-300">
                <Clock className="text-slate-500 w-7 h-7 group-hover:text-white transition-colors duration-300" />
              </div>
              <div>
                <span className="block font-bold text-slate-800 text-base">Track Your Order</span>
                <span className="text-slate-400 text-xs mt-1">Live Kitchen Updates</span>
              </div>
            </button>
          </div>

          {/* Additional Quick Categories */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-slate-800 font-bold text-lg">Top Picks</h3>
              <button onClick={() => navigate('/menu')} className="text-orange-500 text-xs font-bold hover:underline">View All</button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
              {[
                { name: 'Samosa', icon: '🥟', price: '₹15' },
                { name: 'Sandwich', icon: '🥪', price: '₹25' },
                { name: 'Coffee', icon: '☕️', price: '₹20' },
                { name: 'Burger', icon: '🍔', price: '₹60' }
              ].map((item, i) => (
                <div key={i} className="min-w-[120px] bg-slate-50 rounded-3xl p-4 flex flex-col items-center gap-2 border border-transparent hover:border-orange-200 hover:bg-white hover:shadow-md transition-all cursor-pointer">
                  <span className="text-3xl">{item.icon}</span>
                  <span className="font-bold text-slate-800 text-sm mt-1">{item.name}</span>
                  <span className="text-orange-500 font-bold text-xs">{item.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Tab Bar (Aesthetics only for now) */}
        <div className="mt-auto bg-white border-t border-slate-100 px-8 py-6 flex justify-evenly items-center relative z-10">
          <button className="text-orange-500 flex flex-col items-center gap-1 transition-transform active:scale-90">
            <Utensils size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
          </button>
          <button onClick={() => navigate('/orders')} className="text-slate-300 hover:text-slate-500 flex flex-col items-center gap-1 transition-all active:scale-90">
            <Clock size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Orders</span>
          </button>
        </div>
      </div>
    </main>
  );
}

// This is the Router that connects your whole app together
export default function App() {
  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      {/* Global order-ready popup — works on any page the customer is on */}
      <OrderReadyNotification />
      <Routes>
        {/* Root → customer login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Customer auth */}
        <Route path="/login" element={<CustomerPublicRoute><CustomerLogin /></CustomerPublicRoute>} />

        {/* Customer ordering routes — require customerToken */}
        <Route path="/menu" element={<CustomerRoute><Menu /></CustomerRoute>} />
        <Route path="/checkout" element={<CustomerRoute><Checkout /></CustomerRoute>} />
        <Route path="/orders" element={<CustomerRoute><ActiveOrders /></CustomerRoute>} />

        {/* Admin auth — separate route */}
        <Route path="/admin/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Admin/Kitchen Routes */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/kitchen" element={<AdminRoute><Kitchen /></AdminRoute>} />
      </Routes>
    </Router>
  );
}