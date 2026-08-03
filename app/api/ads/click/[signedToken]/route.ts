import { type NextRequest, NextResponse } from "next/server";
import { AdvertisingServingService } from "@/lib/advertising/serving.service";
import { AdvertisingClickService } from "@/lib/advertising/click.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ signedToken: string }> }) {
  let destinationUrl = "/";
  
  try {
    const { signedToken } = await params;
    
    // 1. Verify signed token (HMAC validation, prevents falsified clicks)
    const payload = AdvertisingServingService.verifySignedToken(signedToken);
    
    if (payload) {
      // 2. Validate expiry and internal destination path (done in token verification & click service)
      const fingerprint = payload.sessionFingerprint || "unknown";
      const userAgent = request.headers.get("user-agent") || "";
      const isBot = /bot|crawler|spider|crawling/i.test(userAgent);
      const userAgentClass = isBot ? "bot" : "human";

      try {
        // 3. Resolve serve decision, 4. Record measurement, 5. Classify validity, 6. Invoke click billing service
        const clickService = new AdvertisingClickService();
        const result = await clickService.processClick(payload, fingerprint, userAgentClass);
        destinationUrl = result.destination;
      } catch (serviceError) {
        // Navigation remains functional if billing/processing fails
        console.error("Non-fatal billing/click processing failure, continuing:", serviceError);
        // Fall back to payload's stored destination path
        if (payload.destinationReference && payload.destinationReference.startsWith("/")) {
          destinationUrl = payload.destinationReference;
        }
      }
    }
  } catch (outerError) {
    console.error("Fatal error during click routing:", outerError);
  }

  // 7. Redirect to pinned KT Couriers destination
  const response = NextResponse.redirect(new URL(destinationUrl, request.url));
  
  // Set safe cache control and security headers
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  return response;
}
