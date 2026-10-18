"use client";

import React from "react";
import Link, { LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface ActiveLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  exact?: boolean;
  target?: string;
  rel?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  "data-testid"?: string;
  "aria-label"?: string;
}

/**
 * Universal active link component.
 * Automatically inspects the current route pathname and applies active styling
 * and `aria-current="page"` when matched.
 */
export function ActiveLink({
  href,
  children,
  className,
  activeClassName = "text-primary font-semibold",
  inactiveClassName = "text-muted-foreground hover:text-foreground",
  exact = false,
  ...rest
}: ActiveLinkProps) {
  const pathname = usePathname();
  const hrefString = typeof href === "string" ? href : href.pathname || "";

  // Normalize path without hash or query
  const cleanHref = hrefString.split("?")[0].split("#")[0];
  const cleanPathname = pathname.split("?")[0].split("#")[0];

  const isActive = exact || cleanHref === "/"
    ? cleanPathname === cleanHref
    : cleanPathname === cleanHref || cleanPathname.startsWith(`${cleanHref}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(className, isActive ? activeClassName : inactiveClassName)}
      {...rest}
    >
      {children}
    </Link>
  );
}
