import type { Config } from 'tailwindcss/types/config';

export default {
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
} as Omit<Config, 'content'>;
