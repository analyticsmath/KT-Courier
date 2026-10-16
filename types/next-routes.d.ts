export {};

declare global {
  interface RouteContext<T = string> {
    params: Promise<Record<string, string>>;
  }
}
