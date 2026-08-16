/** Minimal i18n layer — UI strings never hardcoded in driver-facing screens. */
export type Lang = "en" | "hi" | "hinglish";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "hinglish", label: "Hinglish" },
];

const dict = {
  en: {
    greeting: "Good day",
    currentTrip: "Current trip",
    emptySoon: "Will become empty soon",
    findReturnLoad: "Find return load",
    voiceButton: "Speak to find a load",
    potentialEarning: "Potential extra earning",
    emptyKmAvoided: "Empty KM avoided",
    fuelSaved: "Estimated fuel saved",
    loadsNearYou: "Loads near you",
    matches: "AI return-load matches",
    book: "Request booking",
    noLoads: "No suitable return load found yet.",
  },
  hi: {
    greeting: "नमस्ते",
    currentTrip: "मौजूदा ट्रिप",
    emptySoon: "जल्द खाली होगा",
    findReturnLoad: "रिटर्न लोड ढूँढें",
    voiceButton: "बोलो और लोड ढूँढो",
    potentialEarning: "संभावित अतिरिक्त कमाई",
    emptyKmAvoided: "बचाए गए खाली किलोमीटर",
    fuelSaved: "अनुमानित ईंधन बचत",
    loadsNearYou: "आपके पास के लोड",
    matches: "AI रिटर्न लोड मैच",
    book: "बुकिंग रिक्वेस्ट",
    noLoads: "अभी कोई उपयुक्त रिटर्न लोड नहीं मिला।",
  },
  hinglish: {
    greeting: "Namaste",
    currentTrip: "Current trip",
    emptySoon: "Jald khali hoga",
    findReturnLoad: "Return load dhundo",
    voiceButton: "Bolo aur load dhundo",
    potentialEarning: "Extra kamai (estimated)",
    emptyKmAvoided: "Empty KM bachaye",
    fuelSaved: "Fuel bachat (estimated)",
    loadsNearYou: "Aapke paas ke loads",
    matches: "AI return load matches",
    book: "Booking request bhejo",
    noLoads: "Abhi koi suitable return load nahi mila.",
  },
} as const;

export type TKey = keyof (typeof dict)["en"];

export function t(lang: Lang, key: TKey): string {
  return dict[lang][key] ?? dict.en[key];
}
