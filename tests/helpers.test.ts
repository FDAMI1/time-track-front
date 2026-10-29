import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { filenameFromDisposition } from "../src/lib/disposition.ts";
import { groupReactions } from "../src/lib/reactions.ts";
import { isLocationRequired } from "../src/lib/geolocation.ts";
import { localDateString } from "../src/lib/utils.ts";
import { parseBulkQuestions } from "../src/mcq/lib/parseQuestions.ts";
import { pctOf, scoreVariant } from "../src/mcq/lib/types.ts";
import { assetUrl } from "../src/lib/asset-url.ts";

describe("assetUrl", () => {
  const cld = "https://res.cloudinary.com/demo/image/upload/v1/portal/orgs/1/logo/abc.png";
  test("adds automatic format and quality to Cloudinary images, once", () => {
    const out = assetUrl(cld, "");
    assert.equal(out, "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/portal/orgs/1/logo/abc.png");
    assert.equal(assetUrl(out, ""), out);
  });
  test("prefixes legacy server paths with the API host", () => {
    assert.equal(assetUrl("/uploads/logo/a.png", "https://api.example.com"), "https://api.example.com/uploads/logo/a.png");
  });
  test("leaves other URLs alone and maps empty values to empty", () => {
    assert.equal(assetUrl("https://cdn.example.com/x.png", ""), "https://cdn.example.com/x.png");
    assert.equal(assetUrl("blob:http://localhost/123", ""), "blob:http://localhost/123");
    assert.equal(assetUrl(undefined, ""), "");
    assert.equal(assetUrl("", ""), "");
  });
});

describe("filenameFromDisposition", () => {
  test("reads quoted and unquoted names", () => {
    assert.equal(filenameFromDisposition('attachment; filename="Report_2026.xlsx"', "x"), "Report_2026.xlsx");
    assert.equal(filenameFromDisposition("attachment; filename=report.docx", "x"), "report.docx");
  });
  test("prefers the RFC 5987 form and decodes it", () => {
    assert.equal(filenameFromDisposition("attachment; filename=\"fallback.pdf\"; filename*=UTF-8''na%C3%AFve.pdf", "x"), "naïve.pdf");
  });
  test("falls back when nothing usable is announced", () => {
    assert.equal(filenameFromDisposition(null, "report.xlsx"), "report.xlsx");
    assert.equal(filenameFromDisposition("inline", "report.xlsx"), "report.xlsx");
  });
});

describe("groupReactions", () => {
  test("collapses repeated emoji and marks the current user's own", () => {
    const chips = groupReactions(
      [
        { userId: "u1", emoji: "heart" },
        { userId: { _id: "u2" }, emoji: "heart" },
        { userId: "u2", emoji: "star" },
      ],
      "u2"
    );
    assert.deepEqual(chips, [
      { emoji: "heart", count: 2, mine: true },
      { emoji: "star", count: 1, mine: true },
    ]);
  });
  test("handles missing input", () => {
    assert.deepEqual(groupReactions(undefined, "u1"), []);
  });
});

describe("isLocationRequired", () => {
  const org = { isLocationRestrictionEnabled: true, location: { latitude: 24.8, longitude: 67 } };
  test("applies the organization setting to members", () => {
    assert.equal(isLocationRequired({ role: "student" }, org), true);
    assert.equal(isLocationRequired({ role: "student" }, { ...org, isLocationRestrictionEnabled: false }), false);
  });
  test("a per-user override wins in both directions", () => {
    assert.equal(isLocationRequired({ role: "student", locationRestrictionEnabled: false }, org), false);
    assert.equal(isLocationRequired({ role: "student", locationRestrictionEnabled: true }, { ...org, isLocationRestrictionEnabled: false }), true);
  });
  test("admins are exempt and nothing is enforced without a configured point", () => {
    assert.equal(isLocationRequired({ role: "org_admin" }, org), false);
    assert.equal(isLocationRequired({ role: "student", locationRestrictionEnabled: true }, { isLocationRestrictionEnabled: true }), false);
    assert.equal(isLocationRequired(null, org), false);
  });
});

describe("localDateString", () => {
  test("uses the local calendar day, not the UTC day", () => {
    // 23:30 local on the 31st is already the next day in UTC for zones east of
    // UTC-0; the helper must still report the local 31st.
    assert.equal(localDateString(new Date(2026, 0, 31, 23, 30)), "2026-01-31");
    assert.equal(localDateString(new Date(2026, 0, 1, 0, 5)), "2026-01-01");
  });
  test("pads month and day", () => {
    assert.equal(localDateString(new Date(2026, 2, 5, 12)), "2026-03-05");
  });
});

describe("parseBulkQuestions", () => {
  test("parses a well-formed block and skips incomplete ones", () => {
    const text = [
      "1. Which property sets text size?",
      "A) text-size",
      "B) font-style",
      "C) font-size",
      "D) text-style",
      "Answer: C",
      "",
      "2. Broken question",
      "A) one",
      "B) two",
      "Answer: A",
    ].join("\n");
    const parsed = parseBulkQuestions(text);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].correctAnswer, 2);
    assert.equal(parsed[0].options[2], "font-size");
  });
});

describe("score helpers", () => {
  test("percentages ignore missing totals", () => {
    assert.equal(pctOf(5, 20), 25);
    assert.equal(pctOf(null, 20), 0);
    assert.equal(pctOf(5, 0), 0);
  });
  test("variants follow the thresholds", () => {
    assert.equal(scoreVariant(70), "default");
    assert.equal(scoreVariant(40), "secondary");
    assert.equal(scoreVariant(39), "destructive");
  });
});
