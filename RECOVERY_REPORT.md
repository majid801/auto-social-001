# AutoSocial AI Recovery Report

## Status

The latest accessible implementation was recovered from the public repository `majid801/auto-social-001` at commit `aa41dae` because the original local workspaces and managed checkpoint could not be adopted by the current project identity. The existing React dashboard, Firebase project/configuration, Firestore rules, Publora integration, content/calendar/media/settings screens, and navigation were preserved.

The corrected source is complete and locally verified. It has not been published to the existing managed deployment because that deployment is not attachable from this project identity.

## Implemented repairs

### Authentication and API boundary

Google Sign-In now uses Firebase redirect authentication on Android/mobile browsers and retains popup authentication on desktop. Firebase browser-local persistence is configured, redirect results are handled, and the landing page shows actionable errors for unauthorized domains, invalid redirect configuration, blocked popups, network failures, and other sign-in failures.

All non-health API routes now require a verified Firebase ID token. Verification checks the Firebase project audience, issuer, expiration, issued-at time, RS256 signature, and Google Secure Token signing certificate. Scheduler identity is derived from the verified token rather than trusting request body or query-string user IDs. The browser API client forwards the current Firebase ID token on authenticated requests.

### Genuine image generation

Image generation is constrained to the stable `gemini-2.5-flash-image` model. The UI no longer advertises unsupported future model IDs. Returned image bytes are persisted as real media, while Gemini quota, permission, model, and empty-output failures remain explicit error states. Uploading an image or opening the Media Library remains available as a workflow alternative; no fake AI result is created.

### Functional video generation

The inaccessible Gemini Omni/Kaggle/LTX branch was removed from the recovered app. Video Studio now uses an asynchronous FFmpeg scene renderer that produces vertical 9:16 or landscape 16:9 H.264/AAC MP4 output with captioned scenes, fade transitions, a valid audio stream, polling, preview, download, and existing Media Library handoff. The UI and settings explicitly disclose that this is lightweight scene rendering, not native text-to-video generation.

### Production and scheduling

The server honors the hosting `PORT`, exposes a public `/api/health` endpoint, and serves `public/manus-routes.json` for the single-page route. Recurring automation matching now evaluates each rule in its configured IANA timezone rather than using server-local time.

## Verification evidence

| Check | Result |
|---|---|
| TypeScript check (`npm run lint`) | Passed with exit code 0 |
| Production Vite build (`npm run build`) | Passed with exit code 0 |
| `/api/health` | HTTP 200; reports `ffmpeg-scene-renderer` |
| `/manus-routes.json` | HTTP 200; declares `/` |
| SPA root `/` | HTTP 200 with AutoSocial AI HTML shell |
| Unauthenticated `/api/config/status`, `/api/media/list`, `/api/scheduler/state`, `/api/ai/models` | HTTP 401; no data returned |
| Mobile Chromium render | Captured a 390×844 landing page after Firebase initialization |
| FFmpeg scene pipeline | Valid 4-second MP4: 720×1280 H.264 video, AAC audio, `yuv420p`, MP4 container |
| Legacy provider scan | No Kaggle/GPU-worker/Free-AI-Studio/Gemini Omni references remain in application source |

## Remaining blockers

The original managed Webdev project still needs to be reconnected before checkpointing or publishing. A real Android-device OAuth test remains necessary to verify Firebase Console authorized domains, Google provider enablement, and redirect configuration. Live Gemini quota/model entitlement and Publora connection/publishing require the owner’s configured credentials and were not exercised; no live post was created.

The server API is now authenticated, but direct `/uploads/*` file URLs remain public for compatibility with existing browser image/video previews. A later production hardening pass should move media to user-scoped object storage or authenticated download URLs. The scheduler still uses local JSON/in-process cron state; a durable store and distributed lock are required for multi-instance or restart-safe unattended automation.

## Working files

The implementation plan is in `plan.md`, and the remaining reconnection/test checklist is in `TODO.md`.
