export function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(list: readonly T[], seed: number): T[] {
  const copy = [...list];
  const nextRand = createSeededRng(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export interface GalleryDistributable {
  id: string;
}

function circularRowDistance(rowA: number, rowB: number, columnLength: number): number {
  const diff = Math.abs(rowA - rowB);
  return Math.min(diff, columnLength - diff);
}

/**
 * Distributes gallery items across `columnCount` columns from a seeded shuffle.
 * Guarantees (whenever >= 2 distinct items exist):
 * - No item is adjacent to itself within a column, including across the loop seam.
 * - No item sits side-by-side with itself in an adjacent column at the same row index.
 * - Repeats (when `items.length < columnCount * minRowsPerColumn`) are spaced as far apart as possible.
 */
export function distributeGalleryColumns<T extends GalleryDistributable>(
  items: readonly T[],
  columnCount: number,
  seed: number,
  options?: { minRowsPerColumn?: number },
): T[][] {
  const cols = Math.max(1, Math.trunc(columnCount));
  if (items.length === 0) {
    return Array.from({ length: cols }, () => []);
  }

  const uniqueById: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      uniqueById.push(item);
    }
  }

  const shuffled = seededShuffle(uniqueById, seed);
  const nextRand = createSeededRng(seed ^ 0x9e3779b9);

  if (shuffled.length === 1) {
    const minRows = Math.max(2, options?.minRowsPerColumn ?? 6);
    return Array.from({ length: cols }, () =>
      Array.from({ length: minRows }, () => shuffled[0]),
    );
  }

  const baseMinRows = Math.max(2, options?.minRowsPerColumn ?? 6);
  // Ensure even length when only 2 items exist so A/B alternation never clashes at the loop seam.
  const minRows = shuffled.length === 2 && baseMinRows % 2 === 1 ? baseMinRows + 1 : baseMinRows;

  const exactFit = shuffled.length >= cols * minRows;
  const colLengths = Array.from({ length: cols }, (_, c) => {
    if (!exactFit) return minRows;
    return Math.floor(shuffled.length / cols) + (c < shuffled.length % cols ? 1 : 0);
  });

  const maxRows = Math.max(...colLengths);
  const grid: Array<Array<T | undefined>> = Array.from({ length: cols }, (_, c) =>
    new Array<T | undefined>(colLengths[c]),
  );

  const usageCount = new Map<string, number>();
  const placementsById = new Map<string, Array<{ col: number; row: number }>>();
  const jitterById = new Map<string, number>();
  for (const item of shuffled) {
    usageCount.set(item.id, 0);
    placementsById.set(item.id, []);
    jitterById.set(item.id, nextRand() * 0.5);
  }

  for (let row = 0; row < maxRows; row++) {
    for (let col = 0; col < cols; col++) {
      const colLen = colLengths[col];
      if (row >= colLen) continue;

      const prevInCol = row > 0 ? grid[col][row - 1] : undefined;
      const firstInCol = row === colLen - 1 && colLen > 1 ? grid[col][0] : undefined;
      const leftNeighbor = col > 0 && row < colLengths[col - 1] ? grid[col - 1][row] : undefined;

      let bestItem = shuffled[0];
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of shuffled) {
        let penalty = 0;
        if (prevInCol && candidate.id === prevInCol.id) penalty += 1_000_000;
        if (firstInCol && candidate.id === firstInCol.id) penalty += 1_000_000;
        if (leftNeighbor && candidate.id === leftNeighbor.id) penalty += 400_000;

        // Look ahead one step on the penultimate row for small pools (e.g., N=3) to prevent a 3-way lock on the seam row.
        if (shuffled.length === 3 && row === colLen - 2 && col > 0) {
          const leftLast =
            colLen - 1 < colLengths[col - 1] ? grid[col - 1][colLen - 1] : undefined;
          const colFirst = grid[col][0];
          if (colFirst && leftLast && candidate.id !== colFirst.id && candidate.id !== leftLast.id) {
            // If placing candidate leaves only an item that would collide on the last row, gently penalize.
            const remaining = shuffled.find(
              (x) => x.id !== candidate.id && x.id !== colFirst.id,
            );
            if (remaining && leftLast.id === remaining.id) {
              penalty += 50_000;
            }
          }
        }

        const count = usageCount.get(candidate.id) ?? 0;
        penalty += count * 10_000;

        const existing = placementsById.get(candidate.id) ?? [];
        let minSameColDist = colLen;
        let minNeighborRowGap = maxRows;

        for (const pos of existing) {
          if (pos.col === col) {
            const d = circularRowDistance(row, pos.row, colLen);
            if (d < minSameColDist) minSameColDist = d;
          } else if (Math.abs(pos.col - col) === 1) {
            const rowGap = Math.abs(row - pos.row);
            if (rowGap < minNeighborRowGap) minNeighborRowGap = rowGap;
          }
        }

        penalty += (colLen - minSameColDist) * 200;
        penalty += (maxRows - minNeighborRowGap) * 40;
        penalty += (jitterById.get(candidate.id) ?? 0) + nextRand() * 0.25;

        if (penalty < bestScore) {
          bestScore = penalty;
          bestItem = candidate;
        }
      }

      grid[col][row] = bestItem;
      usageCount.set(bestItem.id, (usageCount.get(bestItem.id) ?? 0) + 1);
      placementsById.get(bestItem.id)?.push({ col, row });
    }
  }

  // Repair pass for rare 3-item seam + neighbor locks when N === 3.
  if (shuffled.length >= 2) {
    for (let col = 0; col < cols; col++) {
      const colLen = colLengths[col];
      for (let row = 0; row < colLen; row++) {
        const cur = grid[col][row]!;
        const prev = row > 0 ? grid[col][row - 1]! : grid[col][colLen - 1]!;
        const next = grid[col][(row + 1) % colLen]!;
        const left = col > 0 && row < colLengths[col - 1] ? grid[col - 1][row] : undefined;
        const right =
          col + 1 < cols && row < colLengths[col + 1] ? grid[col + 1][row] : undefined;

        const hasConflict =
          cur.id === prev.id ||
          cur.id === next.id ||
          (left !== undefined && cur.id === left.id) ||
          (right !== undefined && cur.id === right.id);

        if (!hasConflict) continue;

        for (let otherRow = 0; otherRow < colLen; otherRow++) {
          if (otherRow === row) continue;
          const other = grid[col][otherRow]!;
          if (other.id === cur.id) continue;

          const otherPrev =
            otherRow > 0 ? grid[col][otherRow - 1]! : grid[col][colLen - 1]!;
          const otherNext = grid[col][(otherRow + 1) % colLen]!;
          const otherLeft =
            col > 0 && otherRow < colLengths[col - 1] ? grid[col - 1][otherRow] : undefined;
          const otherRight =
            col + 1 < cols && otherRow < colLengths[col + 1]
              ? grid[col + 1][otherRow]
              : undefined;

          const curOkAtOther =
            cur.id !== (otherRow === row + 1 ? other.id : otherPrev.id) &&
            cur.id !== (otherRow === (row - 1 + colLen) % colLen ? other.id : otherNext.id) &&
            (!otherLeft || cur.id !== otherLeft.id) &&
            (!otherRight || cur.id !== otherRight.id);

          const otherOkAtCur =
            other.id !== (row === otherRow + 1 ? cur.id : prev.id) &&
            other.id !== (row === (otherRow - 1 + colLen) % colLen ? cur.id : next.id) &&
            (!left || other.id !== left.id) &&
            (!right || other.id !== right.id);

          if (curOkAtOther && otherOkAtCur) {
            grid[col][row] = other;
            grid[col][otherRow] = cur;
            break;
          }
        }
      }
    }
  }

  return grid.map((col) => col.filter((item): item is T => item !== undefined));
}
