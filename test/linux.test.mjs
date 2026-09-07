import assert from "node:assert/strict";
import test from "node:test";
import { parseStat } from "../lib/linux.mjs";

test("proc stat parser preserves full-width ticks and handles parentheses in comm", () => {
  const line =
    "123 (odd ) name\n) S " +
    Array(18).fill("0").join(" ") +
    " 18446744073709551615 0";
  assert.deepEqual(parseStat(line, 123), {
    state: "S",
    startTime: "18446744073709551615",
  });
  for (const bad of [
    line.replace("123 (", "124 ("),
    "123 (name) S",
    line.replace("18446744073709551615", "18446744073709551616"),
    line.replace(") S ", ") ? "),
  ]) {
    assert.equal(parseStat(bad, 123), null);
  }
});
