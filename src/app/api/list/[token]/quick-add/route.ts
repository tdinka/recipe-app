import { householdFromToken } from "@/lib/list-auth";
import { splitQuickAdd } from "@/lib/grocery";
import { addGroceryItem } from "@/lib/grocery-add";

export const dynamic = "force-dynamic";

const MAX_TEXT = 500;
const MAX_ITEMS = 20;

// Used by the "Add to Groceries" Siri Shortcut. Takes whatever was said
// ("milk, bread and 2 avocados"), adds each item to the family list, and
// replies with a plain sentence for Siri to read out.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) return reply("I couldn't find your grocery list. The link may have been reset.", 404);

  const text = (await readText(req)).slice(0, MAX_TEXT);
  const items = splitQuickAdd(text).slice(0, MAX_ITEMS);
  if (items.length === 0) return reply("I didn't catch anything to add.", 400);

  const added: string[] = [];
  const already: string[] = [];
  for (const { name, quantity } of items) {
    const { item, merged } = await addGroceryItem(household.id, { name: name.slice(0, 120), quantity });
    (merged ? already : added).push(item.name);
  }

  const parts = [];
  if (added.length) parts.push(`Added ${joinNames(added)}.`);
  if (already.length) parts.push(`${joinNames(already)} ${already.length === 1 ? "was" : "were"} already on the list.`);
  return reply(parts.join(" "));
}

// Shortcuts can send a form, JSON, or plain text; accept all three.
async function readText(req: Request): Promise<string> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = await req.json();
      return typeof body?.text === "string" ? body.text : "";
    }
    if (type.includes("form")) {
      const value = (await req.formData()).get("text");
      return typeof value === "string" ? value : "";
    }
    return await req.text();
  } catch {
    return "";
  }
}

function joinNames(names: string[]): string {
  const lower = names.map((n) => n.toLowerCase());
  if (lower.length <= 1) return lower.join("");
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

function reply(message: string, status = 200) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
