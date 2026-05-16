/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#0a0a0f',
          925: '#0d0d14',
        },
      },
      animation: {
        'pulse-dot': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash': 'flash 0.6s ease-out',
      },
      keyframes: {
        flash: {
          '0%':   { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0.7)' },
          '70%':  { boxShadow: '0 0 0 12px rgba(251, 191, 36, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)' },
        },
      },
    },
  },
  plugins: [],
}
