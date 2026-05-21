import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.05)',
      },
    },
  },
  plugins: [],
} satisfies Config;
