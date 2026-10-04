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

// Words that describe how an ingredient is prepped or what size it is, rather
// than what to buy. Stripped so "2 large eggs, beaten" goes on the list as "Eggs".
const PREP_WORDS = [
  "fresh", "freshly", "chopped", "diced", "minced", "sliced", "grated", "shredded",
  "crushed", "peeled", "cubed", "halved", "quartered", "trimmed", "rinsed", "drained",
  "softened", "melted", "beaten", "cooked", "packed", "sifted", "toasted",
  "finely", "roughly", "coarsely", "thinly", "thickly", "lightly",
  "large", "medium", "small", "extra-large", "jumbo",
  "all-purpose", "extra-virgin", "extra virgin", "unsalted", "salted",
  "boneless", "skinless", "room temperature", "cold", "warm", "divided", "optional",
];
const PREP_PATTERN = new RegExp(
  `\\b(${PREP_WORDS.map((w) => w.replace(/[-\s]/g, "[-\\s]")).join("|")})\\b`,
  "g"
);
// Amounts written as words, e.g. "a pinch of salt" or "1 (14 oz) can tomatoes".
const LEADING_AMOUNT =
  /^((a|an|some|few|handful|pinch|pinches|dash|splash|can|cans|jar|jars|package|packages|pkg|bag|bags|box|boxes|bottle|bottles|bunch|bunches|head|heads|clove|cloves|stick|sticks|cup|cups|tbsp|tsp|oz|lb|lbs)\s+)+(of\s+)?/;

// Things sold in a container, where the full product name and size matter:
// "1 (14 oz) can diced tomatoes" → "Can of diced tomatoes (14 oz)".
const CONTAINERS: Record<string, string> = {
  can: "can", cans: "can", tin: "tin", tins: "tin", jar: "jar", jars: "jar",
  package: "package", packages: "package", pkg: "package", bag: "bag", bags: "bag",
  box: "box", boxes: "box", bottle: "bottle", bottles: "bottle", carton: "carton",
  cartons: "carton", container: "container", containers: "container", tub: "tub", tubs: "tub",
};
const CONTAINER_PATTERN = new RegExp(
  "^(?:(?:[\\d/.½¼¾⅓⅔⅛-]+|an?|one|two)\\s+)*" + // how many: "1", "1 1/2", "a", "one"
    "(?:\\(([^)]*)\\)\\s*|(\\d+(?:\\.\\d+)?[-\\s]?(?:oz|ounces?|fl\\.? oz|ml|g|grams?|lbs?|pounds?|l|liters?))\\s+)?" + // size
    `(${Object.keys(CONTAINERS).join("|")})\\b\\s*(?:of\\s+)?(.+)$`
);

function containerName(text: string): string | null {
  const match = text.match(CONTAINER_PATTERN);
  if (!match) return null;
  const [, parenSize, plainSize, container, afterContainer] = match;
  // The size can also come after the container: "box (16 oz) penne pasta".
  const late = afterContainer.match(/^\(([^)]*)\)\s*(.*)$/);
  const rest = late ? late[2] : afterContainer;
  const product = rest
    .split(/,|;|\bor\b|\bfor\b/)[0] // ", drained" is prep, not part of the product
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!product) return null;
  const size = (parenSize ?? plainSize ?? late?.[1] ?? "")
    .replace(/^about\s+/, "")
    .replace(/(\d)-(?=[a-z])/, "$1 ") // "14-ounce" → "14 ounce"
    .trim();
  const name = `${CONTAINERS[container]} of ${product}${size ? ` (${size})` : ""}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function cleanPart(part: string): string {
  let name = part.replace(/^[\d\s/.½¼¾⅓⅔⅛-]+/, " ").trim();
  name = name.replace(LEADING_AMOUNT, "");
  name = name.replace(/^(juice|zest) of\s+(\d+\s+|an?\s+)?/, ""); // "juice of 1 lemon" → "lemon"
  name = name.replace(PREP_PATTERN, " ");
  return name.replace(/[^a-z0-9'&\s-]/g, " ").replace(/\s+/g, " ").replace(/^[\s-]+|[\s-]+$/g, "");
}

// Turns a recipe ingredient into a plain grocery item name:
// "all-purpose flour, sifted" → "Flour", "a pinch of salt" → "Salt".
export function genericIngredientName(ingredient: string): string {
  const lower = ingredient.toLowerCase().replace(/\s+/g, " ").trim();
  const container = containerName(lower);
  if (container) return container;

  // Use the first part that names a food: "salted, roasted peanuts" skips "salted".
  const parts = lower
    .replace(/\([^)]*\)/g, " ") // "(14 oz)", "(about 2 cups)"
    .split(/,|;|\bor\b|\bfor\b|\bto taste\b|\bplus\b/); // "…, chopped", "… or water"
  const name = parts.map(cleanPart).find(Boolean) ?? "";

  const fallback = ingredient.split(",")[0].trim();
  const result = name || fallback;
  return result.charAt(0).toUpperCase() + result.slice(1);
}
