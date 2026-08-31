import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        linen: {
          DEFAULT: "#EFEADD",
          50: "#FAF8F2",
          100: "#F4F0E5",
          200: "#EFEADD",
          300: "#E3DBC7",
          400: "#D3C7A9",
        },
        ink: {
          DEFAULT: "#2B2A24",
          light: "#514F44",
        },
        brick: {
          DEFAULT: "#A6402B",
          dark: "#853321",
          50: "#F6E8E3",
        },
        mustard: {
          DEFAULT: "#C99A2E",
          dark: "#A67F24",
          50: "#F7EDD6",
        },
        forest: {
          DEFAULT: "#445940",
          dark: "#333F30",
          50: "#E4E9E1",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(43,42,36,0.06), 0 4px 14px rgba(43,42,36,0.07)",
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
