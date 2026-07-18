# Persistence Scope

This document records the current storage-scope rules for the TEMU toolbox
Electron app so new modules follow the same boundary by default.

## Canonical Rule

- Account-scoped local data:
  `{featureRoot}/users/{userKey}/{config|state|cache}/...`
- Account-scoped cloud data:
  `{storageKey}/users/{userKey}/{config|state|cache}/...`
- Repository-specific top-level roots stay in repo rules and profile services.

## Default Decision

Use account-scoped storage unless the dataset is clearly shared across every
login of the same software.

Exception: uploaded material object keys under the user-selected global
`存储素材` provider/root prefix must not add a software-account username,
`userKey`, or `users/{userKey}` layer. The user selected that storage location
directly. Keep local caches and cloud config/state account-scoped when needed,
but do not push the software-account boundary into material object paths.
Old uploaded material object caches that include a software-account path layer
should expire instead of being matched or migrated. Regenerate or reupload those
assets under the current material root.

Choose shared storage only when all of the following are true:

- the data is not tied to one software account
- cross-account reuse is intentional
- mixing data across logins cannot create confusion or overwrite risk
- the code or docs say explicitly that the dataset is shared

## Current Account-Scoped Storage

These modules should stay isolated by software account.

- Global configuration:
  `src/services/globalConfig/globalConfigService.js`
- PSD smart template profiles:
  `src/services/creationCenter/podSuitePsdTemplateStore.js`
- White mockup templates:
  `src/services/creationCenter/podSuiteWhiteMockupTemplateStore.js`
- MiaoShou workspace state:
  `src/services/featureCenter/podUploadSheetMiaoshouWorkspaceStateService.js`
- MiaoShou template sync state and template cache:
  `src/services/featureCenter/podUploadSheetMiaoshouTemplateService.js`
- MiaoShou COS upload cache and prepared upload cache:
  `src/services/featureCenter/podUploadSheetMiaoshouCosUploadService.js`
- Promotion master region cookie caches:
  `src/services/featureCenter/promotionMasterSessionService.js`
- Promotion monitor config and runtime state:
  `src/services/featureCenter/promotionMonitorService.js`
- Per-account root-category snapshots:
  `src/services/featureCenter/operationsProductCategoryService.js`

## Current Shared Storage

These datasets are intentionally shared across accounts.

- Software login bootstrap cache:
  `src/state/loginAccountCache.js` and `src/state/authSessionCache.js`
  Reason: these files are read before a software account is active. They only
  store remembered login bootstrap state for opening the app and do not store
  feature, shop, task, or template data across accounts.
- Full global category tree cache:
  `src/services/featureCenter/operationsProductCategoryService.js`
  Reason: the dataset comes from online category crawling and can be reused by
  all accounts after one successful sync.

## Review Checklist For New Persistence

- Is the data tied to the current software login?
- Could another account see wrong data if this path were shared?
- Is the data user preference, runtime state, cookie cache, task state, or
  template state? If yes, it should almost always be account-scoped.
- Is the data a read-mostly reference dataset that is safe to reuse globally?
  If yes, shared storage may be acceptable, but call it out explicitly.
- If changing an old path, add a compatibility migration from the legacy path
  before removing old reads.

## Legacy Layout Notes

Avoid using these legacy patterns for new work:

- `localConfigDir/users/...`
- `localStateDir/users/...`
- `localCacheDir/users/...`

Prefer deriving from `localRootDir` first, then appending:

- `users/{userKey}/config/...`
- `users/{userKey}/state/...`
- `users/{userKey}/cache/...`
