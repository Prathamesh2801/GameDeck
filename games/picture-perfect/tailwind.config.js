/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Zeal brand type (see packages/brand): Outfit display, Inter body.
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Zeal brand palette. Tailwind v3 needs literal colours for opacity
        // modifiers (bg-brand-purple/20), so these mirror the hex values in
        // packages/brand/brand.css; keep them in sync.
        brand: {
          bg: '#f6f7f5', // app canvas
          card: '#ffffff', // card / panel surface
          'card-deep': '#eef1ee', // deeper surface for gradients
          // primary Zeal green (legacy purple-* names kept so classes resolve)
          purple: '#1c552a',
          'purple-light': '#24703a',
          'purple-dark': '#154421',
          'purple-muted': '#c3ccc5',
          pink: '#1c552a', // primary (titles/icons)
          indigo: '#b97a14', // amber accent
          blue: '#eef1ee', // muted surface (answer idle)
          green: '#2f8a4a', // success
          red: '#c4453b', // error
          orange: '#d9961f', // warning / bronze
          yellow: '#d9961f', // gold accents
          text: '#27322b', // body copy
          'text-muted': '#5f6b63',
          'text-dim': '#6b766e',
          'text-dark': '#142019', // headings / high emphasis
          summary: '#ffffff',
          'summary-deep': '#eef1ee',
          'summary-dark': '#142019',
          'summary-text': '#5f6b63',
          border: '#dfe4e0',
          'border-strong': '#c3ccc5',
          'on-primary': '#ffffff',
        },
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
