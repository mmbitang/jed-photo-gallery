# Gallery Preview Modal Design

## Summary

Add a same-page preview experience for gallery images. When a user clicks a photo card, the app should open a modal overlay with a larger preview, previous and next navigation, a direct download action, and a thumbnail rail showing the active photo list.

## Goals

- Keep users on the same gallery page while previewing images.
- Support both portrait and landscape photos without distortion.
- Allow sequential browsing with previous and next controls.
- Allow direct selection from a thumbnail list under the main preview.
- Allow downloading the current photo from the preview.
- Work cleanly on desktop, tablet, and phone screens.

## Non-Goals

- Deep-linking preview state into the URL.
- Editing or deleting Drive files.
- Loading full Drive metadata beyond what is needed for preview and download.

## Active Photo List

The modal should navigate within the current active list:

- While browsing a folder, use only image items from the current folder.
- While searching, use the current search result list.

This keeps the preview state aligned with what the user is currently viewing in the gallery.

## Interaction Design

Clicking an image card opens a fullscreen modal overlay. The overlay contains:

- A close button.
- A large centered image preview.
- Previous and next buttons.
- A download button for the currently selected image.
- A thumbnail rail under the preview for all photos in the active list.

Users can navigate by:

- Clicking previous or next.
- Clicking a thumbnail in the thumbnail rail.
- Using the left and right arrow keys.
- Closing with Escape, the close button, or the backdrop.

The selected thumbnail should remain visually highlighted.

## Image Handling

The large preview should use a higher-resolution image URL than the gallery card thumbnails. The image must use contain-style sizing so portrait and landscape assets both remain fully visible inside the modal viewport without stretching or cropping.

## Responsive Behavior

The modal layout must adapt across screen sizes:

- Desktop: large preview with controls aligned around the main image and a full thumbnail rail below.
- Tablet: reduced spacing and control sizes while preserving image visibility.
- Phone: stacked modal layout, smaller action buttons, and a horizontally scrollable thumbnail rail sized for touch input.

The main image should always remain the priority element in the viewport.

## Implementation Notes

- Add modal markup to `index.html`.
- Add modal state and active-list tracking in `script.js`.
- Reuse existing image card rendering by opening the modal instead of sending users to Google Drive.
- Add helper functions for active-image lists, current modal index, image selection, modal open/close, and keyboard handling.
- Add modal and thumbnail rail styling in `styles.css`.

## Testing Focus

- Clicking an image opens the correct preview.
- Previous and next stay within the active list and disable at the ends.
- Search results open with search-result navigation, not folder navigation.
- Portrait and landscape images fit correctly.
- Download targets the selected image.
- Modal remains usable on tablet and phone widths.
