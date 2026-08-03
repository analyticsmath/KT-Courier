import { OrderStatus } from "@/types/db";

export function establishesCustody(status: OrderStatus): boolean {
  return status === OrderStatus.PICKED_UP;
}
