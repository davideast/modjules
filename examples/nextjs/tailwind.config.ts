import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#715cd7',
        'background-light': '#f6f6f8',
        'background-dark': '#15131f',
        'card-light': '#FFFFFF',
        'card-dark': '#161B22',
        'text-light': '#24292F',
        'text-dark': '#C9D1D9',
        'meta-light': '#57606A',
        'meta-dark': '#8B949E',
        'border-light': '#D0D7DE',
        'border-dark': '#30363D',
        'code-bg-light': '#F6F8FA',
        'code-bg-dark': '#010409',
      },
      fontFamily: {
        display: ['Geist Sans', 'Public Sans', 'Space Grotesk', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['Source Code Pro', 'Roboto Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};

export default config;
