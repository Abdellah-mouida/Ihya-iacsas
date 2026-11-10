import { project } from "@/lib/morocco-projection";
import type { PublicBranch } from "@/lib/branches/types";

/** Deterministically fans out coincident markers without changing saved coordinates. */
export function spreadBranchMarkers<T extends Pick<PublicBranch, "latitude" | "longitude">>(branches: T[]) {
  const placed: Array<{ x: number; y: number }> = [];
  return branches.map((branch, index) => {
    const base = project(branch.latitude, branch.longitude);
    let candidate = base;
    for (let attempt = 0; attempt < 260; attempt += 1) {
      if (placed.every((point) => Math.hypot(point.x - candidate.x, point.y - candidate.y) >= 13)) break;
      const angle = (index + attempt) * 2.399963229728653;
      const radius = 7 + 3.8 * Math.sqrt(attempt + 1);
      candidate = { x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius };
    }
    placed.push(candidate);
    return { branch, point: candidate };
  });
}
