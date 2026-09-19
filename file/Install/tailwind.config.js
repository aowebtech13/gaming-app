module.exports = {
  content: [
    './views/**/*.ejs',
    './public/**/*.js',
    './public/assets/js/**/*.js',
    './src/**/*.js',
    './resources/**/*.js'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'fadeIn': 'fadeIn 0.2s ease-in-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      }
    }
  },
  plugins: []
};
