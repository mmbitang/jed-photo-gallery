# Google Drive Gallery Design

## Goal

Create a static site that can be deployed on GitHub Pages and later embedded into the Jed Photo site. The site must:

- Display public Google Drive photos under a single public root folder
- Preserve the actual Google Drive folder hierarchy for browsing
- Provide global search across all indexed photos
- Run entirely as a static frontend with live browser calls to the Google Drive API

## Constraints

- The workspace is currently empty and is not a git repository
- The site must remain static-host compatible
- Google Drive metadata and image access must be public enough for anonymous browser access
- The Google API key will be exposed in the browser and must be restricted by HTTP referrer in Google Cloud

## Recommended Architecture

The app is a plain HTML/CSS/JavaScript site intended for GitHub Pages.

On startup, the client recursively crawls one configured Google Drive root folder. It loads folders and images, stores them in memory, builds a folder tree, and generates a flat image index for global search. The UI has two primary modes:

1. Folder mode
   - Shows folders and images for the currently selected Drive folder
   - Supports breadcrumb navigation through the actual Drive structure
2. Search mode
   - Filters across every indexed image, regardless of current folder
   - Shows each match with its folder path so users can understand where it lives

## Data Model

The runtime keeps three main structures:

- `itemsById`
  - Map of every fetched folder or image keyed by Drive file ID
- `childrenByFolderId`
  - Map of folder ID to direct children for navigation
- `searchIndex`
  - Flat array of image items with derived path metadata for global search

Each item includes:

- `id`
- `name`
- `mimeType`
- `parents`
- `folderPath`
- `isFolder`

## API Strategy

The frontend uses the Google Drive Files API and recursively requests children for each folder:

- Query folders and images below a given parent folder
- Follow pagination with `nextPageToken`
- Restrict results to:
  - folders
  - image files
  - non-trashed items

The implementation should request:

- `id`
- `name`
- `mimeType`
- `parents`
- `thumbnailLink`
- `imageMediaMetadata`

The code should prefer `thumbnailLink` where available and fall back to the standard Drive view URL pattern.

## UI Design

The page includes:

- A header with title and configuration status
- A search input for global search
- Breadcrumbs for folder navigation
- A gallery grid that mixes folders and images in folder mode
- A search results grid in search mode
- Empty, loading, and error states

Folder cards should be visually distinct from image tiles. Search results should show the full folder path.

## Interaction Model

- Initial load opens the configured root folder
- Clicking a folder moves into that folder
- Clicking a breadcrumb navigates upward
- Typing in the search box activates global search immediately
- Clearing the search box returns to the current folder view
- Clicking a search result opens the full image in a new tab

## Error Handling

The app should handle:

- Invalid or missing API key / root folder ID
- Drive API request failures
- Empty folders
- No search results
- Folders containing unsupported non-image files

Errors should be shown inline with actionable guidance.

## Performance Notes

This first version honors the requirement for live API access. The tradeoff is that initial load time depends on the size of the Drive folder tree. For large libraries, later improvements can include:

- prebuilt JSON indexing
- folder-level lazy loading
- session storage caching

Those are explicitly out of scope for the first version.

## Verification Plan

- Confirm the page loads with placeholder configuration
- Confirm recursive data crawling logic is present
- Confirm folder navigation and breadcrumb rendering are wired
- Confirm global search scans all indexed images
- Confirm the setup documentation explains Drive sharing and API key restrictions
