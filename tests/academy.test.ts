import test from "node:test";
import assert from "node:assert/strict";
import { addDays, canUseAcademy, canUseCrm, canUseTickets, fillTemplate, formatMoney, mondayOf, toMinor, weekOf } from "../src/academy/lib/academy.ts";

test("money text becomes exact paise", () => {
  assert.equal(toMinor("19.99"), 1999);
  assert.equal(toMinor("1500"), 150000);
  assert.equal(toMinor("0.5"), 50);
  assert.equal(toMinor("1.10"), 110);
  assert.equal(toMinor("1.999"), null);
  assert.equal(toMinor("-5"), null);
  assert.equal(toMinor("abc"), null);
  assert.equal(formatMoney(150000), "₹1,500.00");
});

test("weeks start on Monday and cross month ends", () => {
  assert.equal(mondayOf("2026-11-01"), "2026-10-26");
  assert.equal(mondayOf("2026-11-02"), "2026-11-02");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(weekOf("2026-10-26").slice(-1), ["2026-11-01"]);
});

test("menus follow organization type, feature and role", () => {
  const org = { type: "academy", features: {} };
  assert.equal(canUseAcademy({ role: "teacher", organizationId: org }, "lectures"), true);
  assert.equal(canUseCrm({ role: "employee", organizationId: { type: "company" }, toolAccess: { crm: true } }), true);
  assert.equal(canUseCrm({ role: "employee", organizationId: { type: "company" } }), false);
  assert.equal(canUseCrm({ role: "org_admin", organizationId: { type: "company" } }), true);
  assert.equal(canUseCrm({ role: "student", organizationId: org }), false);
  assert.equal(canUseCrm({ role: "org_admin", organizationId: { type: "company", features: { crm: false } } }), false);
  assert.equal(canUseCrm({ role: "superadmin", organizationId: null }), false);
  assert.equal(canUseTickets({ role: "superadmin", organizationId: null }), false);
  assert.equal(canUseTickets({ role: "org_admin", organizationId: { type: "company" } }), true);
  assert.equal(canUseTickets({ role: "employee", organizationId: { type: "company" }, toolAccess: { tickets: true } }), true);
  assert.equal(canUseTickets({ role: "employee", organizationId: { type: "company" } }), false);
  assert.equal(fillTemplate("Hi {name} from {org}, {missing}", { name: "Asha", org: "Acme" }), "Hi Asha from Acme, {missing}");
  assert.equal(canUseAcademy({ role: "teacher", organizationId: org }, "fees"), false);
  assert.equal(canUseAcademy({ role: "student", organizationId: org }, "fees"), true);
  assert.equal(canUseAcademy({ role: "manager", organizationId: { type: "company" } }, "fees"), false);
  assert.equal(canUseAcademy({ role: "manager", organizationId: { type: "academy", features: { fees: false } } }, "fees"), false);
  assert.equal(canUseAcademy(null, "fees"), false);
});
