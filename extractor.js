











const DEBUG_EXTRACTOR = false;
const ENABLE_GENERIC_STORE_FALLBACK = false;

function logDebug(...args) {
  if (DEBUG_EXTRACTOR) console.log('[Pretzi:Extractor]', ...args);
}

function addSelectorError(list, selectorKey, reason, selectorValue = '') {
  if (!Array.isArray(list) || list.length >= 20) return;
  const key = String(selectorKey || '').trim();
  const why = String(reason || '').trim();
  if (!key || !why) return;

  const selector = String(selectorValue || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const entry = selector ? `${key}:${why}:${selector}` : `${key}:${why}`;
  if (!list.includes(entry)) {
    list.push(entry);
  }
}

function getSelectorMatchLimit(storeConfig) {
  const storeLimit = Number(storeConfig?.selectorMatchMax);
  if (Number.isFinite(storeLimit) && storeLimit >= 1) {
    return Math.max(1, Math.min(50, Math.floor(storeLimit)));
  }

  const defaultLimit = Number(
    typeof EXTRACTION_CONFIG !== "undefined" ? EXTRACTION_CONFIG.selectorMatchMax : NaN
  );
  if (Number.isFinite(defaultLimit) && defaultLimit >= 1) {
    return Math.max(1, Math.min(50, Math.floor(defaultLimit)));
  }

  return 12;
}

function mergeSelectorErrors(target, source) {
  if (!Array.isArray(target) || !Array.isArray(source) || source.length === 0) return;
  for (const entry of source) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    if (target.length >= 20) break;
    if (!target.includes(entry)) target.push(entry);
  }
}

function sanitizeJsonCandidate(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/<!--|-->/g, '')
    .replace(/,\s*([}\]])/g, '$1')


    .replace(/[\u0000-\u001F\u2028\u2029]/g, '')
    .trim();
}

function parseJsonSafely(raw, context = 'json') {
  const source = typeof raw === 'string' ? raw : String(raw || '');
  if (!source || !source.trim()) return null;

  const attempts = [];
  const seen = new Set();
  const addAttempt = (value) => {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    attempts.push(text);
  };

  addAttempt(source);
  const sanitized = sanitizeJsonCandidate(source);
  addAttempt(sanitized);

  if (sanitized) {
    const firstObj = sanitized.indexOf('{');
    const lastObj = sanitized.lastIndexOf('}');
    if (firstObj >= 0 && lastObj > firstObj) {
      addAttempt(sanitized.slice(firstObj, lastObj + 1));
    }
    const firstArr = sanitized.indexOf('[');
    const lastArr = sanitized.lastIndexOf(']');
    if (firstArr >= 0 && lastArr > firstArr) {
      addAttempt(sanitized.slice(firstArr, lastArr + 1));
    }
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      logDebug(`JSON parse failed (${context}):`, e?.message || e);
    }
  }

  return null;
}

function parseJsonPathToken(token) {
  const cleaned = String(token || "").trim();
  if (!cleaned) return null;
  if (cleaned === "*") return { key: "*", index: null };
  const match = cleaned.match(/^([^[\]]+)(?:\[(\*|\d+)\])?$/);
  if (!match) return { key: cleaned, index: null };
  return { key: match[1], index: match[2] ?? null };
}

function extractValuesByJsonPath(root, jsonPath) {
  if (root == null) return [];
  const tokens = String(jsonPath || "")
    .split(".")
    .map(parseJsonPathToken)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  let current = [root];
  for (const token of tokens) {
    const next = [];
    for (const value of current) {
      if (value == null) continue;

      if (token.key === "*") {
        if (Array.isArray(value)) {
          next.push(...value);
        } else if (typeof value === "object") {
          next.push(...Object.values(value));
        }
        continue;
      }

      const candidates = [];
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, token.key)) {
            candidates.push(entry[token.key]);
          }
        }
      } else if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, token.key)) {
        candidates.push(value[token.key]);
      }

      for (const candidate of candidates) {
        if (token.index == null) {
          next.push(candidate);
          continue;
        }
        if (!Array.isArray(candidate)) continue;
        if (token.index === "*") {
          next.push(...candidate);
          continue;
        }
        const index = Number(token.index);
        if (Number.isInteger(index) && index >= 0 && index < candidate.length) {
          next.push(candidate[index]);
        }
      }
    }
    current = next;
    if (current.length === 0) break;
  }

  return current;
}

function collectJsonRootsForSelector(parsed) {
  const roots = [];
  const queue = [parsed];
  const seen = new Set();
  while (queue.length > 0 && roots.length < 60) {
    const node = queue.shift();
    if (node == null) continue;
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);
    roots.push(node);
    if (node["@graph"]) queue.push(node["@graph"]);
    if (node.mainEntity) queue.push(node.mainEntity);
  }
  return roots;
}

function normalizeExtractedJsonValue(value) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    return text || null;
  }
  if (typeof value === "object") {
    const pick =
      value.name ??
      value.value ??
      value.content ??
      value.sku ??
      value.mpn ??
      null;
    if (typeof pick === "string" || typeof pick === "number") {
      const text = String(pick).trim();
      return text || null;
    }
  }
  return null;
}

function extractJsonSelectorValues(raw, jsonPath) {
  if (!raw || !jsonPath) return [];
  const parsed = parseJsonSafely(raw, "identifierSelectors:jsonPath");
  if (parsed == null) return [];

  const roots = collectJsonRootsForSelector(parsed);
  const out = [];
  const seen = new Set();

  for (const root of roots) {
    const values = extractValuesByJsonPath(root, jsonPath);
    for (const value of values) {
      const normalized = normalizeExtractedJsonValue(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
      if (out.length >= 20) return out;
    }
  }

  return out;
}









function cleanUrlForHost(url) {
  try {
    let cleaned = url
      .replace(/https?:\/\//i, '')
      .replace(/^www\./i, '');

    const slashIdx = cleaned.indexOf('/');
    if (slashIdx !== -1) cleaned = cleaned.substring(0, slashIdx);

    const colonIdx = cleaned.indexOf(':');
    if (colonIdx !== -1) cleaned = cleaned.substring(0, colonIdx);

    const parts = cleaned.split('.');
    if (parts.length > 2) {

      const last = parts[parts.length - 1];
      const secondLast = parts[parts.length - 2];
      if (secondLast === 'com' || secondLast === 'co') {
        return parts.slice(-3).join('.').toLowerCase();
      }
      return parts.slice(-2).join('.').toLowerCase();
    }
    return cleaned.toLowerCase();
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
    return url.toLowerCase();
  }
}

function findMatchedStoreConfig(host, configs) {
  if (!Array.isArray(configs) || configs.length === 0) return null;
  for (const config of configs) {
    if (!config || !config.link) continue;
    const links = [config.link];
    if (Array.isArray(config.additionalLinks)) links.push(...config.additionalLinks);
    for (const link of links) {
      const normalized = String(link || '').toLowerCase();
      if (!normalized) continue;
      if (host === normalized || host.endsWith('.' + normalized)) {
        return config;
      }
    }
  }
  for (const config of configs) {
    if (!config || !config.link) continue;
    const normalized = String(config.link).toLowerCase();
    if (normalized && host.includes(normalized)) {
      return config;
    }
  }
  return null;
}

function resolveConfigSourceMode(host) {
  try {
    if (typeof getConfigSourceModeForHost === 'function') {
      const mode = String(getConfigSourceModeForHost(host) || '').trim().toLowerCase();
      if (mode === 'server_first' || mode === 'hardcoded_only') return mode;
    }
    if (typeof getConfigSourceMode === 'function') {
      const mode = String(getConfigSourceMode() || '').trim().toLowerCase();
      if (mode === 'server_first' || mode === 'hardcoded_only') return mode;
    }
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
  }
  return 'server_first';
}










function findStoreConfig(url) {
  if (!url) return null;

  const host = cleanUrlForHost(url);
  const configSourceMode = resolveConfigSourceMode(host);
  const hardcodedMatch =
    typeof STORE_CONFIGS !== 'undefined' ? findMatchedStoreConfig(host, STORE_CONFIGS) : null;
  const dynamicMatch =
    typeof DYNAMIC_STORE_CONFIGS !== 'undefined' ? findMatchedStoreConfig(host, DYNAMIC_STORE_CONFIGS) : null;

  let resolved = null;
  if (configSourceMode === 'hardcoded_only') {
    resolved = hardcodedMatch;
  } else {

    resolved = dynamicMatch || hardcodedMatch;
  }

  if (resolved) {
    resolved._configSource = dynamicMatch && resolved === dynamicMatch ? 'server' : 'fallback';
    return resolved;
  }


  if (ENABLE_GENERIC_STORE_FALLBACK && (host.endsWith('.ro') || host.endsWith('.com'))) {
    return {
      link: host,
      displayName: host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1),
      isGeneric: true,
      selectors_inject: [
        '[itemprop="price"]',
        '[class*="price"]:not([class*="old"]):not([class*="original"])',
      ],
      selectors_inject_waitFor: [],
      selectors_checkPrice: [],
      pattern_inStock: [],
      pattern_outOfStock: [],
      pattern_whitelistNotFound: [],
      productPagePatterns: [], 
    };
  }

  return null;
}




function isLikelyPromoLandingUrl(url, storeConfig) {
  try {
    const host = cleanUrlForHost(url);
    const storeHost = String(storeConfig?.link || '').toLowerCase();
    const isSpringFarma =
      storeHost === 'springfarma.com' ||
      host === 'springfarma.com' ||
      host.endsWith('.springfarma.com');
    if (!isSpringFarma) return false;

    const pathname = new URL(url, window.location.origin).pathname.toLowerCase();
    const hasDatePrefix =
      /(?:^|\/)20\d{2}[-_/](?:0?[1-9]|1[0-2]|jan|feb|mar|apr|mai|may|iun|jun|iul|jul|aug|sep|oct|nov|dec)\b/.test(pathname);
    if (!hasDatePrefix) return false;

    return /(transport[-_ ]?gratuit|reducere[-_ ]?in[-_ ]?cos|voucher|coupon|swp|prag[-_ ]?\d+\s*lei|promo)/.test(pathname);
  } catch (e) {
    logDebug('Promo landing URL guard failed:', e);
    return false;
  }
}

function isProductPageForStore(url, storeConfig) {
  if (!storeConfig) return false;
  if (isLikelyPromoLandingUrl(url, storeConfig)) return false;



  try {
    if (typeof document !== 'undefined') {
      const bodyClass = String(document.body?.className || '');
      if (/\bcatalog-product-view\b/i.test(bodyClass)) return true;
      if (/\bcatalog-category-view\b|\bcatalogsearch-result-index\b/i.test(bodyClass)) return false;


      const host = cleanUrlForHost(url);
      const isSpringFarma =
        String(storeConfig?.link || '').toLowerCase() === 'springfarma.com' ||
        host === 'springfarma.com' ||
        host.endsWith('.springfarma.com');
      if (isSpringFarma) {
        if (/\bcatalog-product-view\b/i.test(bodyClass)) return true;
        if (/\bcatalog-category-view\b|\bpage-products\b/i.test(bodyClass)) return false;
      }
    }
  } catch (e) {
    logDebug('Body-class page-type guard failed:', e);
  }


  if (!storeConfig.productPagePatterns || storeConfig.productPagePatterns.length === 0) {
    return true;
  }

  for (const pattern of storeConfig.productPagePatterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(url)) {
        logDebug('Product page matched:', pattern);
        return true;
      }
    } catch (e) {
      logDebug('Invalid productPagePattern:', pattern, e);
    }
  }

  return false;
}




function isWhitelistedNotFound(html, storeConfig) {
  const title = document.title || '';
  const isLikelyRealPage = html.length > 50000 && title.length > 10 &&
    !/^(just a moment|error|404|403|500|502|503|not found|access denied)/i.test(title);
  const hasStructuredProductSignal =
    /itemprop=\"price\"|application\/ld\+json|schema\.org\/Product|\"@type\"\s*:\s*\"Product\"/i.test(html);


  if (typeof EXTRACTION_CONFIG !== 'undefined' && EXTRACTION_CONFIG.whitelistNotFound) {
    if (EXTRACTION_CONFIG.whitelistNotFound.test(html)) {



      if (isLikelyRealPage) {
        logDebug('Global whitelist match overridden - treating page as valid');
      } else {
        logDebug('Global whitelist match - error page detected');
        return true;
      }
    }
  }


  if (storeConfig && storeConfig.pattern_whitelistNotFound) {
    for (const pattern of storeConfig.pattern_whitelistNotFound) {
      if (testPattern(pattern, html)) {
        if (isLikelyRealPage && hasStructuredProductSignal) {
          logDebug('Store whitelist match overridden - structured product signal detected:', pattern);
          continue;
        }
        logDebug('Store whitelist match:', pattern);
        return true;
      }
    }
  }

  return false;
}









function parsePrice(priceText) {
  if (!priceText) return null;
  const rawText = String(priceText);
  if (
    /\bde\s+la\b/i.test(rawText) ||
    /\bstarting\s+at\b/i.test(rawText) ||
    /\bfrom\b/i.test(rawText) ||
    /\d[\d\s.,]*\s*[-–—]\s*\d[\d\s.,]*/.test(rawText)
  ) {
    return null;
  }

  let cleaned = String(priceText)
    .replace(/lei/gi, '')
    .replace(/ron/gi, '')
    .replace(/eur|euro/gi, '')
    .replace(/usd/gi, '')
    .replace(/gbp/gi, '')
    .replace(/[€$£]/g, '')

    .replace(/nou/gi, '')
    .replace(/resigilat(e)?/gi, '')
    .replace(/pre[tÈ›]:/gi, '')
    .replace(/\u00A0/g, '') 
    .replace(/\s+/g, '')
    .trim();

  if (!cleaned) return null;


  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  else if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  }

  else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  }

  else if (/^\d+\.?\d*$/.test(cleaned)) {

  }

  else {
    cleaned = cleaned.replace(/[^\d.,]/g, '');
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      cleaned = cleaned.replace(',', '.');
    }
  }

  const price = parseFloat(cleaned);
  return isNaN(price) || price <= 0 ? null : price;
}

function normalizeReviewRating(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > 5) return null;
  return Math.round(num * 100) / 100;
}

function normalizeReviewCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 1000000) return null;
  return Math.floor(num);
}

function getElementStringValue(el, preferredAttribute) {
  if (!el) return null;

  const attributes = [];
  if (preferredAttribute) attributes.push(preferredAttribute);
  attributes.push("content", "value", "data-value", "data-price-amount", "data-product-sku");

  for (const attr of attributes) {
    try {
      const value = el.getAttribute && el.getAttribute(attr);
      if (typeof value === "string" && value.trim() !== "") {
        return value.trim();
      }
    } catch (e) {
      if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
    }
  }

  const text = typeof el.textContent === "string" ? el.textContent.trim() : "";
  return text || null;
}

function isValidEan13(code) {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(code[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(code[12]);
}

function extractGtinCandidate(raw) {
  if (!raw) return { ean: null, gtin: null };
  const digitsOnly = String(raw).replace(/\D/g, "");
  if (!digitsOnly) return { ean: null, gtin: null };

  const candidates13 = digitsOnly.match(/\d{13}/g) || [];
  for (const candidate of candidates13) {
    if (isValidEan13(candidate)) {
      return { ean: candidate, gtin: candidate };
    }
  }

  const candidates14 = digitsOnly.match(/\d{14}/g);
  if (candidates14 && candidates14[0]) {
    return { ean: null, gtin: candidates14[0] };
  }

  const candidates12 = digitsOnly.match(/\d{12}/g);
  if (candidates12 && candidates12[0]) {
    return { ean: null, gtin: candidates12[0] };
  }

  const candidates8 = digitsOnly.match(/\d{8}/g);
  if (candidates8 && candidates8[0]) {
    return { ean: null, gtin: candidates8[0] };
  }

  return { ean: null, gtin: null };
}









function extractSchemaJSON(html, storeConfig) {

  if (storeConfig && storeConfig.flags &&
      typeof EXTRACTION_CONFIG !== 'undefined' &&
      (storeConfig.flags & EXTRACTION_CONFIG.FLAGS.IGNORE_SCHEMA_DATA)) {
    logDebug('Schema extraction skipped (IGNORE_SCHEMA_DATA flag)');
    return null;
  }

  let bestFallback = null;
  let bestFallbackScore = -1;

  try {

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        let text = script.textContent || '';
        if (!text.includes('schema.org')) continue;

        let jsonData = parseJsonSafely(text, 'extractSchemaJSON');
        if (!jsonData) continue;


        if (jsonData['@graph']) {
          jsonData = jsonData['@graph'];
        }


        if (jsonData.mainEntity) {
          jsonData = jsonData.mainEntity;
        }

        const items = Array.isArray(jsonData) ? jsonData : [jsonData];

        for (const item of items) {
          const itemType = item['@type'];
          const isProduct = itemType === 'Product' ||
                           (Array.isArray(itemType) && itemType.includes('Product')) ||
                           (typeof itemType === 'string' && itemType.toLowerCase().includes('product'));

          if (!isProduct) {

            if (item.mainEntity) {
              const me = item.mainEntity;
              if (me['@type'] === 'Product' || (typeof me['@type'] === 'string' && me['@type'].toLowerCase().includes('product'))) {
                const extracted = extractOffersFromSchema(me);
                if (extracted?.price !== null) return extracted;
                const score = scoreSchemaExtraction(extracted);
                if (score > bestFallbackScore) {
                  bestFallback = extracted;
                  bestFallbackScore = score;
                }
              }
            }
            continue;
          }

          const extracted = extractOffersFromSchema(item);
          if (extracted?.price !== null) return extracted;
          const score = scoreSchemaExtraction(extracted);
          if (score > bestFallbackScore) {
            bestFallback = extracted;
            bestFallbackScore = score;
          }
        }
      } catch (e) {
        logDebug('JSON-LD parse error:', e.message);
      }
    }
  } catch (e) {
    logDebug('Schema extraction error:', e);
  }

  return bestFallback;
}




function extractOffersFromSchema(product) {
  const result = {
    price: null,
    rawPrice: null,
    currency: null,
    title: null,
    image: null,
    inStock: null,
    rawInStock: null,
    mpn: null,
    ean: null,
    gtin: null,
    brand: null,
    sku: null,
    reviewRating: null,
    reviewCount: null,
  };

  result.title = product.name || null;


  if (product.image) {
    result.image = Array.isArray(product.image) ? product.image[0] : product.image;
    if (result.image && typeof result.image === 'object') {
      result.image = result.image.url || result.image.contentUrl || null;
    }
  }


  result.mpn = product.mpn || null;
  result.sku = product.sku || null;
  const schemaIdentifiers = extractGtinCandidate(
    product.gtin13 || product.gtin14 || product.gtin12 || product.gtin8 || product.gtin || product.ean || null
  );
  result.ean = schemaIdentifiers.ean;
  result.gtin = schemaIdentifiers.gtin;



  if (!result.ean && result.sku) {
    var skuAsGtin = extractGtinCandidate(result.sku);
    if (skuAsGtin.ean) {
      result.ean = skuAsGtin.ean;
      if (!result.gtin) result.gtin = skuAsGtin.gtin;
    }
  }

  if (product.brand) {
    result.brand = typeof product.brand === 'string' ? product.brand : (product.brand.name || null);
  }

  if (product.aggregateRating && typeof product.aggregateRating === "object") {
    const aggregate = product.aggregateRating;
    result.reviewRating = normalizeReviewRating(
      aggregate.ratingValue ?? aggregate.rating ?? aggregate.value
    );
    result.reviewCount = normalizeReviewCount(
      aggregate.reviewCount ?? aggregate.ratingCount ?? aggregate.reviews
    );
  }

  if (product.offers) {
    let offers = product.offers;
    let aggregateLowPrice = null;
    let aggregatePriceCurrency = 'RON';


    if (offers['@type'] === 'AggregateOffer') {
      aggregateLowPrice = offers.lowPrice ?? null;
      aggregatePriceCurrency = offers.priceCurrency || 'RON';
      if (offers.offers) {
        offers = offers.offers;
      } else if (offers.priceSpecification) {
        applySchemaPriceSpecification(result, offers.priceSpecification, offers.priceCurrency || 'RON');
      } else {
        applySchemaPriceCandidate(result, aggregateLowPrice, aggregatePriceCurrency);
        if (offers.availability) {
          result.rawInStock = String(offers.availability);
          result.inStock = !offers.availability.toLowerCase().includes('outofstock');
        }
        return result;
      }
    }

    const offerList = Array.isArray(offers) ? offers : [offers];
    const normalizePath = (value) => {
      if (!value) return '';
      try {
        const pathValue = new URL(String(value), window.location.origin).pathname || '';
        return pathValue.replace(/\/+$/, '').toLowerCase();
      } catch {
        return String(value).replace(/\/+$/, '').toLowerCase();
      }
    };

    const extractVariantId = (value) => {
      if (!value) return null;
      const source = String(value);
      const matchFromPath = source.match(/\/p-(\d+)(?:\/|$)/i);
      if (matchFromPath && matchFromPath[1]) return matchFromPath[1];
      const matchFromNodeId = source.match(/\b(?:pd-variant-|variant[-_]?id[-_]?)(\d+)\b/i);
      if (matchFromNodeId && matchFromNodeId[1]) return matchFromNodeId[1];
      if (/^\d{5,}$/.test(source)) return source;
      return null;
    };

    const currentPath = normalizePath(window.location.href);
    const currentVariantId = extractVariantId(currentPath);
    const productSku = typeof product.sku === 'string' ? product.sku.trim().toLowerCase() : null;
    const selectedVariantIds = new Set();
    const selectedPaths = new Set();
    const selectedSkus = new Set();

    if (currentPath) selectedPaths.add(currentPath);
    if (currentVariantId) selectedVariantIds.add(currentVariantId);
    if (productSku) selectedSkus.add(productSku);


    try {
      const selectedSelectors = [
        '.pd-variant-selected',
        '#pdSelectedVariant',
        '[aria-selected="true"][data-testid*="variant"]',
        '[data-testid*="variant"][aria-current="true"]',
        'input[name="productId"][value]',
        'input[name="sku"][value]',
      ];
      const selectedNodes = Array.from(document.querySelectorAll(selectedSelectors.join(','))).slice(0, 80);
      for (const node of selectedNodes) {
        if (!node) continue;
        const rawValues = [
          node.getAttribute && node.getAttribute('id'),
          node.getAttribute && node.getAttribute('data-testid'),
          node.getAttribute && node.getAttribute('href'),
          node.getAttribute && node.getAttribute('value'),
          node.getAttribute && node.getAttribute('data-product-id'),
          node.getAttribute && node.getAttribute('data-sku'),
          node.textContent,
        ];
        for (const raw of rawValues) {
          const token = String(raw || '').trim();
          if (!token) continue;

          const variantId = extractVariantId(token);
          if (variantId) selectedVariantIds.add(variantId);

          const pathValue = normalizePath(token);
          if (pathValue) {
            selectedPaths.add(pathValue);
            const pathVariantId = extractVariantId(pathValue);
            if (pathVariantId) selectedVariantIds.add(pathVariantId);
          }

          const skuMatch = token.match(/\bsku[:\s-]*([a-z0-9][a-z0-9_-]{2,40})\b/i);
          if (skuMatch && skuMatch[1]) selectedSkus.add(String(skuMatch[1]).toLowerCase());
          if (/[a-z]/i.test(token) && /^[a-z0-9][a-z0-9_-]{2,40}$/i.test(token)) {
            selectedSkus.add(token.toLowerCase());
          }
        }
      }
    } catch {  }

    const offerVariantIds = new Set();
    for (const offer of offerList) {
      const offerPath = normalizePath(offer?.url || '');
      const offerVariantId = extractVariantId(offerPath);
      if (offerVariantId) offerVariantIds.add(offerVariantId);
    }
    const hasMultiVariantOfferSet = offerVariantIds.size >= 2;


    let matchedOffer = null;
    let matchedScore = 0;
    for (const offer of offerList) {
      if (!offer || typeof offer !== 'object') continue;
      const offerPath = normalizePath(offer.url || '');
      const offerVariantId = extractVariantId(offerPath);
      const offerSku = typeof offer.sku === 'string' ? offer.sku.trim().toLowerCase() : null;
      let score = 0;

      if (currentPath && offerPath && (currentPath === offerPath || currentPath.endsWith(offerPath) || offerPath.endsWith(currentPath))) {
        score += 120;
      }
      if (offerPath && selectedPaths.has(offerPath)) score += 110;
      if (currentVariantId && offerVariantId && currentVariantId === offerVariantId) score += 100;
      if (offerVariantId && selectedVariantIds.has(offerVariantId)) score += 95;
      if (productSku && offerSku && productSku === offerSku) score += 90;
      if (offerSku && selectedSkus.has(offerSku)) score += 85;
      if (offer.availability && !String(offer.availability).toLowerCase().includes('outofstock')) score += 3;

      if (score > matchedScore) {
        matchedScore = score;
        matchedOffer = offer;
      }
    }

    if (matchedOffer && matchedScore > 0) {

      const price = parsePrice(matchedOffer.price);
      if (price && price > 0) {
        result.price = price;
        result.rawPrice = String(matchedOffer.price);
        result.currency = matchedOffer.priceCurrency
          ? String(matchedOffer.priceCurrency).toUpperCase()
          : result.currency || 'RON';
      }
      if (matchedOffer.availability) {
        result.rawInStock = String(matchedOffer.availability);
        result.inStock = !matchedOffer.availability.toLowerCase().includes('outofstock');
      }
      if (matchedOffer.sku) result.sku = matchedOffer.sku;
      if (matchedOffer.name && matchedOffer.name.length > (result.title || '').length) {
        result.title = matchedOffer.name;
      }
    } else {
      const allowLowestFallbackAcrossOffers = offerList.length <= 1 || !hasMultiVariantOfferSet;
      if (allowLowestFallbackAcrossOffers) {
        applySchemaPriceCandidate(result, aggregateLowPrice, aggregatePriceCurrency);
        for (const offer of offerList) {
          applySchemaPriceCandidate(result, offer.price, offer.priceCurrency);
          applySchemaPriceSpecification(result, offer.priceSpecification, offer.priceCurrency);

          if (offer.availability) {
            result.rawInStock = String(offer.availability);
            result.inStock = !offer.availability.toLowerCase().includes('outofstock');
          }

          if (!result.sku && offer.sku) result.sku = offer.sku;
        }
      } else {

        const firstInStock = offerList.find((offer) => {
          if (!offer || !offer.availability) return false;
          return !String(offer.availability).toLowerCase().includes('outofstock');
        });
        const statusOffer = firstInStock || offerList.find(Boolean) || null;
        if (statusOffer && statusOffer.availability) {
          result.rawInStock = String(statusOffer.availability);
          result.inStock = !String(statusOffer.availability).toLowerCase().includes('outofstock');
        }
        if (!result.sku && statusOffer && statusOffer.sku) result.sku = statusOffer.sku;
      }
    }
  }

  logDebug('Schema extraction result:', result);
  return scoreSchemaExtraction(result) > 0 ? result : null;
}

function applySchemaPriceCandidate(result, rawPriceValue, rawCurrency) {
  if (rawPriceValue === undefined || rawPriceValue === null || rawPriceValue === '') return;
  const price = parsePrice(rawPriceValue);
  if (!price || price <= 0) return;

  if (result.price === null || price < result.price) {
    result.price = price;
    result.rawPrice = String(rawPriceValue);
  }
  if (rawCurrency) {
    result.currency = String(rawCurrency).toUpperCase();
  } else if (!result.currency) {
    result.currency = 'RON';
  }
}

function applySchemaPriceSpecification(result, priceSpecification, fallbackCurrency) {
  if (!priceSpecification) return;
  const specs = Array.isArray(priceSpecification) ? priceSpecification : [priceSpecification];
  for (const spec of specs) {
    if (!spec || typeof spec !== 'object') continue;
    const rawPrice = spec.price ?? spec.minPrice ?? spec.maxPrice;
    const currency = spec.priceCurrency || fallbackCurrency || null;
    applySchemaPriceCandidate(result, rawPrice, currency);
  }
}

function scoreSchemaExtraction(result) {
  if (!result || typeof result !== 'object') return 0;
  let score = 0;
  if (typeof result.price === 'number' && Number.isFinite(result.price) && result.price > 0) score += 8;
  if (result.ean) score += 4;
  if (result.gtin) score += 3;
  if (result.mpn) score += 3;
  if (result.sku) score += 2;
  if (result.brand) score += 1;
  if (result.title) score += 1;
  return score;
}









function extractMicrodata(html) {
  const result = {
    price: null,
    rawPrice: null,
    currency: null,
    inStock: null,
    rawInStock: null,
    reviewRating: null,
    reviewCount: null,
  };


  if (!html.includes('schema.org/Product') && !html.includes('schema.org/Offer') &&
      !html.includes('itemprop="price"')) {
    return null;
  }

  try {
    const priceSelectors = [
      '[itemprop="price"]',
      'meta[itemprop="price"]',
      '[property="product:price:amount"]',
      'meta[property="product:price:amount"]',
      '[property="price"]',
    ];
    for (const selector of priceSelectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        const raw = getElementStringValue(node, "content");
        const parsed = parsePrice(raw);
        if (parsed) {
          result.price = parsed;
          result.rawPrice = raw;
          break;
        }
      }
      if (result.price) break;
    }

    const currencySelectors = [
      '[itemprop="priceCurrency"]',
      'meta[itemprop="priceCurrency"]',
      '[property="product:price:currency"]',
      'meta[property="product:price:currency"]',
    ];
    for (const selector of currencySelectors) {
      const node = document.querySelector(selector);
      const rawCurrency = getElementStringValue(node, "content");
      if (rawCurrency) {
        result.currency = rawCurrency.toUpperCase();
        break;
      }
    }

    const availabilitySelectors = [
      '[itemprop="availability"]',
      '[property="product:availability"]',
      'link[itemprop="availability"]',
      'meta[itemprop="availability"]',
    ];
    for (const selector of availabilitySelectors) {
      const node = document.querySelector(selector);
      const rawAvailability = (getElementStringValue(node, "href") || "").toLowerCase();
      if (!rawAvailability) continue;
      result.rawInStock = rawAvailability;
      result.inStock = !/(outofstock|soldout|unavailable|stoc-epuizat)/i.test(rawAvailability);
      break;
    }

    const ratingNode = document.querySelector(
      '[itemprop="ratingValue"], meta[itemprop="ratingValue"], [itemprop="rating"]'
    );
    const reviewCountNode = document.querySelector(
      '[itemprop="reviewCount"], meta[itemprop="reviewCount"], [itemprop="ratingCount"], meta[itemprop="ratingCount"]'
    );
    result.reviewRating = normalizeReviewRating(getElementStringValue(ratingNode, "content"));
    result.reviewCount = normalizeReviewCount(getElementStringValue(reviewCountNode, "content"));

    if (typeof EXTRACTION_CONFIG === 'undefined') return null;


    const pattern = EXTRACTION_CONFIG.microdataPattern;
    if (!pattern) return null;

    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(html)) !== null) {
      const prop = match[1].toLowerCase();
      const value = match[2];

      if ((prop === 'price' || prop === 'product:price:amount') && !result.price) {
        const price = parseFloat(value);
        if (!isNaN(price) && price > 0) {
          result.price = price;
          result.rawPrice = value;
        }
      } else if (!result.currency && (prop === 'pricecurrency' || prop === 'product:price:currency' || prop === 'currency')) {
        result.currency = value;
      } else if (result.inStock === null && (prop === 'availability' || prop === 'product:availability')) {
        result.rawInStock = value;
        result.inStock = !value.toLowerCase().includes('outofstock');
      }
    }


    if (!result.price && EXTRACTION_CONFIG.microdataPatternInverse) {
      const inverseRegex = new RegExp(
        EXTRACTION_CONFIG.microdataPatternInverse.source,
        EXTRACTION_CONFIG.microdataPatternInverse.flags
      );

      while ((match = inverseRegex.exec(html)) !== null) {
        const value = match[1];
        const prop = match[2].toLowerCase();

        if ((prop === 'price' || prop === 'product:price:amount') && !result.price) {
          const price = parseFloat(value);
          if (!isNaN(price) && price > 0) {
            result.price = price;
            result.rawPrice = value;
          }
        } else if (!result.currency && (prop === 'pricecurrency' || prop === 'product:price:currency' || prop === 'currency')) {
          result.currency = value;
        } else if (result.inStock === null && (prop === 'availability' || prop === 'product:availability')) {
          result.rawInStock = value;
          result.inStock = !value.toLowerCase().includes('outofstock');
        }
      }
    }
  } catch (e) {
    logDebug('Microdata extraction error:', e);
  }

  logDebug('Microdata result:', result);
  return result.price ? result : null;
}









function extractWithRegex(html, storeConfig) {
  if (!storeConfig || !storeConfig.selectors_checkPrice || storeConfig.selectors_checkPrice.length === 0) {
    return null;
  }

  const result = { price: null, rawPrice: null, selectorErrors: [], successKey: null };

  for (const pattern of storeConfig.selectors_checkPrice) {

    if (isRegexPattern(pattern)) {
      const regexStr = pattern.slice(1, pattern.lastIndexOf('/'));
      const flags = pattern.slice(pattern.lastIndexOf('/') + 1) || '';

      try {
        const regex = new RegExp(regexStr, flags);
        const match = regex.exec(html);
        if (match && match[1]) {
          const price = parsePrice(match[1]);
          if (price) {
            result.price = price;
            result.rawPrice = String(match[1]);
            result.successKey = `selectors_checkPrice:${pattern}`;
            logDebug('Regex extraction match:', pattern, '->', price);
            return result;
          }
          addSelectorError(result.selectorErrors, "selectors_checkPrice", "parse_failed", pattern);
        }
      } catch (e) {
        logDebug('Regex pattern error:', pattern, e);
        addSelectorError(result.selectorErrors, "selectors_checkPrice", "invalid_regex", pattern);
      }
    } else {

      try {
        const cleanedPattern = cleanSelector(pattern);
        if (!cleanedPattern) {
          addSelectorError(result.selectorErrors, "selectors_checkPrice", "invalid_selector", pattern);
          continue;
        }
        const elements = document.querySelectorAll(cleanedPattern);
        if (elements.length > 0) {
          const maxMatches = getSelectorMatchLimit(storeConfig);
          if (elements.length > maxMatches) {
            addSelectorError(result.selectorErrors, "selectors_checkPrice", "found_too_many", pattern);
          }

          const scanLimit = Math.min(elements.length, maxMatches);
          const candidates = [];
          for (let i = 0; i < scanLimit; i++) {
            const el = elements[i];
            const content = getElementStringValue(el, "content");
            const price = parsePrice(content || el.textContent);
            if (price) {
              candidates.push({
                price,
                raw: content || el.textContent || null,
              });
            }
          }

          if (candidates.length > 0) {
            const uniquePrices = Array.from(new Set(candidates.map((entry) => entry.price)));
            if (uniquePrices.length > 1) {
              addSelectorError(result.selectorErrors, "selectors_checkPrice", "found_too_many", pattern);
              continue;
            }

            result.price = candidates[0].price;
            result.rawPrice = candidates[0].raw;
            result.successKey = `selectors_checkPrice:${pattern}`;
            logDebug('CSS checkPrice match:', pattern, '->', result.price);
            return result;
          }

          addSelectorError(result.selectorErrors, "selectors_checkPrice", "parse_failed", pattern);
        } else {
          addSelectorError(result.selectorErrors, "selectors_checkPrice", "not_found", pattern);
        }
      } catch (e) {
        logDebug('CSS checkPrice error:', pattern, e);
        addSelectorError(result.selectorErrors, "selectors_checkPrice", "query_error", pattern);
      }
    }
  }

  return result.price ? result : result;
}









function extractWithSelectors(storeConfig) {
  if (!storeConfig || !storeConfig.selectors_inject || storeConfig.selectors_inject.length === 0) {
    return null;
  }

  const result = { price: null, rawPrice: null, selectorErrors: [], successKey: null };

  for (const selector of storeConfig.selectors_inject) {
    try {

      const cleanedSelector = cleanSelector(selector);
      if (!cleanedSelector) {
        addSelectorError(result.selectorErrors, "selectors_inject", "invalid_selector", selector);
        continue;
      }

      const elements = document.querySelectorAll(cleanedSelector);
      if (elements.length === 0) {
        addSelectorError(result.selectorErrors, "selectors_inject", "not_found", selector);
        continue;
      }
      const maxMatches = getSelectorMatchLimit(storeConfig);
      if (elements.length > maxMatches) {
        addSelectorError(result.selectorErrors, "selectors_inject", "found_too_many", selector);
      }



      const ltMatch = selector.match(/:lt\((\d+)\)/);
      const limitFromSelector = ltMatch ? parseInt(ltMatch[1]) : elements.length;
      const limit = Math.min(limitFromSelector, maxMatches);
      const candidates = [];

      for (let i = 0; i < Math.min(limit, elements.length); i++) {
        const el = elements[i];


        if (el.offsetParent === null && el.style.display !== 'contents') continue;


        const text = getElementStringValue(el, "content");
        const price = parsePrice(text);

        if (price) {
          candidates.push({
            price,
            raw: text,
          });
        }
      }

      if (candidates.length > 0) {
        const uniquePrices = Array.from(new Set(candidates.map((entry) => entry.price)));
        if (uniquePrices.length > 1) {
          addSelectorError(result.selectorErrors, "selectors_inject", "found_too_many", selector);
          continue;
        }

        result.price = candidates[0].price;
        result.rawPrice = candidates[0].raw;
        result.successKey = `selectors_inject:${selector}`;
        logDebug('CSS selector match:', selector, '->', result.price, `(text: "${String(result.rawPrice || "").substring(0, 50)}")`);
        return result;
      }

      addSelectorError(result.selectorErrors, "selectors_inject", "parse_failed", selector);
    } catch (e) {
      logDebug('CSS selector error:', selector, e.message);
      addSelectorError(result.selectorErrors, "selectors_inject", "query_error", selector);
    }
  }

  return result.price ? result : result;
}





function cleanSelector(selector) {
  try {
    let cleaned = selector;

    cleaned = cleaned.replace(/:Contains\([^)]*\)/gi, '');

    cleaned = cleaned.replace(/:lt\(\d+\)/gi, '');

    cleaned = cleaned.replace(/:visible/gi, '');

    cleaned = cleaned.replace(/:contains\([^)]*\)/gi, '');

    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned || null;
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
    return null;
  }
}









function checkStock(storeConfig, html) {
  if (!storeConfig) return null;

  let inStock = null;
  let outOfStock = null;


  if (storeConfig.pattern_inStock && storeConfig.pattern_inStock.length > 0) {
    for (const pattern of storeConfig.pattern_inStock) {
      if (testPattern(pattern, html)) {
        inStock = true;
        logDebug('In-stock pattern match:', pattern);
        break;
      }
    }
  }


  if (storeConfig.pattern_outOfStock && storeConfig.pattern_outOfStock.length > 0) {
    for (const pattern of storeConfig.pattern_outOfStock) {
      if (testPattern(pattern, html)) {
        outOfStock = true;
        logDebug('Out-of-stock pattern match:', pattern);
        break;
      }
    }
  }


  if (outOfStock === true) return false;
  if (inStock === true) return true;
  return null; 
}

function extractRawStockText(storeConfig) {
  if (!storeConfig) return null;
  const patterns = [
    ...(Array.isArray(storeConfig.pattern_inStock) ? storeConfig.pattern_inStock : []),
    ...(Array.isArray(storeConfig.pattern_outOfStock) ? storeConfig.pattern_outOfStock : []),
  ];

  for (const pattern of patterns) {
    if (isRegexPattern(pattern)) continue;
    try {
      const cleaned = cleanSelector(pattern);
      if (!cleaned) continue;
      const el = document.querySelector(cleaned);
      if (!el) continue;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (text) return text.slice(0, 160);
    } catch (e) {
      if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
    }
  }

  return null;
}

function isDynamicClass(cls) {
  if (!cls || cls.length > 40) return true;
  if (/^(css-|sc-|_|jsx-|emotion-|styled-|svelte-)/.test(cls)) return true;
  if (/^[0-9]/.test(cls)) return true;
  if (/^[a-z]{1,2}[A-Z0-9][a-zA-Z0-9]{3,}$/.test(cls)) return true;
  return false;
}

function isDynamicId(id) {
  if (!id) return true;
  if (/[0-9]{5,}/.test(id)) return true;
  if (/^[a-f0-9]{8,}$/i.test(id)) return true;
  if (/^(ember|react|vue|ng)-/.test(id)) return true;
  return false;
}

function buildStableSelector(el) {
  if (!el || !el.tagName) return null;

  var parts = [];
  var current = el;
  var depth = 0;

  while (current && current !== document.body && depth < 4) {
    var tag = String(current.tagName || "").toLowerCase();
    if (!tag) break;

    var itemprop = current.getAttribute ? current.getAttribute("itemprop") : null;
    if (itemprop) {
      parts.unshift(tag + '[itemprop="' + itemprop + '"]');
      break;
    }

    if (current.hasAttribute && current.hasAttribute("data-price")) {
      parts.unshift(tag + "[data-price]");
      break;
    }

    var classes = Array.from(current.classList || [])
      .filter(function (cls) {
        return !isDynamicClass(cls);
      })
      .slice(0, 2);

    if (classes.length > 0) {
      parts.unshift(tag + "." + classes.join("."));
    } else if (current.id && !isDynamicId(current.id)) {
      parts.unshift(tag + "#" + current.id);
    } else {
      parts.unshift(tag);
    }

    current = current.parentElement;
    depth += 1;
  }

  var selector = parts.join(" > ");
  if (!selector) return null;

  if (
    selector.length < 5 ||
    (!selector.includes(".") && !selector.includes("[") && !selector.includes("#"))
  ) {
    return null;
  }

  return selector.slice(0, 200);
}

function discoverCandidateSelectors(knownPrice, failedKeys) {
  if (!knownPrice || knownPrice <= 0 || !Array.isArray(failedKeys) || failedKeys.length === 0) {
    return [];
  }

  var candidates = [];
  var checked = 0;
  var MAX_ELEMENTS = 3000;
  var elements = document.querySelectorAll(
    "span, div, p, strong, b, em, ins, meta[itemprop], [data-price]"
  );

  for (var i = 0; i < elements.length && checked < MAX_ELEMENTS; i++) {
    var el = elements[i];
    checked += 1;

    if (!el || !el.tagName) continue;
    if (el.tagName !== "META" && el.offsetParent === null) continue;
    if (el.children && el.children.length > 3) continue;

    var text = "";
    if (el.tagName === "META") {
      text = el.getAttribute("content") || "";
    } else {
      text = (el.textContent || "").trim();
    }

    if (!text || text.length > 60) continue;

    var parsed = parsePrice(text);
    if (!parsed || parsed <= 0) continue;
    if (Math.abs(parsed - knownPrice) > 0.02) continue;

    var selector = buildStableSelector(el);
    if (!selector) continue;

    if (
      candidates.some(function (entry) {
        return entry.candidateSelector === selector;
      })
    ) {
      continue;
    }

    candidates.push({
      candidateSelector: selector,
      extractedValue: parsed,
    });

    if (candidates.length >= 3) break;
  }

  return candidates;
}






function testPattern(pattern, html) {
  if (isRegexPattern(pattern)) {

    const regexStr = pattern.slice(1, pattern.lastIndexOf('/'));
    const flags = pattern.slice(pattern.lastIndexOf('/') + 1) || '';
    try {
      const regex = new RegExp(regexStr, flags);
      return regex.test(html || document.documentElement.outerHTML);
    } catch (e) {
      if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
      return false;
    }
  } else {

    try {
      const cleaned = cleanSelector(pattern);
      if (!cleaned) return false;


      const containsMatch = pattern.match(/:Contains\("([^"]*)"\)/i);
      if (containsMatch) {
        const textToFind = containsMatch[1].toLowerCase();
        const elements = document.querySelectorAll(cleaned);
        for (const el of elements) {
          if (el.textContent.toLowerCase().includes(textToFind)) {
            return true;
          }
        }
        return false;
      }


      const jqContainsMatch = pattern.match(/:contains\("([^"]*)"\)/i);
      if (jqContainsMatch) {
        const textToFind = jqContainsMatch[1].toLowerCase();
        const elements = document.querySelectorAll(cleaned);
        for (const el of elements) {
          if (el.textContent.toLowerCase().includes(textToFind)) {
            return true;
          }
        }
        return false;
      }

      return document.querySelector(cleaned) !== null;
    } catch (e) {
      if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
      return false;
    }
  }
}




function isRegexPattern(pattern) {
  return typeof pattern === 'string' && pattern.startsWith('/') && pattern.lastIndexOf('/') > 0;
}









function extractTitle() {
  function normalizeTitle(value) {
    if (!value) return null;
    let t = String(value).replace(/\s+/g, ' ').trim();

    t = t.replace(/\s*-\s*eMAG\.ro\s*$/i, '').replace(/\s*\|\s*eMAG\.ro\s*$/i, '').trim();
    if (t.length < 4 || t.length > 500) return null;
    return t;
  }

  function isBadTitle(text) {
    if (!text) return true;
    const t = String(text).toLowerCase().trim();
    if (!t) return true;

    const bad = [
      'vezi toate produsele',
      'vezi toate ofertele',
      'vezi toate',
      'vezi produsul',
      'vezi detalii',
      'cumpara impreuna',
      'cumpara Ã®mpreuna',
      'resigilate',
      'resigilat',
      'produse similare',
      'produse recomandate',
      'inapoi',
      'Ã®napoi',
    ];
    if (bad.includes(t)) return true;

    if (/^(vezi|cumpara|resigilat|resigilate)\b/i.test(t)) return true;
    return false;
  }


  const metaCandidates = [
    document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
  ]
    .map(normalizeTitle)
    .filter((t) => t && !isBadTitle(t));
  if (metaCandidates.length > 0) return metaCandidates[0];

  const selectors = [

    'h1.page-title',
    '.page-title h1',

    'h1.product-title',
    'h1[class*="product-title"]',
    'h1[class*="product-name"]',
    'h1[itemprop="name"]',
    '[data-testid="productName"]',
    'h1'
  ];

  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const text = normalizeTitle(el.textContent);
        if (text && !isBadTitle(text)) return text;
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }

  const docTitle = normalizeTitle(document.title);
  if (docTitle && !isBadTitle(docTitle)) return docTitle;
  return null;
}

function normalizeProductTitleCandidate(value) {
  if (!value) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (text.length < 4 || text.length > 500) return null;
  return text;
}

function isLikelyKeywordStuffedTitle(value) {
  const text = normalizeProductTitleCandidate(value);
  if (!text) return true;
  const lower = text.toLowerCase();





  const commaCount = (lower.match(/,/g) || []).length;
  if (commaCount > 8) return true; 


  const parts = lower
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);

  if (parts.length >= 4) {


    const uniqueParts = new Set(parts);

    if (uniqueParts.size <= Math.ceil(parts.length * 0.4)) return true;
  }


  const words = lower
    .split(/[^a-z0-9ăâîșşțţ]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);

  if (words.length >= 15) {

    const uniqueWords = new Set(words);
    if (uniqueWords.size <= Math.ceil(words.length * 0.45)) return true;
  }

  return false;
}

function shouldPreferTitleCandidate(currentTitle, candidateTitle) {
  const current = normalizeProductTitleCandidate(currentTitle);
  const candidate = normalizeProductTitleCandidate(candidateTitle);
  if (!candidate) return false;
  if (!current) return true;

  const currentStuffed = isLikelyKeywordStuffedTitle(current);
  const candidateStuffed = isLikelyKeywordStuffedTitle(candidate);
  if (currentStuffed && !candidateStuffed) return true;
  if (!currentStuffed && candidateStuffed) return false;

  const currentCommaCount = (current.match(/,/g) || []).length;
  const candidateCommaCount = (candidate.match(/,/g) || []).length;
  if (currentCommaCount >= 3 && candidateCommaCount <= 1) return true;


  if (candidate.length > current.length + 80) return false;
  if (candidate.length >= Math.floor(current.length * 0.65)) return candidate.length >= current.length;
  return false;
}




function extractImage() {
  function isRejectedProductImageUrl(src) {
    const lower = String(src || '').trim().toLowerCase();
    if (!lower) return true;
    return (
      /\/label_\d+/i.test(lower) ||
      /[/\\](?:energy[-_]?label|eticheta[-_]?energetica|fisa[-_]?energetica)\b/i.test(lower) ||
      /(?:^|[\/_.-])eprel(?:[\/_.-]|$)/i.test(lower)
    );
  }

  function isBadImageContext(el) {
    if (!el || !el.closest) return false;
    return Boolean(
      el.closest('.panel-resealed, .panel-resealed-products, #resigilate') ||
      el.closest('.panel-offers-container, .panel-offers-bundle, .bf-panel-offers-bundle, .bf-offer, .js-pac-bundle') ||
      el.closest('[data-type="FREQUENTLY_BOUGHT_TOGETHER"]')
    );
  }

  function readCandidateImageSrc(el) {
    if (!el) return null;
    const src = el.getAttribute('data-zoom-image') ||
                el.getAttribute('data-src') ||
                el.currentSrc ||
                el.src;
    if (!src || !src.startsWith('http')) return null;
    if (src.includes('placeholder') || src.includes('data:image')) return null;
    if (isRejectedProductImageUrl(src)) return null;
    return src;
  }

  function pickImageBySelectors(selectors) {
    for (const sel of selectors) {
      try {
        const nodes = Array.from(document.querySelectorAll(sel));
        for (const el of nodes) {
          if (isBadImageContext(el)) continue;
          const src = readCandidateImageSrc(el);
          if (src) return src;
        }
      } catch (e) {
        if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
      }
    }
    return null;
  }

  const host = String(window.location.hostname || '').toLowerCase();
  const isAltexFamily = /(^|\.)altex\.ro$|(^|\.)mediagalaxy\.ro$/.test(host);

  if (isAltexFamily) {
    const altexHeroImage = pickImageBySelectors([
      '.swiper-slide-active .swiper-zoom-container img[src*="/media/catalog/product/"]',
      '.swiper-slide-active img[src*="/media/catalog/product/"]',
      '.swiper-zoom-container img[src*="/media/catalog/product/"]',
      'img[src*="/media/catalog/product/"]',
    ]);
    if (altexHeroImage) return altexHeroImage;
  }


  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const src = ogImage.getAttribute('content');
    if (src && src.startsWith('http') && !isRejectedProductImageUrl(src)) return src;
  }


  const selectors = [
    'img[itemprop="image"]',

    '.product-gallery img',
    '.product-gallery-image img',
    '.product-gallery-image img',
    '.product-page-gallery img',
    'img[data-zoom-image]',
    '.product-images-wrapper img',

    'main img[src*="http"]'
  ];

  const genericImage = pickImageBySelectors(selectors);
  if (genericImage) return genericImage;

  return null;
}











function waitForContent(storeConfig, options = {}) {
  return new Promise((resolve) => {
    const opts = options && typeof options === 'object' ? options : {};
    const defaultMaxCounter = (typeof EXTRACTION_CONFIG !== 'undefined' && EXTRACTION_CONFIG.waitForMaxCounter) || 15;
    const defaultInterval = (typeof EXTRACTION_CONFIG !== 'undefined' && EXTRACTION_CONFIG.waitForInterval) || 1000;
    const defaultMinContentSize = (typeof EXTRACTION_CONFIG !== 'undefined' && EXTRACTION_CONFIG.waitForMinContentSize) || 5000;
    const maxCounter = Number.isFinite(opts.maxCounter) && opts.maxCounter > 0
      ? Math.max(1, Math.floor(opts.maxCounter))
      : defaultMaxCounter;
    const interval = Number.isFinite(opts.interval) && opts.interval > 0
      ? Math.max(100, Math.floor(opts.interval))
      : defaultInterval;
    const minContentSize = Number.isFinite(opts.minContentSize) && opts.minContentSize > 0
      ? Math.max(500, Math.floor(opts.minContentSize))
      : defaultMinContentSize;
    const skipWaitForSelectors = Boolean(opts.skipWaitForSelectors);
    const effectiveWaitForSelectors = Array.isArray(opts.waitForSelectors)
      ? opts.waitForSelectors
      : (storeConfig && Array.isArray(storeConfig.selectors_inject_waitFor)
        ? storeConfig.selectors_inject_waitFor
        : []);


    const maxWaitTimeMs = maxCounter * interval;

    let counter = 0;
    let contentGateTimedOut = false;
    let selectorGateTimedOut = false;
    let lastContentSize = 0;
    const hasWaitForSelectors = Boolean(
      !skipWaitForSelectors &&
      effectiveWaitForSelectors &&
      effectiveWaitForSelectors.length > 0
    );

    let observer = null;
    let timeoutId = null;
    let isFinished = false;

    function finish(isTimeout) {
      if (isFinished) return;
      isFinished = true;

      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (isTimeout) {
        if (lastContentSize < minContentSize) contentGateTimedOut = true;
        selectorGateTimedOut = hasWaitForSelectors && !checkSelectors();
      }

      logDebug(`Content ready after ${counter} checks`);
      resolve({
        ready: true,
        checks: counter,
        contentSize: lastContentSize,
        minContentSize,
        maxCounter,
        interval,
        hasWaitForSelectors,
        contentGateTimedOut,
        selectorGateTimedOut,
        timedOut: contentGateTimedOut || selectorGateTimedOut,
      });
    }

    function checkSelectors() {
      if (!hasWaitForSelectors) return true;
      for (const selector of effectiveWaitForSelectors) {
        try {
          const cleaned = cleanSelector(selector);
          if (cleaned && document.querySelector(cleaned)) {
            return true;
          }
        } catch (e) {  }
      }
      return false;
    }

    function check() {
      if (isFinished) return false;
      counter++;


      const contentSize = document.documentElement.innerHTML.length;
      lastContentSize = contentSize;

      if (contentSize < minContentSize) {
        logDebug(`Content too small (${contentSize} < ${minContentSize}), waiting for mutations...`);
        return false;
      }


      if (hasWaitForSelectors) {
        const found = checkSelectors();
        if (!found) {
          logDebug(`WaitFor selectors not found, waiting for mutations...`);
          return false;
        }
      }

      return true; 
    }


    let pendingCheck = null;
    function scheduleCheck() {
      if (isFinished) return;
      if (!pendingCheck) {
        pendingCheck = setTimeout(() => {
          pendingCheck = null;
          if (check()) {
            finish(false);
          }
        }, 150); 
      }
    }


    setTimeout(() => {
      if (check()) {
        finish(false);
      } else {

        observer = new MutationObserver(() => {
          scheduleCheck();
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'id']
        });


        timeoutId = setTimeout(() => {
          finish(true);
        }, maxWaitTimeMs);
      }
    }, 500);
  });
}










function extractIdentifiersFromNextData() {
  try {
    var el = document.getElementById('__NEXT_DATA__');
    if (!el) return null;

    var data = parseJsonSafely(el.textContent || '', '__NEXT_DATA__');
    if (!data || typeof data !== 'object') return null;

    var result = { mpn: null, ean: null, gtin: null };


    var candidates = [
      data.props && data.props.pageProps && data.props.pageProps.initialData && data.props.pageProps.initialData.product,
      data.props && data.props.pageProps && data.props.pageProps.product,
      data.props && data.props.pageProps && data.props.pageProps.data && data.props.pageProps.data.product,
      data.props && data.props.pageProps && data.props.pageProps.productData,
    ].filter(Boolean);

    for (var ci = 0; ci < candidates.length; ci++) {
      var product = candidates[ci];


      if (!result.mpn && product.mpn && typeof product.mpn === 'string') {
        var mpnDirect = product.mpn.trim();
        if (isStructuredMpnCode(mpnDirect)) result.mpn = mpnDirect;
      }
      if (!result.ean) {
        var eanRaw = product.ean || product.gtin13 || product.gtin || product.barcode;
        if (eanRaw) {
          var directCandidate = extractGtinCandidate(String(eanRaw));
          if (directCandidate.ean) result.ean = directCandidate.ean;
          if (directCandidate.gtin && !result.gtin) result.gtin = directCandidate.gtin;
        }
      }


      var specGroups = product.characteristics || product.specifications ||
                       product.attributes || product.specs || product.features || [];
      var groups = Array.isArray(specGroups) ? specGroups : [];

      for (var gi = 0; gi < groups.length; gi++) {
        var group = groups[gi];
        var items = group.items || group.characteristics || group.values ||
                    group.attributes || group.specs || [];
        var itemList = Array.isArray(items) ? items : [];

        for (var ii = 0; ii < itemList.length; ii++) {
          var item = itemList[ii];
          var label = String(item.name || item.label || item.key || '').trim();
          var value = String(item.value || item.text || item.val || '').trim();

          if (!label || !value || value.length < 3 || value.length > 60) continue;


          if (!result.mpn && /cod\s+produc[a\u0103]tor|manufacturer.*code|part\s*number|model\s+produc[a\u0103]tor|numar\s+model/i.test(label)) {
            if (isStructuredMpnCode(value)) {
              result.mpn = value;
            }
          }


          if (!result.ean && /^ean$|^gtin|cod\s+de\s+bare|barcode/i.test(label)) {
            var eanCandidate = extractGtinCandidate(value);
            if (eanCandidate.ean) result.ean = eanCandidate.ean;
            if (eanCandidate.gtin && !result.gtin) result.gtin = eanCandidate.gtin;
          }
        }
      }

      if (result.mpn && result.ean) break;
    }

    return (result.mpn || result.ean || result.gtin) ? result : null;
  } catch (e) {
    logDebug('__NEXT_DATA__ identifier extraction error:', e);
    return null;
  }
}






function extractIdentifiersFromScriptJson() {
  try {
    var result = { ean: null, gtin: null };


    try {
      if (typeof EM !== 'undefined') {
        var emProduct = EM.product || EM.productData;
        if (emProduct && typeof emProduct === 'object') {
          var emEan = emProduct.ean || emProduct.gtin13 || emProduct.gtin || emProduct.barcode;
          if (emEan) {
            var emCandidate = extractGtinCandidate(String(emEan));
            if (emCandidate.ean) result.ean = emCandidate.ean;
            if (emCandidate.gtin && !result.gtin) result.gtin = emCandidate.gtin;
            if (result.ean) return result;
          }
        }
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }


    var scripts = document.querySelectorAll('script:not([src])');
    var eanPatterns = [
      /"ean"\s*:\s*"(\d{8,14})"/,
      /"gtin13"\s*:\s*"(\d{13})"/,
      /"gtin"\s*:\s*"(\d{8,14})"/,
      /"barcode"\s*:\s*"(\d{8,14})"/,
      /"cod_bare"\s*:\s*"(\d{8,14})"/,
      /"part_number"\s*:\s*"(\d{8,14})"/,
    ];

    for (var si = 0; si < scripts.length; si++) {
      var text = scripts[si].textContent || '';
      if (text.length < 20 || text.length > 500000) continue;

      for (var pi = 0; pi < eanPatterns.length; pi++) {
        var match = text.match(eanPatterns[pi]);
        if (match && match[1]) {
          var candidate = extractGtinCandidate(match[1]);
          if (candidate.ean) {
            result.ean = candidate.ean;
            if (candidate.gtin) result.gtin = candidate.gtin;
            return result;
          }
          if (candidate.gtin && !result.gtin) {
            result.gtin = candidate.gtin;
          }
        }
      }
    }

    return (result.ean || result.gtin) ? result : null;
  } catch (e) {
    logDebug('Script JSON identifier extraction error:', e);
    return null;
  }
}






function extractColorFromUrl(url) {
  if (!url) return null;

  try {
    var pathname = new URL(url).pathname;

    var slug = pathname
      .replace(/\.html?$/i, '')
      .split('/')
      .filter(Boolean)
      .pop();

    if (!slug) return null;

    var parts = slug.split('-');
    if (parts.length < 3) return null;


    var colorMap = {
      'negru': 'negru', 'black': 'negru',
      'alb': 'alb', 'white': 'alb',
      'rosu': 'rosu', 'red': 'rosu',
      'albastru': 'albastru', 'blue': 'albastru',
      'gri': 'gri', 'grey': 'gri', 'gray': 'gri',
      'verde': 'verde', 'green': 'verde',
      'mov': 'mov', 'purple': 'mov', 'violet': 'mov',
      'roz': 'roz', 'pink': 'roz',
      'argintiu': 'argintiu', 'silver': 'argintiu',
      'auriu': 'auriu', 'gold': 'auriu',
      'galben': 'galben', 'yellow': 'galben',
      'portocaliu': 'portocaliu', 'orange': 'portocaliu',
      'crem': 'crem', 'cream': 'crem',
      'maro': 'maro', 'brown': 'maro',
      'bej': 'bej', 'beige': 'bej',
      'bordo': 'bordo', 'burgundy': 'bordo',
      'turcoaz': 'turcoaz', 'turquoise': 'turcoaz',
      'coral': 'coral',
      'titan': 'titan', 'titanium': 'titan',
      'navy': 'navy',
      'indigo': 'indigo',
      'magenta': 'magenta',
    };


    var lastOne = parts[parts.length - 1].toLowerCase();
    if (colorMap[lastOne]) return colorMap[lastOne];


    if (parts.length >= 4) {
      var secondLast = parts[parts.length - 2].toLowerCase();
      if (colorMap[secondLast]) return colorMap[secondLast];
    }

    return null;
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
    return null;
  }
}









function extractIdentifiers(storeConfig) {
  const identifiers = { mpn: null, ean: null, gtin: null, brand: null, sku: null };
  const codeLabelPattern = "(?:Cod(?:\\s+(?:produs|produc(?:ator|\\u0103tor)|model(?:\\s+produc(?:ator|\\u0103tor))?))?(?!\\s+intern)|SKU|MPN|Part\\s*(?:Number|No)|Model(?:ul)?)";
  const codeLabelRegex = new RegExp(`(?:^|\\b)${codeLabelPattern}\\b`, "i");
  const eanLabelRegex = /(?:^|\b)(?:ean|gtin|barcode|cod\s+de\s+bare)\b/i;

  function cleanCodeValue(raw) {
    if (!raw) return null;
    let value = String(raw).replace(/\s+/g, " ").trim();
    if (!value) return null;
    if (value.endsWith(":")) return null;
    if (
      /^(?:cod(?:\s+(?:produs|produc(?:ator|\u0103tor)|model))?|sku|mpn|part\s*(?:number|no)|model(?:ul)?)[:\s]*$/i.test(
        value,
      )
    ) {
      return null;
    }


    const labeled = value.match(new RegExp(`(?:^|\\b)${codeLabelPattern}\\s*[:\\s]\\s*([A-Z0-9][\\w\\-\\/\\.]{2,30})\\b`, "i"));
    if (labeled && labeled[1]) return labeled[1].trim();


    if (codeLabelRegex.test(value)) {
      const matches = value.match(/[A-Z0-9][\w\-\/\.]{2,30}/gi);
      if (matches && matches.length > 0) return matches[matches.length - 1].trim();
    }

    return value;
  }

  function isLikelyStructuredMpnCode(value) {
    if (!value) return false;
    const compact = String(value).replace(/[\s\/\-_.]/g, "").trim();
    if (compact.length < 5 || compact.length > 30) return false;
    if (!/[a-z]/i.test(compact)) return false;
    if (!/\d/.test(compact)) return false;
    return true;
  }


  if (storeConfig && Array.isArray(storeConfig.identifierSelectors)) {
    for (const sel of storeConfig.identifierSelectors) {
      try {
        const field = typeof sel?.field === "string" ? sel.field.trim() : "";
        const selector = typeof sel?.selector === "string" ? sel.selector.trim() : "";
        if (!field || !selector) continue;
        if (!Object.prototype.hasOwnProperty.call(identifiers, field)) continue;

        const rawValues = [];
        const jsonPath = typeof sel?.jsonPath === "string" ? sel.jsonPath.trim() : "";

        if (jsonPath) {
          const nodes = Array.from(document.querySelectorAll(selector)).slice(0, 8);
          for (const node of nodes) {
            const rawJson = getElementStringValue(node, sel.attribute);
            if (!rawJson) continue;
            const extracted = extractJsonSelectorValues(rawJson, jsonPath);
            for (const value of extracted) {
              rawValues.push(value);
              if (rawValues.length >= 20) break;
            }
            if (rawValues.length >= 20) break;
          }
        } else {
          const el = document.querySelector(selector);
          if (!el) continue;
          const raw = getElementStringValue(el, sel.attribute);
          if (!raw) continue;
          rawValues.push(raw);
        }

        for (const raw of rawValues) {
          if (!raw) continue;
          if (field === "ean" || field === "gtin") {
            const gtinCandidate = extractGtinCandidate(raw);
            if (field === "ean") {
              if (gtinCandidate.ean) identifiers.ean = gtinCandidate.ean;
              else if (gtinCandidate.gtin && !identifiers.gtin) identifiers.gtin = gtinCandidate.gtin;
            } else if (gtinCandidate.gtin) {
              identifiers.gtin = gtinCandidate.gtin;
              if (gtinCandidate.ean && !identifiers.ean) identifiers.ean = gtinCandidate.ean;
            }
            continue;
          }

          const value =
            field === "mpn" || field === "sku" ? cleanCodeValue(raw) : String(raw).trim();
          if (field === "mpn" && !isLikelyStructuredMpnCode(value)) {
            continue;
          }
          if (value && value.length > 0 && value.length < 100 && identifiers[field] == null) {
            identifiers[field] = value;
          }
        }
      } catch (e) {
        logDebug('Identifier selector error:', sel?.selector, e);
      }
    }
  }


  if (!identifiers.mpn) {
    const mpnSelectors = [
      'span.product-code-display',
      '[itemprop="mpn"]',
      '[itemprop="sku"]',
      '[data-testid="product-code"]'
    ];
    for (const sel of mpnSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const value = cleanCodeValue(getElementStringValue(el, "content"));
          if (value && value.length > 2 && value.length < 80 && isLikelyStructuredMpnCode(value)) {
            identifiers.mpn = value;
            break;
          }
        }
      } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
    }
  }


  if (!identifiers.mpn) {
    try {
      const modelEl = document.querySelector('h3.model');
      if (modelEl) {
        const parentText = String(modelEl.parentElement?.textContent || "").replace(/\s+/g, " ").trim();
        if (/(?:^|\b)Cod\b(?!\s+intern)/i.test(parentText)) {
          const modelCode = cleanCodeValue(modelEl.textContent || "");
          if (modelCode && modelCode.length > 2 && modelCode.length < 80 && isLikelyStructuredMpnCode(modelCode)) {
            identifiers.mpn = modelCode;
          }
        }
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }


  if (!identifiers.mpn) {
    try {
      const allElements = document.querySelectorAll('p, span, div, li, td');
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text.length > 200) continue;

        const match = text.match(new RegExp(`(?:${codeLabelPattern})[:\\s]+([A-Z0-9][\\w\\-\\/\\.]{2,30})`, "i"));
        if (match && match[1]) {

          const childSpan = el.querySelector('span');
          if (childSpan) {
            const childText = childSpan.textContent.trim();
            if (childText && childText.length > 2 && childText.length < 50 && isLikelyStructuredMpnCode(childText)) {
              identifiers.mpn = childText;
              break;
            }
          }
          const matchedCode = match[1].trim();
          if (isLikelyStructuredMpnCode(matchedCode)) {
            identifiers.mpn = matchedCode;
            break;
          }
        }
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }


  if (!identifiers.mpn) {
    try {
      const rows = document.querySelectorAll('.row, tr, li');
      for (const row of rows) {
        let labelEl = row.querySelector('.char-name, th, .label, dt, .name');
        let valueEl = row.querySelector('.char-value, td, .value, dd');

        if (!labelEl || !valueEl) {
          const tdCells = row.querySelectorAll('td');
          if (tdCells.length >= 2) {
            labelEl = labelEl || tdCells[0];
            valueEl = valueEl || tdCells[1];
          }
        }

        if (!labelEl || !valueEl) continue;

        const labelText = String(labelEl.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!codeLabelRegex.test(labelText)) {
          continue;
        }

        const code = cleanCodeValue(getElementStringValue(valueEl, "content"));
        if (code && code.length > 2 && code.length < 80 && isLikelyStructuredMpnCode(code)) {
          identifiers.mpn = code;
          break;
        }
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }


  if (!identifiers.mpn || !identifiers.ean) {
    try {
      var nextDataIds = extractIdentifiersFromNextData();
      if (nextDataIds) {
        if (!identifiers.mpn && nextDataIds.mpn && isLikelyStructuredMpnCode(nextDataIds.mpn)) {
          identifiers.mpn = nextDataIds.mpn;
        }
        if (!identifiers.ean && nextDataIds.ean) identifiers.ean = nextDataIds.ean;
        if (!identifiers.gtin && nextDataIds.gtin) identifiers.gtin = nextDataIds.gtin;
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }


  if (!identifiers.ean) {
    try {
      const gtinEls = document.querySelectorAll(
        '[itemprop="gtin13"], meta[itemprop="gtin13"], [itemprop="gtin"], meta[itemprop="gtin"], [itemprop="gtin8"], meta[itemprop="gtin8"]'
      );
      for (const el of gtinEls) {
        const candidate = extractGtinCandidate(getElementStringValue(el, "content"));
        if (candidate.ean) identifiers.ean = candidate.ean;
        if (!identifiers.gtin && candidate.gtin) identifiers.gtin = candidate.gtin;
        if (identifiers.ean) break;
      }

      if (identifiers.ean) {

      } else {
        const rows = document.querySelectorAll('tr, .row, li');
        for (const row of rows) {
          let labelEl = row.querySelector('th, .char-name, .label, dt, .name');
          let valueEl = row.querySelector('td, .char-value, .value, dd');

          if (!labelEl || !valueEl) {
            const tdCells = row.querySelectorAll('td');
            if (tdCells.length >= 2) {
              labelEl = labelEl || tdCells[0];
              valueEl = valueEl || tdCells[1];
            }
          }

          if (!labelEl || !valueEl) continue;

          const labelText = String(labelEl.textContent || "").replace(/\s+/g, " ").trim();
          if (!eanLabelRegex.test(labelText)) continue;

          const candidate = extractGtinCandidate(getElementStringValue(valueEl, "content"));
          if (candidate.ean) identifiers.ean = candidate.ean;
          if (!identifiers.gtin && candidate.gtin) identifiers.gtin = candidate.gtin;
          if (identifiers.ean) break;
        }
      }

      if (!identifiers.ean) {
      const allElements = document.querySelectorAll('p, span, div, li, td, tr');
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text.length > 200) continue;

        if (!eanLabelRegex.test(text)) continue;
        const candidate = extractGtinCandidate(text);
        if (candidate.ean) {
          identifiers.ean = candidate.ean;
          if (!identifiers.gtin && candidate.gtin) identifiers.gtin = candidate.gtin;
          break;
        }
      }
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }

  if (!identifiers.gtin && identifiers.ean) identifiers.gtin = identifiers.ean;


  if (!identifiers.ean) {
    try {
      var scriptIds = extractIdentifiersFromScriptJson();
      if (scriptIds) {
        if (scriptIds.ean) identifiers.ean = scriptIds.ean;
        if (!identifiers.gtin && scriptIds.gtin) identifiers.gtin = scriptIds.gtin;
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }

  if (!identifiers.gtin && identifiers.ean) identifiers.gtin = identifiers.ean;


  if (!identifiers.brand) {
    try {
      const brandEl = document.querySelector('meta[itemprop="brand"]') ||
                      document.querySelector('[itemprop="brand"]');
      if (brandEl) {
        identifiers.brand = brandEl.getAttribute('content') || brandEl.textContent.trim() || null;
      }
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }

  logDebug('DOM identifier extraction:', identifiers);
  return identifiers;
}

function isNumericIdentifier(value) {
  if (!value) return false;
  const compact = String(value).replace(/\s+/g, "").trim();
  return /^\d{8,14}$/.test(compact);
}

function isStructuredMpnCode(value) {
  if (!value) return false;
  const compact = String(value).replace(/[\s\/\-_.]/g, "").trim();
  return compact.length >= 5 && compact.length <= 30 && /[a-z]/i.test(compact) && /\d/.test(compact);
}

function shouldPreferDomMpn(existingMpn, domMpn) {
  if (!domMpn) return false;
  if (!existingMpn) return true;
  const existing = String(existingMpn).trim();
  const dom = String(domMpn).trim();
  if (!dom || existing.toLowerCase() === dom.toLowerCase()) return false;


  if (isNumericIdentifier(existing) && isStructuredMpnCode(dom)) return true;
  return false;
}
















function extractCategory() {
  const MAX_LEN = 300;


  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        let text = script.textContent || '';
        if (!text.includes('schema.org')) continue;
        let jsonData = parseJsonSafely(text, 'extractCategory.product');
        if (!jsonData) continue;
        if (jsonData['@graph']) jsonData = jsonData['@graph'];
        if (jsonData.mainEntity) jsonData = jsonData.mainEntity;
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];
        for (const item of items) {
          const itemType = item['@type'];
          const isProduct = itemType === 'Product' ||
            (Array.isArray(itemType) && itemType.includes('Product')) ||
            (typeof itemType === 'string' && itemType.toLowerCase().includes('product'));
          const target = isProduct ? item : (item.mainEntity && item.mainEntity['@type'] === 'Product' ? item.mainEntity : null);
          if (target && typeof target.category === 'string' && target.category.trim().length > 0) {
            const cat = target.category.trim().substring(0, MAX_LEN);
            logDebug('Category from JSON-LD Product.category:', cat);
            return cat;
          }
        }
      } catch (e) { logDebug('extractCategory Product JSON-LD parse error:', e?.message || e); }
    }
  } catch (e) { logDebug('extractCategory Product JSON-LD error:', e?.message || e); }


  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        let text = script.textContent || '';
        if (!text.includes('schema.org')) continue;
        let jsonData = parseJsonSafely(text, 'extractCategory.breadcrumb');
        if (!jsonData) continue;
        if (jsonData['@graph']) jsonData = jsonData['@graph'];
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];
        for (const item of items) {
          if (item['@type'] !== 'BreadcrumbList' || !Array.isArray(item.itemListElement)) continue;
          const elements = item.itemListElement
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map(el => el.name || el.item?.name || '')
            .filter(n => n.trim().length > 0);

          if (elements.length > 2) {
            const cat = elements.slice(1, -1).join(' > ').substring(0, MAX_LEN);
            if (cat.length > 0) {
              logDebug('Category from BreadcrumbList JSON-LD:', cat);
              return cat;
            }
          }
        }
      } catch (e) { logDebug('extractCategory Breadcrumb JSON-LD parse error:', e?.message || e); }
    }
  } catch (e) { logDebug('extractCategory Breadcrumb JSON-LD error:', e?.message || e); }


  try {
    const breadcrumbSelectors = [
      'ol.breadcrumb li a',
      'nav[aria-label="breadcrumb"] a',
      '.breadcrumbs a',
      '[itemtype*="BreadcrumbList"] a'
    ];
    for (const sel of breadcrumbSelectors) {
      try {
        const links = document.querySelectorAll(sel);
        if (links.length < 2) continue;
        const parts = Array.from(links)
          .map(a => (a.textContent || '').trim())
          .filter(t => t.length > 0 && !/^(home|acas[aÄƒ]|pagina principal[aÄƒ])$/i.test(t));

        const h1Text = (document.querySelector('h1')?.textContent || '').trim();
        if (parts.length > 1) {
          const last = parts[parts.length - 1];
          if (last.length > 60 || (h1Text && last === h1Text)) {
            parts.pop();
          }
        }
        if (parts.length > 0) {
          const cat = parts.join(' > ').substring(0, MAX_LEN);
          logDebug('Category from DOM breadcrumbs:', cat);
          return cat;
        }
      } catch (e) { logDebug('extractCategory DOM breadcrumb selector error:', e?.message || e); }
    }
  } catch (e) { logDebug('extractCategory DOM breadcrumb error:', e?.message || e); }


  try {
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl) {
      const nextData = parseJsonSafely(nextDataEl.textContent || '', 'extractCategory.__NEXT_DATA__');
      if (!nextData || typeof nextData !== 'object') {
        throw new Error('invalid __NEXT_DATA__ JSON');
      }
      const breadcrumbs = nextData?.props?.pageProps?.breadcrumbs;
      if (Array.isArray(breadcrumbs)) {
        const parts = breadcrumbs
          .filter(b => b && b.level !== 99)
          .map(b => (b.name || b.label || '').trim())
          .filter(t => t.length > 0);
        if (parts.length > 0) {
          const cat = parts.join(' > ').substring(0, MAX_LEN);
          logDebug('Category from __NEXT_DATA__:', cat);
          return cat;
        }
      }
    }
  } catch (e) { logDebug('extractCategory __NEXT_DATA__ parse error:', e?.message || e); }


  try {
    if (typeof EM !== 'undefined' && EM.listingGlobals && EM.listingGlobals.category && EM.listingGlobals.category.trail) {
      const trail = EM.listingGlobals.category.trail;
      const cat = (typeof trail === 'string' ? trail : '').replace(/\//g, ' > ').trim().substring(0, MAX_LEN);
      if (cat.length > 0) {
        logDebug('Category from EM.listingGlobals:', cat);
        return cat;
      }
    }
  } catch (e) { logDebug('extractCategory EM globals parse error:', e?.message || e); }

  return null;
}










function extractProductData(storeConfig) {
  const html = document.documentElement.outerHTML;
  const data = {
    title: null,
    rawName: null,
    price: null,
    rawPrice: null,
    originalPrice: null,
    rawOriginalPrice: null,
    image: null,
    inStock: null,
    rawInStock: null,
    currency: 'RON',
    extractionMethod: null,
    mpn: null,
    ean: null,
    gtin: null,
    brand: null,
    sku: null,
    reviewRating: null,
    reviewCount: null,
    promoType: null,
    promoLabel: null,
    isLoyaltyOnly: null,
    category: null,
    rawBrand: null,
    variantColor: null,
    selectorErrors: [],
    selectorSuccesses: [],
    selectorCandidates: [],
  };
  let selectedVariantSignal = null;


  if (isWhitelistedNotFound(html, storeConfig)) {
    logDebug('Error page detected, skipping extraction');
    return null;
  }


  const schemaData = extractSchemaJSON(html, storeConfig);
  if (schemaData) {

    if (schemaData.title && shouldPreferTitleCandidate(data.title, schemaData.title)) {
      data.title = schemaData.title;
      data.rawName = schemaData.title;
    }
    if (schemaData.image && !data.image) data.image = schemaData.image;
    if (schemaData.inStock !== null && data.inStock === null) {
      data.inStock = schemaData.inStock;
      data.rawInStock = schemaData.rawInStock || data.rawInStock;
    }
    if (schemaData.mpn && !data.mpn) data.mpn = schemaData.mpn;
    if (schemaData.ean && !data.ean) data.ean = schemaData.ean;
    if (schemaData.gtin && !data.gtin) data.gtin = schemaData.gtin;
    if (schemaData.brand && !data.brand) data.brand = schemaData.brand;
    if (schemaData.brand && !data.rawBrand) data.rawBrand = schemaData.brand;
    if (schemaData.sku && !data.sku) data.sku = schemaData.sku;
    if (data.reviewRating === null && schemaData.reviewRating !== null) data.reviewRating = schemaData.reviewRating;
    if (data.reviewCount === null && schemaData.reviewCount !== null) data.reviewCount = schemaData.reviewCount;

    if (schemaData.price) {
      data.price = schemaData.price;
      data.rawPrice = schemaData.rawPrice || data.rawPrice;
      data.currency = schemaData.currency || 'RON';
      data.extractionMethod = 'json-ld';
      data.selectorSuccesses.push('strategy:json-ld');
      logDebug('Strategy 1 (JSON-LD) succeeded:', data.price);
    }
  }



  if (storeConfig) {

    if (data.price && storeConfig.priceOverrideSelector) {
      try {
        var overrideEl = document.querySelector(storeConfig.priceOverrideSelector);
        if (overrideEl && storeConfig.priceOverrideAttribute) {
          var overrideRawPrice = overrideEl.getAttribute(storeConfig.priceOverrideAttribute);
          var exactPrice = parsePrice(overrideRawPrice || '') || parseFloat(overrideRawPrice || '');
          var overrideDeltaPct = data.price > 0
            ? Math.abs(exactPrice - data.price) / data.price
            : 0;
          if (
            !isNaN(exactPrice) &&
            exactPrice > 0 &&
            exactPrice < 1000000 &&
            overrideDeltaPct <= 0.8 &&
            Math.abs(exactPrice - data.price) >= 0.01
          ) {
            logDebug('Price override:', data.price, '->', exactPrice);
            data.price = exactPrice;
          }
        }
      } catch (e) { logDebug('Price override error:', e); }
    }

    var selectedVariantContainer = null;



    if (storeConfig.selectedVariantContainerSelector) {
      try {
        var container = document.querySelector(storeConfig.selectedVariantContainerSelector);
        selectedVariantContainer = container || null;
        if (container) {

          var nameMeta = container.querySelector('meta[itemprop="name"]');
          if (nameMeta) {
            var vName = (nameMeta.getAttribute('content') || '').trim();
            if (vName && vName.length > 5) {
              data.title = vName;
              data.rawName = vName;
              logDebug('Variant container: title =', vName);
            }
          }

          var scopedPriceEl = null;
          if (storeConfig.variantPriceSelector) {
            try { scopedPriceEl = container.querySelector(storeConfig.variantPriceSelector); } catch {  }
          }
          if (!scopedPriceEl) scopedPriceEl = container.querySelector('meta[itemprop="price"]');
          if (scopedPriceEl) {
            var scopedPriceRaw = storeConfig.variantPriceAttribute
              ? (scopedPriceEl.getAttribute(storeConfig.variantPriceAttribute) ||
                  scopedPriceEl.getAttribute('content') ||
                  scopedPriceEl.textContent ||
                  '')
              : (scopedPriceEl.getAttribute('content') || scopedPriceEl.textContent || '');
            var vPrice = parsePrice(scopedPriceRaw || '');
            if (vPrice) {
              data.price = vPrice;
              data.rawPrice = String(scopedPriceRaw || vPrice);
              logDebug('Variant container: price =', vPrice);
            }
          }


          var scopedSkuEl = null;
          if (storeConfig.variantSkuSelector) {
            try { scopedSkuEl = container.querySelector(storeConfig.variantSkuSelector); } catch {  }
          }
          if (!scopedSkuEl) scopedSkuEl = container.querySelector('meta[itemprop="sku"]');
          if (scopedSkuEl) {
            var scopedSkuRaw = storeConfig.variantSkuAttribute
              ? (scopedSkuEl.getAttribute(storeConfig.variantSkuAttribute) ||
                  scopedSkuEl.getAttribute('content') ||
                  scopedSkuEl.textContent ||
                  '')
              : (scopedSkuEl.getAttribute('content') || scopedSkuEl.textContent || '');
            var scopedSku = String(scopedSkuRaw || '').trim();
            if (scopedSku) data.sku = scopedSku;
          }


          var scopedPidEl = null;
          if (storeConfig.variantPidSelector) {
            try { scopedPidEl = container.querySelector(storeConfig.variantPidSelector); } catch {  }
          }
          if (!scopedPidEl) scopedPidEl = container.querySelector('a[data-pid], [data-pid]');
          if (scopedPidEl) {
            var pidAttrName = storeConfig.variantPidAttribute || 'data-pid';
            var scopedPidRaw = scopedPidEl.getAttribute(pidAttrName) ||
              scopedPidEl.getAttribute('data-pid') ||
              scopedPidEl.textContent ||
              '';
            var scopedPid = String(scopedPidRaw || '').trim();
            if (scopedPid && scopedPid.length <= 64) {
              data.mpn = scopedPid;
            }
          }


          var availMeta = container.querySelector('meta[itemprop="availability"]');
          if (availMeta) {
            var availVal = (availMeta.getAttribute('content') || '').toLowerCase();
            data.inStock = !/(outofstock|soldout|unavailable)/i.test(availVal);
            data.rawInStock = availMeta.getAttribute('content');
            logDebug('Variant container: inStock =', data.inStock);
          }
        }
      } catch (e) { logDebug('Variant container error:', e); }
    }



    if (storeConfig.variantPriceSelector) {
      try {
        var vpEl = null;
        if (selectedVariantContainer) {
          try { vpEl = selectedVariantContainer.querySelector(storeConfig.variantPriceSelector); } catch {  }
        }
        if (!vpEl) vpEl = document.querySelector(storeConfig.variantPriceSelector);
        if (vpEl) {
          var vpRaw = storeConfig.variantPriceAttribute
            ? (vpEl.getAttribute(storeConfig.variantPriceAttribute) ||
                vpEl.getAttribute('content') ||
                vpEl.textContent)
            : (vpEl.getAttribute('content') || vpEl.textContent);
          if (vpRaw) {
            var vpPrice = parsePrice(vpRaw);
            if (vpPrice && vpPrice > 0 && vpPrice !== data.price) {
              logDebug('Variant price override:', data.price, '->', vpPrice);
              data.price = vpPrice;
              data.rawPrice = String(vpRaw);
            }
          }
        }
      } catch (e) { logDebug('Variant price error:', e); }
    }




    if (storeConfig.titleSelector) {
      try {
        var titleEl = document.querySelector(storeConfig.titleSelector) || document.querySelector('h1');
        if (titleEl) {
          function getSpacedText(node) {
            var text = '';
            for (var i = 0; i < node.childNodes.length; i++) {
              var child = node.childNodes[i];
              if (child.nodeType === 3) { text += child.textContent; }
              else if (child.nodeType === 1) {
                var childText = getSpacedText(child);
                if (childText && text && !/\s$/.test(text)) text += ' ';
                text += childText;
              }
            }
            return text;
          }
          var fullTitle = getSpacedText(titleEl).replace(/\s+/g, ' ').trim();
          if (fullTitle && shouldPreferTitleCandidate(data.title, fullTitle)) {
            data.title = fullTitle;
            data.rawName = fullTitle;
            logDebug('Title override:', fullTitle);
          }
        }
      } catch (e) { logDebug('Title override error:', e); }
    }



    if (storeConfig.variantSizeSelector || storeConfig.selectedVariantContainerSelector) {
      try {
        function extractNormalizedSize(rawText) {
          if (!rawText) return null;
          var text = String(rawText).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
          if (!text) return null;


          var re = /(\d+(?:[.,]\d+)?)\s*(ml|g|kg|l|oz)\b/ig;
          var m;
          while ((m = re.exec(text)) !== null) {
            var idx = m.index;
            var before = text.slice(Math.max(0, idx - 3), idx);
            if (/\//.test(before)) continue;

            var numRaw = String(m[1] || '').trim();
            var unit = String(m[2] || '').toLowerCase();
            if (!numRaw || !unit) continue;
            return numRaw + ' ' + unit;
          }


          if (/\d/.test(text) && text.length <= 20) return text;
          return null;
        }

        var sizeText = null;
        if (storeConfig.variantSizeSelector) {
          var sizeEl = null;
          if (selectedVariantContainer) {
            try { sizeEl = selectedVariantContainer.querySelector(storeConfig.variantSizeSelector); } catch {  }
          }
          if (!sizeEl) sizeEl = document.querySelector(storeConfig.variantSizeSelector);
          if (sizeEl) sizeText = extractNormalizedSize(sizeEl.textContent || '');
        }


        if (!sizeText && storeConfig.selectedVariantContainerSelector) {
          var selectedContainer = document.querySelector(storeConfig.selectedVariantContainerSelector);
          if (selectedContainer) {
            sizeText = extractNormalizedSize(selectedContainer.textContent || '');
          }
        }

        if (sizeText && /\d/.test(sizeText) && data.title &&
            !data.title.toLowerCase().includes(sizeText.toLowerCase())) {

          var sep = data.title.includes(' - ') ? ' - ' : ', ';
          data.title = data.title + sep + sizeText;
          data.rawName = data.title;
          logDebug('Variant size appended:', sizeText);
        }
      } catch (e) { logDebug('Variant size error:', e); }
    }




    try {
      var storeLink = String(storeConfig.link || '').toLowerCase();
      var isNotinoStore =
        /(^|\.)notino\./i.test(window.location.hostname || '') ||
        /(^|[^a-z0-9])notino\./i.test(storeLink);
      if (isNotinoStore) {
        var selectedTile = document.querySelector('#pdVariantsTile a.pd-variant-selected, a.pd-variant-selected');
        if (selectedTile) {
          var selectedText = String(selectedTile.textContent || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          function normalizeVariantSize(raw) {
            var txt = String(raw || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
            if (!txt) return null;
            var m = txt.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|kg|l|oz)\b/i);
            if (!m) return null;
            return String(m[1]).trim() + ' ' + String(m[2]).toLowerCase();
          }

          var selectedSizeEl = selectedTile.querySelector('.pd-variant-label');
          var selectedSize = normalizeVariantSize(selectedSizeEl ? selectedSizeEl.textContent : '');
          if (!selectedSize) {
            var ariaLiveSize = document.querySelector('#pdSelectedVariant [aria-live=\"assertive\"], #pdSelectedVariant [aria-live]');
            selectedSize = normalizeVariantSize(ariaLiveSize ? ariaLiveSize.textContent : '');
          }
          var selectedPriceEl = selectedTile.querySelector('[data-testid="price-variant"], [itemprop="price"], [content]');
          var selectedPriceRaw = selectedPriceEl
            ? (selectedPriceEl.getAttribute('content') || selectedPriceEl.textContent || '')
            : '';
          var selectedPrice = parsePrice(selectedPriceRaw);
          var selectedOutOfStock = /(indisponibil|nu este disponibil|epuizat|out of stock|sold out)/i.test(selectedText);

          selectedVariantSignal = {
            size: selectedSize,
            text: selectedText,
            outOfStock: selectedOutOfStock,
            hasPrice: typeof selectedPrice === 'number' && Number.isFinite(selectedPrice) && selectedPrice > 0,
            price: (typeof selectedPrice === 'number' && Number.isFinite(selectedPrice) && selectedPrice > 0) ? selectedPrice : null,
          };

          if (selectedVariantSignal.price && selectedVariantSignal.price > 0) {
            data.price = selectedVariantSignal.price;
            data.rawPrice = String(selectedVariantSignal.price);
            if (!data.extractionMethod) data.extractionMethod = 'variant-tile';
          }
          if (selectedOutOfStock) {
            data.inStock = false;
            if (!data.rawInStock) {
              data.rawInStock = selectedText || 'Indisponibil';
            }
          }
        }
      }
    } catch (e) { logDebug('Notino variant guard error:', e); }




    try {
      var sephoraStoreLink = String(storeConfig.link || '').toLowerCase();
      var isSephoraStore =
        /(^|\.)sephora\./i.test(window.location.hostname || '') ||
        /(^|[^a-z0-9])sephora\./i.test(sephoraStoreLink);
      if (isSephoraStore) {
        var selectedVariantButton = document.querySelector(
          '.variation-button-line.selected .variation-button[data-pid], #colorguide-modal .variation-button-line.selected .variation-button[data-pid]'
        );
        if (selectedVariantButton) {
          var selectedPid = String(selectedVariantButton.getAttribute('data-pid') || '').trim();
          if (selectedPid) {
            data.sku = selectedPid;
            if (!data.mpn || String(data.mpn).trim().length === 0) {
              data.mpn = selectedPid;
            }
          }

          var selectedSizeRaw =
            selectedVariantButton.getAttribute('title') ||
            (selectedVariantButton.querySelector('.variation-title span, .variation-title')
              ? selectedVariantButton.querySelector('.variation-title span, .variation-title').textContent
              : '');
          var selectedSizeNorm = null;
          if (selectedSizeRaw) {
            var sizeMatch = String(selectedSizeRaw).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
              .match(/(\d+(?:[.,]\d+)?)\s*(ml|g|kg|l|oz)\b/i);
            if (sizeMatch) {
              selectedSizeNorm = String(sizeMatch[1]).trim() + ' ' + String(sizeMatch[2]).toLowerCase();
            }
          }
          if (
            selectedSizeNorm &&
            data.title &&
            !data.title.toLowerCase().includes(selectedSizeNorm.toLowerCase())
          ) {
            data.title = data.title + ', ' + selectedSizeNorm;
            data.rawName = data.title;
          }

          var selectedPriceNode = selectedVariantButton.querySelector(
            '.product-variant-price-wrapper .price-sales-standard, .product-price.st-price .price-sales-standard, meta[itemprop="price"], [itemprop="price"]'
          );
          if (selectedPriceNode) {
            var selectedPriceRaw =
              selectedPriceNode.getAttribute('content') ||
              selectedPriceNode.textContent ||
              '';
            var selectedPriceValue = parsePrice(selectedPriceRaw);
            if (selectedPriceValue && selectedPriceValue > 0) {
              data.price = selectedPriceValue;
              data.rawPrice = String(selectedPriceRaw || selectedPriceValue);
              if (!data.extractionMethod) data.extractionMethod = 'variant-button';
            }
          }

          var selectedStockText = '';
          var selectedStockNode = selectedVariantButton.querySelector('.variation-avaibility, .variation-availability');
          if (selectedStockNode && selectedStockNode.textContent) {
            selectedStockText = selectedStockNode.textContent;
          } else if (selectedVariantButton.textContent) {
            selectedStockText = selectedVariantButton.textContent;
          }
          if (/(indisponibil|epuizat|out of stock|sold out)/i.test(selectedStockText || '')) {
            data.inStock = false;
            data.rawInStock = String(selectedStockText || '').trim() || data.rawInStock;
          }
        }
      }
    } catch (e) { logDebug('Sephora variant guard error:', e); }
  }


  if (!data.price) {
    const microdata = extractMicrodata(html);
    if (microdata && microdata.price) {
      data.price = microdata.price;
      data.rawPrice = microdata.rawPrice || data.rawPrice;
      data.currency = microdata.currency || data.currency;
      if (microdata.inStock !== null) {
        data.inStock = microdata.inStock;
        data.rawInStock = microdata.rawInStock || data.rawInStock;
      }
      if (data.reviewRating === null && microdata.reviewRating !== null) data.reviewRating = microdata.reviewRating;
      if (data.reviewCount === null && microdata.reviewCount !== null) data.reviewCount = microdata.reviewCount;
      data.extractionMethod = 'microdata';
      data.selectorSuccesses.push('strategy:microdata');
      logDebug('Strategy 2 (Microdata) succeeded:', data.price);
    } else {
      addSelectorError(data.selectorErrors, "microdata", "no_price");
    }
  }


  if (!data.price) {
    const regexData = extractWithRegex(html, storeConfig);
    mergeSelectorErrors(data.selectorErrors, regexData?.selectorErrors);
    if (regexData && regexData.price) {
      data.price = regexData.price;
      data.rawPrice = regexData.rawPrice || data.rawPrice;
      data.extractionMethod = 'regex';
      data.selectorSuccesses.push(regexData.successKey || "strategy:regex");
      logDebug('Strategy 3 (Regex) succeeded:', data.price);
    }
  }


  if (!data.price) {
    const selectorData = extractWithSelectors(storeConfig);
    mergeSelectorErrors(data.selectorErrors, selectorData?.selectorErrors);
    if (selectorData && selectorData.price) {
      data.price = selectorData.price;
      data.rawPrice = selectorData.rawPrice || data.rawPrice;
      data.extractionMethod = 'css-selector';
      data.selectorSuccesses.push(selectorData.successKey || "strategy:css-selector");
      logDebug('Strategy 4 (CSS) succeeded:', data.price);
    }
  }




  if (data.price && (data.extractionMethod === 'json-ld' || data.extractionMethod === 'microdata')) {
    const regexProbe = extractWithRegex(html, storeConfig);
    mergeSelectorErrors(data.selectorErrors, regexProbe?.selectorErrors);
    if (regexProbe && regexProbe.price) {
      data.selectorSuccesses.push(regexProbe.successKey || "strategy:regex");
    }

    const selectorProbe = extractWithSelectors(storeConfig);
    mergeSelectorErrors(data.selectorErrors, selectorProbe?.selectorErrors);
    if (selectorProbe && selectorProbe.price) {
      data.selectorSuccesses.push(selectorProbe.successKey || "strategy:css-selector");
    }
  }


  const fallbackDomTitle = extractTitle();
  if (shouldPreferTitleCandidate(data.title, fallbackDomTitle)) {
    data.title = fallbackDomTitle;
  }
  if (!data.rawName || (fallbackDomTitle && data.title === fallbackDomTitle)) {
    data.rawName = data.title;
  }
  const fallbackDomImage = extractImage();
  const preferDomImageForStore = storeConfig?.link === 'altex.ro';
  if (fallbackDomImage && (!data.image || preferDomImageForStore)) {
    data.image = fallbackDomImage;
  }




  const domStockStatus = checkStock(storeConfig, html);
  const preferDomStockForStore = storeConfig?.link === 'kfea.ro';
  if (domStockStatus !== null) {
    if (data.inStock === null || preferDomStockForStore) {
      data.inStock = domStockStatus;
    }
    if (!data.rawInStock || preferDomStockForStore) {
      data.rawInStock = extractRawStockText(storeConfig);
    }
  } else if (data.inStock === null) {

    data.inStock = data.price !== null;
  }


  const domIdentifiers = extractIdentifiers(storeConfig);
  if (domIdentifiers.mpn && shouldPreferDomMpn(data.mpn, domIdentifiers.mpn)) data.mpn = domIdentifiers.mpn;
  if (!data.ean && domIdentifiers.ean) data.ean = domIdentifiers.ean;
  if (!data.gtin && domIdentifiers.gtin) data.gtin = domIdentifiers.gtin;
  if (!data.brand && domIdentifiers.brand) data.brand = domIdentifiers.brand;
  if (!data.rawBrand && domIdentifiers.brand) data.rawBrand = domIdentifiers.brand;
  if (!data.sku && domIdentifiers.sku) data.sku = domIdentifiers.sku;


  if (!data.category) data.category = extractCategory();




  const promoMeta = extractPromotionMetadata(data.price);
  if (promoMeta) {
    if (promoMeta.promoType) data.promoType = promoMeta.promoType;
    if (promoMeta.promoLabel) data.promoLabel = promoMeta.promoLabel;
    if (typeof promoMeta.isLoyaltyOnly === "boolean") data.isLoyaltyOnly = promoMeta.isLoyaltyOnly;





    if (
      promoMeta.promoCode &&
      typeof promoMeta.promoPrice === "number" &&
      Number.isFinite(promoMeta.promoPrice) &&
      promoMeta.promoPrice > 0 &&
      typeof data.price === "number" &&
      Number.isFinite(data.price) &&
      promoMeta.promoPrice < data.price &&
      promoMeta.promoPrice >= data.price * 0.35
    ) {
      const previousPrice = data.price;
      data.price = Math.round(promoMeta.promoPrice * 100) / 100;
      data.rawPrice = String(data.price);
      logDebug('Promo price override:', previousPrice, '->', data.price,
        '| code:', promoMeta.promoCode, '| type:', promoMeta.promoType);

      const hasValidOriginal =
        typeof data.originalPrice === "number" &&
        Number.isFinite(data.originalPrice) &&
        data.originalPrice > data.price;
      if (!hasValidOriginal || data.originalPrice < previousPrice) {
        data.originalPrice = previousPrice;
        data.rawOriginalPrice = String(previousPrice);
      }

      data.extractionMethod = data.extractionMethod
        ? `${data.extractionMethod}+promo`
        : "promo-window";
    }
  }


  if (selectedVariantSignal) {
    const variantSize = selectedVariantSignal.size || null;
    if (
      variantSize &&
      /\d/.test(variantSize) &&
      data.title &&
      !data.title.toLowerCase().includes(variantSize.toLowerCase())
    ) {
      data.title = `${data.title}, ${variantSize}`;
      data.rawName = data.title;
    }

    if (selectedVariantSignal.outOfStock && !selectedVariantSignal.hasPrice) {
      data.inStock = false;
      data.rawInStock = selectedVariantSignal.text || data.rawInStock || 'Indisponibil';
      data.price = null;
      data.rawPrice = null;
      data.originalPrice = null;
      data.rawOriginalPrice = null;
      data.promoType = null;
      data.promoLabel = null;
      data.isLoyaltyOnly = null;
      data.extractionMethod = data.extractionMethod
        ? `${data.extractionMethod}+variant-unavailable`
        : 'variant-unavailable';
    } else if (selectedVariantSignal.price && selectedVariantSignal.price > 0) {
      const baseVariantPrice = selectedVariantSignal.price;
      const keepPromoPrice =
        typeof data.price === 'number' &&
        Number.isFinite(data.price) &&
        data.price > 0 &&
        data.price < baseVariantPrice &&
        Boolean(data.promoType || data.promoLabel);
      if (!keepPromoPrice) {
        data.price = baseVariantPrice;
        data.rawPrice = String(baseVariantPrice);
      }
    }
  }


  if (!data.variantColor) {
    try {
      data.variantColor = extractColorFromUrl(location.href);
    } catch (e) { if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message); }
  }

  if (!data.rawPrice && data.price !== null) data.rawPrice = String(data.price);
  if (!data.rawBrand && data.brand) data.rawBrand = data.brand;
  data.selectorSuccesses = Array.from(new Set(
    (data.selectorSuccesses || [])
      .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
      .slice(0, 10)
  ));

  var cssFailedKeys = (data.selectorErrors || []).filter(function (entry) {
    return (
      typeof entry === "string" &&
      (entry.indexOf("selectors_checkPrice:") === 0 || entry.indexOf("selectors_inject:") === 0)
    );
  });

  var method = String(data.extractionMethod || "").toLowerCase();
  if (
    data.price &&
    data.price > 0 &&
    cssFailedKeys.length > 0 &&
    (method === "json-ld" || method === "jsonld" || method === "microdata")
  ) {
    try {
      data.selectorCandidates = discoverCandidateSelectors(data.price, cssFailedKeys);
    } catch (err) {
      if (DEBUG_EXTRACTOR) console.warn("[PM][extractor] candidate discovery failed:", err);
    }
  }

  if (!data.price && !data.rawPrice) {
    if (DEBUG_EXTRACTOR) console.warn("[PM][extractor] All strategies failed to extract price", {
      url: location.href,
      method: data.extractionMethod || "none",
      errorCount: (data.selectorErrors || []).length,
    });
  }

  logDebug('Final extraction result:', {
    title: data.title?.substring(0, 50),
    price: data.price,
    rawPrice: data.rawPrice,
    method: data.extractionMethod,
    inStock: data.inStock,
    rawInStock: data.rawInStock,
    mpn: data.mpn,
    ean: data.ean,
    brand: data.brand,
    reviewRating: data.reviewRating,
    reviewCount: data.reviewCount,
    sku: data.sku,
    category: data.category,
    promoType: data.promoType,
    promoLabel: data.promoLabel,
    isLoyaltyOnly: data.isLoyaltyOnly,
    selectorErrors: data.selectorErrors.length,
    selectorSuccesses: data.selectorSuccesses.length,
    selectorCandidates: Array.isArray(data.selectorCandidates) ? data.selectorCandidates.length : 0,
  });

  return data;
}

function normalizePromoText(value) {
  const normalized = String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();


  try {
    return normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
    return normalized;
  }
}

function isPlausiblePromoCode(token) {
  if (!token || token.length < 3) return false;
  if (!/[a-z]/i.test(token)) return false;

  if (/\d/.test(token)) return true;

  if (/^[A-Z]/.test(token) && token === token.toUpperCase()) return true;

  if (/[_-]/.test(token)) return true;

  return false;
}

function extractPromoCodeFromText(text) {
  const clean = normalizePromoText(text);
  if (!clean) return null;

  const patterns = [
    /\b(?:folosind|cu)\s+cod(?:ul)?\s+([a-z0-9][a-z0-9_-]{2,24})\b/i,
    /\bcod(?:ul)?(?:\s+promo)?\s*[:\-]?\s*([a-z0-9][a-z0-9_-]{2,24})\b/i,
    /\b(?:voucher|coupon)\s*[:\-]\s*([a-z0-9][a-z0-9_-]{2,24})\b/i,
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (!match || !match[1]) continue;
    const token = match[1].trim();
    if (!isPlausiblePromoCode(token)) continue;
    const afterToken = clean.slice(match.index + match[0].length).trim();
    if (/^(?:lei|ron|eur|usd|%)(?:\b|$)/i.test(afterToken)) continue;
    return token;
  }

  return null;
}

function extractPromoCodeFromNode(node) {
  if (!node || typeof node.querySelectorAll !== "function") return null;



  const tokenRegex = /^(?=.*[a-zA-Z])[a-zA-Z0-9][a-zA-Z0-9_-]{2,24}$/;
  const contextRegex = /\b(?:folosind|cu)\s+cod(?:ul)?\b/i;

  const candidates = Array.from(node.querySelectorAll("span,strong,b,em,i")).slice(0, 80);
  for (const el of candidates) {
    const token = normalizePromoText(el.textContent || "");
    if (!tokenRegex.test(token)) continue;
    if (!isPlausiblePromoCode(token)) continue;

    const parentText = normalizePromoText(el.parentElement?.textContent || "");
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const explicitTokenRegex = new RegExp(`\\b(?:folosind|cu)\\s+cod(?:ul)?\\s*[:\\-]?\\s*${escapedToken}\\b`, "i");
    if (parentText && contextRegex.test(parentText) && explicitTokenRegex.test(parentText)) {
      return token;
    }
  }

  return null;
}

function extractPromoPriceFromNode(node, currentPrice) {
  if (!node) return null;
  const structuredCandidates = [];
  const looseCandidates = [];
  const text = normalizePromoText(node.textContent || "");

  const pushPrice = (raw, bucket = "loose") => {
    if (raw === null || raw === undefined) return;
    const normalized = String(raw).trim();
    if (!normalized) return;
    if (/^(ron|lei|eur|usd)$/i.test(normalized)) return;
    const parsed = parsePrice(normalized);
    if (typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0) {
      if (bucket === "structured") {
        structuredCandidates.push(parsed);
      } else {
        looseCandidates.push(parsed);
      }
    }
  };

  const pushPricesFromText = (raw, bucket = "loose") => {
    const normalized = normalizePromoText(raw);
    if (!normalized) return;

    const currencyMatches = normalized.match(/\b\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?\s*(?:ron|lei)\b/gi) || [];
    for (const match of currencyMatches) {
      pushPrice(match, bucket);
    }

    if (currencyMatches.length === 0) {
      pushPrice(normalized, bucket);
    }
  };


  if (text) {
    const codePricePatterns = [
      /(\d{2,6}(?:[.,]\d{1,2})?)\s*(?:lei|ron)\s*(?:folosind|cu)\s+cod(?:ul)?\s+[a-z0-9][a-z0-9_-]{2,24}/i,
      /(?:folosind|cu)\s+cod(?:ul)?\s+[a-z0-9][a-z0-9_-]{2,24}\s*(?:la|de)?\s*(\d{2,6}(?:[.,]\d{1,2})?)\s*(?:lei|ron)/i,
    ];
    for (const pattern of codePricePatterns) {
      const match = text.match(pattern);
      if (!match || !match[1]) continue;
      const parsed = parsePrice(match[1]);
      if (typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  try {
    const contentEls = Array.from(node.querySelectorAll("[content]"));
    for (const el of contentEls) {
      pushPrice(el.getAttribute("content"), "structured");
    }
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
  }

  try {
    const priceHintEls = Array.from(
      node.querySelectorAll(
        '[data-testid*="price"], [class*="price"], [id*="price"], [content]'
      )
    ).slice(0, 25);
    for (const el of priceHintEls) {
      pushPricesFromText(el.textContent || "", "structured");
    }
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
  }

  pushPricesFromText(text, "loose");





  const thresholdAmounts = new Set();
  if (text) {
    const thresholdPatterns = [

      /(?:de\s+peste|peste|de\s+minim(?:um)?|de\s+cel\s+pu[tț]in|minim(?:um)?)\s+(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:lei|ron)\b/gi,

      /(?:cump[aă]r[aă](?:turi)?|comand[aă]|comenzi|achizi[tț]ii)\s+de\s+(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:lei|ron)\b/gi,

      /(?:campanie|voucher|cupon)\b.*?\bde\s+la\s+(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:lei|ron)\b/gi,

      /pre[tț](?:ul)?\s+(?:cel\s+mai\s+(?:mic|sc[aă]zut)|minim)\b[^.]{0,80}?(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:lei|ron)\b/gi,
    ];
    for (const pattern of thresholdPatterns) {
      let tm;
      while ((tm = pattern.exec(text)) !== null) {
        const tp = parsePrice(tm[1]);
        if (typeof tp === "number" && tp > 0) thresholdAmounts.add(tp);
      }
    }
  }

  const candidates = structuredCandidates.concat(looseCandidates);


  const filtered = thresholdAmounts.size > 0
    ? candidates.filter((p) => !thresholdAmounts.has(p))
    : candidates;

  if (filtered.length === 0) return null;


  const sane = filtered.filter((p) => p > 0 && p < 500000);
  if (sane.length === 0) return null;

  if (typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0) {
    const cheaper = sane.filter((p) => p < currentPrice);
    if (cheaper.length > 0) {
      const filteredStructured = thresholdAmounts.size > 0
        ? structuredCandidates.filter((p) => !thresholdAmounts.has(p))
        : structuredCandidates;
      const structuredCheaper = filteredStructured
        .filter((p) => p < currentPrice && p > 0 && p < 500000);
      const pool = structuredCheaper.length > 0 ? structuredCheaper : cheaper;



      if (/\b(folosind|cu)\s+cod(?:ul)?\b/i.test(text)) {
        const plausible = pool.filter((p) => p >= currentPrice * 0.35);
        const source = plausible.length > 0 ? plausible : pool;
        source.sort((a, b) => a - b);
        return source[0];
      }


      pool.sort((a, b) => b - a);
      return pool[0];
    }
  }

  sane.sort((a, b) => a - b);
  return sane[0];
}

function detectPromoTypeFromText(text, hasCode) {
  const normalized = normalizePromoText(text).toLowerCase();
  if (!normalized) return null;

  if (hasCode || /\b(voucher|coupon|cupon|cod(?:ul)?(?:\s+promo)?)\b/i.test(normalized)) {
    return "coupon";
  }
  if (/\b(loial|loyalty|fidelit|member|club)\b/i.test(normalized)) {
    return "loyalty";
  }
  if (/\b(flash|timp limitat|time limit|today only|doar azi)\b/i.test(normalized)) {
    return "flash_sale";
  }
  if (/\b(clearance|lichidare)\b/i.test(normalized)) {
    return "clearance";
  }
  if (/\b(sezon|seasonal|black friday|cyber monday)\b/i.test(normalized)) {
    return "seasonal";
  }
  if (/\b(reducere|discount|promo(?:tie)?)\b/i.test(normalized)) {
    return "discount";
  }

  return null;
}

function extractPromotionMetadata(currentPrice) {
  const selectors = [
    '[data-testid*="voucher"]',
    '[data-testid*="discount"]',
    '[data-testid*="promo"]',
    '[class*="voucher"]',
    '[class*="discount"]',
    '[class*="promo"]',
    '[class*="coupon"]',
  ];

  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll(selectors.join(","))).slice(0, 120);
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
    return null;
  }




  try {
    const root = document.querySelector('main, [role="main"]') || document.body;
    const textHint = /\b(folosind\s+cod|cod(?:ul)?\s+promo|voucher|coupon|cupon|pretul actual|promo(?:tie)?|discount|reducere)\b/i;
    const fallbackNodes = Array.from(root.querySelectorAll('section, article, div, p, span')).slice(0, 2200);
    for (const node of fallbackNodes) {
      const text = normalizePromoText(node.textContent || "");
      if (text.length < 18 || text.length > 500) continue;
      if (!/\d/.test(text)) continue;
      if (!textHint.test(text)) continue;
      nodes.push(node);
    }
  } catch (e) {
    if (DEBUG_EXTRACTOR) console.warn('[Pretzi]', e?.message);
  }


  nodes = Array.from(new Set(nodes));
  if (nodes.length === 0) return null;

  let best = null;
  let bestScore = -1;

  for (const node of nodes) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;

    const text = normalizePromoText(node.textContent || "");
    if (!text || text.length < 10 || text.length > 500) continue;

    const hasPromoKeyword = /\b(cod(?:ul)?|voucher|coupon|cupon|promo(?:tie)?|reducere|discount|fidelit|loial|loyalty)\b/i.test(text);
    if (!hasPromoKeyword) continue;

    const promoCode = extractPromoCodeFromNode(node) || extractPromoCodeFromText(text);
    const promoPrice = extractPromoPriceFromNode(node, currentPrice);
    const promoType = detectPromoTypeFromText(text, Boolean(promoCode));
    if (!promoType) continue;

    let score = 0;
    if (promoCode) score += 40;
    if (promoPrice !== null) score += 20;
    if (
      promoPrice !== null &&
      typeof currentPrice === "number" &&
      Number.isFinite(currentPrice) &&
      promoPrice < currentPrice
    ) {
      score += 25;
    }
    if (/folosind cod/i.test(text)) score += 12;
    if (/pret actual|pret minim/i.test(text)) score += 5;

    if (score > bestScore) {
      bestScore = score;
      best = { promoType, promoCode, promoPrice, text };
    }
  }

  if (!best || !best.promoType) return null;

  let promoLabel = null;
  if (best.promoCode && best.promoPrice !== null) {
    promoLabel = `Cu cod ${best.promoCode.toUpperCase()}: ${best.promoPrice} RON`;
  } else if (best.promoCode) {
    promoLabel = `Cod promo: ${best.promoCode.toUpperCase()}`;
  } else if (
    best.promoPrice !== null &&
    typeof currentPrice === "number" &&
    Number.isFinite(currentPrice) &&
    best.promoPrice < currentPrice
  ) {
    promoLabel = `Pret promotional: ${best.promoPrice} RON`;
  } else {
    promoLabel = best.text.slice(0, 120);
  }

  return {
    promoType: best.promoType,
    promoCode: best.promoCode || null,
    promoLabel: promoLabel ? String(promoLabel).slice(0, 120) : null,
    isLoyaltyOnly: best.promoType === "loyalty",
    promoPrice:
      typeof best.promoPrice === "number" && Number.isFinite(best.promoPrice)
        ? best.promoPrice
        : null,
  };
}
