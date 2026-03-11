const statusLabel = document.getElementById("status-label");
const statusText = document.getElementById("status-text");
const summaryCard = document.getElementById("summary-card");
const listingCard = document.getElementById("listing-card");
const listingText = document.getElementById("listing-text");
const factsList = document.getElementById("facts-list");
const jsonOutput = document.getElementById("json-output");
const productImage = document.getElementById("product-image");
const storeName = document.getElementById("store-name");
const productTitle = document.getElementById("product-title");
const productUrl = document.getElementById("product-url");
const metricPrice = document.getElementById("metric-price");
const metricOriginalPrice = document.getElementById("metric-original-price");
const metricStock = document.getElementById("metric-stock");
const metricMethod = document.getElementById("metric-method");
const rescanButton = document.getElementById("rescan-button");
const copyButton = document.getElementById("copy-button");

let lastScanResult = null;
let activeTabId = null;

function formatPrice(value, currency = "RON") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " " + currency;
}

function formatStock(value) {
  if (value === true) return "In stoc";
  if (value === false) return "Indisponibil";
  return "Necunoscut";
}

function setBusy(isBusy) {
  rescanButton.disabled = isBusy;
  copyButton.disabled = isBusy || !lastScanResult;
  statusLabel.textContent = isBusy ? "Scanam pagina..." : statusLabel.textContent;
}

function showStatus(label, text) {
  statusLabel.textContent = label;
  statusText.textContent = text;
}

function hideResultCards() {
  summaryCard.classList.add("hidden");
  listingCard.classList.add("hidden");
}

function renderFacts(entries) {
  factsList.innerHTML = "";
  for (const [label, value] of entries) {
    if (!value) continue;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    factsList.append(dt, dd);
  }
}

function renderProduct(result) {
  const product = result.product || {};
  hideResultCards();
  summaryCard.classList.remove("hidden");

  showStatus(
    "Produs detectat local",
    "Datele de mai jos sunt extrase direct din tabul activ, fara apeluri catre backend."
  );

  storeName.textContent = result.store?.displayName || result.store?.domain || "Magazin necunoscut";
  productTitle.textContent = product.title || "Titlu indisponibil";
  productUrl.textContent = result.url || "";
  metricPrice.textContent = formatPrice(product.price, product.currency);
  metricOriginalPrice.textContent = formatPrice(product.originalPrice, product.currency);
  metricStock.textContent = formatStock(product.inStock);
  metricMethod.textContent = product.extractionMethod || "-";

  if (product.image) {
    productImage.src = product.image;
    productImage.classList.remove("hidden");
  } else {
    productImage.removeAttribute("src");
    productImage.classList.add("hidden");
  }

  renderFacts([
    ["Brand", product.brand],
    ["Categorie", product.category],
    ["EAN", product.ean],
    ["GTIN", product.gtin],
    ["MPN", product.mpn],
    ["SKU", product.sku],
    ["Varianta", product.variantColor],
    ["Promo", product.promoLabel],
    ["Scanat la", result.checkedAt],
  ]);

  jsonOutput.textContent = JSON.stringify(result, null, 2);
}

function renderListing(result) {
  hideResultCards();
  listingCard.classList.remove("hidden");
  const count = typeof result.visibleItems === "number" ? result.visibleItems : 0;
  const store = result.store?.displayName || result.store?.domain || "magazinul curent";
  showStatus(
    "Magazin suportat",
    "Tabul activ este suportat, dar pagina curenta nu pare sa fie o fisa de produs."
  );
  listingText.textContent = count > 0
    ? `Pe ${store} se vad aproximativ ${count} carduri de produs pe pagina curenta.`
    : `Pe ${store} pagina pare a fi listing, cautare sau alta pagina non-produs.`;
  jsonOutput.textContent = JSON.stringify(result, null, 2);
}

function renderRestricted(message) {
  hideResultCards();
  showStatus("Nu pot scana tabul curent", message);
  jsonOutput.textContent = "";
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function isRestrictedUrl(url) {
  if (typeof url !== "string" || !url) return true;
  return !/^https?:/i.test(url);
}

async function injectScanner(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["store-configs.js", "extractor.js", "scan-page.js"],
  });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      if (typeof window.__PRETZI_OSS_SCAN__ !== "function") {
        return {
          kind: "error",
          message: "Scannerul OSS nu a fost initializat corect.",
        };
      }
      return window.__PRETZI_OSS_SCAN__();
    },
  });

  return result;
}

async function scanActiveTab() {
  setBusy(true);
  hideResultCards();

  try {
    const tab = await getActiveTab();
    if (!tab || typeof tab.id !== "number") {
      throw new Error("Nu am gasit tabul activ.");
    }

    activeTabId = tab.id;
    if (isRestrictedUrl(tab.url)) {
      renderRestricted("Deschide o pagina HTTP sau HTTPS a unui magazin suportat.");
      lastScanResult = null;
      return;
    }

    const result = await injectScanner(tab.id);
    lastScanResult = result;
    copyButton.disabled = false;

    if (!result || result.kind === "error") {
      renderRestricted(result?.message || "Scanarea a esuat.");
      return;
    }

    if (result.kind === "product") {
      renderProduct(result);
      return;
    }

    if (result.kind === "listing") {
      renderListing(result);
      return;
    }

    if (result.kind === "unsupported") {
      renderRestricted(
        "Domeniul curent nu exista in lista locala de magazine suportate din varianta OSS."
      );
      return;
    }

    renderRestricted("Pagina este suportata, dar extractorul nu a gasit suficiente date.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderRestricted(message);
    lastScanResult = null;
  } finally {
    setBusy(false);
    copyButton.disabled = !lastScanResult;
  }
}

async function copyJson() {
  if (!lastScanResult) return;
  await navigator.clipboard.writeText(JSON.stringify(lastScanResult, null, 2));
  showStatus("JSON copiat", "Rezultatul scanarii a fost copiat in clipboard.");
}

rescanButton.addEventListener("click", () => {
  scanActiveTab();
});

copyButton.addEventListener("click", () => {
  copyJson().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    showStatus("Copiere esuata", message);
  });
});

scanActiveTab();
