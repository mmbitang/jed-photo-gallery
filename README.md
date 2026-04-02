# Jed Photo Gallery

Static Google Drive photo gallery for GitHub Pages.

## What it does

- Browses one public Google Drive root folder
- Preserves nested folder navigation with breadcrumbs
- Builds a live global search across all indexed images
- Works as a static frontend with HTML, CSS, and JavaScript

## Setup

1. Create a Google Cloud project and enable the Google Drive API.
2. Create an API key.
3. Restrict the API key by HTTP referrer before publishing.
4. Make sure the target Google Drive root folder and its contents are publicly viewable.
5. Edit [`script.js`](/C:/Development/jed-photo-gallery/script.js) and replace:
   - `YOUR_API_KEY`
   - `YOUR_ROOT_FOLDER_ID`
6. Deploy the files to a GitHub Pages repository.

## Important limitations

- The API key is client-side, so do not leave it unrestricted.
- This version does live recursive fetching. Large Drive libraries will load more slowly.
- Search is global across every indexed image under the configured root folder.

## Files

- [`index.html`](/C:/Development/jed-photo-gallery/index.html)
- [`styles.css`](/C:/Development/jed-photo-gallery/styles.css)
- [`script.js`](/C:/Development/jed-photo-gallery/script.js)
- [`docs/superpowers/specs/2026-04-02-google-drive-gallery-design.md`](/C:/Development/jed-photo-gallery/docs/superpowers/specs/2026-04-02-google-drive-gallery-design.md)
