/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        zeus: {
          canvas:    '#F8FAFC',
          surface:   '#FFFFFF',
          panel:     '#F1F5F9',
          border:    '#E2E8F0',
          muted:     '#94A3B8',
          text:      '#334155',
          heading:   '#0F172A',
          accent:    '#0891B2',
          optimal:   '#10B981',
          moderate:  '#F59E0B',
          critical:  '#F43F5E',
          cyan:      '#06B6D4',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.06)',
        card:  '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        lift:  '0 4px 14px rgba(0, 0, 0, 0.08)',
        glow:  '0 0 20px rgba(8, 145, 178, 0.15)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
