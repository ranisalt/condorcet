import { expect, it } from "vitest";
import { openTestD1 } from "./d1.ts";

it("opens isolated D1 fixtures and disposes both proxies", async () => {
  const fixtures: Awaited<ReturnType<typeof openTestD1>>[] = [];

  try {
    const first = await openTestD1();
    fixtures.push(first);
    const second = await openTestD1();
    fixtures.push(second);

    await first.d1.prepare("CREATE TABLE fixture_probe (value text NOT NULL)").run();
    await first.d1.prepare("INSERT INTO fixture_probe (value) VALUES (?)").bind("first").run();

    const row = await first.d1
      .prepare("SELECT value FROM fixture_probe")
      .first<{ value: string }>();
    expect(row?.value).toBe("first");
    await expect(second.d1.prepare("SELECT value FROM fixture_probe").first()).rejects.toThrow();
  } finally {
    await Promise.all(fixtures.map((fixture) => fixture.dispose()));
  }
});
