# AnatomyLens production security and privacy audit

Audit date: September 24, 2026  
Scope: React/Vite application, bundled runtime assets, Capacitor iOS project, package manifests and lockfiles, current repository text files and practical Git history review.

## Critical

No critical security issues found in the reviewed application source or release package. No backend, account system, camera upload, analytics, ads, telemetry, or remote anatomy API exists in the app.

## Important

- The public App Store privacy-policy URL and support contact still need to be published and entered into App Store Connect. Hosted-site access logs are controlled by the eventual hosting provider; they can include visitor IP/browser data.
- Before App Store submission, review the final signed archive's privacy manifest report and complete App Store privacy answers, SDK declarations, age rating, content rights, and territory requirements.
- Public package audit reports no known production dependency advisories. Two conditional development-tool advisories remain: `uuid@7.0.3` via Xcode project tooling (the app's runtime does not ship or use this package), and `esbuild@0.27.7` in Vite's development toolchain (the reported file-read issue concerns the development server on Windows). Do not expose a dev server publicly; keep the lockfile updated.
- The camera was not tested in the simulator during this audit. The user reports that camera and overlay worked on their physical iPhone when screen sharing was off; screen sharing interferes with that camera. Validate camera behavior on-device with screen sharing off before each release.

## Minor

- iOS release build emits Xcode's App Intents metadata warning because the app does not use App Intents; it does not fail validation.
- Configure the generated `deployment/security-headers.mjs` response headers on whichever production host is selected. The bundled `_headers` file is recognized by Netlify and Cloudflare Pages; other hosts need equivalent header configuration.
- `com.bitfbt.anatomy` is still a provisional bundle identifier; confirm ownership and use in the publishing Apple Developer account.

## Changes made

- Set the product and iOS display name to AnatomyLens; added accurate camera-use permission copy.
- Disabled custom Vite environment exposure (`envPrefix: []`), excluded `.env*` except the placeholder `.env.example`, and scanned current source plus practical Git history for credential patterns. No credential pattern was found.
- Removed the stale npm lockfile and updated the pnpm dependency lock. Updated vulnerable development transitive packages without major-version upgrades; moved unused-in-production Three.js to development dependencies.
- Bundled the required MediaPipe model/runtime files locally; restricted production asset copying to reviewed runtime assets and privacy/license documents; omitted experimental skull art, source maps and template assets.
- Added a restrictive but app-compatible CSP and deployment security headers, including camera-only Permissions-Policy; limited Vite dev/preview servers to loopback with CORS disabled.
- Disabled Capacitor WebView debugging/native logging for release and stripped console/debugger calls in production bundles.
- Hardened camera lifecycle behavior: start only from the Scan action, stop/release tracks on Stop, camera switch, hidden/background state, failure, and unmount; cancel stale initialization/animation callbacks and clear app-owned pixel/landmark history. Added an iOS background cover to keep camera pixels out of the app-switcher snapshot.
- Updated the bundled privacy notice to distinguish app-owned buffers from transient MediaPipe model state and from hosting-provider request logs.

## Remaining risks

- The project has no backend endpoints, so server input validation, API rate limiting, paid API abuse controls, and server error sanitization are not applicable. Production hosts must use HTTPS and apply the supplied headers.
- `pnpm audit --prod` returned zero advisories. Full `pnpm audit` reports the two development-only advisories described above.
- The privacy notice is bundled in the app, but its public URL/support identity is not yet available. The exact hosting-provider data handling and retention cannot be assessed until a host is chosen.
- The app uses third-party MediaPipe model/runtime binaries. They are bundled locally with a license notice, but this source audit is not a binary supply-chain attestation.
- No signed App Store archive, TestFlight submission, or App Store Connect privacy-label verification was performed.

## Privacy verification

For the reviewed app code, the statement that AnatomyLens does not collect personal information and does not persist camera images/video is accurate. Camera access starts only after the user taps Scan and accepts OS permission. Frames feed local tracking/rendering; they are not written to files, browser storage, or sent to a server. Recent image pixels and app-owned landmark history are transient in memory; MediaPipe can retain transient inference state while its loaded model remains resident, and the app discards process memory when it closes. No analytics, advertising, tracking cookie, crash-reporting service, or user-data upload path was found. A hosted web deployment's ordinary request logs are outside the app and depend on host configuration.

## API key verification

No API keys, credentials, or secret-bearing environment files were found in the searched working-tree text files or practical Git-history blobs. The production frontend bundle was rebuilt with a unique `VITE_` secret sentinel present in the build environment; the sentinel was absent from the bundle. Vite's custom env exposure is disabled. API keys/secrets are absent from the browser-facing production bundle.

## Validation

- `pnpm build`: passed (Vite 7.3.6).
- `pnpm test`: passed, 150 tests, zero failures.
- `pnpm lint`: passed.
- `pnpm audit --prod`: zero advisories.
- `pnpm audit`: one low and one moderate advisory, both limited to development tooling.
- Generic iOS Release build: passed with code signing disabled for local validation.
- iPhone 18 Pro Simulator Release build: passed; installed package reports display name AnatomyLens. Simulator was not used to test camera.
- Production package checks: `.map` files and Vite sentinel absent; privacy notice and `_headers` present; console/debugger output stripped; test-only/experimental skull artwork omitted.
- Physical iPhone camera workflow: user-provided confirmation/photo in this task indicates camera and anatomy overlay work with screen sharing off. No new physical-device camera test was performed during this audit.
