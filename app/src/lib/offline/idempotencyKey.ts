const UUID_VERSION_4 = 0x40;
const UUID_VARIANT = 0x80;

function randomUuidFromBytes(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | UUID_VERSION_4;
  bytes[8] = (bytes[8] & 0x3f) | UUID_VARIANT;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newIdempotencyKey(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : randomUuidFromBytes();
}
