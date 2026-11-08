import type { Cookies } from "@sveltejs/kit";

/** An in-memory cookie jar: `jar` shows exactly what a handler set or deleted. */
export function fakeCookies() {
  const jar = new Map<string, string>();
  const cookies = {
    get: (name: string) => jar.get(name),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
    serialize: (name: string, value: string) => `${name}=${value}`,
    parse: () => ({}),
  } as unknown as Cookies;
  return { cookies, jar };
}
