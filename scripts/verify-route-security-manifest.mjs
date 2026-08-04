import fs from "node:fs";
import path from "node:path";

function normalizeRouteFilePathToPublicPattern(filePath) {
  let normalized = filePath.replace(/\\/g, "/");
  normalized = normalized.replace(/^(\.\/)?app\//, "");
  normalized = normalized.replace(/\/route\.(ts|js)$/, "");

  const segments = normalized.split("/").filter(Boolean);

  const publicSegments = segments
    .filter((segment) => !/^\([A-Za-z0-9_-]+\)$/.test(segment))
    .map((segment) => {
      if (/^\[{1,2}\.\.\.[A-Za-z0-9_-]+\]{1,2}$/.test(segment)) {
        return "*";
      }
      if (/^\[[A-Za-z0-9_-]+\]$/.test(segment)) {
        const paramName = segment.slice(1, -1);
        return `:${paramName}`;
      }
      return segment;
    });

  return "/" + publicSegments.join("/");
}

function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).reduce((acc, f) => {
    const p = path.join(dir, f);
    return acc.concat(fs.statSync(p).isDirectory() ? getFiles(p) : p);
  }, []);
}

export function buildRouteInventory(appDir = "app") {
  const allFiles = getFiles(appDir);
  const routeFiles = allFiles.filter((f) => f.replace(/\\/g, "/").endsWith("route.ts"));

  const inventory = [];

  routeFiles.forEach((file) => {
    const code = fs.readFileSync(file, "utf8");
    const normalizedPath = normalizeRouteFilePathToPublicPattern(file);
    const methods = [];

    ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].forEach((m) => {
      const regex = new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\b`);
      if (regex.test(code)) {
        methods.push(m);
      }
    });

    methods.forEach((method) => {
      inventory.push({
        sourceFile: file.replace(/\\/g, "/"),
        publicPathPattern: normalizedPath,
        method,
        securityClass: classifyRoute(normalizedPath, method, code),
      });
    });
  });

  return { routeFilesCount: routeFiles.length, inventory };
}

export function classifyRoute(pathPattern, method, code) {
  if (pathPattern.startsWith("/api/payments/payfast/itn") || pathPattern.startsWith("/api/webhooks/")) {
    return "WEBHOOK_VERIFIED";
  }

  if (pathPattern.startsWith("/api/v1/")) {
    return "API_CLIENT_AUTHENTICATED";
  }

  if (pathPattern.startsWith("/api/admin/") || pathPattern.startsWith("/admin/")) {
    if (code.includes("hasPermission") || code.includes("requireAdminPagePermission")) {
      return "PERMISSION_GATED";
    }
    return "ROLE_GATED";
  }

  if (pathPattern.startsWith("/api/store/") || pathPattern.startsWith("/store/")) {
    if (code.includes("ownerUserId") || code.includes("getStoreForUser") || code.includes("resolveStoreContext")) {
      return "OWNERSHIP_GATED";
    }
    return "ROLE_GATED";
  }

  if (pathPattern.startsWith("/api/driver/") || pathPattern.startsWith("/driver/")) {
    return "ROLE_GATED";
  }

  if (pathPattern.startsWith("/api/account/") || pathPattern.startsWith("/account/")) {
    return "AUTHENTICATED";
  }

  if (
    pathPattern.startsWith("/api/auth/signup") ||
    pathPattern.startsWith("/api/auth/login") ||
    pathPattern.startsWith("/api/public/") ||
    pathPattern.startsWith("/coverage-areas") ||
    pathPattern.startsWith("/stores") ||
    pathPattern.startsWith("/products")
  ) {
    return "PUBLIC_INTENTIONAL";
  }

  if (code.includes("getCurrentUser") || code.includes("requireAuth")) {
    return "AUTHENTICATED";
  }

  return "PUBLIC_INTENTIONAL";
}

export function verifyRouteSecurityManifest() {
  const { routeFilesCount, inventory } = buildRouteInventory("app");
  const errors = [];

  const unclassified = inventory.filter((item) => !item.securityClass);
  if (unclassified.length > 0) {
    errors.push(`Found ${unclassified.length} unclassified route methods.`);
  }

  const seen = new Set();
  inventory.forEach((item) => {
    const key = `${item.method}:${item.publicPathPattern}`;
    if (seen.has(key)) {
      errors.push(`Duplicate policy resolution for ${key}`);
    }
    seen.add(key);
  });

  return {
    success: errors.length === 0,
    routeFilesCount,
    totalMethodsCount: inventory.length,
    inventory,
    errors,
  };
}

if (process.argv[1] && process.argv[1].endsWith("verify-route-security-manifest.mjs")) {
  const result = verifyRouteSecurityManifest();
  console.log(`Route Files Scanned: ${result.routeFilesCount}`);
  console.log(`Total Exported Methods: ${result.totalMethodsCount}`);
  console.log(`Manifest Verification Success: ${result.success}`);
  if (!result.success) {
    console.error("Errors:", result.errors);
    process.exit(1);
  }
}
