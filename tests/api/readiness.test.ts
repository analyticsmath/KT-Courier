import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import { GET } from "@/app/api/ready/route";

const queryRaw = vi.mocked(prisma.$queryRaw);

describe("GET /api/ready", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns 200 when the database check succeeds", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ready",
      database: "reachable",
    });
  });

  it("returns 503 without exposing raw database errors", async () => {
    queryRaw.mockRejectedValue(new Error("postgresql://user:secret@db:5432/app"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "not_ready",
      database: "unreachable",
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("postgresql://");
  });
});
