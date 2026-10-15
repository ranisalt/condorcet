import { expect, it } from "vitest";
import { privateResponse } from "./private-response.ts";

it("prevents shared caching while preserving response body and status", async () => {
  const original = new Response("private voting data", {
    status: 409,
    statusText: "Conflict",
    headers: { "Cache-Control": "public, max-age=3600", "X-Request-ID": "fixture" },
  });
  const response = privateResponse(original);
  expect(response.status).toBe(409);
  expect(response.statusText).toBe("Conflict");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-request-id")).toBe("fixture");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("same-origin");
  expect(await response.text()).toBe("private voting data");
  expect(original.headers.get("cache-control")).toBe("public, max-age=3600");
});

it("preserves separate session cookies including expiry commas", () => {
  const headers = new Headers();
  headers.append("Set-Cookie", "session=fixture; HttpOnly; SameSite=Lax; Path=/");
  headers.append("Set-Cookie", "state=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/");
  const original = new Response(null, { status: 303, headers });
  original.headers.set("Location", "/ballot");
  const response = privateResponse(original);
  expect(response.headers.getSetCookie()).toEqual(original.headers.getSetCookie());
  expect(response.headers.getSetCookie()).toHaveLength(2);
  expect(response.headers.get("location")).toBe("/ballot");
  expect(response.status).toBe(303);
});
