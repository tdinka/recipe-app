export const CATEGORIES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Dessert",
  "Snack",
  "Drink",
  "Side",
  "Sauce/Base",
] as const;

export const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

// sessionStorage key for an AI idea handed from "What can I make?" to the add-recipe page.
export const IDEA_DRAFT_KEY = "recipeIdeaDraft";
