import { expect, it } from "vitest";
import { base64UrlDecode, base64UrlEncode } from "./encoding.ts";

it("round-trips bytes through the unpadded url-safe alphabet", () => {
  const bytes = new Uint8Array([251, 255, 1, 0]);
  expect(base64UrlEncode(bytes)).toBe("-_8BAA");
  expect(base64UrlDecode("-_8BAA")).toEqual(bytes);
});

it.each(["AB==", "AC", " AB", "A B", "A", "+/8B", "AB$C"])("rejects %j", (text) => {
  expect(() => base64UrlDecode(text)).toThrow();
});
