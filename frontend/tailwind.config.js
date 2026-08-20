/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bone: {
          DEFAULT: "#EDEAE2",
          light: "#F6F4EE",
        },
        ink: "#1F2A24",
        sage: {
          DEFAULT: "#5C6F5D",
          light: "#8AA089",
          dark: "#3E4C3F",
        },
        amber: {
          DEFAULT: "#B5702C",
          light: "#D89B5D",
          dark: "#8A5220",
        },
        clay: "#A8574E",
        mist: "#D8D2C4",
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        body: ["'Public Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "4px",
      },
    },
  },
  plugins: [],
};
