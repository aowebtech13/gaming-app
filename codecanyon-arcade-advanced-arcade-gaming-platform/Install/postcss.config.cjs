// postcss.config.js
module.exports = {
    plugins: {
        tailwindcss: {},
        autoprefixer: {},    
        "postcss-rtlcss": {
            // invert ltr and rtl prefixes so that left and right would be natural in rtl
            ltrPrefix: '[dir="rtl"]',
            rtlPrefix: '[dir="ltr"]',
        }
    }
};