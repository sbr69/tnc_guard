import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        "ClarifyLaw": "ClarifyLaw",
        "Close": "Close",
        "Analyzing": "Analyzing",
        "Safety Score": "Safety Score",
        "Risk Flags": "Risk Flags",
        "Check Summary": "Check Summary",
        "No significant risks detected.": "No significant risks detected.",
        "This site's policies appear fair and standard.": "This site's policies appear fair and standard.",
        "Scanned": "Scanned"
      }
    }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export const t = (key: string, options?: any): string => i18n.t(key, options) as unknown as string;
export default i18n;
