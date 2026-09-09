import { PaymentError } from "../../errors";

export function zarToSubunitCents(amount: string | number): number {
  const str = typeof amount === "string" ? amount.trim() : amount.toString();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", `Invalid ZAR amount: ${str}`);
  }
  const [whole, fraction = ""] = str.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  if (cents <= 0n) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", "Payment amount must be greater than zero.");
  }
  return Number(cents);
}

export function subunitCentsToZar(cents: number | bigint): string {
  const c = BigInt(cents);
  const whole = c / 100n;
  const fraction = (c % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

const ALLOWED_PAYSTACK_CHECKOUT_HOSTS = new Set([
  "checkout.paystack.com",
  "standard.paystack.co",
]);

export function validatePaystackAuthorizationUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack did not return an authorization URL.");
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack authorization URL must use HTTPS.");
    }
    const host = parsed.hostname.toLowerCase();
    const isApprovedHost = ALLOWED_PAYSTACK_CHECKOUT_HOSTS.has(host) || host.endsWith(".paystack.com") || host.endsWith(".paystack.co");
    if (!isApprovedHost) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", `Paystack authorization URL domain '${host}' is not permitted.`);
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack authorization URL is malformed.");
  }
}

export type PaystackInitializeInput = Readonly<{
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  metadata?: Readonly<Record<string, unknown>>;
  channels?: readonly string[];
}>;

export type PaystackInitializeData = Readonly<{
  authorization_url: string;
  access_code: string;
  reference: string;
}>;

export type PaystackVerifyData = Readonly<{
  id: number;
  domain: "test" | "live";
  status: "success" | "failed" | "abandoned" | "reversed" | string;
  reference: string;
  amount: number; // in cents
  message: string | null;
  gateway_response: string;
  paid_at: string | null;
  created_at: string;
  channel: string;
  currency: string;
  ip_address: string | null;
  metadata?: Record<string, unknown>;
  customer?: {
    id: number;
    email: string;
    customer_code?: string;
  };
}>;

export type PaystackRefundInput = Readonly<{
  transaction: string;
  amountCents: number;
  currency?: "ZAR";
  merchantNote?: string;
}>;

export type PaystackRefundData = Readonly<{
  id: number;
  transaction: {
    id: number;
    reference: string;
  };
  deducted_amount: number;
  currency: string;
  status: "pending" | "processed" | "failed" | string;
  refunded_by?: string;
  merchant_note?: string;
  createdAt?: string;
  updatedAt?: string;
}>;

export class PaystackClient {
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor(options: { secretKey: string; baseUrl?: string }) {
    this.secretKey = options.secretKey;
    this.baseUrl = (options.baseUrl || "https://api.paystack.co").replace(/\/+$/, "");
  }

  private async request<T>(
    path: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
      signal?: AbortSignal;
    },
  ): Promise<{ status: boolean; message: string; data: T }> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      throw new PaymentError("PAYMENT_PROVIDER_UNAVAILABLE", "Network communication with Paystack failed.", true);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack response was not valid JSON.", true);
    }

    if (!response.ok || !payload || typeof payload !== "object") {
      const message = typeof (payload as { message?: unknown })?.message === "string" ? (payload as { message: string }).message : "Paystack API request failed.";
      if (response.status === 401 || response.status === 403) {
        throw new PaymentError("PAYMENT_PROVIDER_AUTHENTICATION_FAILED", "Paystack authentication failed.");
      }
      if (response.status === 429) {
        throw new PaymentError("PAYMENT_PROVIDER_RATE_LIMITED", "Paystack API rate limit encountered.", true);
      }
      if (response.status >= 500) {
        throw new PaymentError("PAYMENT_PROVIDER_UNAVAILABLE", `Paystack server error: ${message}`, true);
      }
      throw new PaymentError("PAYMENT_PROVIDER_REQUEST_INVALID", `Paystack rejected request: ${message}`);
    }

    return payload as { status: boolean; message: string; data: T };
  }

  async initializeTransaction(
    input: PaystackInitializeInput,
    signal?: AbortSignal,
  ): Promise<PaystackInitializeData> {
    const body: Record<string, unknown> = {
      email: input.email,
      amount: input.amountCents,
      currency: "ZAR",
      reference: input.reference,
      callback_url: input.callbackUrl,
    };
    if (input.metadata) {
      body.metadata = input.metadata;
    }
    if (input.channels && input.channels.length > 0) {
      body.channels = input.channels;
    }

    const response = await this.request<PaystackInitializeData>("/transaction/initialize", {
      method: "POST",
      body,
      signal,
    });

    if (!response.status || !response.data?.authorization_url) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack failed to initialize transaction.");
    }

    validatePaystackAuthorizationUrl(response.data.authorization_url);

    return response.data;
  }

  async verifyTransaction(
    reference: string,
    signal?: AbortSignal,
  ): Promise<PaystackVerifyData> {
    const response = await this.request<PaystackVerifyData>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: "GET", signal },
    );

    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack transaction verification returned no data.");
    }

    return response.data;
  }

  async createRefund(
    input: PaystackRefundInput,
    signal?: AbortSignal,
  ): Promise<PaystackRefundData> {
    const body: Record<string, unknown> = {
      transaction: input.transaction,
      amount: input.amountCents,
      currency: input.currency || "ZAR",
    };
    if (input.merchantNote) {
      body.merchant_note = input.merchantNote;
    }

    const response = await this.request<PaystackRefundData>("/refund", {
      method: "POST",
      body,
      signal,
    });

    if (!response.status || !response.data) {
      throw new PaymentError("REFUND_PROVIDER_RESPONSE_INVALID", "Paystack refund request returned no data.");
    }

    return response.data;
  }

  async getRefund(
    refundId: string | number,
    signal?: AbortSignal,
  ): Promise<PaystackRefundData> {
    const response = await this.request<PaystackRefundData>(
      `/refund/${encodeURIComponent(refundId.toString())}`,
      { method: "GET", signal },
    );

    if (!response.status || !response.data) {
      throw new PaymentError("REFUND_PROVIDER_RESPONSE_INVALID", "Paystack refund query returned no data.");
    }

    return response.data;
  }
}
