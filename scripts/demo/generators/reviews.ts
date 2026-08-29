/**
 * KT Couriers — Authentic Customer Review Generator
 * Zero forbidden tokens, natural South African tone, realistic rating distributions.
 */

import { SeededRNG } from "./rng";

const REVIEW_COMMENTS = [
  "Fresh produce arrived crisp and well packaged. Driver was on time and very polite.",
  "The meal was still hot when it arrived. Delicious flavours and generous portions.",
  "Fast delivery and good communication from the courier. Everything as ordered.",
  "High quality items and secure packaging. Will definitely order from this store again.",
  "Very pleased with the fast dispatch and careful handling of fragile goods.",
  "Always reliable for our weekly groceries. Fresh vegetables and long dated dairy.",
  "Great customer service and fast turnaround time on our weekend lunch order.",
  "Everything arrived safely without damage. Friendly driver and prompt updates.",
  "Authentic spices and delicious traditional curry. Arrived piping hot.",
  "The pastry was wonderfully flaky and fresh. Excellent bakery quality.",
  "Top quality electronics cable and charger. Fast delivery directly to my office.",
  "Stunning fynbos flower arrangement. Looked even better in person than the catalog.",
  "Prompt dispatch for our pet food supplies. Great communication via SMS tracking.",
  "Gentle on skin and very well packaged. Quick delivery to our Pretoria address.",
  "The stoneware dinner set arrived in perfect condition with ample protective wrapping."
];

export function generateCustomerReview(rng: SeededRNG): { rating: number; comment: string } {
  // 70% 5 stars, 22% 4 stars, 8% 3 stars
  const r = rng.next();
  const rating = r < 0.70 ? 5 : r < 0.92 ? 4 : 3;
  const comment = rng.element(REVIEW_COMMENTS);
  return { rating, comment };
}
