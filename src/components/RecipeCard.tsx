import Link from "next/link";
import Image from "next/image";
import { proxiedImageUrl } from "@/lib/image-proxy";

export interface RecipeCardData {
  id: string;
  title: string;
  imageUrl: string | null;
  category: string | null;
  cuisine: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  tags: string[];
}

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const splitTime = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const totalTime = splitTime > 0 ? splitTime : recipe.totalMinutes;

  return (
    <Link href={`/recipes/${recipe.id}`} className="recipe-card card block overflow-hidden">
      <div className="relative h-28 w-full bg-linen-200 sm:h-40">
        {recipe.imageUrl ? (
          <Image
            src={proxiedImageUrl(recipe.imageUrl)}
            alt={recipe.title}
            fill
            sizes="(max-width: 640px) 50vw, 300px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-3xl italic text-linen-400">
            {recipe.title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="font-display text-base leading-snug text-ink sm:text-lg">{recipe.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {recipe.category && <span className="category-pill">{recipe.category}</span>}
          {totalTime ? <span className="measure text-xs">{totalTime} min</span> : null}
          {recipe.cuisine && <span className="hidden text-xs text-ink-light sm:inline">{recipe.cuisine}</span>}
        </div>
        {recipe.tags.length > 0 && (
          <div className="mt-2 hidden flex-wrap gap-1 sm:flex">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag-pill">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
