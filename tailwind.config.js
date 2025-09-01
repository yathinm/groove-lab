/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#1E1E2E',
        'card-bg': '#2A2A3A',
        primary: '#7F5AF0',
      },
    },
  },
  plugins: [],
};


