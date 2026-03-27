/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                gray: {
                    50: '#f9fafb',
                    100: '#f3f4f6',
                    200: '#e5e7eb',
                    300: '#d1d5db',
                    400: '#9ca3af',
                    500: '#6b7280',
                    600: '#4b5563',
                    700: '#374151',
                    800: '#1f2937',
                    900: '#111827',
                },
                orange: {
                    50: '#fff7ed',
                    100: '#ffedd5',
                    300: '#fed7aa',
                    400: '#fb923c',
                    500: '#f97316',
                    600: '#ea580c',
                },
                green: {
                    50: '#f0fdf4',
                    500: '#22c55e',
                },
            },
        },
    },
    plugins: [],
}