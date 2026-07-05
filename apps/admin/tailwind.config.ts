import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        adminbg: { DEFAULT: "#0F172A" },
        purple: { DEFAULT: "#7C3AED" },
      },
    },
  },
  plugins: [],
};

export default config;
