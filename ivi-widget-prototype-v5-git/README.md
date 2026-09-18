# IVI Widget Layout Prototype

Interactive browser prototype for comparing three widget-page rules on a 3-row IVI rail.

## What is implemented

- A / B / C layout-rule tabs.
- Four comparison scenarios, for 12 rule-scenario combinations.
- 1x1 and 1x2 widgets; 1x2 never splits across pages.
- Direct pointer drag from two NEW widget cards in the left app area.
- Direct drag of existing widgets across pages.
- Hover preview: cards push/reflow before pointer release.
- Drag outside any page to cancel and animate back to the original layout.
- Delete animation and rule-specific pull/reflow.
- Undo, reset, and Done cleanup of fully empty pages.
- Newly added widgets get a gradually shifting gradient color sequence.
- IVI frame based on the supplied Status Bar / app area / right widget rail / GNB / PNP reference.
- Reduced IVI Status Bar (~35% of the previous height) and GNB (~60%) so the app/widget interaction area is larger.

## Rule A correction

Free Placement is truly slot-based while Edit Mode is open. A 1x1 may sit in the top, middle, or bottom row without being auto-aligned upward. If the target page has enough total row capacity, existing cards may shove/reorder inside that page to honor the requested drop slot. A never pushes overflow into another page.

## Rule C exception toggle

A toggle appears only while Option C is selected.

- **OFF (default):** Page-local + Spill with free slot placement inside the edited page. Cards may stay in top/middle/bottom slots; if the target page overflows, only the overflow goes to a new spill page immediately after the target.
- **ON:** applies only when moving an **existing widget to a different page**. No Spill Page is created. The prototype reflows only the pages needed between the source and target, passing overflow toward existing capacity and stopping as soon as that capacity absorbs the move. Pages outside that affected corridor are left untouched.
- Adding a **new widget** still uses the original C spill-page rule even when the toggle is ON.
- Same-page reorder still behaves as normal C local reflow.

This exception exists to demonstrate a narrower trade-off: avoid creating a Spill Page while accepting limited displacement along the source-target corridor, without turning C into Option B's full global repagination.

## Run

Open `index.html` in a modern desktop browser.

No build system or dependency install is required.

## Compact review layout

- The A/B/C and Scenario controls are fixed in a left sidebar on desktop.
- The IVI screen and the full page overview are vertically compacted so they usually fit in one browser window at common laptop/desktop heights.
- The sidebar scrolls independently if the window is short, while the main prototype area stays focused on the IVI screen + page overview.
- On narrow screens the sidebar falls back to a normal stacked layout.

## Page navigation / page management additions

- While dragging a **NEW** widget, top and bottom edge zones appear on the main IVI widget rail.
- Hold a new widget in an edge zone for **1 second** to move to the previous/next existing page without releasing the drag. Keep holding to continue paging, then move back into the page and drop normally.
- The bottom of the widget rail now has compact **+ page** and **- page** controls. `+` always inserts an empty page immediately after the page currently being viewed. `-` deletes the current page and its widgets as one Undo-able transaction.
- In Page Overview, each page exposes an individual delete button on hover.
