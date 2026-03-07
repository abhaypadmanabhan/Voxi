# Lessons Learned

- **WS Handler Testing:** Testing Fastify websocket plugins requires binding to a dynamic port rather than using `.inject()` to correctly test full TCP communication.
- **Electron Builder Main Script:** `electron-builder` respects `package.json`'s `main` field, so it is necessary to accurately point it to `dist/server.js` matching the final compiled location.
- **Electron Builder with fastify:** When adding `electron-builder`, any `dependencies` are built into `app.asar`. If a dependency doesn't properly cleanly install locally during tests, caching problems can arise.
- **macOS Entitlements:** `electron-builder` requires an entitlements `.plist` file if `hardenedRuntime` is enabled (necessary for App Store / Developer Id code signing), so test environments must generate at least a dummy `.plist` file to allow ad-hoc offline testing.
