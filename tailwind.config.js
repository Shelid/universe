/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      colors: {
        cosmos: {
          950: '#02040a',
          900: '#060b19',
          800: '#0c162d',
          700: '#15254a',
          accent: '#38bdf8',
          gold: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}

