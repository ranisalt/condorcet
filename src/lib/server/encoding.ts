export function base64UrlEncode(bytes: Uint8Array): string {
  return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
}

/**
 * Strict decoder: rejects characters outside the alphabet, padding, whitespace, and non-canonical
 * trailing bits. `fromBase64` tolerates the last three, so the input must also round-trip.
 */
export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  const bytes = Uint8Array.fromBase64(text, { alphabet: "base64url" });
  if (base64UrlEncode(bytes) !== text) throw new Error("non-canonical base64url");
  return bytes;
}
