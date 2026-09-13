---
name: Generated client DOM types
description: TypeScript library settings needed by generated browser API clients.
---

Generated API client code can call iterable browser APIs such as `Headers.entries()`. When the shared TypeScript base config only includes `dom`, the generated client library may fail typechecking even though the app itself has a browser lib. Include `dom.iterable` in the generated-client package's `lib` list.

**Why:** The generated client is typechecked as its own composite library, so the consuming Vite app's DOM settings do not fix missing iterable declarations upstream.

**How to apply:** If codegen introduces `Headers.entries()` or similar browser iterable errors, update the affected library `tsconfig.json` rather than hand-editing generated output.