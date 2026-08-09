import type { FailureClass, NotificationChannel } from "./contracts";

export type ProviderSendResult = { accepted: boolean; providerMessageReference?: string; failureClass?: FailureClass; safeCode?: string; retryAfterSeconds?: number };
export interface NotificationProvider { readonly channel: Exclude<NotificationChannel, "IN_APP">; readonly name: string; send(input: { destination: string; subject?: string; body: string; htmlBody?: string; idempotencyKey: string }): Promise<ProviderSendResult>; }

class NotConfiguredProvider implements NotificationProvider {
  constructor(readonly channel: Exclude<NotificationChannel, "IN_APP">, readonly name: string, private readonly failureClass: FailureClass) {}
  async send(_input?: { destination: string; subject?: string; body: string; htmlBody?: string; idempotencyKey: string }): Promise<ProviderSendResult> { void _input; return { accepted: false, failureClass: this.failureClass, safeCode: this.name }; }
}
export class NotConfiguredEmailProvider extends NotConfiguredProvider { constructor() { super("EMAIL", "EMAIL_PROVIDER_NOT_CONFIGURED", "CONFIGURATION_FAILURE"); } }
export class NotConfiguredSmsProvider extends NotConfiguredProvider { constructor() { super("SMS", "SMS_PROVIDER_NOT_CONFIGURED", "CONFIGURATION_FAILURE"); } }
export class NotConfiguredPushProvider extends NotConfiguredProvider { constructor(channel: "WEB_PUSH" | "ANDROID_PUSH") { super(channel, "PUSH_PROVIDER_NOT_CONFIGURED", "CONFIGURATION_FAILURE"); } }
