import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "rgb(223, 208, 184)",
          100: "rgb(223, 208, 184)",
          200: "rgb(223, 208, 184)",
          300: "rgb(148, 137, 121)",
          400: "rgb(148, 137, 121)",
          500: "rgb(148, 137, 121)",
          600: "rgb(148, 137, 121)",
          700: "rgb(57, 62, 70)",
          800: "rgb(57, 62, 70)",
          900: "rgb(57, 62, 70)",
          950: "rgb(34, 40, 49)",
        },
        cyan: {
          200: "rgb(223, 208, 184)",
          300: "rgb(223, 208, 184)",
          400: "rgb(223, 208, 184)",
          500: "rgb(223, 208, 184)",
          700: "rgb(148, 137, 121)",
          900: "rgb(57, 62, 70)",
        },
        rose: {
          300: "rgb(223, 208, 184)",
        },
        sky: {
          600: "rgb(223, 208, 184)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
