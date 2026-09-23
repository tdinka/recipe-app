import { renderAppIcon } from "@/lib/app-icon";

const SIZES = [180, 192, 512];

export function GET(_req: Request, { params }: { params: { variant: string; size: string } }) {
  const requested = Number(params.size);
  const size = SIZES.includes(requested) ? requested : 192;
  const variant = params.variant === "list" ? "list" : "box";
  return renderAppIcon(variant, size);
}
