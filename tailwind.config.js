/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brutal: {
          yellow: '#FFD440',
          pink: '#FE7DA8',
          lavender: '#BBAFE6',
          cream: '#FFFAEF',
          cyan: '#27CCF3',
          orange: '#F8A16F',
          lime: '#A9D877',
          black: '#141111',
          white: '#FFFFFF',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        brutal: '4px 4px 0px #141111',
        'brutal-sm': '2px 2px 0px #141111',
        'brutal-lg': '6px 6px 0px #141111',
      },
    },
  },
  plugins: [],
}
