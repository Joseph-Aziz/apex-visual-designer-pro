# User guide

APEX Creative Studio has four workspaces, chosen in the rail on the left:

- **Design** (Design Studio) styles the components of one page. The sections below call it Design items.
- **Theme** (Theme Lab) sets one look for the whole application.
- **Layout** (Layout Studio) rearranges the components of one page.
- **Library** (Design Library) lists the saved designs and presets of the application.

The top bar shows the open page, or the application on Theme and Library, and a status dot: **Ready**, **Connected to APEX**, **Not in APEX** or **Connection problem**. The half-circle button switches between the dark and the light appearance. **Help** at the foot of the rail explains the current workspace. Each workspace keeps its own Save, Push or Apply button in its mode bar; there is no global save.

The studio follows the page's reading direction, so it works right to left on an Arabic or Hebrew APEX page. The Layout board stays left to right, because it draws APEX's 12-column grid.

## Opening a page

Design items and Layout work on the page in the **page bar** at the top: enter the application and page, then click **Open page**. Both views follow it, so a page is opened once. To design another application of the workspace, enter its id and click **Add application** first; only applications of the same workspace are accepted. The open page is remembered after a reload.

Switching views with unsaved changes asks first: Design items offers to save, discard or stay; Layout offers to apply, discard or stay. Opening another page with unsaved changes asks to discard them.

## Design items

1. The left list shows the open page's regions, items and buttons, grouped by type. The centre shows the live page.
2. Select a component in the list, or click it on the page. Clicking never runs it. Ctrl+click (or Shift+click) more components of the same type to edit them together: a design, preset, reset or Remove design applies to all of them, and a setting changes every selected component that has the same design. **Use page** turns that off, so you can fill items and submit, for example to show a chart that needs dates.
3. Pick one of the designs for its type, then adjust its settings:
   - **Basic:** colours, corner radius, padding, font size and weight. Text, date and list fields also have **Label position**: above the box, or inside it at the top, where it stays while you type. Use inside to line an item up with items that use the floating label template.
   - **Arrows** (dates): the previous and next day arrows beside the field, and the month arrows of the calendar: icon, size, colour, background, hover colours, shape and border. Previous sits at the start, next at the end, the date in the middle.
   - **Icon** (dates and lists): icon style, size, colour, hover background and position.
   - **Show / hide:** hide parts that APEX draws, such as an Interactive Report's search bar or Actions button, a region's title bar, an item's label or a button's icon. This hides them on screen only; the APEX feature stays on.
   - **Advanced:** shadow, hover and focus colours, font, spacing, text case, width, alignment, animation, ripple, and extra CSS declarations.
4. Click **Save to page** to write the result into the page. **Undo** and **Redo** step through your changes before saving. **History** lists every saved version, and **Restore** puts one back.

Regions and buttons need a Static ID. When one is missing, the designer offers to set it.

### Gallery, browser and presets

- **Gallery:** the designs of the selected component are shown as live thumbnails. Point at one, or move to it with the keyboard, to try it on the real component in the preview; click it to keep it. **Reset settings** keeps the design and clears its settings.
- **Components:** the left panel switches between the page's components and a browser by category. Choose a member (for example Textarea or Popup LOV) to see its designs on its own sample, and the components of the page that are that member.
- **Preview width:** Desktop, Tablet (768px) or Mobile (375px).
- **Presets:** **Save as preset** asks for a name and saves the design as a named style of the application's theme, as a draft. The gallery then shows it beside the built-in designs on every page of the application; clicking it copies its design and settings onto the component. After the theme is pushed, **Theme style** can link the component to it instead. **Saved designs** in the rail lists all presets.
- **Size limit:** a page takes at most 32,767 characters of CSS and of JavaScript. The size beside **Save to page** shows how full the page is: amber from 80%, red when over. A save over the limit is refused and the message explains the fix:
  1. Select a component with a design you use on many items and click **Save as preset**.
  2. Push the theme in the Theme workspace.
  3. Choose the preset under **Theme style** on each item, then save the page again.

When the application has a pushed theme, **Theme style** puts one of its named styles on the selected component.

| Type | Designs |
| --- | --- |
| Text, List | Filled, Outlined, Soft, Underline, Glass, Pill |
| Date | Filled, Outlined, Soft, Underline, Glass, Pill, Dashboard |
| Checkbox / Radio | Material, Chip, Card, Segmented, Pill, List tile, Dashboard |
| Switch | Material, iOS, Labelled pill, Square, Thin track, Outline |
| Button | Filled, Tonal, Outlined, Elevated, Text, Gradient, Dashboard |
| Display only | Plain, Chip, Tile, Badge, Outlined, Large value |
| Region | Elevated card, Outlined card, Flat, Tonal, Glass, Accent bar, Dashboard |
| Cards | Elevated, Outlined, Media, Tonal, Glass, Accent top, Dashboard |
| Chart | Chart Designer (below) |
| Classic Report, Interactive Report, Interactive Grid | Material table, Striped, Dense, Card rows, Borderless, Accent header |

**Dashboard** designs match a hand-built statistics page: white cards with a light border, 16px corners, a soft shadow and the Cairo font.

- **Cards:** the card Title holds the main value (large, teal), the Subtitle a second value (blue; hidden when empty), the Body a small grey label.
- **Checkbox / Radio:** a radio group becomes a segmented toggle, a checkbox group a row of pill chips.

### Chart Designer

A native chart region has no fixed designs. Select it and click **Open Chart Designer**; the panel opens beside the live page.

- **Engine:** Oracle JET, the engine APEX uses, or Apache ECharts, which the plug-in ships with the page (no download from the internet). ECharts adds gauge, waterfall and heatmap, wheel zoom and a few more effects. A setting the chosen engine cannot draw is shown disabled with a note.
- **Parts:** choose a part on the left (Chart, each Series, Points, X / Y / Y2 axis, Labels, Legend, Tooltip, Reference lines) and change its settings. **Settings** switches between Basic and Advanced. Each field has a reset to its default.
- **Templates** fill the settings with a ready look, such as Monthly sales or Statistics; you can change anything afterwards.
- The live page updates with every change. Click **Done** to go back to the component list, then **Save to page** as for any other component.

The chart keeps its SQL, refresh and dynamic actions; the designer only changes how it is drawn. A click on the chart raises the event `vdchartclick` with the series, group and value, for your own dynamic actions.

## Layout

The Layout board shows the open page as boxes on APEX's 12-column grid: one box per region, with its items inside, grouped by page slot (Body, Breadcrumb Bar, Dialog Footer and the other slots of the page template).

- Drag a region to another position, slot or parent region. Drag an item to another position or another region.
- Put a box on the same row as the one before it, or start a new row.
- Drag a box's right edge to set its column span, 1 to 12.

Nothing changes until **Apply**, which writes every move in one page re-import and reloads the live page. **Revert** discards unapplied changes. **Undo apply** puts back the layout from before the last apply; the last 10 applies per page are kept. Apply is refused when someone changed the page in App Builder after the board loaded it: open the page again.

Buttons, dynamic actions, processes and validations do not move. Buttons stay with their region.

## Theme

The Theme Designer sets one look for the whole application.

- **Styles:** each component type has an optional **default style**, which applies to every component of that type. It can also have any number of **named styles**. To use a named style, add the class `vd-<type>-<name>` to a component, or pick it under **Theme style** in Design items.
- **Global:** page background, base font, and the accent colour for new styles.
- **Preview:** **Gallery** previews every style. **Page** previews any page of the application with the theme applied.
- **Saving:**
  - **Save draft** keeps your work without changing the application.
  - **Push to app** makes the theme live on every page.
  - **History** and **Restore** bring back an earlier pushed version.
  - **Download CSS** gives you the same file to use in any other application.
- **Presets between applications:** **Export presets** downloads the theme's named styles as a `vd-presets` JSON file. **Import presets** adds a file's presets to the theme as unsaved changes; save the draft to keep them. A file with an unknown family, design or setting, or a value that is not allowed, is refused with its name. A class that is already taken gets `-2`, `-3` and so on; nothing is overwritten.

Page designs always win over the theme, because they target one component by its id.

## Library

The Library shows the theme styles (presets) of the open application, grouped by component type, as cards with a light preview, the design name and the class. Copy one onto a component in Design items, or link it with **Theme style** once the theme is pushed. Edit or remove them in the Theme workspace; the Library itself only lists them.

## Good to know

Saving a page design, applying a layout, setting a Static ID and pushing a theme all re-import the changed page. That ends the signed-in sessions of that application, and its users must log in again.
