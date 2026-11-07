import { cn } from "@/lib/utils";

interface PageBackgroundProps {
  variant?: "default" | "auth" | "profile" | "content" | "admin";
  className?: string;
  children?: React.ReactNode;
  showOrnaments?: boolean;
}

/** Layout compatibility wrapper; the actual atmosphere is mounted once in RootLayout. */
export function PageBackground({
  variant = "default",
  className,
  children,
}: PageBackgroundProps) {
  return (
    <div
      data-testid="page-background"
      data-variant={variant}
      className={cn("relative isolate min-h-screen w-full overflow-hidden text-foreground", className)}
    >
      {children}
    </div>
  );
}
