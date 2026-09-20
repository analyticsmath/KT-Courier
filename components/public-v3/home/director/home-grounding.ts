export interface GroundContactAlignment {
  width: number;
  height: number;
  groundContact: { x: number; y: number };
  target: { x: number; y: number };
}

export function alignGroundContact({
  width,
  height,
  groundContact,
  target,
}: GroundContactAlignment): { left: number; top: number } {
  return {
    left: target.x - width * groundContact.x,
    top: target.y - height * groundContact.y,
  };
}
