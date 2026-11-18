import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      brand:'#078bb4','brand-dark':'#08739a','brand-deep':'#075779',
      ok:'#16875d',warn:'#a86b0d',bad:'#c93a3a',
      ink:'#10263b',ink2:'#607487',line:'#e2edf3'
    },
    fontFamily: { sans: ['var(--font-inter)','system-ui','sans-serif'] },
  }},
  plugins: [],
};
export default config;
