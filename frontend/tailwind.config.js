/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E40AF',
          dark: '#1A3793',
          50: '#EFF3FF',
          100: '#DBE4FF',
        },
        success: {
          DEFAULT: '#10B981',
          bg: '#ECFDF5',
        },
        page: '#F8FAFC',
        card: '#FFFFFF',
        ink: '#0F172A',
        muted: '#64748B',
        danger: { DEFAULT: '#DC2626', bg: '#FEF2F2' },
        warn: { DEFAULT: '#F59E0B', bg: '#FEF3C7', ink: '#92400E' },
        info: '#3B82F6',
        line: '#E2E8F0',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        input: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        pop: '0 10px 25px rgba(15,23,42,0.12)',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
}
