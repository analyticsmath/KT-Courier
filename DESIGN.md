# KT public visual direction

Current client-approved execution brief: `docs/frontend-redesign/kt-creative-reset-2026-10-18.md`. The client explicitly authorized implementation on `main` on 18 October 2026.

The public redesign lives under `.kt-redesign`. `/shop` and every catalog descendant keep their existing content visual root and typography. The latest client instruction explicitly replaces the shared header and footer on catalog routes too. Dashboard routes remain outside the redesign.

White #FFFFFF, neutral surface #F4F4F4, ink #191919, supporting copy #595959, functional focus/error signal #982C35. The supplied logo retains its original colors. No blue interface tint, cream, gradients, glow, glass, colored heading words, routine eyebrows or decorative separators.

Local Mona Sans is the redesigned display/body face. Headings use scale and composition at approximately 450–550 weight. Existing catalog typography remains unchanged.

The homepage is a new editorial scene graph. No initial van or intro curtain. The full side van appears in a later scroll scene; both vehicles use contained lateral motion without leaving the frame. The homepage has no product feed. Existing photography supplies context, with measured parallax and media-plane overlap. The local-life filmstrip advances with desktop scroll; service cards resolve as they enter; the footer has a single-line, width-fitted KT COURIERS wordmark. Motion is scene-local, reversible and cleaned up on unmount. Reduced motion retains complete content.

Utility routes place the task first. Auth forms, quote/tracking inputs, cart quantity controls, checkout stages and payment behavior retain their existing business owners. Cart/checkout CSS is isolated in `transaction-design.module.css`; public UI styling must never change financial calculations or authorization.

Visual acceptance requires real rendered desktop/mobile inspection. Typecheck, lint, build and domain tests are engineering evidence, not a self-issued design score. Do not use Playwright for this program.
