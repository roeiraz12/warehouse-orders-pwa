import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Heebo', 'Arial', 'sans-serif'] },
      // Accessible type scale: nothing below 18px.
      fontSize: {
        sm: ['18px', '1.5'],
        base: ['20px', '1.6'],
        lg: ['22px', '1.5'],
        xl: ['26px', '1.4'],
        '2xl': ['30px', '1.3'],
        '3xl': ['36px', '1.2'],
        '4xl': ['44px', '1.1'],
      },
      minHeight: { touch: '56px', huge: '88px' },
      colors: {
        ok: { DEFAULT: '#15803d', soft: '#dcfce7', ink: '#14532d' },
        warn: { DEFAULT: '#a16207', soft: '#fef9c3', ink: '#713f12', bar: '#eab308' },
        bad: { DEFAULT: '#b91c1c', soft: '#fee2e2', ink: '#7f1d1d' },
        brand: { DEFAULT: '#1e3a8a', soft: '#dbeafe' },
      },
    },
  },
  plugins: [],
} satisfies Config;
