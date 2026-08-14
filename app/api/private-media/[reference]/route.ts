import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, forbidden, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response";
import { PrivateMediaPolicyError, PrivateMediaService } from "@/lib/private-media/private-media.service";

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { reference } = await context.params;
  try {
    const media = await new PrivateMediaService().read({ actor: { userId: user.id, role: user.role }, reference });
    return new Response(Buffer.from(media.bytes), { headers: { "Content-Type": media.mimeType, "Content-Disposition": `attachment; filename="${media.fileName.replace(/[\"\\]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof PrivateMediaPolicyError) {
      if (error.status === 403) return forbidden(error.message);
      if (error.status === 404) return notFound(error.message);
      if (error.status === 503) return serviceUnavailable(error.message);
      return badRequest(error.message);
    }
    return badRequest("Private media could not be retrieved.");
  }
}
