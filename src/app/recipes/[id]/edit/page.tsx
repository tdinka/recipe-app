"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RecipeForm, type RecipeFormValues } from "@/components/RecipeForm";
import { parseIngredientLine } from "@/lib/ingredient-parser";

export default function EditRecipePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<RecipeFormValues | null>(null);

  useEffect(() => {
    fetch(`/api/recipes/${params.id}`).then(async (res) => {
      if (!res.ok) return;
      const json = await res.json();
      const r = json.recipe;
      setInitial({
        title: r.title,
        sourceUrl: r.sourceUrl,
        imageUrl: r.imageUrl,
        description: r.description,
        servings: r.servings,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        totalMinutes: r.totalMinutes,
        category: r.category,
        cuisine: r.cuisine,
        ingredientsText: r.ingredients.map((i: { raw: string }) => i.raw).join("\n"),
        instructionsText: r.instructions.join("\n"),
        tagsText: r.tags.join(", "),
      });
    });
  }, [params.id]);

  async function handleSave(values: RecipeFormValues) {
    const payload = {
      title: values.title,
      sourceUrl: values.sourceUrl || null,
      imageUrl: values.imageUrl || null,
      description: values.description || null,
      servings: values.servings,
      prepMinutes: values.prepMinutes,
      cookMinutes: values.cookMinutes,
      totalMinutes: values.totalMinutes,
      category: values.category,
      cuisine: values.cuisine,
      ingredients: values.ingredientsText.split("\n").map((l) => l.trim()).filter(Boolean).map((raw) => parseIngredientLine(raw)),
      instructions: values.instructionsText.split("\n").map((l) => l.trim()).filter(Boolean),
      tags: values.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const res = await fetch(`/api/recipes/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Couldn't save changes.");
    router.push(`/recipes/${params.id}`);
  }

  if (!initial) return <p className="text-ink-light">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl text-ink">Edit recipe</h1>
      <div className="mt-6">
        <RecipeForm initial={initial} onSubmit={handleSave} submitLabel="Save changes" />
      </div>
    </div>
  );
}
