/** Static utilities for Company only. Do not use the Play CDN on /company.
 *  Rebuild: npx tailwindcss@3.4.17 -c tailwind.company.config.js -i css/company-tw.src.css -o css/company-tw.css --minify
 */
module.exports = {
  content: [
    './company.html',
    './js/address-autocomplete.js',
    './js/company-chat.js',
    './js/company-crm.js',
    './js/company-staff.js',
    './js/company-traffic.js',
    './js/company-website-control.js',
    './js/print-form.js'
  ],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {}
  },
  safelist: [
    'hidden',
    'block',
    'flex',
    'inline-flex',
    'grid',
    'contents',
    'sr-only'
  ]
};
