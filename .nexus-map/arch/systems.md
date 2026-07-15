> generated_by: nexus-mapper v2
> verified_at: 2026-07-13
> provenance: AST-backed for file inventory; system boundaries are verified by manual inspection of entry files, catalogs, windows, preload, services, and validation scripts.

# Systems

## Electron Main Orchestrator

- Code: `src/main.js`
- Responsibility: app lifecycle, single-instance behavior, session data path setup, global services, lazy service construction, feature window opening, progress broadcast, login/logout area switching, and IPC registration.
- Notes: this file is still large. Future work should extend existing domain modules or extract cohesive responsibilities instead of adding more orchestration logic directly.

## Window And Browser Automation

- Code: `src/windows/`
- Key files: `create*Window.js`, `shopWindowBrowserController.js`, `shopWindowLoginAutofill.js`, `shopWindowSellerSessionProbe.js`, `shopWindowSellerCenterLanding.js`, `shopWindowBrowserEnvironment.js`.
- Responsibility: BrowserWindow/WebContentsView creation, TEMU seller-center and ads workspace management, login automation, seller session probing, browser storage sync, popup handling, environment/proxy/fingerprint setup.
- Notes: this is main-process side product logic. Complex browser automation should stay here or in services, not inside renderer UI.

## IPC And Preload Bridge

- Code: `src/ipc/`, `src/preload/`
- Responsibility: channel constants, registration handlers, fallback responses, and the `window.temuApp` public API surface for renderer modules.
- Key files: `src/preload/appPreload.js`, `src/preload/featureCenterPreloadApi.js`, `src/preload/featureCenterOperationsPreloadApi.js`, `src/ipc/registerFeatureCenterIpc.js`, `src/ipc/ipcRegistration.js`.
- Validation: `npm run validate:preload-ipc`.

## Renderer Shell And Feature Apps

- Code: `src/renderer/`
- Responsibility: user-facing UI. The main window shell uses `src/renderer/index.html` plus Vue bundles. Newer workbenches are independent Vue apps under `*App/`; older operations workbenches are large plain JS/CSS files.
- Key shell files: `src/renderer/index.html`, `src/renderer/index.js`, `src/renderer/mainWindowApp/`, `src/renderer/mainWindowShellView.js`, `src/renderer/vueBundleViewLoader.js`.
- Shared bundle loader: `src/renderer/vueBundleViewLoader.js` centralizes Vue app mounting, stylesheet loading, and fallback rendering for thin HTML/JS shells such as shop management, global config, confirm dialog, exit progress, global category sync, POD upload sheets, promotion manager, promotion manager new, PSD smart suite, and the shop window shell.
- PSD smart suite renderer rules: `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteModels.js` owns mockup normalization and run-payload shaping; `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteProgress.js` owns progress event labels, log text, tone, and counters so `App.vue` remains focused on UI state wiring.
- PSD smart suite local settings persistence lives in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteSettings.js` so storage parsing and serialization stay separate from the Vue view entry.
- PSD smart suite renderer state composables live in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteLogs.js` and `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteMockups.js` so log scrolling and mockup list editing stay isolated from the page shell.
- PSD smart suite source selection and metadata state live in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteSources.js` so image-directory and metadata-directory flows stay isolated from the page shell.
- PSD smart suite template workspace logic lives in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteTemplateWorkspace.js` so template fetch/save/delete flow stays separate from page orchestration.
- PSD smart suite run/runtime logic lives in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteRuntime.js` so task start/cancel/progress and engine-window sync stay separate from the page shell.
- PSD smart suite presentational styles live in `src/renderer/psdSmartSuiteApp/styles/psd-smart-suite-app.css` and are loaded from `src/renderer/psdSmartSuiteApp/main.js` so the Vue entry no longer carries the full stylesheet.
- Keep-alive behavior: main sections are hidden and shown instead of destroyed. `src/renderer/operationsModuleKeepAlive.js` provides first-activation and resume contracts for legacy operations pages.

## Catalog And Profile Metadata

- Code: `src/features/`, `src/services/*/*ProfileService.js`
- Responsibility: feature-center and creation-center catalogs, feature card metadata, module metadata, storage keys, code category, and per-entry storage profile decoration.
- Key files: `src/features/featureCenter/catalog.js`, `src/features/creationCenter/catalog.js`, `src/services/featureCenter/featureCenterProfileService.js`, `src/services/creationCenter/creationCenterProfileService.js`.
- Validation: `npm run validate:feature-catalog`.

## Feature Services

- Code: `src/services/featureCenter/`
- Responsibility: operations activity management, traffic boost, price declaration, new product lifecycle, promotion master/monitor, marketing tools, POD MiaoShou export/upload/template/title services, shared cost/shop/category services.
- Notes: POD MiaoShou export now uses a shared pure helper for material item selection and description image resolution so the TEMU and universal export services stay aligned on the same rule set. POD MiaoShou AI title generation now also persists per-user, per-entry result cache files under the feature storage cache root so `useCache` can skip both upload and generation work on repeated inputs.
- Risk: several services are thousands of lines and should be changed carefully with focused validation.

## Creation Services

- Code: `src/services/creationCenter/`
- Responsibility: POD suite tool, PSD smart object rendering, white mockup template rendering, template stores, image metadata, slicing/export helpers.
- Notes: PSD smart suite payload compatibility and provided-source-list normalization live in `podSuitePsdPayloadUtils.js`; pure PSD runtime rules such as output format, slice mode, output identity, source decoration, and work-unit splitting live in `podSuitePsdRuntimeRules.js`; PSD failure and partial-result assembly lives in `podSuitePsdResultFactory.js`; task signals, cancellation checks, concurrency limiters, and recoverable-open retry constants live in `podSuitePsdTaskRuntime.js`; image enumeration and existence checks live in `podSuiteFileSystemUtils.js`; PSD source and metadata-source resolution lives in `podSuitePsdSourceResolver.js`; progress timestamping lives in `podSuitePsdProgressUtils.js`; the single-PSD-mockup render loop lives in `podSuitePsdMockupRunner.js` so `podSuiteToolService.js` can stay focused on service entry orchestration. Photopea-local file serving lives in `photopeaLocalFileServer.js`, input image preparation and export conversion live in `photopeaImagePipeline.js`, message parsing lives in `photopeaMessageRuntime.js`, script/Echo protocol helpers live in `photopeaSmartObjectScripts.js`, and debug log isolation lives in `photopeaRuntimeLogger.js`; `photopeaSmartObjectRenderer.js` now owns BrowserWindow session control, Photopea messaging, and smart-object execution orchestration.
- Validation: `npm run validate:pod-suite-tool` covers image rendering, template handling, mask/region behavior, and slice export logic.

## Shop Management And Persistence

- Code: `src/services/shopManagement/`, `src/state/`, `src/utils/persistenceRoots.js`, `docs/persistence-scope.md`
- Responsibility: shop records, groups, visibility, fingerprints, login account/session state, and scoped TEMU data root migration.
- Rule: new account-tied data should live under `{featureRoot}/users/{userKey}/{config|state|cache}/...`.

## Build And Release Tooling

- Code: `scripts/`, `vite*.config.mjs`, `package.json`
- Responsibility: per-renderer Vite bundles, validation scripts, git backup, Windows start flow, release upload, and Electron builder packaging.
- Main build helper: `scripts/buildRendererBundle.js`.
