export const SMILE_QUOTES = [
  { text: "That smile? Absolutely stunning.", sub: "You light up the room." },
  { text: "Beautiful.", sub: "Your smile tells a story worth hearing." },
  { text: "Gorgeous.", sub: "The world looks better when you smile." },
  { text: "Pure magic.", sub: "That smile is your superpower." },
  { text: "Radiant.", sub: "You were born to shine like this." },
  { text: "Breathtaking.", sub: "A smile like that changes everything." },
  { text: "Absolutely glowing.", sub: "Keep smiling. The world needs it." },
  { text: "That's the one.", sub: "Your smile is your best accessory." },
  { text: "Incredible.", sub: "Never stop sharing that smile." },
  { text: "You're a masterpiece.", sub: "And that smile is the signature." },
];

export function getRandomQuote() {
  return SMILE_QUOTES[Math.floor(Math.random() * SMILE_QUOTES.length)];
}
