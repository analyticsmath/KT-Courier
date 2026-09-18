import { PublicTransitionRouter } from "./PublicTransitionRouter";
export { useTransitionContext } from "./PublicTransitionRouter";

interface PublicPageTransitionProps {
  children: React.ReactNode;
}

export function PublicPageTransition({ children }: PublicPageTransitionProps) {
  return (
    <PublicTransitionRouter>
      {children}
    </PublicTransitionRouter>
  );
}

