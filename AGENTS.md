# TEMU Toolbox Electron Rules

These rules are mandatory for future development in this repository.

## Framework Baseline

- Use Vue 3, TypeScript, Electron, Vite, and Arco Design Vue.
- Prefer existing renderer modules and the current theme system over parallel custom HTML/CSS patterns.
- Keep feature UI inside renderer pages and feature components. Do not move product UI into main-process template strings.

## Module Structure

- Treat TEMU toolbox development with the same module organization used by YiZhi Ecommerce: thin renderer entry, feature-specific `components`, `runtime` or `services`, `state`, `view-models`, `styles`, `types`, and `utils` directories when those responsibilities exist.
- Keep feature pages and feature windows isolated as independent renderer modules when they have meaningful UI or workflow ownership.
- Keep state, rendering, dialogs, export mapping, image handling, persistence, and service orchestration in separate modules instead of one mixed page file.
- Preserve existing workflow order, column order, and button order unless the user explicitly asks for a re-layout.

## UI Baseline

- Keep layouts stable unless the user explicitly requests structural changes.
- Use the existing theme variables for buttons, tags, focus states, hover states, and disabled states.
- Keep the app visually clean: white or near-white surfaces, subtle borders, compact controls, 6-8px radius, and light shadows only when needed.
- Use another software as a layout and density reference only when asked. For this project, the YiZhi Ecommerce Electron app is a visual reference for cleanliness, hierarchy, and control density.
- Do not copy another app's brand palette or theme colors unless the user explicitly asks for that palette.
- Reserve red for destructive or failure states. Use the app theme color for primary actions.
- For TEMU toolbox UI, follow the same density and surface discipline as YiZhi Ecommerce while keeping the TEMU app's own theme identity and color system.

## Feature Layout Rules

- Keep data-heavy pages full-height and scrollable without breaking the top-level layout.
- Keep table columns, panel order, and button order stable unless the user requests a re-layout.
- When refining an existing page, prefer adjusting spacing, borders, surfaces, and control states before changing structure.

## Verification

- Run the relevant build or validation command after UI or framework changes.
- Renderer-only style changes should be verified by refreshing the page or window; main-process changes still require a real restart.
