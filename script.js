const CONFIG = {
  API_KEY: "AIzaSyB0ek3xLlcICGdUg2tOyfEdB_lrrvDN36c",
  ROOT_FOLDER_ID: "1dsZXZFAf3rRK0L99ICgLBfBlgRd8r4Od",
};

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const state = {
  itemsById: new Map(),
  childrenByFolderId: new Map(),
  pathByFolderId: new Map(),
  searchIndex: [],
  currentFolderId: null,
  rootFolderName: "Root",
  isSearchMode: false,
  visibleImages: [],
  previewItems: [],
  previewIndex: -1,
};

const elements = {
  gallery: document.getElementById("gallery"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  message: document.getElementById("message"),
  searchInput: document.getElementById("searchInput"),
  clearSearchButton: document.getElementById("clearSearchButton"),
  themeButtons: Array.from(document.querySelectorAll("[data-theme-value]")),
  statusBadge: document.getElementById("statusBadge"),
  statsText: document.getElementById("statsText"),
  previewModal: document.getElementById("previewModal"),
  previewImage: document.getElementById("previewImage"),
  previewTitle: document.getElementById("previewTitle"),
  previewMeta: document.getElementById("previewMeta"),
  previewThumbs: document.getElementById("previewThumbs"),
  previewPrevButton: document.getElementById("previewPrevButton"),
  previewNextButton: document.getElementById("previewNextButton"),
  previewCloseButton: document.getElementById("previewCloseButton"),
  previewDownload: document.getElementById("previewDownload"),
};

elements.searchInput.addEventListener("input", handleSearchInput);
elements.clearSearchButton.addEventListener("click", clearSearch);
elements.themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeValue));
});
elements.previewPrevButton.addEventListener("click", showPreviousPreview);
elements.previewNextButton.addEventListener("click", showNextPreview);
elements.previewCloseButton.addEventListener("click", closePreview);
elements.previewModal.addEventListener("click", handlePreviewBackdropClick);
document.addEventListener("keydown", handleDocumentKeydown);

initTheme();
bootstrap().catch((error) => {
  renderError(error.message || "Unexpected startup failure.");
});

async function bootstrap() {
  if (!isConfigured()) {
    setStatus("Waiting for configuration");
    renderMessage(
      "Add your Google Drive API key and public root folder ID in script.js, then reload the page."
    );
    renderEmptyState("No gallery data yet.");
    return;
  }

  setStatus("Indexing Drive...");
  renderMessage(
    "Fetching folders and images from Google Drive. Large libraries may take some time on first load."
  );
  state.currentFolderId = CONFIG.ROOT_FOLDER_ID;
  state.pathByFolderId.set(CONFIG.ROOT_FOLDER_ID, ["Root"]);

  await crawlFolder(CONFIG.ROOT_FOLDER_ID, "Root");

  const rootItem = state.itemsById.get(CONFIG.ROOT_FOLDER_ID);
  if (rootItem && rootItem.name) {
    state.rootFolderName = rootItem.name;
    state.pathByFolderId.set(CONFIG.ROOT_FOLDER_ID, [rootItem.name]);
  }

  rebuildDerivedData();
  renderCurrentFolder();
  setStatus("Gallery ready");
  renderMessage("Browse folders or use the search box to search across the whole gallery.");
}

function isConfigured() {
  return (
    CONFIG.API_KEY &&
    CONFIG.ROOT_FOLDER_ID &&
    CONFIG.API_KEY !== "YOUR_API_KEY" &&
    CONFIG.ROOT_FOLDER_ID !== "YOUR_ROOT_FOLDER_ID"
  );
}

function initTheme() {
  const savedTheme = localStorage.getItem("gallery-theme") || "system";
  setTheme(savedTheme, false);
}

function setTheme(theme, persist = true) {
  const normalized = theme === "light" || theme === "dark" ? theme : "system";
  const root = document.documentElement;

  root.classList.remove("theme-light", "theme-dark");
  if (normalized === "light" || normalized === "dark") {
    root.classList.add(`theme-${normalized}`);
    root.style.colorScheme = normalized;
  } else {
    root.style.colorScheme = "light dark";
  }

  if (persist) {
    localStorage.setItem("gallery-theme", normalized);
  }

  elements.themeButtons.forEach((button) => {
    const isActive = button.dataset.themeValue === normalized;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

async function crawlFolder(folderId, fallbackName) {
  if (!state.itemsById.has(folderId)) {
    state.itemsById.set(folderId, {
      id: folderId,
      name: fallbackName,
      mimeType: FOLDER_MIME_TYPE,
      parents: [],
      isFolder: true,
    });
  }

  let pageToken = "";
  const children = [];

  do {
    const query =
      `'${folderId}' in parents and ` +
      `(mimeType = '${FOLDER_MIME_TYPE}' or mimeType contains 'image/') and trashed = false`;

    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("key", CONFIG.API_KEY);
    url.searchParams.set("q", query);
    url.searchParams.set(
      "fields",
      "nextPageToken, files(id, name, mimeType, parents, thumbnailLink, webViewLink)"
    );
    url.searchParams.set("pageSize", "1000");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Google Drive API request failed with ${response.status}.`);
    }

    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];

    files.forEach((file) => {
      const normalized = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        parents: Array.isArray(file.parents) ? file.parents : [folderId],
        thumbnailLink: file.thumbnailLink || "",
        webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        isFolder: file.mimeType === FOLDER_MIME_TYPE,
      };
      state.itemsById.set(file.id, normalized);
      children.push(file.id);
    });

    pageToken = data.nextPageToken || "";
  } while (pageToken);

  state.childrenByFolderId.set(folderId, children);

  for (const childId of children) {
    const child = state.itemsById.get(childId);
    if (child && child.isFolder) {
      const parentPath = state.pathByFolderId.get(folderId) || [fallbackName];
      state.pathByFolderId.set(childId, [...parentPath, child.name]);
      await crawlFolder(childId, child.name);
    }
  }
}

function rebuildDerivedData() {
  state.searchIndex = [];

  for (const item of state.itemsById.values()) {
    if (item.isFolder) {
      continue;
    }

    const parentId = item.parents && item.parents[0] ? item.parents[0] : CONFIG.ROOT_FOLDER_ID;
    const folderPathSegments = state.pathByFolderId.get(parentId) || [state.rootFolderName];
    item.folderPath = folderPathSegments.join(" / ");
    item.thumbnailSrc = getThumbnailSrc(item);
    item.previewSrc = getPreviewSrc(item);
    item.downloadSrc = getDownloadSrc(item);
    state.searchIndex.push(item);
  }

  const folderCount = Array.from(state.itemsById.values()).filter((item) => item.isFolder).length;
  elements.statsText.textContent = `${folderCount} folders · ${state.searchIndex.length} photos`;
}

function getThumbnailSrc(item) {
  if (item.thumbnailLink) {
    return item.thumbnailLink.replace(/=s\d+$/, "=s1200");
  }
  return `https://drive.google.com/thumbnail?id=${item.id}&sz=w1200`;
}

function getPreviewSrc(item) {
  if (item.thumbnailLink) {
    return item.thumbnailLink.replace(/=s\d+$/, "=s2400");
  }
  return `https://drive.google.com/thumbnail?id=${item.id}&sz=w2400`;
}

function getDownloadSrc(item) {
  return `https://drive.google.com/uc?export=download&id=${item.id}`;
}

function handleSearchInput(event) {
  closePreview();
  const term = event.target.value.trim().toLowerCase();

  if (!term) {
    state.isSearchMode = false;
    renderCurrentFolder();
    renderMessage("Browse folders or use the search box to search across the whole gallery.");
    return;
  }

  state.isSearchMode = true;
  const matches = state.searchIndex.filter((item) => {
    const name = item.name.toLowerCase();
    const path = item.folderPath.toLowerCase();
    return name.includes(term) || path.includes(term);
  });

  renderBreadcrumbs([]);
  renderSearchResults(matches, term);
}

function clearSearch() {
  closePreview();
  elements.searchInput.value = "";
  state.isSearchMode = false;
  renderCurrentFolder();
  renderMessage("Browse folders or use the search box to search across the whole gallery.");
}

function renderCurrentFolder() {
  const currentFolderId = state.currentFolderId || CONFIG.ROOT_FOLDER_ID;
  const currentFolder = state.itemsById.get(currentFolderId);
  const childIds = state.childrenByFolderId.get(currentFolderId) || [];
  const children = childIds
    .map((childId) => state.itemsById.get(childId))
    .filter(Boolean)
    .sort(sortItems);

  state.visibleImages = children.filter((item) => !item.isFolder);
  renderBreadcrumbs(getBreadcrumbSegments(currentFolderId));

  if (!children.length) {
    renderEmptyState(`No folders or images inside ${currentFolder ? currentFolder.name : "this folder"}.`);
    return;
  }

  elements.gallery.innerHTML = "";
  children.forEach((item) => {
    const card = item.isFolder ? createFolderCard(item) : createImageCard(item, false);
    elements.gallery.appendChild(card);
  });
}

function renderSearchResults(matches, term) {
  const sortedMatches = [...matches].sort((a, b) => a.name.localeCompare(b.name));
  state.visibleImages = sortedMatches;
  renderMessage(`Found ${matches.length} result${matches.length === 1 ? "" : "s"} for "${term}".`);

  if (!sortedMatches.length) {
    renderEmptyState("No photos matched your search.");
    return;
  }

  elements.gallery.innerHTML = "";
  sortedMatches.forEach((item) => {
    elements.gallery.appendChild(createImageCard(item, true));
  });
}

function createFolderCard(item) {
  const article = document.createElement("article");
  article.className = "card folder-card";
  article.innerHTML = `
    <div class="folder-visual" aria-hidden="true">📁</div>
    <div class="folder-meta">
      <h2>${escapeHtml(item.name)}</h2>
      <p>Open folder</p>
    </div>
  `;
  article.addEventListener("click", () => {
    closePreview();
    state.currentFolderId = item.id;
    if (!state.isSearchMode) {
      renderCurrentFolder();
    }
  });
  return article;
}

function createImageCard(item, showPath) {
  const article = document.createElement("article");
  article.className = "card image-card";
  article.innerHTML = `
    <div class="image-frame">
      <img src="${escapeAttribute(item.thumbnailSrc)}" alt="${escapeAttribute(item.name)}" loading="lazy">
    </div>
    <div class="image-meta">
      <h2>${escapeHtml(item.name)}</h2>
      ${showPath ? `<span class="image-path">${escapeHtml(item.folderPath)}</span>` : ""}
    </div>
  `;
  article.addEventListener("click", () => {
    openPreview(state.visibleImages, state.visibleImages.findIndex((candidate) => candidate.id === item.id));
  });
  return article;
}

function openPreview(items, startIndex) {
  if (!Array.isArray(items) || !items.length || startIndex < 0) {
    return;
  }

  state.previewItems = items;
  state.previewIndex = startIndex;
  elements.previewModal.hidden = false;
  document.body.classList.add("modal-open");
  renderPreview();
}

function closePreview() {
  if (elements.previewModal.hidden) {
    return;
  }

  elements.previewModal.hidden = true;
  document.body.classList.remove("modal-open");
  state.previewItems = [];
  state.previewIndex = -1;
  elements.previewImage.removeAttribute("src");
  elements.previewImage.alt = "";
  elements.previewThumbs.innerHTML = "";
}

function renderPreview() {
  const item = state.previewItems[state.previewIndex];
  if (!item) {
    closePreview();
    return;
  }

  elements.previewImage.src = item.previewSrc;
  elements.previewImage.alt = item.name;
  elements.previewTitle.textContent = item.name;
  elements.previewMeta.textContent = `${item.folderPath} · ${state.previewIndex + 1} of ${state.previewItems.length}`;
  elements.previewDownload.href = item.downloadSrc;
  elements.previewDownload.setAttribute("download", item.name);

  elements.previewPrevButton.disabled = state.previewIndex <= 0;
  elements.previewNextButton.disabled = state.previewIndex >= state.previewItems.length - 1;

  renderPreviewThumbs();
}

function renderPreviewThumbs() {
  elements.previewThumbs.innerHTML = "";

  state.previewItems.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `preview-thumb${index === state.previewIndex ? " is-active" : ""}`;
    button.setAttribute("aria-pressed", String(index === state.previewIndex));
    button.innerHTML = `
      <span class="preview-thumb-frame">
        <img src="${escapeAttribute(item.thumbnailSrc)}" alt="${escapeAttribute(item.name)}" loading="lazy">
      </span>
      <span class="preview-thumb-label">${escapeHtml(item.name)}</span>
    `;
    button.addEventListener("click", () => {
      state.previewIndex = index;
      renderPreview();
      button.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
    elements.previewThumbs.appendChild(button);
  });

  const activeThumb = elements.previewThumbs.querySelector(".preview-thumb.is-active");
  if (activeThumb) {
    activeThumb.scrollIntoView({ block: "nearest", inline: "center" });
  }
}

function showPreviousPreview() {
  if (state.previewIndex <= 0) {
    return;
  }

  state.previewIndex -= 1;
  renderPreview();
}

function showNextPreview() {
  if (state.previewIndex >= state.previewItems.length - 1) {
    return;
  }

  state.previewIndex += 1;
  renderPreview();
}

function handlePreviewBackdropClick(event) {
  if (event.target instanceof HTMLElement && event.target.dataset.previewClose === "true") {
    closePreview();
  }
}

function handleDocumentKeydown(event) {
  if (elements.previewModal.hidden) {
    return;
  }

  if (event.key === "Escape") {
    closePreview();
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    showPreviousPreview();
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    showNextPreview();
  }
}

function renderBreadcrumbs(segments) {
  if (!segments.length) {
    elements.breadcrumbs.innerHTML = `<span>Search results</span>`;
    return;
  }

  elements.breadcrumbs.innerHTML = "";
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `crumb-button${isLast ? " is-active" : ""}`;
    button.textContent = segment.name;
    if (!isLast) {
      button.addEventListener("click", () => {
        closePreview();
        state.currentFolderId = segment.id;
        state.isSearchMode = false;
        elements.searchInput.value = "";
        renderCurrentFolder();
        renderMessage("Browse folders or use the search box to search across the whole gallery.");
      });
    } else {
      button.disabled = true;
    }
    elements.breadcrumbs.appendChild(button);

    if (!isLast) {
      const separator = document.createElement("span");
      separator.className = "crumb-separator";
      separator.textContent = "/";
      elements.breadcrumbs.appendChild(separator);
    }
  });
}

function getBreadcrumbSegments(folderId) {
  const segments = [];
  let currentId = folderId;

  while (currentId) {
    const item = state.itemsById.get(currentId);
    if (!item) {
      break;
    }

    segments.unshift({ id: currentId, name: item.name });
    const parentId = item.parents && item.parents[0] ? item.parents[0] : null;
    if (!parentId || currentId === CONFIG.ROOT_FOLDER_ID) {
      break;
    }
    currentId = parentId;
  }

  if (!segments.length) {
    segments.push({ id: CONFIG.ROOT_FOLDER_ID, name: state.rootFolderName });
  }

  return segments;
}

function renderMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("is-error", isError);
}

function renderError(text) {
  setStatus("Error");
  renderMessage(text, true);
  renderEmptyState("Unable to load the gallery.");
}

function renderEmptyState(text) {
  state.visibleImages = [];
  elements.gallery.innerHTML = `
    <div class="empty-state">
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function setStatus(text) {
  elements.statusBadge.textContent = text;
}

function sortItems(a, b) {
  if (a.isFolder !== b.isFolder) {
    return a.isFolder ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}


