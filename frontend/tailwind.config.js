/** @type {import('tailwindcss').Config} */
export default { darkMode: 'class', content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'], theme: { extend: { colors: { ink: '#172033', brand: { DEFAULT: '#4f46e5', dark: '#3730a3' } }, boxShadow: { soft: '0 8px 30px rgba(23,32,51,.08)' } } }, plugins: [] };
