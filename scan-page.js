(function bootstrapPretziOssScanner() {
  function normalizeDomain(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }

  function getStoreConfigs() {
    return Array.isArray(STORE_CONFIGS) ? STORE_CONFIGS : [];
  }

  function getStoreAliases(storeConfig) {
    const aliases = [storeConfig?.link, ...(Array.isArray(storeConfig?.additionalLinks) ? storeConfig.additionalLinks : [])];
    return aliases.map(normalizeDomain).filter(Boolean);
  }

  function findStoreConfigForHost(hostname) {
    const host = normalizeDomain(hostname || window.location.hostname);
    return getStoreConfigs().find((storeConfig) => {
      const aliases = getStoreAliases(storeConfig);
      return aliases.some((domain) => host === domain || host.endsWith("." + domain));
    }) || null;
  }

  function countVisibleProductCards(storeConfig) {
    const selectors = [
      storeConfig?.listingCardSelector,
      storeConfig?.listingAnchorSelector,
    ].filter(Boolean);

    for (const selector of selectors) {
      try {
        const nodes = Array.from(document.querySelectorAll(selector)).filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (nodes.length > 0) return nodes.length;
      } catch {
        continue;
      }
    }

    return 0;
  }

  function sanitizeProduct(product, storeConfig) {
    const result = product && typeof product === "object" ? { ...product } : {};
    if (!result.storeName) {
      result.storeName = storeConfig?.displayName || storeConfig?.link || null;
    }
    if (!result.currency) result.currency = "RON";
    if (!Array.isArray(result.resealed)) result.resealed = [];
    if (!Array.isArray(result.selectorErrors)) result.selectorErrors = [];
    if (!Array.isArray(result.selectorSuccesses)) result.selectorSuccesses = [];
    if (!Array.isArray(result.selectorCandidates)) result.selectorCandidates = [];
    return result;
  }

  async function scanPage() {
    const storeConfig = findStoreConfigForHost(window.location.hostname);
    const supportedStoreCount = getStoreConfigs().length;

    if (!storeConfig) {
      return {
        kind: "unsupported",
        url: window.location.href,
        supportedStoreCount,
        checkedAt: new Date().toISOString(),
      };
    }

    if (!isProductPageForStore(window.location.href, storeConfig)) {
      return {
        kind: "listing",
        url: window.location.href,
        store: {
          domain: storeConfig.link,
          displayName: storeConfig.displayName || storeConfig.link,
        },
        visibleItems: countVisibleProductCards(storeConfig),
        supportedStoreCount,
        checkedAt: new Date().toISOString(),
      };
    }

    const waitMeta = await waitForContent(storeConfig, {
      maxCounter: 8,
      interval: 500,
      minContentSize: 3000,
    });

    let product = extractProductData(storeConfig);
    if (!product) {
      return {
        kind: "no-data",
        url: window.location.href,
        store: {
          domain: storeConfig.link,
          displayName: storeConfig.displayName || storeConfig.link,
        },
        waitMeta,
        supportedStoreCount,
        checkedAt: new Date().toISOString(),
      };
    }

    if (!product.price && storeConfig.priceParseMode === "int-sup") {
      product.price = extractIntSupPrice(storeConfig);
      if (product.price && !product.extractionMethod) {
        product.extractionMethod = "int-sup-config";
      }
    }

    if (typeof extractOriginalPrice === "function") {
      product.originalPrice = extractOriginalPrice(storeConfig, product.price);
      if (product.originalPrice !== null && product.originalPrice !== undefined && !product.rawOriginalPrice) {
        product.rawOriginalPrice = String(product.originalPrice);
      }
    } else if (typeof product.originalPrice === "undefined") {
      product.originalPrice = null;
    }

    if (typeof extractResealed === "function") {
      product.resealed = extractResealed(storeConfig).sort((a, b) => a.price - b.price);
    } else if (!Array.isArray(product.resealed)) {
      product.resealed = [];
    }

    if (
      !product.mpn &&
      typeof extractProductCodeFromUrl === "function" &&
      Array.isArray(storeConfig.productCodeUrlPatterns) &&
      storeConfig.productCodeUrlPatterns.length > 0
    ) {
      const codeFromUrl = extractProductCodeFromUrl(window.location.href, storeConfig);
      if (codeFromUrl) product.mpn = codeFromUrl;
    }

    const checkedAt = new Date().toISOString();
    return {
      kind: "product",
      url: window.location.href,
      store: {
        domain: storeConfig.link,
        displayName: storeConfig.displayName || storeConfig.link,
      },
      waitMeta,
      supportedStoreCount,
      checkedAt,
      product: sanitizeProduct(product, storeConfig),
    };
  }

  window.__PRETZI_OSS_SCAN__ = scanPage;
})();
