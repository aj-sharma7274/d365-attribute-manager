export default {
  content: ['./src/**/*.{js,jsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'monospace'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          400: '#93b4ff',
          500: '#5c8aff',
          600: '#3366f6',
          700: '#1e45eb',
        },
      },
      animation: {
        'fade-in':  'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}