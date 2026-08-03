/** PHP urlencode / RFC 1738 compatible UTF-8 encoding required by Payfast. */
export function payfastUrlEncode(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  let encoded = "";
  for (const byte of bytes) {
    const unreserved = (byte >= 0x41 && byte <= 0x5a)
      || (byte >= 0x61 && byte <= 0x7a)
      || (byte >= 0x30 && byte <= 0x39)
      || byte === 0x2d
      || byte === 0x5f
      || byte === 0x2e;
    if (unreserved) encoded += String.fromCharCode(byte);
    else if (byte === 0x20) encoded += "+";
    else encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return encoded;
}
