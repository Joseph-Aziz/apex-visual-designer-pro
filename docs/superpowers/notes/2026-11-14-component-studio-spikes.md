# Component Studio spikes (plan Task 0)

Date: 2026-11-14. Plan: `docs/superpowers/plans/2026-11-14-component-studio-phase-1.md`.

## 1. Size of the generated CSS

Measured with `tests/unit/library_golden_test.js` on release 1.3.0 code: the CSS of one designed component, after every declaration is marked `!important`, in characters.

| Type | Default settings | Every setting set |
| --- | --- | --- |
| Text field | 3,301 to 3,463 | 4,911 to 5,073 |
| Date picker | 5,916 to 6,078 | 6,305 to 6,467 |
| List | 6,148 to 6,310 | 6,332 to 6,494 |
| Checkbox and radio | 278 to 1,821 | 1,229 to 2,770 |
| Switch | 625 to 1,057 | 1,555 to 1,987 |
| Button | 695 to 884 | 1,466 to 1,656 |
| Display only | 135 to 286 | 1,056 to 1,207 |
| Region | 469 to 660 | 1,292 to 1,482 |
| Reports and grids | 386 to 935 | 1,405 to 2,160 |
| Cards | 439 to 922 | 1,468 to 1,949 |

Date pickers and lists are the heavy ones, because of the icon and popup rules.

**Open:** whether the page import limits inline CSS to 32,767 characters, as it does page JavaScript (found in 1.3.0). If it does, five or six designed date pickers or lists fill a page. This needs one save of an oversized design on a scratch page of a live instance. Until it is answered, the size guard (plan Task 13) should be treated as needed for CSS as well as JavaScript.

## 2. Selectors for Combobox, Popup LOV, Textarea, Number Field and single Checkbox

**Open.** Needs a page on APEX 26.2 that has one item of each type. For each item, check that the `field.input` selector in `plugin/files/js/look-selectors.js` matches the element the user types in, and that a design looks right.

## 3. Meaning of "Button Group"

**Open.** APEX has no native component by this name. Candidates: the pill-button template option of a radio group, or a region that holds a row of buttons. To be decided with the owner (plan decision 4).

## 4. APEX 24.1

Closed by plan decision 1: 1.4.0 keeps the repository's floor (26.1, tested on 26.2).
