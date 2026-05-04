// Minimal i18n stub. Default 'es'. Add 'en' later via flag.
const dict = { es: {} };
let lang = 'es';
export const t = (k) => (dict[lang] && dict[lang][k]) || k;
export const setLang = (l) => { if (dict[l]) lang = l; };
