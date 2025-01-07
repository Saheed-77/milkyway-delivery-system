
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        milk: {
          50: "#fdfcfb",
          100: "#f7f4f2",
          200: "#f1eae5",
          300: "#e5d8d0",
          400: "#d4c0b4",
          500: "#bfa293",
          600: "#a48475",
          700: "#8b6b5e",
          800: "#74584d",
          900: "#614a41",
        },
        sage: {
          50: "#f8faf8",
          100: "#eef2ef",
          200: "#d8e3da",
          300: "#b8ccbb",
          400: "#92ad96",
          500: "#738c77",
          600: "#5d715f",
          700: "#4d5d4f",
          800: "#414d43",
          900: "#374139",
        },
        cream: {
          50: "#fefefe",
          100: "#fcfbf9",
          200: "#f9f6f1",
          300: "#f4ede3",
          400: "#ecdfd0",
          500: "#e2ccb7",
          600: "#d4b599",
          700: "#c29b7d",
          800: "#b08366",
          900: "#946d54",
        },
      },
      keyframes: {
        "fade-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-down": {
          "0%": {
            opacity: "0",
            transform: "translateY(-10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out",
        "fade-down": "fade-down 0.5s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
