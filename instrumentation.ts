/** Next.js builds instrumentation in Edge and Node runtimes.
 * Only the Node path may load dependencies that require node:crypto.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeInstrumentation } = await import("./instrumentation.node");
    await registerNodeInstrumentation();
  }
}
