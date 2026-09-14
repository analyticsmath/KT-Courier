/**
 * KT Couriers — Production-Grade Authentic Demo Media Sync Engine
 * 
 * Synchronizes authentic photographic assets and fictional merchant brand logos,
 * optimizes into WebP with Sharp, writes to var/catalog-media/ outside public/,
 * and outputs compiled manifest.ts and docs/demo-data/media-provenance.json.
 */

import { acquireAndProcessDemoMedia } from "./acquire";

export async function syncDemoMedia() {
  return await acquireAndProcessDemoMedia();
}

if (require.main === module || process.argv[1]?.endsWith("sync.ts")) {
  syncDemoMedia().catch(err => {
    console.error("Fatal sync error:", err);
    process.exit(1);
  });
}
