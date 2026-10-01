import { getCurrentUser } from "@/lib/auth/current-user";
import { readPublicQuote } from "@/lib/client-platform/delivery.service";
import { toQuoteDto } from "@/lib/services/pricing-quote.service";
import { json, failure } from "@/lib/client-platform/api";
export async function GET(
  _req: Request,
  c: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const q = await readPublicQuote((await c.params).id, user?.id);
    const m = q.metadata as {
      serviceName: string;
      turnaround: string;
      bookingInput: {
        pickupAddress: { line1: string };
        dropoffAddress: { line1: string };
      };
    };
    return json({
      ...toQuoteDto(q),
      serviceName: m.serviceName,
      turnaround: m.turnaround,
      parcelSize: (q.ruleSnapshot as { parcelSize: string }).parcelSize,
      pickupSummary: m.bookingInput.pickupAddress.line1,
      dropoffSummary: m.bookingInput.dropoffAddress.line1,
    });
  } catch (e) {
    return failure(e);
  }
}
