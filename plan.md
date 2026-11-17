# AutoSocial AI recovery plan

## Recovery basis

The original local workspaces and managed checkpoint `84fde66` are not available to the current project identity. The public repository `majid801/auto-social-001` at `aa41dae` is the latest accessible implementation. The deployed URL remains readable but cannot be adopted or republished from this account.

## Implementation approach

Preserve the existing React dashboard, Firebase project/configuration, Firestore data model, Publora API integration, and navigation. Repair the smallest confirmed defects in place:

- use Firebase redirect authentication on mobile browsers and popup authentication on desktop, with local persistence and visible failure details;
- use stable Gemini text/image model IDs and keep genuine image generation failures explicit rather than presenting a fallback as AI output;
- replace the inaccessible native/GPU video branch with the lightweight FFmpeg scene renderer already required by the project brief, producing vertical H.264/AAC MP4 jobs with polling, preview, download, and Media Library handoff;
- honor the hosting `PORT`, add an unauthenticated health endpoint, serve the required route manifest, and add regression-oriented endpoint checks;
- remove the legacy Kaggle/GPU branch and misleading UI copy from the recovered repository.

## Project structure

- `server.ts`: Express API, Gemini text/image routes, FFmpeg video jobs, Publora proxy, media uploads, scheduler, and Vite/static serving.
- `src/context/AuthContext.tsx`: Firebase session persistence and Google sign-in flow.
- `src/lib/firebase.ts`: existing Firebase app/auth/Firestore setup.
- `src/components/Views/`: existing dashboard, content, media, video, publishing, calendar, settings, and analytics screens.
- `src/services/api.ts`: browser API client.
- `public/manus-routes.json`: page route declaration for the managed website contract.

## Constraints

No new Firebase project, paid media provider, GPU/Kaggle worker, fake AI image success, automatic live publishing, or replacement project will be introduced. Publication remains blocked until the original managed project/repository identity is reconnected.
