/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#eebd2b",
        "background-light": "#f8f7f6",
        "background-dark": "#221d10",
        "charcoal": {
          DEFAULT: "#181611",
          50: "#f7f7f6",
          100: "#e5e4e2",
          200: "#cbc9c5",
          300: "#aaa7a1",
          400: "#89857d",
          500: "#6e6a63",
          600: "#57544e",
          700: "#474540",
          800: "#3b3936",
          900: "#33312e",
          950: "#181611",
        },
      },
      fontFamily: {
        "display": ["YUniverse", "sans-serif"]
      },
      borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px"},
    },
  },
  plugins: [],
}

