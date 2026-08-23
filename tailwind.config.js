/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B0E14",
        panel: "#12161F",
        panelAlt: "#171C27",
        line: "#232838",
        signal: "#4FD1C5",
        signalDim: "#2C9A8F",
        ai: "#8B7CF6",
        text: "#E7EAF0",
        subtext: "#8A93A6",
        danger: "#F16565",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        chat: "14px",
      },
    },
  },
  plugins: [],
};
