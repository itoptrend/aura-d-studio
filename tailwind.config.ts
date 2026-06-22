import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        black: '#15151A',
        bone: '#F2EDE4',
        gold: '#C9A24B',
        sage: '#7CA985',
        amber: '#C99A4E',
        red: '#C9716A',
        sky: '#7B9BBE',
        paper: '#1C1B23'
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};

export default config;
