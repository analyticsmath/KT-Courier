import { PaymentError } from "../../errors";

export const MAX_PAYSTACK_TRANSACTION_CENTS = 1_000_000_000; // R10,000,000.00 cap

export function assertValidPaystackTransactionAmount(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_PAYSTACK_TRANSACTION_CENTS) {
    throw new PaymentError(
      "PAYMENT_AMOUNT_INVALID",
      `Paystack transaction amount must be a safe positive integer up to ${MAX_PAYSTACK_TRANSACTION_CENTS} cents (R10,000,000.00).`,
    );
  }
}

export function zarToSubunitCents(amount: string | number, maxCents?: number): number {
  const str = typeof amount === "string" ? amount.trim() : amount.toString();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", `Invalid ZAR amount: ${str}`);
  }
  const [whole, fraction = ""] = str.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  if (cents <= 0n) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", "Payment amount must be greater than zero.");
  }
  const centsNum = Number(cents);
  if (!Number.isSafeInteger(centsNum)) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", "Payment amount exceeds safe integer precision.");
  }
  if (maxCents !== undefined && centsNum > maxCents) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", `Payment amount exceeds maximum transaction limit (${maxCents} cents).`);
  }
  return centsNum;
}

export function subunitCentsToZar(cents: number | bigint): string {
  const c = BigInt(cents);
  if (c < 0n) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", `Invalid subunit cents: ${cents}`);
  }
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
    if (!ALLOWED_PAYSTACK_CHECKOUT_HOSTS.has(host)) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", `Paystack authorization URL domain '${host}' is not permitted.`);
    }
    if (parsed.port !== "" && parsed.port !== "443") {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", `Paystack authorization URL custom port '${parsed.port}' is not permitted.`);
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

export function assertValidPaystackTransferReference(reference: string): string {
  const ref = reference.trim();
  if (ref.length < 16 || ref.length > 50) {
    throw new PaymentError(
      "PAYMENT_PROVIDER_REQUEST_INVALID",
      `Paystack transfer reference must be between 16 and 50 characters: ${ref}`,
    );
  }
  if (!/^[a-z0-9_-]+$/.test(ref)) {
    throw new PaymentError(
      "PAYMENT_PROVIDER_REQUEST_INVALID",
      `Paystack transfer reference must contain only lowercase letters, digits, hyphen, or underscore: ${ref}`,
    );
  }
  return ref;
}

export type PaystackTransferRecipientInput = Readonly<{
  type: "basa";
  name: string;
  account_number: string;
  bank_code: string;
  currency?: "ZAR";
  description?: string;
  metadata?: Record<string, unknown>;
}>;

export type PaystackTransferRecipientData = Readonly<{
  active: boolean;
  createdAt: string;
  currency: string;
  domain: string;
  id: number;
  integration: number;
  name: string;
  recipient_code: string;
  type: string;
  is_deleted: boolean;
  details: {
    account_number: string;
    account_name: string | null;
    bank_code: string;
    bank_name: string;
  };
}>;

export type PaystackBankData = Readonly<{
  name: string;
  slug: string;
  code: string;
  longcode: string;
  gateway: string | null;
  pay_with_bank: boolean;
  active: boolean;
  is_deleted: boolean;
  country: string;
  currency: string;
  type: string;
  id: number;
}>;

export type PaystackValidateAccountInput = Readonly<{
  account_name: string;
  account_number: string;
  account_type: "personal" | "business";
  bank_code: string;
  country_code?: "ZA";
  document_type?: string;
  document_number?: string;
}>;

export type PaystackValidateAccountData = Readonly<{
  verified: boolean;
  verification_status: string;
  account_name?: string;
  account_number?: string;
  bank_code?: string;
}>;

export type PaystackInitiateTransferInput = Readonly<{
  source?: "balance";
  amountCents: number;
  recipient: string;
  reason?: string;
  reference: string;
}>;

export type PaystackTransferData = Readonly<{
  id: number;
  integration: number;
  domain: string;
  amount: number;
  currency: string;
  source: string;
  reason: string;
  recipient: number | PaystackTransferRecipientData;
  status: "success" | "failed" | "pending" | "otp" | "reversed" | "abandoned" | "blocked" | "rejected" | string;
  transfer_code: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
}>;

export type PaystackFinalizeTransferInput = Readonly<{
  transfer_code: string;
  otp: string;
}>;

export type PaystackDisputeData = Readonly<{
  id: number;
  refund_amount: number | null;
  currency: string;
  status: "awaiting-merchant-feedback" | "awaiting-bank-feedback" | "pending" | "resolved" | "archived" | string;
  resolution: "merchant-accepted" | "declined" | string | null;
  domain: string;
  transaction: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
  };
  transaction_reference?: string;
  category?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
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
    assertValidPaystackTransactionAmount(input.amountCents);
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
    assertValidPaystackTransactionAmount(input.amountCents);
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

  async createTransferRecipient(
    input: PaystackTransferRecipientInput,
    signal?: AbortSignal,
  ): Promise<PaystackTransferRecipientData> {
    const body: Record<string, unknown> = {
      type: input.type,
      name: input.name,
      account_number: input.account_number,
      bank_code: input.bank_code,
      currency: input.currency || "ZAR",
    };
    if (input.description) body.description = input.description;
    if (input.metadata) body.metadata = input.metadata;

    const response = await this.request<PaystackTransferRecipientData>("/transferrecipient", {
      method: "POST",
      body,
      signal,
    });

    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack transfer recipient creation returned no data.");
    }
    return response.data;
  }

  async listBanks(
    country: string = "south africa",
    signal?: AbortSignal,
  ): Promise<PaystackBankData[]> {
    const response = await this.request<PaystackBankData[]>(
      `/bank?country=${encodeURIComponent(country)}`,
      { method: "GET", signal },
    );
    if (!response.status || !Array.isArray(response.data)) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack list banks returned invalid data.");
    }
    return response.data;
  }

  async validateAccount(
    input: PaystackValidateAccountInput,
    signal?: AbortSignal,
  ): Promise<PaystackValidateAccountData> {
    const body: Record<string, unknown> = {
      account_name: input.account_name,
      account_number: input.account_number,
      account_type: input.account_type,
      bank_code: input.bank_code,
      country_code: input.country_code || "ZA",
    };
    if (input.document_type) body.document_type = input.document_type;
    if (input.document_number) body.document_number = input.document_number;

    const response = await this.request<PaystackValidateAccountData>("/bank/validate", {
      method: "POST",
      body,
      signal,
    });
    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack account validation returned no data.");
    }
    return response.data;
  }

  async resolveAccount(
    accountNumber: string,
    bankCode: string,
    signal?: AbortSignal,
  ): Promise<{ account_number: string; account_name: string; bank_id: number }> {
    const response = await this.request<{ account_number: string; account_name: string; bank_id: number }>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { method: "GET", signal },
    );
    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack bank account resolution returned no data.");
    }
    return response.data;
  }

  async initiateTransfer(
    input: PaystackInitiateTransferInput,
    signal?: AbortSignal,
  ): Promise<PaystackTransferData> {
    assertValidPaystackTransactionAmount(input.amountCents);
    assertValidPaystackTransferReference(input.reference);

    const body: Record<string, unknown> = {
      source: input.source || "balance",
      amount: input.amountCents,
      recipient: input.recipient,
      reference: input.reference,
    };
    if (input.reason) body.reason = input.reason;

    const response = await this.request<PaystackTransferData>("/transfer", {
      method: "POST",
      body,
      signal,
    });

    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack transfer initiation returned no data.");
    }
    return response.data;
  }

  async finalizeTransfer(
    input: PaystackFinalizeTransferInput,
    signal?: AbortSignal,
  ): Promise<PaystackTransferData> {
    const response = await this.request<PaystackTransferData>("/transfer/finalize_transfer", {
      method: "POST",
      body: {
        transfer_code: input.transfer_code,
        otp: input.otp,
      },
      signal,
    });
    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack transfer finalization returned no data.");
    }
    return response.data;
  }

  async fetchTransfer(
    transferCodeOrId: string | number,
    signal?: AbortSignal,
  ): Promise<PaystackTransferData> {
    const response = await this.request<PaystackTransferData>(
      `/transfer/${encodeURIComponent(transferCodeOrId.toString())}`,
      { method: "GET", signal },
    );
    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack transfer fetch returned no data.");
    }
    return response.data;
  }

  async verifyTransfer(
    reference: string,
    signal?: AbortSignal,
  ): Promise<PaystackTransferData> {
    const response = await this.request<PaystackTransferData>(
      `/transfer/verify/${encodeURIComponent(reference)}`,
      { method: "GET", signal },
    );
    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack transfer verify returned no data.");
    }
    return response.data;
  }

  async getDispute(
    disputeId: string | number,
    signal?: AbortSignal,
  ): Promise<PaystackDisputeData> {
    const response = await this.request<PaystackDisputeData>(
      `/dispute/${encodeURIComponent(disputeId.toString())}`,
      { method: "GET", signal },
    );
    if (!response.status || !response.data) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack dispute query returned no data.");
    }
    return response.data;
  }

  async listDisputes(
    params?: { status?: string; transaction?: string },
    signal?: AbortSignal,
  ): Promise<PaystackDisputeData[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.transaction) query.set("transaction", params.transaction);
    const qs = query.toString();
    const path = qs ? `/dispute?${qs}` : "/dispute";

    const response = await this.request<PaystackDisputeData[]>(path, { method: "GET", signal });
    if (!response.status || !Array.isArray(response.data)) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Paystack list disputes returned invalid data.");
    }
    return response.data;
  }

  async retryRefundWithCustomerDetails(
    refundId: string | number,
    input: { account_name: string; account_number: string; bank_code: string },
    signal?: AbortSignal,
  ): Promise<PaystackRefundData> {
    const response = await this.request<PaystackRefundData>(
      `/refund/${encodeURIComponent(refundId.toString())}`,
      {
        method: "POST",
        body: input,
        signal,
      },
    );
    if (!response.status || !response.data) {
      throw new PaymentError("REFUND_PROVIDER_RESPONSE_INVALID", "Paystack refund retry returned no data.");
    }
    return response.data;
  }
}
