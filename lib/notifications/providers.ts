import { Resend } from "resend";
import type { FailureClass, NotificationChannel } from "./contracts";

export type ProviderSendResult = {
  accepted: boolean;
  providerMessageReference?: string;
  failureClass?: FailureClass;
  safeCode?: string;
  retryAfterSeconds?: number;
};

export interface NotificationProvider {
  readonly channel: Exclude<NotificationChannel, "IN_APP">;
  readonly name: string;
  send(input: { destination: string; subject?: string; body: string; htmlBody?: string; idempotencyKey: string }): Promise<ProviderSendResult>;
}

class NotConfiguredProvider implements NotificationProvider {
  constructor(readonly channel: Exclude<NotificationChannel, "IN_APP">, readonly name: string, private readonly failureClass: FailureClass) {}
  async send(_input?: { destination: string; subject?: string; body: string; htmlBody?: string; idempotencyKey: string }): Promise<ProviderSendResult> {
    void _input;
    return { accepted: false, failureClass: this.failureClass, safeCode: this.name };
  }
}

export class NotConfiguredEmailProvider extends NotConfiguredProvider {
  constructor() {
    super("EMAIL", "EMAIL_PROVIDER_NOT_CONFIGURED", "CONFIGURATION_FAILURE");
  }
}

export class NotConfiguredSmsProvider extends NotConfiguredProvider {
  constructor() {
    super("SMS", "SMS_PROVIDER_NOT_CONFIGURED", "CONFIGURATION_FAILURE");
  }
}

export class NotConfiguredPushProvider extends NotConfiguredProvider {
  constructor(channel: "WEB_PUSH" | "ANDROID_PUSH") {
    super(channel, "PUSH_PROVIDER_NOT_CONFIGURED", "CONFIGURATION_FAILURE");
  }
}

/**
 * Concrete Resend transactional email provider adapter.
 * Uses Resend SDK with error classification and idempotency headers.
 */
export class ResendEmailProvider implements NotificationProvider {
  readonly channel = "EMAIL" as const;
  readonly name = "RESEND_EMAIL";
  private readonly client: Resend;
  private readonly fromAddress: string;

  constructor(apiKey = process.env.RESEND_API_KEY, fromAddress = process.env.EMAIL_FROM ?? "KT Couriers <noreply@ktcouriers.co.za>") {
    if (!apiKey) {
      throw new Error("Resend API key is required to initialize ResendEmailProvider.");
    }
    this.client = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async send(input: { destination: string; subject?: string; body: string; htmlBody?: string; idempotencyKey: string }): Promise<ProviderSendResult> {
    try {
      const response = await this.client.emails.send(
        {
          from: this.fromAddress,
          to: [input.destination],
          subject: input.subject ?? "KT Couriers Notification",
          text: input.body,
          html: input.htmlBody,
          headers: {
            "Idempotency-Key": input.idempotencyKey,
          },
        },
      );

      if (response.error) {
        const errorName = response.error.name?.toLowerCase() || "";
        const errorMessage = response.error.message?.toLowerCase() || "";

        let failureClass: FailureClass = "UNKNOWN_PROVIDER_FAILURE";
        let retryAfterSeconds: number | undefined;

        if (errorName.includes("rate_limit") || errorMessage.includes("rate limit")) {
          failureClass = "PROVIDER_RATE_LIMIT";
          retryAfterSeconds = 60;
        } else if (errorName.includes("validation") || errorMessage.includes("invalid")) {
          failureClass = "INVALID_DESTINATION";
        } else if (errorName.includes("suppression") || errorMessage.includes("suppressed")) {
          failureClass = "SUPPRESSED_DESTINATION";
        } else if (errorName.includes("internal") || errorName.includes("service")) {
          failureClass = "PROVIDER_UNAVAILABLE";
          retryAfterSeconds = 30;
        }

        return {
          accepted: false,
          failureClass,
          safeCode: `RESEND_${response.error.name?.toUpperCase() || "ERROR"}`,
          retryAfterSeconds,
        };
      }

      return {
        accepted: true,
        providerMessageReference: response.data?.id,
      };
    } catch (err) {
      return {
        accepted: false,
        failureClass: "TRANSIENT_NETWORK",
        safeCode: err instanceof Error ? err.name : "RESEND_NETWORK_ERROR",
        retryAfterSeconds: 30,
      };
    }
  }
}
