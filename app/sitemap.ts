import type { MetadataRoute } from "next";
import { sitemapPublicRoutes } from "@/lib/public-site/public-route-registry";
import { canonicalUrl } from "@/lib/public-site/site-origin";
import { connection } from "next/server";
import { loadPublishedPolicy, publicPolicyDefinitions, type PublicPolicyId } from "@/lib/public-legal/published-policy";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const policies = await Promise.all((Object.keys(publicPolicyDefinitions) as PublicPolicyId[]).map(async (id) => {
    const policy = await loadPublishedPolicy(id);
    return policy ? { url: canonicalUrl(publicPolicyDefinitions[id].route) } : null;
  }));
  // indexablePublicServicePages
  return [...sitemapPublicRoutes.map((route) => ({ url: canonicalUrl(route.route) })), ...policies.filter((policy) => policy !== null)];
}
