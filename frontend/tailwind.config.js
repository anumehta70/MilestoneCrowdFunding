/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ledger: {
          950: "#0a0e1a",
          900: "#0f1424",
          800: "#161d33",
          700: "#212a47",
          600: "#34405f",
          500: "#4d5b80",
          400: "#7886a8",
          300: "#a8b2cc",
          200: "#d2d7e6",
          100: "#eceff7",
          50: "#f6f7fb",
        },
        brass: {
          900: "#5c4313",
          800: "#7a5a1a",
          700: "#977025",
          600: "#b88a32",
          500: "#d4a544",
          400: "#e3bd6c",
          300: "#edd296",
          200: "#f5e4bf",
          100: "#faf1de",
        },
        signal: {
          green: "#3ecf8e",
          amber: "#e3a23a",
          red: "#e1564a",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "vault-grid":
          "linear-gradient(rgba(212,165,68,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,165,68,0.04) 1px, transparent 1px)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slide-up 0.4s ease-out",
      },
      keyframes: {
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
