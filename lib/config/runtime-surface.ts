type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

/** The Vercel front end only forwards stateful requests to Railway. */
export function isVercelProxyRuntime(
  env: RuntimeEnvironment = process.env,
): boolean {
  return (
    env.VERCEL === "1" &&
    (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") &&
    !env.DATABASE_URL?.trim() &&
    !env.RAILWAY_SERVICE_ID?.trim() &&
    !env.RAILWAY_ENVIRONMENT_ID?.trim()
  );
}
