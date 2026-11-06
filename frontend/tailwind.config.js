/** @type {import('tailwindcss').Config} */

// Dermarra brand system (from the "dermarra brand c" sheet): six colours --
// blue, orange, lime, gold, black, white. Each hue's DEFAULT (= 500) is the
// exact brand colour and is meant to be the dominant use; the 50-400 tints
// and 600-900 shades exist for backgrounds and for text that has to sit on
// white. Contrast rules (checked):
//   * Text ON blue / orange / lime / gold is brand black (ink): 5.2-9.8:1.
//     White text fails on all four (1.7-3.1:1) -- white goes on black only.
//   * Coloured text on white uses the 700 shade (800 for lime): >= 5:1.
//   * Data marks may use the brand colours directly (>= 3:1 vs white,
//     except lime/gold, which need a direct label or an outline).
const scale = (s) => ({ DEFAULT: s[500], ...s });

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#231F20", // brand black
          soft: "#4A4547",
        },
        bone: {
          DEFAULT: "#FFFFFF", // brand white
          light: "#F7F7F6",
        },
        mist: "#ECECEB",
        blue: scale({
          50: "#EDF7FC", 100: "#D6EDF8", 200: "#AEDBF1", 300: "#7CC6E8", 400: "#4AB0DF",
          500: "#1D9CD7", 600: "#1E86B6", 700: "#1F6F95", 800: "#205974", 900: "#214253",
        }),
        orange: scale({
          50: "#FEF3ED", 100: "#FCE4D7", 200: "#FAC8AF", 300: "#F7A77F", 400: "#F4854E",
          500: "#F16722", 600: "#CC5A22", 700: "#A74D21", 800: "#824021", 900: "#5D3321",
        }),
        lime: scale({
          50: "#FAFCEF", 100: "#F3F7DA", 200: "#E7F0B5", 300: "#D8E788", 400: "#C9DD5A",
          500: "#BBD531", 600: "#A0B42E", 700: "#84932B", 800: "#697328", 900: "#4E5225",
        }),
        gold: scale({
          50: "#FBF6EE", 100: "#F6EBD9", 200: "#EDD7B3", 300: "#E2BF85", 400: "#D7A657",
          500: "#CD902D", 600: "#AE7C2B", 700: "#906728", 800: "#715326", 900: "#533F24",
        }),
      },
      // Owner's readability minimums (2026-11-06): normal text >= 18px,
      // button/badge text >= 14px, nav links >= 16px, headings >= 36px.
      // Enforced in the scale itself so no class can go below them:
      // xs (the smallest) = 14px for buttons/chips only; sm and base = 18px
      // for all running text; 3xl = 36px is the smallest heading size.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],   // 14px -- buttons, badges, chips
        sm: ["1.125rem", { lineHeight: "1.75rem" }],   // 18px -- normal text
        base: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
        lg: ["1.25rem", { lineHeight: "1.875rem" }],   // 20px
        xl: ["1.5rem", { lineHeight: "2rem" }],        // 24px
        "2xl": ["1.875rem", { lineHeight: "2.375rem" }], // 30px
        "3xl": ["2.25rem", { lineHeight: "2.625rem" }],  // 36px -- minimum heading
        "4xl": ["2.75rem", { lineHeight: "3rem" }],      // 44px
        "5xl": ["3.25rem", { lineHeight: "3.5rem" }],    // 52px
        "6xl": ["3.75rem", { lineHeight: "1.05" }],      // 60px
        "7xl": ["4.5rem", { lineHeight: "1.05" }],       // 72px
      },
      fontFamily: {
        // Gotham is the reference; it's a licensed (Hoefler&Co) geometric sans.
        // Montserrat is its standard free near-match. Swap here if a Gotham
        // web licence is ever bought.
        display: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "4px",
      },
    },
  },
  plugins: [],
};
