"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useLowPower } from "@/hooks/use-low-power";
import { cn } from "@/lib/utils";
import rbStyles from "./react-bits-adaptations.module.css";

export interface AnimatedListItemData {
  key: string;
}

export function AnimatedList<T extends AnimatedListItemData>({
  items,
  renderItem,
  className,
  itemClassName,
  emptyState,
  layoutCap = 25,
  ariaLabel,
  testId,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  emptyState?: ReactNode;
  layoutCap?: number;
  ariaLabel?: string;
  testId?: string;
}) {
  const lowPower = useLowPower();
  const enableLayout = !lowPower && items.length <= layoutCap;

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <ul
      data-rb="AnimatedList"
      data-testid={testId}
      aria-label={ariaLabel}
      className={cn("space-y-1.5", className)}
    >
      {items.map((item, index) => {
        if (!enableLayout) {
          return (
            <li
              key={item.key}
              className={cn(
                !lowPower && rbStyles.animatedListItem,
                itemClassName,
              )}
              style={!lowPower ? { animationDelay: `${Math.min(index, 8) * 28}ms` } : undefined}
            >
              {renderItem(item, index)}
            </li>
          );
        }

        return (
          <motion.li
            key={item.key}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              layout: { type: "spring", stiffness: 420, damping: 32 },
              opacity: { duration: 0.2 },
              y: { duration: 0.22 },
            }}
            className={itemClassName}
          >
            {renderItem(item, index)}
          </motion.li>
        );
      })}
    </ul>
  );
}
