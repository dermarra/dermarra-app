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
        // Dermarra brand blue -- the logo/favicon mark (#009ee2), built out
        // into a scale. The admin area's primary colour. Contrast on white
        // (checked): 500 = 3.0 (accents/large only), 600 = 4.1 (chart marks,
        // large text), 700 = 5.9 and 800 = 8.7 (buttons with white text,
        // body-size text and links).
        brand: {
          50: "#EAF7FD",
          100: "#D2EEFA",
          200: "#A6DCF4",
          300: "#6FC6EC",
          400: "#33B0E6",
          DEFAULT: "#009EE2",
          500: "#009EE2",
          600: "#0086C0",
          700: "#006B9A",
          800: "#005077",
          900: "#003852",
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
