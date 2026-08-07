/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  important: '.ai-chat',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
};
