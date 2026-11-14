# Dashboard Looks in the Flutter Designer — Design

## Intent

Statistics pages built by hand (custom HTML KPI cards, chart cards, chips) look good, but every new
page has to repeat that work. The developer wants to build such pages from native APEX components
(Cards, Charts, regions, buttons, radio and checkbox groups, date fields) and, in the Flutter
Designer, pick for each component a look that matches the hand-built dashboard style. Chart looks
act as templates: a fixed set that can be applied to any native chart on any page, at any time.

## Goals

- A seventh look, **Dashboard**, for Region, Cards, Button, Radio group, Checkbox group and Date field.
- A new component type, **Chart**, for native APEX chart regions, with its own set of looks
  (Dashboard plus a few more), usable as templates on any chart type (bar, line, area, pie, ...).
- Every Dashboard look exposes its colours, corners and font as parameters, as other looks do.

## Non-goals

- Saving custom looks under a name (no new storage). Colours are tuned per use.
- Creating components or data. The designer only restyles what is on the page.
- The page header band and the period chips on it.
- A one-click "style the whole page" action.

## Anti-goals

- Changing any existing look v1..v6: a page already styled must look exactly as before.
- Replacing APEX markup or behaviour: styling stays CSS on native markup, plus JS only where CSS
  cannot reach (as existing looks with `needsJs` do).

## The Dashboard style (reference values)

| Part | Value |
|---|---|
| Font | Cairo, then system-ui |
| Card / region | white, 1px #e2e8f0 border, 16px corners, padding 18–22px, shadow `0 4px 20px -2px rgba(15,23,42,.05), 0 2px 6px -1px rgba(15,23,42,.03)` |
| Text | main #0f172a, muted #64748b |
| KPI title | 13px, bold, muted |
| KPI values | 26px bold; first value teal #0f766e, second value blue #2563eb |
| KPI sub-labels | 11px, semi-bold, muted |
| Button (primary) | teal #0f766e, white text, 8px corners, 12px bold, padding 6px 14px |
| Button (secondary) | outline variant of the same |
| Chips (checkbox group) | pill, 20px corners, 13px semi-bold, 4px 14px padding, teal accent when checked |
| Segmented toggle (radio group) | buttons side by side, active one teal filled, as the weekly/monthly switch |

## Approaches

- **A. Seventh look per type + new Chart type (chosen).** Fits the designer's select → look → tune
  flow; nothing existing changes. Costs: the "every type has six looks" test becomes "six or more".
- B. Replace one of the six looks with Dashboard. No test change, but pages using the replaced look
  would change. Rejected: breaks existing pages.
- C. A separate "Dashboard kit" tab. Duplicates the existing flow. Rejected.

## Decided parts of the how

1. **Library:** each listed type in `flutter-variants.js` gets a `v7` entry labelled "Dashboard".
   The variants test checks each type has at least six looks with unique ids.
2. **Chart type:**
   - The server (`pkg_vd_plugin`) reports native chart regions (`NATIVE_JET_CHART`) with
     `component = 'chart'`. The Flutter view lists them under "Charts".
   - Chart looks: Dashboard (card frame, title, light dashed grid, teal/blue series), and three
     more chart templates (for example Minimal, Soft, Dark) so the set is a real choice.
   - CSS covers frame, title, fonts, grid and axis lines; series colours are set with JS through
     the chart's own options (the JET chart's colour defaults), because SVG fills drawn by the
     chart are not reliably reachable with CSS. These looks are `needsJs`.
   - Parameters: series colours (at least two), grid colour, corners, font.
3. **Cards Dashboard look:** styles the native Cards region as KPI cards. Title muted, the main
   value large and teal; a second value placed by the developer in the card body (sub-title or an
   HTML column) is styled blue. The look documents which Cards slot holds which value.
4. **Region Dashboard look:** white card with the reference border, corners, shadow and a bold header.

## Left to the builder

- Exact selectors per APEX 26.2 markup (`look-selectors.js`).
- The JS hook to set chart colours (region static id → chart widget option) and making it run
  after the chart renders and after refreshes.
- Names and looks of the three extra chart templates.
- RTL correctness: every look must work on right-to-left pages.

## Testing

- Unit: library shape (seven looks where added, unique ids, parameters), CSS output of each new
  look for a sample selector, chart kind mapping.
- Live: on app 102, style a native Cards region, a bar and a line chart, a button, a radio and a
  checkbox group and a date field with the Dashboard look; compare against the hand-built page.
