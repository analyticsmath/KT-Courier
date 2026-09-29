# Post-Hero source asset blockers

The active derivative inventory and per-file alpha measurements are in `components/public-v3/home/data/home-cinematic-assets.qc.json`. The generated box, full pickup/delivery, combined handoff, and road PNG derivatives have been retired from the runtime manifest and public output.

## 1. White van matte edges

Sources: `public/media/public/images/KT_Courier_White_Van_Courier_Performance_Pack/pickup_A05_door_open.png` and `delivery_B05_door_open.png`.

The van roof and lower sill contain near-white extraction fragments attached to legitimate white bodywork. Conservative alpha thresholding and disconnected-component removal eliminate loose pixels, but cannot separate every attached fragment from the van without cutting into its silhouette. The composed van derivatives retain this source limitation. A clean van and matching closed-door source with the same camera geometry are needed for final visual acceptance.

## 2. Parcel baked into courier poses

Sources: `public/media/public/images/KT_Courier_20_Transparent_PNG_Assets/04_walking_one_parcel_facing_right.png`, `05_walking_one_parcel_facing_left.png`, `10_looking_right_approaching_vehicle.png`, `11_looking_left_approaching_vehicle.png`, and `18_loading_unloading_parcel.png`.

These courier poses include a box overlapping the hands. Removing it through an alpha mask would erase fingers and forearms. The active scene uses a separate parcel object for motion and occlusion, but some poses can still expose part of the source box. Matching parcel-free courier poses with the same identity and hand positions would resolve this.

## 3. Recipient extraction edges

Sources: `public/media/public/images/KT_COURIER_HANDOFF_12_PNGS/handoff_01_approach.png`, `handoff_03_recipient_reach.png`, and `handoff_12_final_separation.png`.

The recipient is extracted with one consistent crop from combined plates. Some hair, shoe, and sleeve edges are irregular in the source and remain after conservative cleanup. Further global erosion would damage valid silhouette pixels. Separate clean recipient alpha sources in the same three poses are needed for final visual acceptance.

These are source-quality blockers, not build failures. The user should assess them during the requested manual desktop and mobile visual review before accepting the creative result.
