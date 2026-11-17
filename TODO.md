# AutoSocial AI recovery TODO

- [x] Recover the latest accessible implementation from the public repository and inspect the deployed website/reports.
  - The expected local copies are missing; the repository is at `aa41dae`.
  - The prior managed checkpoint/deployment cannot be adopted by the current project identity.
- [x] Preserve the existing dashboard, Firebase configuration, Firestore rules, Publora integration, media library, calendar, settings, and navigation.
- [x] Repair Google Sign-In for Android/mobile by using Firebase redirect flow with local session persistence while retaining desktop popup sign-in.
- [x] Keep genuine Gemini image generation explicit: use the stable Gemini image model, persist returned image bytes, and show quota/provider errors without labeling them successful AI generation.
- [x] Provide functional lightweight FFmpeg video jobs with vertical 9:16 support, H.264/AAC MP4 output, polling, preview, download, and Media Library integration; disclose that this is scene rendering, not native text-to-video.
- [x] Remove the recovered repository's legacy Kaggle/GPU branch and misleading settings/video copy.
- [x] Make the server honor `PORT`, add `/api/health`, and add `/manus-routes.json` for the current single-page route.
- [ ] Reconnect the original managed Webdev project identity so the corrected code can be checkpointed and published.
- [ ] Re-test authenticated Google OAuth end-to-end on a real Android device and desktop browser; this is blocked without an adoptable managed project/browser session and Firebase console access.
- [ ] Re-test live Publora publishing and scheduling with the owner's credentials; no live post will be created by this recovery run.
