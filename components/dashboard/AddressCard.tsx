import { Card } from "@/components/ui/Card";
import type { Address } from "@/types/order";

interface AddressCardProps {
  type: "pickup" | "dropoff";
  address: Address;
}

export function AddressCard({ type, address }: AddressCardProps) {
  return (
    <Card padding="sm">
      <div className="flex gap-3">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
            type === "pickup" ? "bg-[--kt-blue-soft]" : "bg-[--kt-green-soft]"
          }`}
          aria-hidden="true"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              type === "pickup" ? "bg-[--kt-brand-blue]" : "bg-[--kt-green]"
            }`}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wider mb-0.5">
            {type === "pickup" ? "Pickup" : "Dropoff"}
          </p>
          <p className="text-sm font-semibold text-[--kt-text]">{address.name}</p>
          <p className="text-sm text-[--kt-text-muted]">{address.phone}</p>
          <p className="text-sm text-[--kt-text-muted] mt-0.5">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
          </p>
          <p className="text-sm text-[--kt-text-muted]">
            {address.city}
            {address.postcode ? ` ${address.postcode}` : ""}
          </p>
          {address.notes && (
            <p className="text-xs text-[--kt-text-muted] mt-1 italic">{address.notes}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
