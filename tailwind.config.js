/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./.storybook/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        voxi: {
          DEFAULT: "#6C63FF",
          50: "#f0efff",
          100: "#e2e0ff",
          500: "#6C63FF",
          600: "#5a52e8",
          700: "#4840d1",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
