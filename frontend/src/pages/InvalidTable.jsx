import React from 'react';
import { AlertCircle, QrCode } from 'lucide-react';

export default function InvalidTable() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans antialiased">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-12 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="text-red-500 w-10 h-10" />
                </div>

                <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
                    Invalid Table QR
                </h1>

                <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                    We couldn't identify your table. Please scan the QR code on your table to start ordering.
                </p>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <QrCode className="text-slate-300 w-16 h-16 mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Scan Table QR Code
                    </p>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">
                        Need help? Contact our staff
                    </p>
                </div>
            </div>
        </div>
    );
}
