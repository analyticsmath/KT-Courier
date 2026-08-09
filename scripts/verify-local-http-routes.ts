async function testRoute(url: string, description: string) {
  try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "";
    let preview = "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      preview = JSON.stringify(json).slice(0, 200);
    } else {
      const text = await res.text();
      preview = text.slice(0, 200).replace(/\s+/g, " ");
    }
    console.log(`[HTTP ${res.status}] ${description} (${url})`);
    console.log(`  Preview: ${preview}\n`);
    return { ok: res.ok, status: res.status };
  } catch (error) {
    console.error(`[FETCH FAILED] ${description} (${url}):`, error instanceof Error ? error.message : String(error));
    return { ok: false, status: 0 };
  }
}

async function main() {
  console.log("=== LOCALHOST HTTP ROUTE VERIFICATION ===\n");
  
  await testRoute("http://localhost:3000/api/health", "API Health");
  await testRoute("http://localhost:3000/api/ready", "API Readiness");
  await testRoute("http://localhost:3000/api/storefront/home", "Storefront Home API");
  await testRoute("http://localhost:3000/api/storefront/categories", "Storefront Categories API");
  await testRoute("http://localhost:3000/api/storefront/stores", "Storefront Stores API");
  await testRoute("http://localhost:3000/shop", "/shop Landing Page");
  await testRoute("http://localhost:3000/shop/categories/groceries", "/shop Category Page");
  await testRoute("http://localhost:3000/shop/stores/fresh-basket-grocers", "/shop Store Page");
}

main().catch(console.error);
