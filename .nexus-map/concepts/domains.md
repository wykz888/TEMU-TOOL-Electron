> generated_by: nexus-mapper v2
> verified_at: 2026-07-13
> provenance: AST-backed file inventory plus manual inspection of catalogs, services, windows, renderer shell, and docs.

# Domains

## Auth And Session

Session state is held in `src/state/sessionStore.js`, remembered software-login credentials are handled by `src/state/loginAccountCache.js`, and remembered software-login session bootstrap state is handled by `src/state/authSessionCache.js`. Main process switches between auth and main areas through `openAuthenticatedArea` and `returnToAuthArea` in `src/main.js`; startup restores a remembered software-login session before opening the auth window when `rememberLogin` was enabled.

## Shop Management

Shop records, groups, fingerprint profiles, visibility, and shop detail services live under `src/services/shopManagement/`. Renderer state is exposed through `src/renderer/shopManagementApp/` and older helpers such as `src/renderer/shopManagementStore.js`.

## Shop Window And TEMU Browser Automation

The shop browser workspace is controlled by `src/windows/shopWindowBrowserController.js` with helpers for login autofill, seller-center landing, mall switching, region context requests, seller session probes, popup messages, and storage sync. Docs record login and automation performance rules.

## Feature Center

Feature cards live in `src/features/featureCenter/`. The catalog currently covers global category sync, operations activity, traffic boost, price declaration, new product lifecycle, marketing tools, promotion master, POD MiaoShou TEMU, and POD MiaoShou universal.

## Creation Center

Creation cards live in `src/features/creationCenter/`. Current catalog entries include POD suite tool. Rendering and generation services live under `src/services/creationCenter/`. PSD smart suite renderer model rules live in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteModels.js`, progress event parsing lives in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteProgress.js`, local settings persistence lives in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteSettings.js`, log/mockup renderer state composables live in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteLogs.js` and `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteMockups.js`, source selection state lives in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteSources.js`, template workspace flow lives in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteTemplateWorkspace.js`, run/runtime lifecycle lives in `src/renderer/psdSmartSuiteApp/utils/psdSmartSuiteRuntime.js`, and presentational styles live in `src/renderer/psdSmartSuiteApp/styles/psd-smart-suite-app.css`; task payload aliases and reusable source-file lists are normalized by `podSuitePsdPayloadUtils.js`, output-format, slice-mode, path-identity, source-progress, and work-unit rules live in `podSuitePsdRuntimeRules.js`, image enumeration lives in `podSuiteFileSystemUtils.js`, PSD source and metadata-source resolution lives in `podSuitePsdSourceResolver.js`, progress timestamping lives in `podSuitePsdProgressUtils.js`, PSD task signals/concurrency/cancel helpers live in `podSuitePsdTaskRuntime.js`, PSD failure/partial-result assembly lives in `podSuitePsdResultFactory.js`, and the single-mockup render loop lives in `podSuitePsdMockupRunner.js` before batch orchestration enters `podSuiteToolService.js`. Photopea engine support is split so local HTTP file serving is in `photopeaLocalFileServer.js`, Sharp-based input/output image handling is in `photopeaImagePipeline.js`, script and Echo protocol construction is in `photopeaSmartObjectScripts.js`, and debug log emission is in `photopeaRuntimeLogger.js`; `photopeaSmartObjectRenderer.js` remains the session and smart-object execution layer.

Photopea message parsing now lives in `src/services/creationCenter/photopeaMessageRuntime.js` so the session layer can stay focused on BrowserWindow control and smart-object execution.

## Operations Workbenches

Operations activity management, traffic boost, price declaration, and new product lifecycle have large renderer workbench files and large feature-center services. Shared category, shop selection, and cost state are service-backed and should be reused instead of duplicated.

## POD MiaoShou

POD MiaoShou TEMU and universal variants have separate feature metadata, independent Vue apps, form/template/workspace services, export services, COS upload services, and shared AI title generation support. Both variants now preserve material import order maps for carousel items, use description image name fields as the first-class selection source before falling back to legacy order numbers, and share the persistent AI title result cache boundary under `users/{userKey}/cache/ai-title-results`. Global config `存储素材` is used by POD image upload and batch AI title image upload as a user-selected remote material root; uploaded object keys should stay under the configured root plus feature folders and must not append a software-account username or `users/{userKey}` segment. Old material upload caches with a software-account path layer should expire instead of being matched or migrated. The batch AI title dialog state lives in the shared renderer module `src/renderer/shared/batchAiTitle/useBatchAiTitleDialog.js`; TEMU keeps output-language selection disabled because it generates Chinese and English titles together, while universal keeps the output-language control. AI title result cache keys live in `podUploadSheetMiaoshouAiTitleCacheKeyUtils.js`, including a source-file-stat key that allows repeat runs to return cached titles before image compression. Git hotspots show this is the most active current area.

## Promotion Master And Monitor

Promotion management uses `src/renderer/promotionManagerApp/`, `src/services/featureCenter/promotionMasterSessionService.js`, `promotionMonitorService.js`, and related promotion IPC handlers. It depends on shop sessions and browser automation.

Promotion Ads session and cookie handling now live behind the neutral `src/services/featureCenter/promotionAdsSessionService.js`; the old `promotionMasterSessionService.js` path remains as a compatibility export. Promotion master new queries mall goods through `src/services/featureCenter/promotionManagerNewGoodsService.js`, which calls the shared Ads session service and parses `query_mall_goods_list` results.

Promotion master new is a separate layout-first feature entry under `src/features/featureCenter/promotionMasterNew/` with an independent window shell at `src/renderer/promotionManagerNew.html`, renderer module `src/renderer/promotionManagerNewApp/`, and window factory `src/windows/createPromotionManagerNewWindow.js`. It now includes a real goods-list query surface before the remaining promotion creation workflow is wired in. New create-promotion configuration state such as selected shops and query regions is persisted through `promotionManagerNewSettingsService.js` / `promotionManagerNewSettingsStore.js` under `feature_center/promotion_master_new/campaign_create/users/{userKey}/config/create-promotion-settings.json` and the matching COS key, so it does not depend on the old promotion manager settings service.

The promotion master new create page keeps the query/action toolbar in `src/renderer/promotionManagerNewApp/components/CreatePromotionToolbar.vue`, goods table rendering in `src/renderer/promotionManagerNewApp/components/CreatePromotionGoodsTable.vue`, row display/control defaults plus draft patch helpers in `src/renderer/promotionManagerNewApp/view-models/createPromotionGoodsRows.js`, create-row status helpers in `src/renderer/promotionManagerNewApp/view-models/createPromotionSubmitStatus.js`, and create-ad submit payload shaping in `src/renderer/promotionManagerNewApp/view-models/createPromotionSubmitRows.js`. Goods and detail tables use Arco Design Vue `a-table` / `a-table-column` instead of hand-written HTML table scaffolding. The goods list includes row selection plus per-row daily-budget, target global ROAS controls, and per-row create status. Large goods datasets should stay shallow-reactive in the page, use Arco virtual table rendering, avoid full-row object copying in table adapters, and only persist row draft overrides instead of materializing default drafts for every row. Service-side goods-list pages are capped at 100 rows per request, `getBid` prediction chunks are capped at 50 goods per request, goods query cancellation is exposed through the preload/IPC bridge, and create-ad submissions are routed through `src/services/featureCenter/promotionManagerNewAdsCreateService.js` in capped chunks over the shared region-cookie backend session service.

## Global Config, Theme, And Update

Global config is served by `src/services/globalConfig/` and exposed through preload. Theme preference is managed by `src/services/theme/themePreferenceService.js` and `src/renderer/themeSync.js`. Update behavior lives under `src/services/update/updateService.js` and main-window update dialog components.

## Persistence Scope

`src/utils/persistenceRoots.js` defines the app data root `TEMU_Data_Electron`. `docs/persistence-scope.md` states that account-tied state should use `users/{userKey}/{config|state|cache}` under each feature root.
