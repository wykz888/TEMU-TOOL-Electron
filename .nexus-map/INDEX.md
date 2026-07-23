> generated_by: nexus-mapper v2
> verified_at: 2026-07-13
> provenance: AST-backed for file inventory and ES module edges; CommonJS, Vue internals, Electron runtime wiring, and dependency diagrams are verified by manual inspection.

# TEMU Toolbox Electron Map

This repository is a TEMU Toolbox Electron app. The repo rules require Vue 3, TypeScript, Electron, Vite, and Arco Design Vue for future work, but the current implementation is mostly JavaScript plus Vue SFC modules. Treat TypeScript as the intended baseline for new work, not the current source language.

## Cold Start Summary

- Main process orchestration lives in `src/main.js`. It owns app startup, session/profile/theme/update services, window lifecycle, lazy feature services, and IPC registration.
- Renderer UI is split between a main HTML shell at `src/renderer/index.html`, Vue bundles under `src/renderer/*App/`, thin bundle loaders such as `src/renderer/vueBundleViewLoader.js`, and older large renderer scripts such as `operationsActivityManagementView.js`. Promotion Master now uses the Vue/Arco implementation under `src/renderer/promotionManagerNewApp/` and opens through `src/renderer/promotionManagerNew.html`; the older `promotionManagerApp` renderer and old window entry were removed. Promotion detail queries use `src/services/featureCenter/promotionManagerNewDetailService.js` over the shared Ads session service, with payload/row parsing in `promotionManagerNewDetailRows.js` so `ads_detail` rows become clone-safe renderer models. Promotion detail manual operations use `promotionManagerNewDetailActionService.js` over the same region-cookie backend session path and submit `modify_ads` in capped chunks with clone-safe row action results. Promotion monitor config/action rules, metric parsing, `ads_detail` item parsing, `ads_detail` paging collection, automatic operation rules, pause/resume sequence rules, modify payload shaping, runtime state model, and runtime logs are split into `promotionMonitorConfigModel.js`, `promotionMonitorMetricUtils.js`, `promotionMonitorAdsDetailItemParser.js`, `promotionMonitorAdsDetailItems.js`, `promotionMonitorOperationRules.js`, `promotionMonitorPauseSequenceRules.js`, `promotionMonitorModifyPayloads.js`, `promotionMonitorStateModel.js`, and `promotionMonitorRuntimeLogStore.js`. Promotion monitor total-spend sorting and empty-region rechecks are throttled per shop and region to avoid repeating expensive TEMU requests every monitor cycle.
- PSD smart suite renderer helpers now live under `src/renderer/psdSmartSuiteApp/utils/` for mockup normalization, progress parsing, local settings persistence, log/mockup state composables, source selection state, template workspace flow, and run/runtime lifecycle; presentational styles live in `src/renderer/psdSmartSuiteApp/styles/psd-smart-suite-app.css`. PSD service payload aliases, pure runtime/output/work-unit rules, result assembly, task runtime helpers, image file utilities, source resolution, progress emission, and single-mockup rendering live in focused modules such as `src/services/creationCenter/podSuitePsdPayloadUtils.js`, `src/services/creationCenter/podSuitePsdRuntimeRules.js`, `src/services/creationCenter/podSuitePsdResultFactory.js`, `src/services/creationCenter/podSuitePsdTaskRuntime.js`, `src/services/creationCenter/podSuiteFileSystemUtils.js`, `src/services/creationCenter/podSuitePsdSourceResolver.js`, `src/services/creationCenter/podSuitePsdProgressUtils.js`, and `src/services/creationCenter/podSuitePsdMockupRunner.js` so `podSuiteToolService.js` stays focused on service entry orchestration. Photopea-specific file serving, input image preparation/export conversion, message parsing, script and Echo protocol construction, and debug logging live in `photopeaLocalFileServer.js`, `photopeaImagePipeline.js`, `photopeaMessageRuntime.js`, `photopeaSmartObjectScripts.js`, and `photopeaRuntimeLogger.js` so `photopeaSmartObjectRenderer.js` can stay focused on BrowserWindow session control and smart-object execution.
- Public renderer access goes through `window.temuApp` from `src/preload/appPreload.js`, with domain APIs composed from `src/preload/*PreloadApi.js`.
- Feature and creation cards are metadata-driven in `src/features/featureCenter/catalog.js` and `src/features/creationCenter/catalog.js`. Storage boundaries are derived by profile services.
- User-selected material storage from global config `存储素材` is a material object root, not a software-account storage root. Uploaded material object keys must not add `users/{userKey}` under that selected root; keep account scoping only for local caches, settings, and cloud config/state. Old uploaded material caches with a software-account path layer are expired instead of matched or migrated.
- Shop browser automation is a major main-process side system under `src/windows/`, especially `shopWindowBrowserController.js`, login autofill, seller session probes, and seller-center landing logic. Pure browser load-error page rendering now lives in `src/windows/shopWindowViewLoadErrorPage.js`, shop browser partition identity/path rules live in `src/windows/shopWindowPartitionIdentity.js`, browser right-click menu behavior lives in `src/windows/shopWindowContextMenu.js`, and proxy/fingerprint workspace environment signature rules live in `src/windows/shopWindowEnvironmentSignature.js` so the controller stays focused on WebContentsView orchestration.
- Shop management renderer entry `src/renderer/shopManagementApp/App.vue` is now a thin Vue composer. Toolbar, table, group modal, shop form modal, state actions, and page styles live under `components/`, `state/`, and `styles/`.
- Shop window renderer script `src/renderer/shopWindowView.js` still owns the legacy direct-script coordinator, while shared constants, browser storage empty models, and workspace bounds/payload comparison helpers live in `src/renderer/shopWindowRuntime.js`, loaded before `shopWindowView.js` from the main HTML shell.
- Software login startup state is split between volatile `src/state/sessionStore.js`, remembered login credential bootstrap in `src/state/loginAccountCache.js`, and remembered session bootstrap in `src/state/authSessionCache.js`; startup restores the remembered software-login session before opening the auth window when `rememberLogin` was enabled.
- Validation is script-based, not a full test suite. Use `npm run validate` for catalog, preload IPC, pricing logic, POD suite service, and auth bridge checks.

## Evidence Caveats

AST extraction saw 356 JavaScript/Vue files and 183724 lines, but it was truncated and Vue files have module-only coverage. CommonJS imports are not fully represented by `query_graph.py`, so dependency notes below use manual inspection where stated.

Hotspots from the last 90 days cluster around POD MiaoShou renderer flows, package/build configuration, `src/main.js`, PSD smart suite, and catalog-center UI.

## Fast Routing

- UI shell or navigation: start with `src/renderer/index.html`, `src/renderer/index.js`, `src/renderer/mainWindowApp/`, and the relevant `*View.js`.
- New feature card or storage scope: start with `src/features/*/catalog.js`, the feature module directory, and the matching profile service.
- Renderer to main bridge changes: edit channel constants in `src/ipc/*Channels.js`, registration in `src/ipc/register*.js`, preload exposure in `src/preload/`, then validate.
- Browser/session/TEMU login work: start with `src/windows/shopWindowBrowserController.js`, `shopWindowLoginAutofill.js`, `shopWindowSellerSessionProbe.js`, and docs under `docs/`.
- Operations workbenches: current risk is large legacy renderer files plus large services. Prefer extracting cohesive state/service/view helpers before adding major logic.

## [Operational Guide] Mandatory Steps

This section is mandatory for any AI reading this map.

### Step 1 Read These Files First

After reading this file, before doing any repository task, read all of:

- `.nexus-map/arch/systems.md`
- `.nexus-map/arch/dependencies.md`
- `.nexus-map/arch/test_coverage.md`
- `.nexus-map/hotspots/git_forensics.md`
- `.nexus-map/concepts/domains.md`

### Step 2 Task-Specific Checks

- If changing public IPC, preload, catalogs, service boundaries, or shared helpers, run `python C:\Users\wykz8\.codex\skills\nexus-mapper\scripts\query_graph.py .nexus-map/raw/ast_nodes.json --impact <path>` and inspect manual callers when CommonJS is involved.
- If adding or changing feature catalog entries, run `npm run validate:feature-catalog`.
- If touching preload or IPC surface, run `npm run validate:preload-ipc`.
- If changing renderer UI only, rebuild the affected renderer bundle. If changing main, preload, service, or window code, restart Electron for verification.
- If architecture, persistence, or public interfaces change materially, update `.nexus-map` before finishing.
