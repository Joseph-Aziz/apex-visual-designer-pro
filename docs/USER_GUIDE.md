# User guide

## Flutter Designer

The Flutter Designer styles one page of a registered application, component by component.

1. Enter the application and page, then click **Open page**. To design another application of the workspace, enter its id and click **Add application** first. The left list shows the page's regions, items and buttons, grouped by type. The centre shows the live page.
2. Select a component in the list, or click it on the page. Clicking never runs it.
3. Pick one of the six designs for its type, then adjust its settings:
   - **Basic:** colours, corner radius, padding, font size and weight.
   - **Icon** (dates and lists): icon style, size, colour, hover background and position.
   - **Show / hide:** hide parts that APEX draws, such as an Interactive Report's search bar or Actions button, a region's title bar, an item's label or a button's icon. This hides them on screen only; the APEX feature stays on.
   - **Advanced:** shadow, hover and focus colours, font, spacing, text case, width, alignment, animation, ripple, and extra CSS declarations.
4. Click **Save to page** to write the result into the page. **History** lists every saved version, and **Restore** puts one back.

Regions and buttons need a Static ID. When one is missing, the designer offers to set it.

When the application has a pushed theme, **Theme style** puts one of its named styles on the selected component.

| Type | Designs |
| --- | --- |
| Text, Date, List | Filled, Outlined, Soft, Underline, Glass, Pill |
| Checkbox / Radio | Material, Chip, Card, Segmented, Pill, List tile |
| Switch | Material, iOS, Labelled pill, Square, Thin track, Outline |
| Button | Filled, Tonal, Outlined, Elevated, Text, Gradient |
| Display only | Plain, Chip, Tile, Badge, Outlined, Large value |
| Region | Elevated card, Outlined card, Flat, Tonal, Glass, Accent bar |
| Cards | Elevated, Outlined, Media, Tonal, Glass, Accent top |
| Classic Report, Interactive Report, Interactive Grid | Material table, Striped, Dense, Card rows, Borderless, Accent header |

## Theme Designer

The Theme Designer sets one look for the whole application.

- **Styles:** each component type has an optional **default style**, which applies to every component of that type. It can also have any number of **named styles**. To use a named style, add the class `vd-<type>-<name>` to a component.
- **Global:** page background, base font, and the accent colour for new styles.
- **Preview:** **Gallery** previews every style. **Page** previews any page of the application with the theme applied.
- **Saving:**
  - **Save draft** keeps your work without changing the application.
  - **Push to app** makes the theme live on every page.
  - **History** and **Restore** bring back an earlier pushed version.
  - **Download CSS** gives you the same file to use in any other application.

Page designs always win over the theme, because they target one component by its id.
