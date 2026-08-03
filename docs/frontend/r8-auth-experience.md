# R8 public authentication experience

## Route inventory and classification

| Route | Classification | Presentation | Authority |
| --- | --- | --- | --- |
| `/login` | Live credential flow | Sign-in form | Existing `/api/auth/login` |
| `/signup` | Live account-creation flow | Customer or business form | Existing `/api/auth/signup` |
| `/signup/select` | Live account-type entry | Customer/business route choice | Existing signup route state |
| `/forgot-password` | Live recovery request | Generic reset-request form and result | Existing `/api/auth/forgot-password` |
| `/reset-password` | Live recovery completion | Password form or explicit invalid-link state | Existing `/api/auth/reset-password` |
| `/verify-otp` | Live verification flow | Six-digit code and resend form | Existing `/api/auth/verify-otp` and `/api/auth/resend-otp` |
| `/security-verification` | Existing route with no verified authority | Explicit unavailable state | No form or invented endpoint |
| `/account-locked` | Existing status route | Generic restricted-access state | No internal cause or policy claim |
| `/session-expired` | Existing status route | Canonical sign-in recovery state | `/login` |
| `/accept-invitation` | Existing route with no verified authority | Explicit unavailable-invitation state | No form or invented endpoint |

No routes were renamed or added. All ten route pages contain one route heading through `AuthRouteIntro` or `AuthStatusPage`. They have unique metadata, `noindex, nofollow`, no token-bearing canonical metadata, and are absent from `app/sitemap.ts`.

## Secure Handoff concept and architecture

Secure Handoff is a cool-neutral, editorial access boundary: a compact site header, a five-column form plane, and an offset four-column operational image plane on larger screens. The desktop image is supporting context, never a status dashboard. On mobile it is removed completely so the form begins immediately after the header.

`AuthShellV2` owns the server-rendered visual boundary, font variables, header, layout, footer, and local media. `AuthRouteIntro`, `AuthStatusPage`, `AuthErrorSummary`, `AuthTextField`, `PasswordField`, `OtpField`, `AuthSecurityNote`, and `AuthFlowLinks` keep interaction and semantic details consistent. Client components are restricted to forms and controls that need browser state.

## Authority, sessions, and redirects

R8 changes no auth API, validation schema, password hash, session service, session cookie, role guard, rate limit, origin check, user-status transition, OTP service, reset-token service, invitation service, or role redirect. Live forms retain their existing JSON endpoints and payload shapes. Login and OTP still accept the redirects supplied by their existing trusted API responses; no return-path or external redirect parameter was introduced.

The reset page resolves the query server-side and keeps the reset value out of presentation props, visible content, metadata, logs, storage, and client state. A server-rendered hidden field is associated with the form only because the existing JSON API contract requires it. Invitation and extra-security routes have no verified public completion authority in this codebase, so R8 deliberately offers no synthetic token parsing, submit action, resend action, or status claim.

## Form behavior

Login has only email and password fields; it has no role choice, social provider, passkey, remember-me option, or tracking form. Its API errors remain server-authored, preserving the generic invalid-credential behavior. Signup offers only the existing `CUSTOMER` and `STORE` payload contracts. Password guidance reflects the validated minimum of eight characters, and password fields use `current-password` or `new-password` as applicable.

Forgot-password always presents the same post-submit result, whether or not an account exists. Reset links with no value produce an explicit invalid state. OTP is a single numeric six-character field with `autocomplete="one-time-code"`; normal typing and pasted digits are accepted. Resend calls the existing authority and has no invented countdown or availability timer. Email is masked in OTP copy where it is displayed.

Every field has a visible label, linked textual error, and shared error summary. Password visibility is a real `type="button"` with a changing accessible name. The forms do not block paste or disable password managers. Inputs retain 16px text on small screens to avoid software-keyboard zoom; the page stays normally scrollable and has no pinned interaction.

## Status content rules

The account-restricted page is deliberately generic and does not reveal thresholds, causes, billing information, or an outcome guarantee. The session-expired page gives a canonical login action without mentioning cookie or token details. Unavailable security and invitation routes explicitly say that completion is not available there and direct people to sign in or support without pretending to verify or accept anything.

## Media, performance, and accessibility

R8 uses the documented local provisional asset in `lib/public-assets/auth-media.ts`; provenance and replacement requirements are in [R8 auth media](./r8-auth-media.md). There are no remote application image URLs, new dependencies, animation libraries, gradients, glass effects, purple treatment, or page pinning. The media plane uses responsive Next image sizing and is omitted on smaller screens.

Focus states, semantic forms, status and alert roles, error associations, reduced-motion handling, forced-colors focus treatment, and meaningful image alternative text are included. The layout is server-first where possible and remains usable without its decorative desktop media.

## Browser QA and next boundary

Browser QA should check all ten URLs at a narrow mobile width and desktop width; tab through headers, inputs, visibility buttons, errors, and links; paste a password and six-digit OTP; trigger server validation; confirm reset and invitation values never render; and confirm the desktop image disappears on mobile. Test login, signup, recovery, reset, OTP, resend, and session behavior against a safe local environment only.

R8 stops at the existing public auth entry experience. A future phase may add invitation or extra-verification UI only after a reviewed server authority and token/session policy exist.
