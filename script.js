const CONFIG = {
  API_KEY: "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B_lrrvDN36c",
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
};

const elements = {
  gallery: document.getElementById("gallery"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  message: document.getElementById("message"),
  searchInput: document.getElementById("searchInput"),
  clearSearchButton: document.getElementById("clearSearchButton"),
  statusBadge: document.getElementById("statusBadge"),
  statsText: document.getElementById("statsText"),
};

elements.searchInput.addEventListener("input", handleSearchInput);
elements.clearSearchButton.addEventListener("click", clearSearch);

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
    item.thumbnailSrc = getImageSrc(item);
    state.searchIndex.push(item);
  }

  const folderCount = Array.from(state.itemsById.values()).filter((item) => item.isFolder).length;
  elements.statsText.textContent = `${folderCount} folders · ${state.searchIndex.length} photos`;
}

function getImageSrc(item) {
  if (item.thumbnailLink) {
    return item.thumbnailLink.replace(/=s\d+$/, "=s1200");
  }
  return `https://drive.google.com/thumbnail?id=${item.id}&sz=w1200`;
}

function handleSearchInput(event) {
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
  renderMessage(`Found ${matches.length} result${matches.length === 1 ? "" : "s"} for "${term}".`);

  if (!matches.length) {
    renderEmptyState("No photos matched your search.");
    return;
  }

  elements.gallery.innerHTML = "";
  matches.sort((a, b) => a.name.localeCompare(b.name)).forEach((item) => {
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
    window.open(item.webViewLink, "_blank", "noopener");
  });
  return article;
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
