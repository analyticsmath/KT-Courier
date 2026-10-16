export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface RouteContext<_T = string> {
    params: Promise<Record<string, string>>;
  }
}
