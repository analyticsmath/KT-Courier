export const dynamic = "force-static";
export async function GET() { return Response.json({ title: "KT Couriers Public Developer API", currentMajorVersion: "v1", openapi: "/api/openapi/v1.json", documentation: "/developers/documentation", support: "/contact" }); }
