"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import { scaleQuantityText, formatScaledNumber } from "@/lib/scale-quantity";
import { proxiedImageUrl } from "@/lib/image-proxy";
import { startsGroup, type ParsedIngredient } from "@/lib/ingredient-parser";

interface Props {
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageAttributionName: string | null;
  imageAttributionUrl: string | null;
  category: string | null;
  cuisine: string | null;
  servings: number | null;
  displayTotal: number | null;
  tags: string[];
  ingredients: ParsedIngredient[];
  instructions: string[];
}

export function SharedRecipeView({
  title,
  description,
  imageUrl,
  imageAttributionName,
  imageAttributionUrl,
  category,
  cuisine,
  servings,
  displayTotal,
  tags,
  ingredients,
  instructions,
}: Props) {
  const SCALE_OPTIONS = [0.5, 1, 2, 3];
  const [scale, setScale] = useState(1);

  return (
    <div className="mt-4">
      <h1 className="font-display text-3xl text-ink">{title}</h1>
      {description && <p className="mt-2 text-ink-light">{description}</p>}

      {imageUrl && (
        <div className="mt-4">
          <div className="relative h-72 w-full overflow-hidden rounded-card bg-linen-200">
            <Image src={proxiedImageUrl(imageUrl)} alt={title} fill className="object-cover" unoptimized />          </div>
          {imageAttributionName && imageAttributionUrl && (
            <p className="mt-1 text-[10px] text-ink-light">
              Photo by{" "}
              <a href={imageAttributionUrl} target="_blank" rel="noreferrer" className="underline">
                {imageAttributionName}
              </a>{" "}
              on Unsplash
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {category && <span className="category-pill">{category}</span>}
        {cuisine && <span className="text-sm text-ink-light">{cuisine}</span>}
        {servings && <span className="measure text-sm">Serves {formatScaledNumber(servings * scale)}</span>}
        {displayTotal ? <span className="measure text-sm">{displayTotal} min total</span> : null}
        {tags.map((t) => <span key={t} className="tag-pill">{t}</span>)}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Ingredients</h2>
            <div className="flex gap-1">
              {SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setScale(opt)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    scale === opt ? "bg-forest text-linen-50" : "bg-linen-100 text-ink-light hover:bg-linen-200"
                  }`}
                >
                  {opt === 0.5 ? "½×" : `${opt}×`}
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {ingredients.map((ing, i) => {
              const heading = startsGroup(ingredients, i);
              return (
                <Fragment key={i}>
                  {heading && <li className="pt-3 font-display text-base text-ink first:pt-0">{heading}</li>}
                  <li className="border-b border-linen-300 pb-2">
                    {ing.quantity && <span className="measure">{scale === 1 ? ing.quantity : scaleQuantityText(ing.quantity, scale)} </span>}
                    {ing.unit && <span className="measure">{ing.unit} </span>}
                    {ing.item}
                  </li>
                </Fragment>
              );
            })}
            {ingredients.length === 0 && <li className="text-ink-light">No ingredients listed.</li>}
          </ul>
        </div>

        <div className="sm:col-span-2">
          <h2 className="font-display text-xl text-ink">Instructions</h2>
          <ol className="mt-3 space-y-4 text-sm">
            {instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-brick">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
            {instructions.length === 0 && <li className="text-ink-light">No instructions listed.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}
