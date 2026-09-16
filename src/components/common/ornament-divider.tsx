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
        {/* Islamic geometric motif */}
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
          fill="currentColor"
          opacity="0.9"
        />
        {/* Star */}
        <g
          className="text-green"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.9"
          transform="translate(2 2)"
        >
          <rect x="4.2" y="4.2" width="6" height="6" transform="rotate(45 7.2 7.2)" />
        </g>
      </svg>
      <span className={cn("rule-gold h-px", compact ? "w-10" : "w-16 sm:w-24")} />
    </div>
  );
}