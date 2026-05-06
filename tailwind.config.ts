import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zao: {
          navy: "#0a1628",
          ink: "#0f1d33",
          accent: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
