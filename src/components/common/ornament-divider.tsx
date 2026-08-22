import { cn } from "@/lib/utils";

export function OrnamentDivider({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center justify-center gap-3 text-brass",
        className,
      )}
    >
      <span className={cn("rule-gold h-px", compact ? "w-10" : "w-16 sm:w-24")} />
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        className="animate-float-slow shrink-0"
      >
        {/* crescent */}
        <path
          d="M16.2 3.4a9 9 0 1 0 4.4 12.3 7 7 0 1 1-4.4-12.3Z"
          fill="currentColor"
          opacity="0.9"
        />
        {/* eight-point star */}
        <g
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.85"
          transform="translate(2 2)"
        >
          <rect x="4.2" y="4.2" width="6" height="6" transform="rotate(45 7.2 7.2)" />
        </g>
      </svg>
      <span className={cn("rule-gold h-px", compact ? "w-10" : "w-16 sm:w-24")} />
    </div>
  );
}
