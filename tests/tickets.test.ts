import test from "node:test";
import assert from "node:assert/strict";
import { countdown, formatDuration } from "../src/tickets/lib/types.ts";

test("durations read naturally", () => {
  assert.equal(formatDuration(null), "Not enough data");
  assert.equal(formatDuration(45 * 60000), "45m");
  assert.equal(formatDuration(130 * 60000), "2h 10m");
  assert.equal(formatDuration(25 * 3600000), "1d 1h");
});

test("countdowns show time left or overdue", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  assert.deepEqual(countdown("2026-11-01T13:00:00Z", now), { overdue: false, text: "1h 0m left" });
  assert.deepEqual(countdown("2026-11-01T11:30:00Z", now), { overdue: true, text: "30m overdue" });
  assert.equal(countdown(undefined, now), null);
});
