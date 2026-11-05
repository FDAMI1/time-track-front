import test from "node:test";
import assert from "node:assert/strict";
import { canUseTimeTracking } from "../src/academy/lib/academy.ts";
import { hasMcqAccess, isMcqStaff } from "../src/mcq/lib/roles.ts";

const academy = { type: "academy" };
const company = { type: "company" };

test("a member opens only the features ticked for them", () => {
  const mcqOnly = { role: "member", organizationId: academy, toolAccess: { mcq: true } };
  const timeOnly = { role: "member", organizationId: company, toolAccess: { timeTracking: true } };
  assert.equal(hasMcqAccess(mcqOnly), true);
  assert.equal(isMcqStaff(mcqOnly), true);
  assert.equal(canUseTimeTracking(mcqOnly), false);
  assert.equal(canUseTimeTracking(timeOnly), true);
  assert.equal(hasMcqAccess(timeOnly), false);
  assert.equal(hasMcqAccess({ role: "member", organizationId: academy, toolAccess: {} }), false);
});

test("member access adds to a role without changing it", () => {
  assert.equal(canUseTimeTracking({ role: "student", toolAccess: { timeTracking: true } }), true);
  assert.equal(canUseTimeTracking({ role: "student" }), false);
  assert.equal(canUseTimeTracking({ role: "teacher" }), true);
  assert.equal(isMcqStaff({ role: "teacher" }), true);
  assert.equal(isMcqStaff({ role: "student", toolAccess: { mcq: true } }), false);
  assert.equal(hasMcqAccess({ role: "student", organizationId: academy }), true);
});
