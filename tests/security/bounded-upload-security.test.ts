import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "@/lib/security/bounded-upload";

describe("Bounded Upload Security", () => {
  it("sanitizes dangerous characters in filenames", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("..etcpasswd");
    expect(sanitizeFilename("evil\\file\0.png")).toBe("evilfile.png");
    expect(sanitizeFilename("my  document  name.pdf")).toBe("my_document_name.pdf");
  });

  it("truncates excessively long filenames", () => {
    const longName = "a".repeat(300) + ".jpg";
    const sanitized = sanitizeFilename(longName);
    expect(sanitized.length).toBeLessThanOrEqual(180);
  });
});
