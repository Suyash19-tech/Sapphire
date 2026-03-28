
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Cloud, Camera, ShieldCheck, Smartphone, CheckCircle, Info, Utensils, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createOrder } from '../api';

export default function Checkout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { cartItems, totalPrice } = location.state || { cartItems: [], totalPrice: 0 };

    const [instructions, setInstructions] = useState('');
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
        }
    }, [navigate]);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!file) return;

        setIsSubmitting(true);
        try {
            const items = cartItems.map(item => ({
                name: item.name,
                qty: item.quantity,
                price: item.price
            }));

            const orderData = {
                items,
                totalAmount: totalPrice,
                cookingInstructions: instructions,
                paymentScreenshot: file
            };

            const response = await createOrder(orderData);
            toast.success('Order placed successfully!');
            navigate('/orders', { state: { orderId: response._id } });
        } catch (error) {
            console.error('Failed to create order:', error);
            toast.error(error.message || 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFileSelected = file !== null;

    return (
        <main className="min-h-screen bg-slate-50 flex justify-center font-sans antialiased">
            <div className="w-full max-w-md bg-white shadow-2xl min-h-screen relative flex flex-col overflow-hidden">

                {/* Header */}
                <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
                    <div className="px-6 py-6 flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all active:scale-90"
                        >
                            <ArrowLeft size={20} className="text-slate-800" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Checkout</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Total: ₹{totalPrice}</p>
                        </div>
                    </div>
                </header>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">

                    {/* Order Summary Summary */}
                    <div className="bg-slate-50 rounded-[2rem] p-6 space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Order Items</h3>
                        {cartItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm px-2">
                                <span className="font-bold text-slate-700">{item.name} x {item.quantity}</span>
                                <span className="font-black text-slate-900">₹{item.price * item.quantity}</span>
                            </div>
                        ))}
                    </div>

                    {/* Payment Alert */}
                    <div className="bg-orange-50 border border-orange-100 rounded-[2rem] p-6 flex gap-4">
                        <div className="bg-orange-500 p-3 rounded-2xl h-fit shadow-lg shadow-orange-200">
                            <Smartphone className="text-white" size={20} />
                        </div>
                        <div>
                            <h3 className="text-orange-900 font-bold text-sm">Scan & Pay ₹{totalPrice}</h3>
                            <p className="text-orange-700 text-xs mt-1 leading-relaxed opacity-80">
                                Please pay exactly ₹{totalPrice} and upload the screenshot below.
                            </p>
                        </div>
                    </div>

                    {/* Scan to Pay Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Payment QR Code</h2>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 bg-green-50 px-3 py-1 rounded-full">
                                <ShieldCheck size={12} /> Secure
                            </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-xl shadow-slate-100 flex flex-col items-center group">
                            <div className="relative">
                                <div className="absolute inset-0 bg-orange-500 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" />
                                <div className="relative bg-white p-6 rounded-[2rem] shadow-inner border border-slate-50">
                                    <div className="w-48 h-48 bg-slate-100 rounded-2xl flex items-center justify-center relative overflow-hidden">
                                        {/* Mock QR Lines */}
                                        <div className="absolute inset-4 border-2 border-slate-300 rounded-lg flex flex-col gap-2 p-4 opacity-30">
                                            <div className="w-full h-2 bg-slate-400 rounded" />
                                            <div className="w-3/4 h-2 bg-slate-400 rounded" />
                                            <div className="w-full h-2 bg-slate-400 rounded" />
                                            <div className="w-1/2 h-2 bg-slate-400 rounded" />
                                        </div>
                                        <div className="z-10 text-center">
                                            <div className="text-4xl mb-2 grayscale group-hover:grayscale-0 transition-all duration-500">📸</div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scan Me</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 text-center space-y-1">
                                <p className="text-slate-900 font-bold text-sm">Amity Gwalior Canteen</p>
                                <p className="text-slate-400 text-[10px] font-medium tracking-wide">UPI ID: canteen@amity</p>
                            </div>
                        </div>
                    </div>

                    {/* Cooking Instructions */}
                    <div className="space-y-4">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Special Requests</h2>
                        <div className="relative">
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder="Any specific cooking instructions? (e.g., extra spicy, no onion)"
                                className="w-full px-6 py-5 bg-slate-50 border-none rounded-[2rem] text-slate-900 text-sm font-medium placeholder-slate-400 focus:ring-2 focus:ring-orange-500/20 transition-all resize-none h-32"
                            />
                        </div>
                    </div>

                    {/* File Upload Dropzone */}
                    <div className="space-y-4 pb-12">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Upload Proof</h2>
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-[2.5rem] p-10 transition-all duration-500 cursor-pointer overflow-hidden group ${dragActive
                                ? 'border-orange-500 bg-orange-50 scale-[1.02]'
                                : file
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50'
                                }`}
                        >
                            <input
                                type="file"
                                onChange={handleFileInput}
                                className="hidden"
                                id="file-upload"
                                accept="image/*"
                            />
                            <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer relative z-10">
                                {file ? (
                                    <>
                                        <div className="w-16 h-16 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-200 mb-4 animate-bounce-short">
                                            <CheckCircle size={32} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{file.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Proof Uploaded</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-100 mb-4 group-hover:scale-110 transition-transform duration-500">
                                            <Cloud size={32} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-900">Upload Screenshot</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center leading-relaxed">
                                            PNG, JPG or PDF <br /> (Max 10MB)
                                        </p>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>
                </div>

                {/* Sticky Footer Button */}
                <div className="sticky bottom-0 px-6 py-8 bg-white/80 backdrop-blur-lg border-t border-slate-100">
                    <button
                        onClick={handleSubmit}
                        disabled={!isFileSelected || isSubmitting}
                        className={`w-full py-5 rounded-[2rem] font-black text-base transition-all duration-500 flex items-center justify-center gap-2 ${isFileSelected && !isSubmitting
                            ? 'bg-slate-900 text-white shadow-2xl shadow-slate-300 hover:scale-[1.02] active:scale-95'
                            : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Processing...
                            </>
                        ) : isFileSelected ? (
                            'Confirm Payment & Order'
                        ) : (
                            'Please Upload Proof'
                        )}
                    </button>
                    <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-4 flex items-center justify-center gap-2">
                        <Info size={12} /> Verification takes ~1-2 mins
                    </p>
                </div>
            </div>
        </main>
    );
}