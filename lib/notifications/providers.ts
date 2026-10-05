import { Resend } from "resend";
import type { FailureClass, NotificationChannel } from "./contracts";

export type ProviderSendResult = {
  accepted: boolean;
  providerMessageReference?: string;
  failureClass?: FailureClass;
  safeCode?: string;
  retryAfterSeconds?: number;
};

export type ProviderSendInput = {
  destination: string;
  subject?: string;
  body: string;
  htmlBody?: string;
  replyTo?: string;
  idempotencyKey: string;
};

export interface NotificationProvider {
  readonly channel: Exclude<NotificationChannel, "IN_APP">;
  readonly name: string;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}

class NotConfiguredProvider implements NotificationProvider {
  constructor(
    readonly channel: Exclude<NotificationChannel, "IN_APP">,
    readonly name: string,
    private readonly failureClass: FailureClass,
  ) {}
  async send(_input?: ProviderSendInput): Promise<ProviderSendResult> {
    void _input;
    return {
      accepted: false,
      failureClass: this.failureClass,
      safeCode: this.name,
    };
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
 * Uses Resend SDK with error classification and stable idempotency keys.
 */
export class ResendEmailProvider implements NotificationProvider {
  readonly channel = "EMAIL" as const;
  readonly name = "RESEND_EMAIL";
  private readonly client: Resend;
  private readonly fromAddress: string;
  private readonly defaultReplyTo?: string;

  constructor(
    apiKey = process.env.RESEND_API_KEY,
    fromAddress = process.env.EMAIL_FROM,
    replyTo = process.env.EMAIL_REPLY_TO,
  ) {
    if (
      !apiKey?.trim() ||
      !fromAddress?.trim() ||
      /[\r\n]/.test(fromAddress) ||
      (replyTo && /[\r\n]/.test(replyTo))
    ) {
      throw new Error(
        "An email provider credential and explicit safe sender are required.",
      );
    }
    this.client = new Resend(apiKey);
    this.fromAddress = fromAddress;
    this.defaultReplyTo = replyTo?.trim() || undefined;
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    try {
      const response = await this.client.emails.send(
        {
          from: this.fromAddress,
          to: [input.destination],
          subject: input.subject ?? "KT Couriers Notification",
          text: input.body,
          html: input.htmlBody,
          replyTo: input.replyTo ?? this.defaultReplyTo,
        },
        { idempotencyKey: input.idempotencyKey },
      );

      if (response.error) {
        const errorName = response.error.name?.toLowerCase() || "";
        const status = response.error.statusCode;

        let failureClass: FailureClass = "UNKNOWN_PROVIDER_FAILURE";
        let retryAfterSeconds: number | undefined;

        if (
          status === 401 ||
          ["invalid_api_key", "missing_api_key", "restricted_api_key"].includes(
            errorName,
          )
        ) {
          failureClass = "AUTHENTICATION_FAILURE";
        } else if (
          status === 403 ||
          [
            "invalid_from_address",
            "monthly_quota_exceeded",
            "daily_quota_exceeded",
          ].includes(errorName)
        ) {
          failureClass = "CONFIGURATION_FAILURE";
        } else if (status === 429 || errorName === "rate_limit_exceeded") {
          failureClass = "PROVIDER_RATE_LIMIT";
          retryAfterSeconds = 60;
        } else if (
          status === 409 &&
          errorName === "concurrent_idempotent_requests"
        ) {
          failureClass = "PROVIDER_UNAVAILABLE";
          retryAfterSeconds = 30;
        } else if (
          status === 422 ||
          [
            "validation_error",
            "invalid_idempotency_key",
            "invalid_idempotent_request",
          ].includes(errorName)
        ) {
          failureClass = "CONTENT_REJECTED";
        } else if (
          (status !== null && status !== undefined && status >= 500) ||
          errorName === "internal_server_error" ||
          errorName === "application_error"
        ) {
          failureClass = "PROVIDER_UNAVAILABLE";
          retryAfterSeconds = 30;
        }

        return {
          accepted: false,
          failureClass,
          safeCode: `RESEND_${failureClass}`,
          retryAfterSeconds,
        };
      }

      if (!response.data?.id?.trim()) {
        return {
          accepted: false,
          failureClass: "UNKNOWN_PROVIDER_FAILURE",
          safeCode: "RESEND_RESPONSE_UNCONFIRMED",
          retryAfterSeconds: 30,
        };
      }
      return {
        accepted: true,
        providerMessageReference: response.data.id,
      };
    } catch {
      return {
        accepted: false,
        failureClass: "TRANSIENT_NETWORK",
        safeCode: "RESEND_NETWORK_ERROR",
        retryAfterSeconds: 30,
      };
    }
  }
}
