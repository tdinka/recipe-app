// Shared grocery list settings: stores, sections, and a quick keyword-based
// section guesser. (Claude takes over sorting later; this stays as the fallback.)

export const STORE_IDS = ["vons", "traderjoes", "costco", "amazon"] as const;
export type StoreId = (typeof STORE_IDS)[number];

export const STORE_LABELS: Record<StoreId, string> = {
  vons: "Vons",
  traderjoes: "Trader Joe's",
  costco: "Costco",
  amazon: "Amazon",
};

export const DEFAULT_STORE: StoreId = "vons";

// Listed roughly in the order you'd walk through a store.
export const SECTIONS = [
  "Produce",
  "Bakery",
  "Meat & Seafood",
  "Deli",
  "Dairy & Eggs",
  "Frozen",
  "Pantry",
  "Breakfast",
  "Snacks",
  "Beverages",
  "Household",
  "Personal Care",
  "Pet",
  "Other",
] as const;
export type Section = (typeof SECTIONS)[number];

export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

// "  Eggs " and "eggs" count as the same item.
export function toNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const KEYWORDS: Record<Exclude<Section, "Other">, string[]> = {
  Produce: ["apple", "banana", "orange", "lemon", "lime", "grape", "berries", "strawberries", "blueberries", "raspberries", "blackberries", "avocado", "tomato", "potato", "sweet potato", "onion", "garlic", "ginger", "carrot", "celery", "cucumber", "lettuce", "romaine", "spinach", "kale", "arugula", "broccoli", "cauliflower", "zucchini", "squash", "bell pepper", "jalapeno", "mushroom", "cilantro", "parsley", "basil", "mint", "scallion", "green onion", "shallot", "cabbage", "corn", "pea", "snap pea", "green bean", "asparagus", "eggplant", "peach", "pear", "plum", "mango", "pineapple", "melon", "watermelon", "cantaloupe", "kiwi", "cherries", "salad", "herb", "fruit", "vegetable"],
  Bakery: ["bread", "bagel", "baguette", "bun", "hamburger bun", "hot dog bun", "tortilla", "croissant", "muffin", "english muffin", "pita", "naan", "sourdough", "cake", "donut"],
  "Meat & Seafood": ["chicken", "chicken breast", "chicken thigh", "beef", "ground beef", "steak", "turkey", "ground turkey", "pork", "pork chop", "bacon", "sausage", "ham", "lamb", "salmon", "shrimp", "fish", "cod", "tilapia", "meatball", "hot dog"],
  Deli: ["deli", "salami", "prosciutto", "pepperoni", "hummus", "rotisserie chicken", "sliced turkey", "lunch meat"],
  "Dairy & Eggs": ["milk", "egg", "cheese", "butter", "yogurt", "cream", "sour cream", "cream cheese", "half and half", "cottage cheese", "oat milk", "almond milk", "mozzarella", "parmesan", "cheddar", "feta", "ghee", "creamer"],
  Frozen: ["ice cream", "popsicle", "gelato", "sorbet", "frozen pizza"],
  Pantry: ["pasta", "spaghetti", "penne", "noodle", "rice", "flour", "sugar", "brown sugar", "oil", "olive oil", "vinegar", "salt", "black pepper", "spice", "cumin", "paprika", "cinnamon", "oregano", "garlic powder", "onion powder", "sauce", "tomato sauce", "pasta sauce", "marinara", "salsa", "soy sauce", "hot sauce", "ketchup", "mustard", "mayo", "mayonnaise", "dressing", "peanut butter", "almond butter", "jam", "jelly", "honey", "bean", "black bean", "chickpea", "lentil", "broth", "chicken broth", "chicken stock", "stock", "canned", "soup", "baking soda", "baking powder", "vanilla", "yeast", "coconut milk", "quinoa", "tuna", "olive"],
  Breakfast: ["cereal", "oatmeal", "oat", "granola", "pancake mix", "waffle", "maple syrup", "syrup"],
  Snacks: ["chip", "tortilla chip", "cracker", "pretzel", "popcorn", "cookie", "nut", "almond", "cashew", "walnut", "trail mix", "granola bar", "candy", "chocolate", "fruit snack", "goldfish"],
  Beverages: ["water", "sparkling water", "soda", "juice", "orange juice", "apple juice", "coffee", "tea", "kombucha", "wine", "beer", "seltzer", "lemonade", "la croix"],
  Household: ["paper towel", "toilet paper", "trash bag", "garbage bag", "dish soap", "dishwasher", "detergent", "laundry", "sponge", "foil", "aluminum foil", "plastic wrap", "ziploc", "napkin", "battery", "batteries", "cleaner", "light bulb", "paper plate"],
  "Personal Care": ["shampoo", "conditioner", "toothpaste", "toothbrush", "deodorant", "soap", "body wash", "lotion", "sunscreen", "floss", "razor", "tissue", "cotton ball"],
  Pet: ["dog food", "cat food", "cat litter", "litter", "dog treat", "pet food"],
};

// Longest keywords are checked first, so "peanut butter" beats "butter"
// and "orange juice" beats "orange".
const KEYWORD_LIST = Object.entries(KEYWORDS)
  .flatMap(([section, words]) =>
    words.map((word) => ({
      section: section as Section,
      pattern: new RegExp(`\\b${word}(s|es)?\\b`),
      length: word.length,
    }))
  )
  .sort((a, b) => b.length - a.length);

export function guessSection(name: string): Section {
  const key = toNameKey(name);
  if (/\bfrozen\b/.test(key)) return "Frozen";
  const match = KEYWORD_LIST.find((k) => k.pattern.test(key));
  return match ? match.section : "Other";
}

// Adding "eggs 2" when "eggs 1" is already listed gives "3".
// Anything that isn't a plain number gets joined: "1 lb + 2 lb".
export function combineQuantities(a: string | null, b: string | null): string | null {
  const first = a?.trim() || "";
  const second = b?.trim() || "";
  if (!first) return second || null;
  if (!second) return first;
  if (/^\d+(\.\d+)?$/.test(first) && /^\d+(\.\d+)?$/.test(second)) {
    return String(Number(first) + Number(second));
  }
  return `${first} + ${second}`;
}
