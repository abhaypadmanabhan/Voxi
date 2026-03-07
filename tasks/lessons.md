# Lessons Learned

- **WS Handler Testing:** Testing Fastify websocket plugins requires binding to a dynamic port rather than using `.inject()` to correctly test full TCP communication.
- **Electron Builder Main Script:** `electron-builder` respects `package.json`'s `main` field, so it is necessary to accurately point it to `dist/server.js` matching the final compiled location.
- **Electron Builder with fastify:** When adding `electron-builder`, any `dependencies` are built into `app.asar`. If a dependency doesn't properly cleanly install locally during tests, caching problems can arise.
- **macOS Entitlements:** `electron-builder` requires an entitlements `.plist` file if `hardenedRuntime` is enabled (necessary for App Store / Developer Id code signing), so test environments must generate at least a dummy `.plist` file to allow ad-hoc offline testing.

- **Github Push Failures (100MB+ limit):**
  - **What was wrong:** `git push` to origin failed with HTTP 400 (RPC failed) due to a massive >100MB payload.
  - **Why it happened:** The `release/` directory containing packaged Electron binaries (`app.asar`, `Voxi Server.app`) was accidentally tracked and committed in the Sprint branch.
  - **The new rule/check that prevents recurrence:** Always add build output directories (`release/`, `dist/`, `out/`) to `.gitignore` *before* staging changes. If a push fails with RPC 400 errors, immediately check for accidentally tracked large files (`git log --stat`) and remove them from history using a soft reset or rebase before attempting to push again.
