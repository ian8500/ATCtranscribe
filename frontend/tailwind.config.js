/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        midnight: "#0b0f1a",
        slate: "#111827",
        accent: "#7c5cff",
      },
    },
  },
  plugins: [],
};
