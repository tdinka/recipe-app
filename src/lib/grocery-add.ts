import { db } from "@/lib/db";
import { ITEM_SELECT } from "@/lib/list-auth";
import { DEFAULT_STORE, combineQuantities, guessSection, toNameKey, type Section, type StoreId } from "@/lib/grocery";

interface NewItem {
  name: string;
  quantity?: string | null;
  store?: StoreId;
  section?: Section;
  source?: string;
  // Set for items added from the logged-in app, so no grocery alert goes out for them.
  skipAlert?: boolean;
}

// Adds an item to the family list. If it's already there for the same store,
// the quantities are combined instead of adding a second line.
export async function addGroceryItem(householdId: string, input: NewItem) {
  const { name, quantity = null, store = DEFAULT_STORE, section, source = "manual", skipAlert = false } = input;

  const existing = await db.groceryItem.findFirst({
    where: { householdId, checked: false, store, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    const item = await db.groceryItem.update({
      where: { id: existing.id },
      data: { quantity: combineQuantities(existing.quantity, quantity) },
      select: ITEM_SELECT,
    });
    return { item, merged: true };
  }

  // Reuse the section from the last time this was bought (it may have been corrected by hand).
  const past = section
    ? null
    : await db.archivedGroceryItem.findUnique({
        where: { householdId_nameKey: { householdId, nameKey: toNameKey(name) } },
        select: { section: true },
      });

  const item = await db.groceryItem.create({
    data: {
      name,
      quantity: quantity || null,
      store,
      section: section ?? (past && past.section !== "Other" ? past.section : guessSection(name)),
      householdId,
      source,
      notifiedAt: skipAlert ? new Date() : null,
    },
    select: ITEM_SELECT,
  });
  return { item, merged: false };
}
