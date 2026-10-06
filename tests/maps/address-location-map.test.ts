// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddressLocationMap } from "@/components/maps/AddressLocationMap";
import type { AddressDto } from "@/lib/maps/google-maps.types";

const provider = vi.hoisted(() => ({ load: vi.fn(), geocode: vi.fn() }));
vi.mock("@/lib/maps/google-browser-loader", () => ({ loadGoogleBrowserMaps: provider.load, GOOGLE_MAPS_AUTH_FAILURE: "kt:maps-test-failure" }));

const pins: FakePin[] = [];
let mapClick: ((event: unknown) => void) | undefined;
class FakePin extends EventTarget {
  position: google.maps.LatLngLiteral;
  map: unknown;
  title: string;
  gmpDraggable: boolean;
  append = vi.fn();
  constructor(options: { position: google.maps.LatLngLiteral; map: unknown; title: string; gmpDraggable: boolean }) {
    super(); Object.assign(this, options); this.position = options.position; this.map = options.map; this.title = options.title; this.gmpDraggable = options.gmpDraggable; pins.push(this);
  }
}
const change = vi.fn();
const place = (country = "ZA") => ({ formatted_address: "12 Main Road, Johannesburg, South Africa", place_id: "place-test", address_components: [{ long_name: country === "ZA" ? "South Africa" : "Namibia", short_name: country, types: ["country"] }, { long_name: "12", short_name: "12", types: ["street_number"] }, { long_name: "Main Road", short_name: "Main Road", types: ["route"] }], geometry: { location: { lat: () => -26, lng: () => 28 } } });
const selected: AddressDto = { formattedAddress: "18 Oak Street, Johannesburg", line1: "18 Oak Street", line2: null, city: "Johannesburg", province: null, postalCode: null, country: "South Africa", placeId: "oak", latitude: -26.3, longitude: 28.2 };
let host: HTMLDivElement, root: Root, mounted: boolean;
let setAddress: React.Dispatch<React.SetStateAction<AddressDto | null>>;
let editAddress: () => void;
function ControlledMap({ initial }: { initial: AddressDto | null }) {
  const [address, update] = React.useState(initial);
  const [editRevision, revise] = React.useState(0);
  React.useEffect(() => { setAddress = update; }, [update]);
  React.useEffect(() => { editAddress = () => { update(null); revise(previous => previous + 1); }; }, []);
  return React.createElement(AddressLocationMap, { value: address, onChange: (next) => { change(next); update(next); }, label: "Dropoff address", editRevision });
}
async function render(value: AddressDto | null = null) { await act(async () => { if (mounted) setAddress(value); else { root.render(React.createElement(ControlledMap, { initial: value })); mounted = true; } }); }
async function drop(location = { lat: -26.213456, lng: 28.052345 }) { await act(async () => { pins[0].position = location; pins[0].dispatchEvent(new Event("gmp-dragend")); }); }
function button(text: string) { return [...host.querySelectorAll("button")].find(b => b.textContent?.includes(text))!; }

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  provider.load.mockReset().mockResolvedValue(undefined); provider.geocode.mockReset(); change.mockReset(); pins.length = 0; mapClick = undefined;
  vi.stubGlobal("google", { maps: { Map: class { panTo = vi.fn(); setZoom = vi.fn(); addListener(_event: string, listener: (event: unknown) => void) { mapClick = listener; return { remove: vi.fn() }; } }, Geocoder: class { geocode = provider.geocode; }, marker: { AdvancedMarkerElement: FakePin, PinElement: class {} } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); mounted = false;
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("address pin interaction", () => {
  it("shows a draggable starting pin without inventing a saved address", async () => {
    await render(); expect(pins).toHaveLength(1); expect(pins[0].gmpDraggable).toBe(true); expect(change).not.toHaveBeenCalled(); expect(provider.geocode).not.toHaveBeenCalled(); expect(host.textContent).toContain("only a preview"); expect(button("Confirm pin location").disabled).toBe(false);
  });
  it("shows an existing address at its exact saved coordinates", async () => {
    await render(selected); expect(pins[0].position).toEqual({ lat: -26.3, lng: 28.2 }); expect(pins[0].title).toContain("Dropoff address"); expect(change).not.toHaveBeenCalled();
  });
  it("confirms a dropped pin using its exact point rather than the provider centre", async () => {
    provider.geocode.mockResolvedValue({ results: [place()] }); await render(); await drop(); expect(change).toHaveBeenNthCalledWith(1, null); expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ line1: "12 Main Road", latitude: -26.213456, longitude: 28.052345 })); expect(host.textContent).toContain("Pin location confirmed");
  });
  it("supports map clicks and explicit pin confirmation", async () => {
    provider.geocode.mockResolvedValue({ results: [place()] }); await render();
    await act(async () => { mapClick?.({ latLng: { toJSON: () => ({ lat: -26.25, lng: 28.06 }) }, stop: vi.fn() }); });
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: -26.25, longitude: 28.06 }));
    await act(async () => button("Confirm pin location").click()); expect(provider.geocode).toHaveBeenCalledTimes(2);
  });
  it("clears the previous address immediately when dragging starts", async () => {
    await render(selected); await act(async () => pins[0].dispatchEvent(new Event("gmp-dragstart"))); expect(change).toHaveBeenLastCalledWith(null); expect(host.textContent).toContain("release it");
  });
  it("rejects points outside South Africa without retaining old coordinates", async () => {
    provider.geocode.mockResolvedValue({ results: [place("NA")] }); await render(selected); await drop(); expect(change.mock.calls).toEqual([[null]]); expect(host.textContent).toContain("has not been confirmed");
  });
  it("keeps failed geocoding retryable and does not commit a coordinate-only address", async () => {
    provider.geocode.mockRejectedValue(new Error("offline")); await render(); await drop(); expect(change.mock.calls).toEqual([[null]]); expect(host.textContent).toContain("Could not confirm this pin"); expect(button("Confirm pin location").disabled).toBe(false);
  });
  it("ignores a late first result after the user chooses a newer pin", async () => {
    let resolveFirst!: (result: unknown) => void;
    provider.geocode.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce({ results: [place()] });
    await render(); await drop(); await drop({ lat: -26.4, lng: 28.4 }); await act(async () => resolveFirst({ results: [place()] }));
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: -26.4, longitude: 28.4 })); expect(change.mock.calls.filter(([v]) => v !== null)).toHaveLength(1);
  });
  it("does not overwrite a later Places/text selection with a pending pin result", async () => {
    let resolve!: (result: unknown) => void; provider.geocode.mockReturnValue(new Promise(done => { resolve = done; }));
    await render(); await drop(); await render(selected); await act(async () => resolve({ results: [place()] })); expect(change.mock.calls).toEqual([[null]]); expect(pins[0].position).toEqual({ lat: -26.3, lng: 28.2 });
  });
  it("cancels a pending pin when text editing starts while the address is already null", async () => {
    let resolve!: (result: unknown) => void; provider.geocode.mockReturnValue(new Promise(done => { resolve = done; }));
    await render(); await drop();
    await act(async () => editAddress());
    await act(async () => resolve({ results: [place()] }));
    expect(change.mock.calls).toEqual([[null]]);
    expect(button("Confirm pin location").disabled).toBe(false);
  });
  it("falls back safely when the map provider cannot load", async () => {
    provider.load.mockRejectedValue(new Error("not configured")); await render(); expect(pins).toHaveLength(0); expect(button("Confirm pin location").disabled).toBe(true); expect(host.textContent).toContain("still enter your address");
  });
  it("does not overwrite a newer address with a late device location", async () => {
    let found!: PositionCallback;
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: vi.fn((success: PositionCallback) => { found = success; }) } });
    await render();
    await act(async () => button("Use my location").click());
    await render(selected);
    await act(async () => found({ coords: { latitude: -26.5, longitude: 28.5 } } as GeolocationPosition));
    expect(provider.geocode).not.toHaveBeenCalled();
    expect(change.mock.calls).toEqual([[null]]);
    expect(pins[0].position).toEqual({ lat: -26.3, lng: 28.2 });
    expect(button("Use my location").disabled).toBe(false);
  });
});
