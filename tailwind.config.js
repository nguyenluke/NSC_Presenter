/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#090b0f',
          panel: '#11141c',
          surface: '#171b26',
          elevated: '#1f2433',
          border: '#262c3d',
          accent: '#f97316',
          live: '#ef4444',
          cue: '#10b981',
          media: '#06b6d4'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
