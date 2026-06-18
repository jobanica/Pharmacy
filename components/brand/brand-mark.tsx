import { cn } from "@/lib/utils";

/**
 * Reseta brand mark — a teal tile with the Rx prescription glyph. Self-contained
 * (carries its own colors) so it looks consistent in any theme. Size via
 * className, e.g. `<BrandMark className="size-8" />`.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Reseta"
      className={cn("size-8", className)}
    >
      <defs>
        <linearGradient id="reseta-mark-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#reseta-mark-g)" />
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="26"
        fontWeight="700"
      >
        Rx
      </text>
    </svg>
  );
}
