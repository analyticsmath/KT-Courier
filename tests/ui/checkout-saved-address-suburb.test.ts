// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutExperience } from "@/components/public-v2/commerce/CheckoutExperience";
import { AddressBookManager } from "@/components/account/AddressBookManager";
import { PublicDeliveryQuoteForm } from "@/components/forms/PublicDeliveryQuoteForm";
import type { SavedAddressDto } from "@/lib/services/customer-addresses.service";

const autocompleteMock = vi.hoisted(() => ({
  triggerSelect: null as ((value: Record<string, unknown>) => void) | null,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("ref=checkout_l01"),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", async () => {
  const ReactMod = await import("react");
  return { default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => ReactMod.createElement("a", { href, ...props }, children) };
});
vi.mock("@/components/maps/AddressAutocomplete", async () => {
  const ReactMod = await import("react");
  return {
    AddressAutocomplete: ({ label, onChange }: { label: string; onChange: (value: unknown) => void }) => {
      autocompleteMock.triggerSelect = (val) => onChange(val);
      return ReactMod.createElement("button", {
        type: "button",
        "data-testid": "mock-map-select",
        onClick: () =>
          onChange({
            formattedAddress: "12 Oxford Rd, Rosebank, Johannesburg, Gauteng, 2196, South Africa",
            placeId: "ChIJrosebank01",
            line1: "12 Oxford Rd",
            line2: "Rosebank",
            suburb: "Rosebank",
            city: "Johannesburg",
            province: "Gauteng",
            postalCode: "2196",
            country: "South Africa",
            latitude: -26.1467,
            longitude: 28.0416,
          }),
      }, `Select place for ${label}`);
    },
  };
});
vi.mock("@/components/public-v2/commerce/GuestCheckoutEmailUpdates", () => ({ GuestCheckoutEmailUpdates: () => null }));

const checkout = {
  reference: "checkout_l01",
  status: "CREATED",
  currency: "ZAR",
  version: 1,
  totals: { merchandiseSubtotal: "154.00", modifierSubtotal: "0.00", deliveryFeeTotal: "0.00", grandTotal: "154.00" },
  storeGroups: [
    {
      storeReference: "store_ref_1",
      storeName: "Test Store",
      storeSlug: "test-store",
      status: "OPEN",
      fulfilmentMode: "COURIER_DELIVERY",
      lines: [
        {
          productReference: "product_1",
          productTitle: "Test item",
          variantReference: "variant_1",
          variantTitle: null,
          offerReference: "offer_1",
          quantity: 1,
          baseUnitPrice: "154.00",
          modifierUnitTotal: "0.00",
          lineTotal: "154.00",
          modifiers: [],
        },
      ],
    },
  ],
};

const mappedSavedAddress = {
  id: "addr_rosebank",
  type: "CUSTOMER",
  label: "Home",
  isDefault: true,
  contactName: "Test Customer",
  contactPhone: "0821112222",
  line1: "12 Oxford Rd",
  line2: "Unit 4B",
  suburb: "Rosebank",
  city: "Johannesburg",
  province: "Gauteng",
  postalCode: "2196",
  country: "South Africa",
  accessNotes: "Gate 2",
  formattedAddress: "12 Oxford Rd, Rosebank, Johannesburg, Gauteng, 2196, South Africa",
  placeId: "ChIJrosebank01",
  latitude: -26.1467,
  longitude: 28.0416,
};

const sandtonSavedAddress = {
  ...mappedSavedAddress,
  id: "addr_sandton",
  label: "Work",
  isDefault: false,
  line1: "90 Rivonia Rd",
  line2: "Suite 8",
  suburb: "Sandton",
  postalCode: "2196",
  formattedAddress: "90 Rivonia Rd, Sandton, Johannesburg, Gauteng, 2196, South Africa",
  placeId: "ChIJsandton01",
};

const legacyUnconfirmedAddress = {
  ...mappedSavedAddress,
  id: "addr_legacy",
  label: "Old Saved",
  isDefault: false,
  line1: "45 Commissioner St",
  line2: "Unit 4B",
  suburb: null,
  formattedAddress: null,
  placeId: null,
  latitude: null,
  longitude: null,
};

const reply = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function setSelectValue(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", { randomUUID: () => "op-l01", subtle: { digest: async () => new ArrayBuffer(32) } });
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY = "test-browser-key";
  fetchMock.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  vi.unstubAllGlobals();
});

describe("L-01 Checkout and AddressBook suburb & unit isolation", () => {
  it("prefills default mapped saved address suburb without wiping it and preserves distinct unit line2", async () => {
    const savedBodies: Array<Record<string, unknown>> = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/checkout/checkout_l01") {
        return reply(200, {
          checkout,
          account: { name: "Test Customer", email: "customer@example.test", phone: "0821112222" },
          savedAddresses: [mappedSavedAddress, sandtonSavedAddress, legacyUnconfirmedAddress],
        });
      }
      if (url.endsWith("/delivery-services")) return reply(200, { model: "MATRIX", services: [] });
      if (url.endsWith("/contact")) return reply(200, { checkout: { ...checkout, version: 2 } });
      if (url.endsWith("/delivery-address")) {
        savedBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return reply(200, { checkout: { ...checkout, version: 3 } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await act(async () => root.render(React.createElement(CheckoutExperience)));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    // Proceed from contact step to Step 2 delivery step
    await act(async () => {
      host.querySelector<HTMLFormElement>('form[aria-labelledby="checkout-contact-heading"]')?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(host.querySelector<HTMLInputElement>("#addrLine2")?.value).toBe("Unit 4B");
    expect(host.querySelector<HTMLInputElement>("#addrSuburb")?.value).toBe("Rosebank");

    // Switching saved address populates Sandton and Suite 8 independently
    const select = host.querySelector<HTMLSelectElement>("#checkout-saved-address")!;
    await act(async () => {
      setSelectValue(select, "addr_sandton");
    });
    expect(host.querySelector<HTMLInputElement>("#addrLine2")?.value).toBe("Suite 8");
    expect(host.querySelector<HTMLInputElement>("#addrSuburb")?.value).toBe("Sandton");

    // Selecting legacy unconfirmed saved address prompts explicitly rather than copying Unit 4B into suburb
    await act(async () => {
      setSelectValue(select, "addr_legacy");
    });
    expect(host.querySelector<HTMLInputElement>("#addrLine2")?.value).toBe("Unit 4B");
    expect(host.querySelector<HTMLInputElement>("#addrSuburb")?.value).toBe("");
    expect(host.textContent).toMatch(/confirm.*suburb/i);
    expect(host.textContent).toMatch(/map location/i);

    // Switching back to mapped Rosebank clears confirmation warning and submits both line2 & suburb
    await act(async () => {
      setSelectValue(select, "addr_rosebank");
    });
    expect(host.querySelector<HTMLInputElement>("#addrSuburb")?.value).toBe("Rosebank");

    await act(async () => {
      host.querySelector<HTMLFormElement>('form[aria-labelledby="checkout-address-heading"]')?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(savedBodies[0]).toMatchObject({
      line1: "12 Oxford Rd",
      line2: "Unit 4B",
      suburb: "Rosebank",
      placeId: "ChIJrosebank01",
      latitude: -26.1467,
      longitude: 28.0416,
    });
  });

  it("populates suburb from Google Places selection without overwriting customer unit line2", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/checkout/checkout_l01") {
        return reply(200, {
          checkout,
          account: { name: "Test Customer", email: "customer@example.test", phone: "0821112222" },
          savedAddresses: [],
        });
      }
      if (url.endsWith("/delivery-services")) return reply(200, { model: "MATRIX", services: [] });
      if (url.endsWith("/contact")) return reply(200, { checkout: { ...checkout, version: 2 } });
      throw new Error(`Unexpected request: ${url}`);
    });

    await act(async () => root.render(React.createElement(CheckoutExperience)));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => {
      setInputValue(host.querySelector<HTMLInputElement>("#contactName")!, "Test Customer");
      setInputValue(host.querySelector<HTMLInputElement>("#contactEmail")!, "customer@example.test");
      setInputValue(host.querySelector<HTMLInputElement>("#contactPhone")!, "0821112222");
    });
    await act(async () => {
      host.querySelector<HTMLFormElement>('form[aria-labelledby="checkout-contact-heading"]')?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      setInputValue(host.querySelector<HTMLInputElement>("#addrLine2")!, "Unit 4B");
      host.querySelector<HTMLButtonElement>('[data-testid="mock-map-select"]')?.click();
    });

    expect(host.querySelector<HTMLInputElement>("#addrLine2")?.value).toBe("Unit 4B");
    expect(host.querySelector<HTMLInputElement>("#addrSuburb")?.value).toBe("Rosebank");
  });

  it("exposes independent unit line2 and suburb inputs in AddressBookManager", async () => {
    const postBodies: Array<Record<string, unknown>> = [];
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      postBodies.push(payload);
      return reply(201, {
        address: {
          id: "saved_new",
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    });

    await act(async () => root.render(React.createElement(AddressBookManager, { initialAddresses: [] as SavedAddressDto[] })));
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="mock-map-select"]')?.click();
    });

    const line2Input = host.querySelector<HTMLInputElement>("#address_line2");
    const suburbInput = host.querySelector<HTMLInputElement>("#address_suburb");
    expect(line2Input).not.toBeNull();
    expect(suburbInput).not.toBeNull();
    expect(suburbInput?.value).toBe("Rosebank");

    await act(async () => {
      setInputValue(line2Input!, "Unit 4B");
    });

    const saveBtn = [...host.querySelectorAll("button")].find((btn) => btn.textContent?.includes("Add address"));
    await act(async () => {
      saveBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(postBodies[0]).toMatchObject({
      line1: "12 Oxford Rd",
      line2: "Unit 4B",
      suburb: "Rosebank",
      placeId: "ChIJrosebank01",
    });
  });

  it("supports clearing back to manual entry and accessible mobile/keyboard labels across /checkout and /quote", async () => {
    const manualBodies: Array<Record<string, unknown>> = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/checkout/checkout_l01") {
        return reply(200, {
          checkout,
          account: { name: "Test Customer", email: "customer@example.test", phone: "0821112222" },
          savedAddresses: [mappedSavedAddress],
        });
      }
      if (url.endsWith("/delivery-services")) return reply(200, { model: "MATRIX", services: [] });
      if (url.endsWith("/contact")) return reply(200, { checkout: { ...checkout, version: 2 } });
      if (url.endsWith("/delivery-address")) {
        manualBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return reply(200, { checkout: { ...checkout, version: 3 } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await act(async () => root.render(React.createElement(CheckoutExperience)));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => {
      host.querySelector<HTMLFormElement>('form[aria-labelledby="checkout-contact-heading"]')?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const select = host.querySelector<HTMLSelectElement>("#checkout-saved-address")!;
    expect(host.querySelector('label[for="checkout-saved-address"]')).not.toBeNull();
    expect(host.querySelector('label[for="addrLine2"]')).not.toBeNull();
    expect(host.querySelector('label[for="addrSuburb"]')).not.toBeNull();
    expect(select.tabIndex).toBeGreaterThanOrEqual(0);

    // Switch back to "Enter a different address" (manual mode)
    await act(async () => { setSelectValue(select, ""); });
    expect(host.querySelector<HTMLInputElement>("#addrLine1")?.value).toBe("");
    expect(host.querySelector<HTMLInputElement>("#addrLine2")?.value).toBe("");
    expect(host.querySelector<HTMLInputElement>("#addrSuburb")?.value).toBe("");

    await act(async () => {
      setInputValue(host.querySelector<HTMLInputElement>("#addrLine1")!, "77 Juta Street");
      setInputValue(host.querySelector<HTMLInputElement>("#addrLine2")!, "Floor 3");
      setInputValue(host.querySelector<HTMLInputElement>("#addrSuburb")!, "Braamfontein");
      setInputValue(host.querySelector<HTMLInputElement>("#addrCity")!, "Johannesburg");
      setInputValue(host.querySelector<HTMLInputElement>("#addrPostalCode")!, "2001");
    });

    await act(async () => {
      host.querySelector<HTMLFormElement>('form[aria-labelledby="checkout-address-heading"]')?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(manualBodies[0]).toMatchObject({
      line1: "77 Juta Street",
      line2: "Floor 3",
      suburb: "Braamfontein",
      city: "Johannesburg",
    });

    // Same customer saved addresses preserve independent suburb in /quote without promoting line2
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/public/parcel-profiles") {
        return reply(200, [{ id: "p1", stableKey: "SMALL", displayName: "Small", lengthCm: 30, widthCm: 20, heightCm: 10, maximumWeightKg: 5 }]);
      }
      if (url === "/api/public/delivery-quotes") {
        return reply(200, [{ stableKey: "CLIENT_STANDARD", displayName: "Standard", turnaround: "1–2 business days", active: true, provinces: ["Gauteng"], regionIds: [], tariffs: { SMALL: { baseFee: "129.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null }, MEDIUM: { baseFee: "179.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null }, LARGE: { baseFee: "249.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null } }, expectedVersion: 0, reason: "test" }]);
      }
      throw new Error(`Unexpected quote request: ${url}`);
    });

    await act(async () => root.render(React.createElement(PublicDeliveryQuoteForm, {
      signedIn: true,
      savedAddresses: [mappedSavedAddress as unknown as SavedAddressDto],
    })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    const pickupSelect = host.querySelector<HTMLSelectElement>("#pickup-saved")!;
    await act(async () => { setSelectValue(pickupSelect, "addr_rosebank"); });
    expect(host.querySelector<HTMLInputElement>("#pickup-line1")?.value).toBe("12 Oxford Rd");
    expect(host.querySelector<HTMLInputElement>("#pickup-suburb")?.value).toBe("Rosebank");
  });
});
