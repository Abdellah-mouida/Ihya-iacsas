import { expect, test } from "@playwright/test";
import { spreadBranchMarkers } from "@/lib/branch-marker-layout";

function point(id: number) {
  return { id: `branch-${id}`, latitude: 30.4, longitude: -9.2 };
}

test("coincident markers spread apart for dense branch areas without mutating source coordinates", () => {
  const branches = Array.from({ length: 60 }, (_, index) => point(index));
  const result = spreadBranchMarkers(branches);
  expect(result).toHaveLength(60);
  expect(branches.every((branch) => branch.latitude === 30.4 && branch.longitude === -9.2)).toBe(true);
  for (let left = 0; left < result.length; left += 1) {
    for (let right = left + 1; right < result.length; right += 1) {
      const distance = Math.hypot(result[left].point.x - result[right].point.x, result[left].point.y - result[right].point.y);
      expect(distance, `marker pair ${left}/${right}`).toBeGreaterThanOrEqual(13);
    }
  }
});
