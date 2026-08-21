/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bone: {
          DEFAULT: "#FFFFFF",
          light: "#F7F7F6",
        },
        ink: "#64615A",
        sage: {
          DEFAULT: "#84C665",
          light: "#AFDA9B",
          dark: "#63954C",
        },
        amber: {
          DEFAULT: "#F47A53",
          light: "#F8A98F",
          dark: "#B75C3E",
        },
        sky: {
          DEFAULT: "#00C0F3",
          light: "#59D6F7",
          dark: "#0090B6",
        },
        clay: "#B75C3E",
        mist: "#ECECEB",
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
