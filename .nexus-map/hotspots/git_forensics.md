> generated_by: nexus-mapper v2
> verified_at: 2026-07-13
> provenance: Git analysis over 90 days from .nexus-map/raw/git_stats.json plus manual interpretation.

# Git Forensics

## Summary

- Analysis window: 90 days.
- Commits analyzed: 48.
- Authors: 2.
- No high-risk files were reported by the script. The active risk band is medium.

## Top Hotspots

| Path | Changes | Risk |
| --- | ---: | --- |
| `package.json` | 14 | medium |
| `src/renderer/podUploadSheetMiaoshouApp/App.vue` | 13 | medium |
| `src/renderer/podUploadSheetMiaoshouUniversalApp/App.vue` | 11 | medium |
| `src/renderer/podUploadSheetMiaoshou.html` | 8 | medium |
| `src/main.js` | 7 | medium |
| `src/renderer/psdSmartSuiteApp/App.vue` | 7 | medium |
| `src/renderer/podUploadSheetMiaoshouApp/useProductWorkflowTasks.js` | 6 | medium |
| `scripts/buildRendererBundle.js` | 5 | medium |
| `src/services/featureCenter/podUploadSheetMiaoshouAiTitleService.js` | 5 | medium |
| `src/renderer/podUploadSheetMiaoshouUniversal.html` | 5 | medium |

## Strong Co-Change Pairs

| Pair | Co-changes | Score |
| --- | ---: | ---: |
| `package.json` plus `scripts/buildRendererBundle.js` | 5 | 1.00 |
| `src/renderer/podUploadSheetMiaoshou.html` plus `src/renderer/podUploadSheetMiaoshouView.js` | 5 | 1.00 |
| `src/renderer/podUploadSheetMiaoshou.html` plus `src/windows/createPodUploadSheetMiaoshouWindow.js` | 5 | 1.00 |
| `src/renderer/podUploadSheetMiaoshouApp/App.vue` plus `src/renderer/podUploadSheetMiaoshouApp/styles/pod-miaoshou-app.css` | 4 | 1.00 |
| `src/renderer/podUploadSheetMiaoshouApp/styles/pod-miaoshou-app.css` plus `src/renderer/podUploadSheetMiaoshouApp/useProductWorkflowTasks.js` | 4 | 1.00 |
| `src/renderer/podUploadSheetMiaoshouApp/App.vue` plus `src/renderer/podUploadSheetMiaoshouApp/useProductWorkflowTasks.js` | 5 | 0.83 |
| `src/renderer/podUploadSheetMiaoshouApp/App.vue` plus `src/renderer/podUploadSheetMiaoshouUniversalApp/App.vue` | 6 | 0.55 |

## Interpretation

The current change center is POD MiaoShou and renderer build plumbing. Changes to MiaoShou App.vue files should be checked against view wrappers, HTML hosts, CSS, workflow-task helpers, and shared AI title services.

`src/main.js` is a medium hotspot and already large. Prefer adding or changing domain services, IPC modules, or window modules before adding more main-file logic.

The backup-style recent commit messages make chronology less descriptive. Use file hotspots and code inspection rather than commit messages alone when estimating impact.
