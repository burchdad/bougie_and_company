import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#080604",
        espresso: "#21150e",
        saddle: "#7a3f19",
        champagne: "#d8ae66",
        cream: "#f7efe4",
        ivory: "#fffaf1",
        ember: "#c94f16",
        navy: "#08223e"
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 24px 70px rgba(216, 174, 102, 0.18)",
        luxe: "0 20px 60px rgba(8, 6, 4, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
