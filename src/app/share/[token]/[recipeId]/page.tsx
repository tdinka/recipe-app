import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ParsedIngredient } from "@/lib/ingredient-parser";
import { SharedRecipeView } from "@/components/SharedRecipeView";

export default async function SharedRecipeDetail({
  params,
}: {
  params: { token: string; recipeId: string };
}) {
  const household = await db.household.findUnique({
    where: { shareToken: params.token },
  });

  if (!household || !household.shareEnabled) notFound();

  const recipe = await db.recipe.findFirst({
    where: { id: params.recipeId, householdId: household.id },
    include: { tags: { include: { tag: true } } },
  });

  if (!recipe) notFound();

  const ingredients: ParsedIngredient[] = JSON.parse(recipe.ingredientsJson);
  const instructions: string[] = JSON.parse(recipe.instructionsJson);
  const tags = recipe.tags.map((rt) => rt.tag.name);

  const totalTime = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const displayTotal = totalTime > 0 ? totalTime : recipe.totalMinutes;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/share/${params.token}`} className="text-sm text-forest hover:underline">
        ← Back to {household.name}'s recipes
      </Link>

      <SharedRecipeView
        title={recipe.title}
        description={recipe.description}
        imageUrl={recipe.imageUrl}
        imageAttributionName={recipe.imageAttributionName}
        imageAttributionUrl={recipe.imageAttributionUrl}
        category={recipe.category}
        cuisine={recipe.cuisine}
        servings={recipe.servings}
        displayTotal={displayTotal}
        tags={tags}
        ingredients={ingredients}
        instructions={instructions}
      />
    </div>
  );
}
