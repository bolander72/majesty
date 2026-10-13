# Lost Trail campaign landmark

`trail-lodge-map.png` is original artwork generated with the built-in imagegen tool. It replaces the borrowed rectangular peninsula visible on the native campaign selector. The existing scrolling map and coastline remain visible through transparent pixels; the lodge, trees and footpath sit on the existing eastern forest peninsula. This is selector artwork; the playable mission terrain remains the original Fertile Plain baseline. The other quest marker and briefing illustration resources remain inherited prototypes.

Reproduce the native resource with `scripts/prepare-lost-trail-map-art.py`, using the preserved previous `LostTrail-menu-art.cam` and this source PNG. The helper preserves all four native IMAG controls, positional TILE identities, selection behavior, and the three non-map tiles. It packs the image into the native 160×160 transparent trigger canvas at the original map coordinates. No gameplay script or mission GUID changes.

Source SHA256: `11612f4e1bea6b063e384fa9641b5f638170acfca86f6d842a67e5ee3e85dddb`.

## Generation prompt

Create an original transparent sprite for The Lost Trail's mission landmark. Match the existing Majesty campaign map's hand-painted medieval cartographic style, dark ink outlines, muted olive green, warm brown and ochre. One isolated rustic timber and stone lodge with mossy green steep roof, weathered arrow signpost, winding ochre path and pine trees, with a teal cloth pennant. Shallow isometric bird's-eye view and a silhouette readable at native map scale. No UI, text, labels, ships, snow, castles, new coast, ocean, parchment background, square terrain tile, broad ground disc or rectangular shadow. Use genuine transparent alpha and generous margins. The full Ardania map was supplied solely as a style reference.
