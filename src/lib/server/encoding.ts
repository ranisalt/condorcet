export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Strict decoder: rejects characters outside the alphabet and non-canonical trailing bits. */
export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) {
    throw new Error("invalid base64url");
  }
  const padded =
    text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (base64UrlEncode(bytes) !== text) throw new Error("non-canonical base64url");
  return bytes;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
