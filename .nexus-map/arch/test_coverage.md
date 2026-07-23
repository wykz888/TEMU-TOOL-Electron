> generated_by: nexus-mapper v2
> verified_at: 2026-07-13
> provenance: Manual inspection of package scripts and validation files.

# Test And Validation Coverage

## Available Commands

- `npm run validate`
- `npm run validate:feature-catalog`
- `npm run validate:preload-ipc`
- `npm run validate:promotion-monitor`
- `npm run validate:operations-feature-chains`
- `npm run validate:operations-pricing`
- `npm run validate:pod-upload-sheet-miaoshou`
- `npm run validate:pod-suite-tool`
- `npm run validate:auth-bridge`

## Static Validation Surface

- Feature and creation catalog shape, uniqueness, storage key boundaries, and code path existence: `scripts/validateFeatureCatalog.js`.
- Preload to IPC channel surface for feature center, creation center, POD suite tool, shop management, global config, and updater: `scripts/validatePreloadIpcSurface.js`.
- Promotion monitor `ads_detail` parsing/paging, automatic pause predicates, pause/resume sequence decisions, and `modify_ads` payload shape: `scripts/validatePromotionMonitorRules.js`.
- Operations activity management, traffic boost, and new product lifecycle open/preload/IPC/main/service chain coverage: `scripts/validateOperationsFeatureChains.js`.
- Operations pricing and submit payload calculations for traffic boost and price declaration: `scripts/validateOperationsPricingLogic.js`.
- POD MiaoShou material sequence rules for TEMU and universal SKU image export: `scripts/validatePodUploadSheetMiaoshouMaterialRules.js`.
- POD suite image rendering, PSD template handling, mask region detection, perspective transforms, and slice export: `scripts/validatePodSuiteToolService.js`.
- Auth bridge validation is run through Electron by `scripts/validateAuthBridgeRunner.js`.

## Build Verification

Renderer bundles are built one target at a time by `scripts/buildRendererBundle.js`. Package scripts expose targets such as:

- `npm run build:renderer:main-window`
- `npm run build:renderer:feature-center`
- `npm run build:renderer:shop-management`
- `npm run build:renderer:exit-progress`
- `npm run build:renderer:pod-upload-sheet-miaoshou`
- `npm run build:renderer:promotion-manager`

Main/preload/service/window changes require a real Electron restart. Renderer-only changes require rebuilding or refreshing the affected window/page.

## Gaps

- No general unit test framework is configured.
- Large legacy renderer files under `src/renderer/operations*View.js` rely mostly on manual/UI verification and partial pricing validations.
- Browser automation behavior is documented but not broadly automated in tests. Changes to login/session flows should be verified in a real Electron browser session and with runtime logs.
- AST extraction was truncated and Vue SFC coverage is module-only, so static dependency evidence is incomplete.
