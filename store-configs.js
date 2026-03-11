const DEBUG_STORE_CONFIGS = false;


















const STORE_CONFIGS = [







  {
    link: 'emag.ro',
    displayName: 'eMAG',
    injectTarget: 'div.product-page-pricing p.product-new-price, div.main-product-form p.product-new-price',
    selectors_inject: [
      'p.product-new-price[data-test="main-price"]',
      'div.product-page-pricing .pricing-block p.product-new-price span',
      'div.main-product-form p.product-new-price span',
    ],
    selectors_inject_waitFor: ['.main-container-inner'],
    selectors_checkPrice: [],
    pattern_inStock: [
      '/[^\\.]label-(in_stock|limited_stock|showroom_only|to_order|preorder)/i',
      '.product-new-price',
    ],
    pattern_outOfStock: [
      '/[^\\.]label-(out_of_stock|unavailable)/i',
    ],
    pattern_whitelistNotFound: [],
    productPagePatterns: [
      'emag\\..*?\\/fd\\/[^\\/]+',
      'emag\\..*?\\/pd\\/[^\\/]+',
    ],
    identifierSelectors: [
      { selector: 'script[type="application/ld+json"]', field: 'mpn', jsonPath: 'sku' },
      { selector: 'span.product-code-display', field: 'mpn' },
      { selector: 'meta[itemprop="gtin13"]', field: 'ean', attribute: 'content' },
      { selector: '[itemprop="gtin13"]', field: 'ean', attribute: 'content' },
      { selector: 'meta[itemprop="gtin"]', field: 'gtin', attribute: 'content' },
      { selector: '[itemprop="gtin"]', field: 'gtin', attribute: 'content' },
      { selector: 'meta[itemprop="gtin8"]', field: 'gtin', attribute: 'content' },
      { selector: '[itemprop="gtin8"]', field: 'gtin', attribute: 'content' },
    ],
    titleStripPrefixes: [
      '^resigilat\\s*:\\s*',
      '^resigilat\\s+',
      '^Telefon\\s+mobil\\s+',
      '^Laptop\\s+',
      '^Televizor\\s+',
      '^Tableta\\s+',
    ],
    listingAnchorSelector: 'a.card-v2-title.js-product-url, a[href*="/pd/"], a[href*="/fd/"]',
    listingCardSelector: '.card-item.js-product-data, .card-item, .card-v2, .js-product-data',
    listingBadgeMountSelector: '.card-v2-pricing, .product-new-price',
  },


  {
    link: 'altex.ro',
    displayName: 'Altex',
    additionalLinks: ['mediagalaxy.ro'],
    injectTarget: 'div.Price-current.leading-none.text-red-brand, [class*="Price-current"]',
    selectors_inject: [
      'div.Price-current.leading-none.text-red-brand',
      '[class*="Price-current"]',
      '[itemprop="price"]',
    ],
    selectors_inject_waitFor: [
      '[class*="Price-current"]',
      'main h1',
    ],
    selectors_checkPrice: [],
    pattern_inStock: [
      '.Product--inStock',
      '/\\bin\\s+stoc\\b/i',
    ],
    pattern_outOfStock: [
      '/stoc epuizat/i',
      '.Product--outOfStock',
    ],
    pattern_whitelistNotFound: [],
    productPagePatterns: [
      '(?:altex|mediagalaxy)\\.ro\\/.*?\\/cpd\\/[^\\/]+',
      '(?:altex|mediagalaxy)\\.ro\\/.*?\\/pd\\/[^\\/]+',
    ],
    priceParseMode: 'int-sup',
    priceContainerSelector: 'div.Price-current.leading-none.text-red-brand, [class*="Price-current"][class*="text-red-brand"], [class*="Price-current"], [itemprop="price"]',
    priceIntSelector: '.Price-int',
    priceDecimalSelector: 'sup',
    priceBadContextSelectors: [
      '[class*="rate"]',
      '[class*="installment"]',
      '[class*="credit"]',
      '[class*="monthly"]',
      '.text-12px.text-\\[\\#777777\\]',
      '#resigilate',
      'li.resealed',
    ],
    originalPriceSelectors: [
      {
        selector: '[class*="has-line-through"]',
        intSelector: '.Price-int',
        decimalSelector: 'sup',
        badContextSelectors: ['[class*="rate"]', '[class*="installment"]'],
        priority: 1,
      },
      {
        selector: '.line-through',
        badContextSelectors: ['[class*="rate"]', '[class*="installment"]'],
        priority: 2,
      },
    ],
    canonicalUrlStripParams: [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'ref', 'gclid', 'fbclid', 'dclid',
    ],
    productCodeUrlPatterns: ['\\/(?:cpd|pd)\\/([^\\/?#]+)'],
    variantObserverSelector: '[class*="Price-current"], [class*="Product-variant"], [class*="Product-color"], [class*="Product-memory"]',
    variantObserverDebounceMs: 1500,
    listingAnchorSelector: 'a[href*="/cpd/"], a[href*="/pd/"]',
    listingCardSelector: 'li.Products-item, .Products-item',
    listingPriceSelector: 'span.Price-int, [class*="Price-current"] .Price-int, [class*="Price-current"]',
    listingBadgeMountSelector: 'div.flex.items-baseline, [class*="Price-current"]',
    identifierSelectors: [],
  },


  {
    link: 'pcgarage.ro',
    displayName: 'PCGarage',
    injectTarget: null,
    selectors_inject: ['meta[itemprop="price"]', '.ps_sell_price .price_num'],
    selectors_inject_waitFor: [],
    selectors_checkPrice: [],
    pattern_inStock: ['/in\\s+stoc/i'],
    pattern_outOfStock: ['/stoc\\s+epuizat/i'],
    pattern_whitelistNotFound: [],
    productPagePatterns: ['pcgarage\\.ro\\/[^/]+\\/[^/]+\\/[^/]+'],
    listingAnchorSelector: '.product_box .product_box_name a[href]',
    listingCardSelector: '.product_box',
    listingPriceSelector: 'p.price',
    listingBadgeMountSelector: '.product_box_price_container .pb-price, .product_box_price_container',
    resealedContainerSelector: '#pe_unsealed .pe_unsealed, #pe_unsealed .pe_unsealed_box',
    resealedPriceSelector: '.pe_unsealed_price span, .pe_unsealed_price',
    resealedConditionSelector: '.pe_unsealed_info p:nth-of-type(2), .pe_unsealed_info p',
    resealedLinkSelector: '.pe_unsealed_buy a[href*=\"adaugaincos-desigilat\"]',
    identifierSelectors: [],
  },


  {
    link: 'flanco.ro',
    displayName: 'Flanco',
    injectTarget: '.price-box.price-final_price',
    selectors_inject: [
      'meta[itemprop="price"]',
      '.price-box.price-final_price .singlePrice .price',
      '.price-box.price-final_price .special-price .price',
    ],
    selectors_inject_waitFor: ['.price-box.price-final_price', '.product-info-price'],
    selectors_checkPrice: ['meta[itemprop="price"]', '/"price":\\s*(\\d+\\.?\\d*)/i'],
    pattern_inStock: [
      '.stockstatus-container .stocky-txt.limited-stock',
      '.stocky-txt.limited-stock',
      '.stockstatus-container .stocky-txt.in-stock',
      '.stocky-txt.in-stock',
      '[itemprop="availability"][content*="InStock"]',
      '/stockstatus-container[\\s\\S]{0,400}(?:stoc\\s+limitat|ultimele\\s+bucati|[Ii]n\\s+stoc)/i',
    ],
    pattern_outOfStock: [
      '.stockstatus-container .stocky-txt.out-of-stock',
      '.stocky-txt.out-of-stock',
      '[itemprop="availability"][content*="OutOfStock"]',
      '/stockstatus-container[\\s\\S]{0,400}(?:stoc\\s+epuizat|indisponibil|out of stock)/i',
    ],
    pattern_whitelistNotFound: ['/404|page not found|pagina nu a fost gasita/i'],
    productPagePatterns: ['flanco\\.ro\\/[^/]+\\.html'],
    identifierSelectors: [
      { selector: 'meta[itemprop="mpn"]', field: 'mpn', attribute: 'content' },
      { selector: 'div[itemprop="sku"]', field: 'sku' },
    ],
    originalPriceSelectors: [
      { selector: '.price-box.price-final_price .pricePrp .price', priority: 1 },
      { selector: '.price-box.price-final_price .old-price .price', priority: 2 },
    ],
    priceParseMode: 'int-sup',
    priceContainerSelector: '.price-box.price-final_price',
    priceIntSelector: '.price-box.price-final_price .singlePrice .price',
    priceDecimalSelector: '.price-box.price-final_price .singlePrice .price sup.decimal',
    priceBadContextSelectors: ['.price-box:not(.price-final_price)', '.pricesPrp .prp'],
    priceContainerScoreBoosts: [
      { selector: '.price-box.price-final_price', boost: 15 },
      { selector: '.product-info-price', boost: 8 },
    ],
    priceOverrideSelector: 'meta[itemprop="price"]',
    priceOverrideAttribute: 'content',
    selectedVariantContainerSelector: null,
    variantPriceSelector: 'meta[itemprop="price"]',
    variantPriceAttribute: 'content',
    variantSizeSelector: null,
    variantObserverSelector: '.price-box.price-final_price',
    variantObserverDebounceMs: 300,
    titleSelector: null,
    canonicalUrlStripParams: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      '_ga',
      '_gl',
      'gclid',
      'fbclid',
      'ref',
    ],
    canonicalUrlStripPatterns: ['_ga_[A-Z0-9]+=.*?(?:&|$)'],
    productCodeUrlPatterns: [],
    titleStripPrefixes: [],
    listingCardSelector: '.product-item',
    listingAnchorSelector: 'a.product-item-link',
    listingPriceSelector: '.price-box.price-final_price .special-price .price, .price-box.price-final_price .singlePrice .price',
    listingBadgeMountSelector: '.price-box.price-final_price',
  },


  {
    link: 'vexio.ro',
    displayName: 'Vexio',
    injectTarget: '.price-box.col-xs-10.col-centered',
    selectors_inject: ['#price-value', '.price-box .h3.price-value span'],
    selectors_inject_waitFor: ['.price-box', '#price-value'],
    selectors_checkPrice: ['/"price":\\s*(\\d+\\.?\\d*)/i'],
    pattern_inStock: ['.instock', '.availability.instock', '/in\\s+stoc/i'],
    pattern_outOfStock: ['/stoc\\s+epuizat/i', '/indisponibil/i'],
    pattern_whitelistNotFound: ['/404|pagina nu a fost gasita|page not found/i'],
    productPagePatterns: ['vexio\\.ro\\/[^/]+\\/[^/]+\\/\\d+-.+'],
    identifierSelectors: [],
    originalPriceSelectors: [
      { selector: '.price-box .old_price del', priority: 1 },
      { selector: '.price-box del', priority: 2 },
    ],
    priceBadContextSelectors: ['.pvalue'],
    priceContainerScoreBoosts: [
      { selector: '.price-box.col-xs-10', boost: 20 },
      { selector: '.h3.price-value', boost: 10 },
    ],
    variantObserverSelector: '.price-box',
    variantObserverDebounceMs: 300,
    canonicalUrlStripParams: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      '_ga',
      '_gl',
      'gclid',
      'fbclid',
      'ref',
    ],
    canonicalUrlStripPatterns: ['_ga_[A-Z0-9]+=.*?(?:&|$)'],
    productCodeUrlPatterns: ['vexio\\.ro\\/[^/]+\\/[^/]+\\/(\\d+)-'],
    titleStripPrefixes: [],
    listingCardSelector: 'article.product-box',
    listingAnchorSelector: 'a.text-center',
    listingPriceSelector: '.price.clearfix .pull-left.discounted, .price.clearfix .pull-left > strong',
    listingBadgeMountSelector: '.price.clearfix',
  },


  {
    link: 'carrefour.ro',
    displayName: 'Carrefour',
    injectTarget: '.product-info-price .price-box',
    selectors_inject: ['.price-box meta[itemprop="price"]', '[data-price-type="finalPrice"][data-price-amount]'],
    selectors_inject_waitFor: ['.price-box', 'h1.page-title'],
    selectors_checkPrice: ['.price-box meta[itemprop="price"]', '/"price"\\s*:\\s*([\\d.]+)/i'],
    pattern_inStock: ['.box-tocart.in-stock', 'link[itemprop="availability"][href*="InStock"]', '/disponibil/i'],
    pattern_outOfStock: ['.box-tocart.out-of-stock', '/indisponibil|stoc\\s+epuizat/i'],
    pattern_whitelistNotFound: ['/(?:title>|eroare\\s*)404|pagina nu a fost gasita/i'],
    productPagePatterns: ['carrefour\\.ro\\/produse\\/[a-z0-9-]+-\\d+-\\d+'],
    identifierSelectors: [
      { selector: 'input[name="vendor_sku"]', field: 'sku', attribute: 'value' },
      { selector: 'p.product-sku strong.highlighted-value', field: 'sku', attribute: null },
      { selector: 'meta[itemprop="mpn"]', field: 'mpn', attribute: 'content' },
      { selector: 'meta[itemprop="gtin13"]', field: 'ean', attribute: 'content' },
      { selector: 'meta[itemprop="gtin"]', field: 'gtin', attribute: 'content' },
    ],
    originalPriceSelectors: [

      { selector: '.price-box .old-price .price', priority: 1 },
      { selector: '.old-price .price-wrapper .price', priority: 2 },
    ],
    priceBadContextSelectors: ['.related-products', '.upsell-products', '.crosssell-products', '.product-items .productItem'],
    priceContainerScoreBoosts: [
      { selector: '.product-info-price', boost: 10 },
      { selector: '[data-price-type="finalPrice"]', boost: 5 },
    ],
    priceOverrideSelector: '[data-price-type="finalPrice"][data-price-amount]',
    priceOverrideAttribute: 'data-price-amount',
    titleSelector: 'h1.page-title',
    canonicalUrlStripParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'gclid', 'fbclid'],
    productCodeUrlPatterns: ['-(\\d+)$'],
    titleStripPrefixes: ['\\s*\\|\\s*Carrefour Romania$'],
    listingCardSelector: '.productItem',
    listingAnchorSelector: ".productItem-name a[href*='/produse/']",
    listingPriceSelector: '.price.price-final[data-price-amount]',
    listingBadgeMountSelector: '.productItem-price',
  },


  {
    link: 'auchan.ro',
    displayName: 'Auchan',
    injectTarget: '.auchan-store-theme-4-x-pricePdpContainer',
    selectors_inject: [
      'meta[property="product:price:amount"]',
      '.vtex-product-price-1-x-currencyContainer--pdp',
      '.vtex-product-price-1-x-sellingPrice--pdp',
    ],
    selectors_inject_waitFor: [
      '.vtex-product-price-1-x-currencyContainer--pdp',
      '.auchan-store-theme-4-x-pricePdpContainer',
    ],
    selectors_checkPrice: [
      'meta[property="product:price:amount"]',
      '/"price":\\s*(\\d+\\.?\\d*)/i',
      '/lowPrice["\']?:\\s*(\\d+\\.?\\d*)/i',
    ],
    pattern_inStock: [
      '.vtex-product-availability-0-x-highStockText',
      '.vtex-product-availability-0-x-container',
      '/[Ii]n stoc/i',
    ],
    pattern_outOfStock: [
      '.vtex-product-availability-0-x-unavailableContainer',
      '/indisponibil|epuizat|stoc\\s+0|out of stock/i',
    ],
    pattern_whitelistNotFound: ['/404|page not found|pagina nu a fost gasita/i'],
    productPagePatterns: ['auchan\\.ro\\/[^/?#]+\\/p(?:$|[?#])'],
    identifierSelectors: [],
    originalPriceSelectors: [
      { selector: '.auchan-store-theme-4-x-listPrice', priority: 1 },
      { selector: '.vtex-product-price-1-x-listPrice--pdp', priority: 2 },
    ],
    priceBadContextSelectors: [
      '.auchan-geo-coords-shipping-simulator-0-x-shippingTableCell',
      '.auchan-store-theme-4-x-currencyContainer',
    ],
    priceContainerScoreBoosts: [
      { selector: '.vtex-product-price-1-x-currencyContainer--pdp', boost: 15 },
      { selector: '.auchan-store-theme-4-x-pricePdpContainer', boost: 10 },
    ],
    priceOverrideSelector: 'meta[property="product:price:amount"]',
    priceOverrideAttribute: 'content',
    variantPriceSelector: '.vtex-product-price-1-x-currencyContainer--pdp',
    variantObserverSelector: '.vtex-product-price-1-x-currencyContainer--pdp',
    variantObserverDebounceMs: 1500,
    canonicalUrlStripParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', '_ga', '_gl', 'gclid', 'fbclid', 'ref', 'sc'],
    productCodeUrlPatterns: ['^\\/([^\\/?#]+)\\/p$'],
    listingCardSelector: '.vtex-search-result-3-x-galleryItem',
    listingAnchorSelector: '.vtex-product-summary-2-x-clearLink',
    listingPriceSelector: '.vtex-product-price-1-x-currencyContainer--shelfPrice',
    listingBadgeMountSelector: '.auchan-store-theme-4-x-pricePlpContainer',
  },




  {
    link: 'notino.ro',
    displayName: 'Notino',
    injectTarget: 'button',
    selectors_inject: ['[data-testid="price-variant"][content]', '[data-testid="pd-price-wrapper"]'],
    selectors_inject_waitFor: ['h1[data-testid="pd-header-title"]', 'h1'],
    selectors_checkPrice: ['[data-testid="price-variant"][content]', '/\"price\":\\s*(\\d+)/i'],
    pattern_inStock: ['/[IiÎî]n stoc/i'],
    pattern_outOfStock: ['/nu este disponibil|epuizat|sold out|out of stock|indisponibil/i'],
    pattern_whitelistNotFound: ['/(?:title>|eroare\\s*)404|pagina nu a fost|nu s-a spart nimic/i'],
    productPagePatterns: ['notino\\.ro\\/[^/]+\\/[^/]+'],
    titleSelector: 'h1[data-testid="pd-header-title"]',
    selectedVariantContainerSelector: '#pdSelectedVariant',
    variantPriceSelector: '[data-testid="price-variant"][content], .pd-variant-selected [data-testid="price-variant"][content]',
    variantPriceAttribute: 'content',
    variantSizeSelector: '.pd-variant-selected .pd-variant-label, #pdSelectedVariant [aria-live="assertive"], #pdSelectedVariant [aria-live="assertive"] span',
    priceParseMode: 'text',
    priceBadContextSelectors: ['/\\d+[,.]?\\d*\\s*RON\\s*\\/\\s*\\d+\\s*ml/i'],
    canonicalUrlStripParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'gclid', 'fbclid'],
    productCodeUrlPatterns: ['\\/p-(\\d+)\\/'],
    identifierSelectors: [],
    listingCardSelector: '[data-testid="product-container"]',
    listingAnchorSelector: '[data-testid="product-container"] a[href]',
    listingPriceSelector: '[data-testid="price-component"], [data-testid="product-price"]',
    listingBadgeMountSelector: '[data-testid="product-price"]',
  },





  {
    link: 'sephora.ro',
    displayName: 'Sephora',
    injectTarget: '.price-block-right',
    selectors_inject: ['meta[itemprop="price"]', '.price-sales-standard'],
    selectors_inject_waitFor: ['.price-block-right', 'h1'],
    selectors_checkPrice: ['meta[itemprop="price"]', '.price-sales-standard'],
    pattern_inStock: ['meta[itemprop="availability"][content*="InStock"]', '.availability-status.instock'],
    pattern_outOfStock: ['meta[itemprop="availability"][content*="OutOfStock"]'],
    pattern_whitelistNotFound: ['/(?:title>|eroare\\s*)404|pagina solicitata nu mai exista/i', '/nu am gasit/i'],
    productPagePatterns: ['sephora\\.ro\\/p\\/.+\\.html'],
    identifierSelectors: [
      { selector: 'meta[itemprop="sku"]', field: 'sku', attribute: 'content' },
      { selector: 'meta[itemprop="productid"]', field: 'mpn', attribute: 'content' },
    ],
    originalPriceSelectors: [
      { selector: '.product-price.st-price', priority: 1 },
    ],
    priceParseMode: 'text',
    priceContainerSelector: '.price-block-right',
    priceBadContextSelectors: ['.unit-price', '/lei\\s*\\/\\s*\\d+\\s*ml/i', '/lei\\s*\\/\\s*\\d+\\s*g/i'],
    priceContainerScoreBoosts: [
      { selector: '.price-block-right', boost: 15 },
      { selector: '.price-sales-standard', boost: 10 },
      { selector: '.product-price-wrapper', boost: 5 },
    ],
    selectedVariantContainerSelector: 'li.parfum-product.selected, .variation-button-line.selected',
    variantPriceSelector: 'meta[itemprop="price"], .product-variant-price-wrapper .price-sales-standard, .product-price.st-price .price-sales-standard',
    variantPriceAttribute: 'content',
    variantSizeSelector: 'span.variation-title.bidirectional, span.variation-title, .variation-title span',
    variantSkuSelector: 'meta[itemprop="sku"], .variation-button[data-pid]',
    variantSkuAttribute: 'data-pid',
    variantPidSelector: 'a.variation-display-name, .variation-button[data-pid]',
    variantPidAttribute: 'data-pid',
    titleSelector: 'h1[itemprop="name"], h1.product-name, h1',
    variantObserverSelector: '.product-variations, .colorguide-variations, #colorguide-modal',
    variantObserverDebounceMs: 1500,
    canonicalUrlStripParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'gclid', 'fbclid', 'dclid'],
    productCodeUrlPatterns: ['\\/p\\/.*-P(\\d+)\\.html'],
    listingCardSelector: 'div.product-tile',
    listingAnchorSelector: 'a.product-tile-link[href*="/p/"]',
    listingPriceSelector: '.product-min-price, .price-sales-standard',
    listingBadgeMountSelector: '.product-pricing, .product-price',
  },




  {
    link: 'dedeman.ro',
    displayName: 'Dedeman',
    injectTarget: '.alternative-special-price.special-price, .price-box.price-final_price',
    selectors_inject: [
      'meta[itemprop="price"]',
      '.alternative-special-price.special-price [data-price-amount]',
      '.price-box.price-final_price [data-price-type="finalPrice"][data-price-amount]',
    ],
    selectors_inject_waitFor: ['.price-box', '.product-info-price'],
    selectors_checkPrice: [
      'meta[itemprop="price"]',
      '.alternative-special-price.special-price [data-price-amount]',
    ],
    pattern_inStock: ['#product-addtocart-button:not([disabled])', '/\\bin stoc\\b/i'],
    pattern_outOfStock: ['#product-addtocart-button[disabled]', '/stoc\\s+epuizat|indisponibil/i'],
    pattern_whitelistNotFound: ['/Pagina eroare 404/i'],
    productPagePatterns: ['dedeman\\.ro\\/ro\\/[^?#]*\\/p\\/\\d+'],
    identifierSelectors: [
      { selector: '[data-product-id]', field: 'mpn', attribute: 'data-product-id' },
    ],
    originalPriceSelectors: [
      { selector: '.old-alternative-price.old-price [data-price-amount]', attribute: 'data-price-amount', priority: 1 },
      { selector: '.old-price [data-price-amount]', attribute: 'data-price-amount', priority: 2 },
    ],
    priceBadContextSelectors: ['.special-alternative-price'],
    priceContainerScoreBoosts: [
      { selector: '.alternative-special-price.special-price', boost: 12 },
      { selector: '.price-box.price-final_price', boost: 8 },
    ],
    priceOverrideSelector: '.alternative-special-price.special-price [data-price-amount]',
    priceOverrideAttribute: 'data-price-amount',
    canonicalUrlStripParams: ['_gl', '_ga', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'gclid', 'fbclid'],
    productCodeUrlPatterns: ['\\/p\\/(\\d+)(?:\\/|$)'],
    listingCardSelector: '.product-item-info',
    listingAnchorSelector: '.product-item-photo',
    listingPriceSelector: '.special-price .price, .price-box.price-final_price .price',
    listingBadgeMountSelector: '.price-box.price-final_price',
  },


  {
    link: 'cel.ro',
    displayName: 'Cel.ro',
    injectTarget: '.pret_info',
    selectors_inject: ['#product-price', '.pret_n .price', '.pret_info .value'],
    selectors_inject_waitFor: ['.pret_info'],
    selectors_checkPrice: ['#product-price', '.pret_n .price', '/\"price\"\\s*:\\s*([\\d.]+)/i'],
    pattern_inStock: ['.info_stoc.in_stoc', '/\\bin stoc\\b/i'],
    pattern_outOfStock: ['.info_stoc.out_stoc', '.info_stoc.no_stoc', '/stoc\\s+epuizat|indisponibil/i'],
    pattern_whitelistNotFound: ['/(?:title>|eroare\\s*)404/i'],
    productPagePatterns: ['cel\\.ro\\/[^?#]*-p[A-Za-z0-9]+(?:-l)?(?:\\/|$)'],
    identifierSelectors: [
      { selector: 'h1 + *', field: 'mpn' },
    ],
    originalPriceSelectors: [
      { selector: '.pret_n .price_initial, .pret_vechi, del.price', priority: 1 },
    ],
    priceContainerScoreBoosts: [
      { selector: '.pret_info', boost: 10 },
      { selector: '#product-price', boost: 8 },
    ],
    canonicalUrlStripParams: ['_gl', '_ga', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'gclid', 'fbclid'],
    productCodeUrlPatterns: ['-p([A-Za-z0-9]+)(?:-l)?(?:\\/|$)'],
    listingCardSelector: '.product_data.productListing-tot',
    listingAnchorSelector: '.product_data a.product_link',
    listingPriceSelector: '.pret_n .price',
    listingBadgeMountSelector: '.price_part',
  },


  {
    link: 'drmax.ro',
    displayName: 'Dr.Max',
    injectTarget: null,
    selectors_inject: ['.current-price-area .price-text span'],
    selectors_inject_waitFor: ['.current-price-area'],
    selectors_checkPrice: ['.current-price-area .price-text'],
    pattern_inStock: ['[data-test-id="product-detail-availability-in-stock"]'],
    pattern_outOfStock: ['/stoc\\s+epuizat|indisponibil/i'],
    pattern_whitelistNotFound: ['/Pagina nu a fost gasita/i'],
    productPagePatterns: ['drmax\\.ro\\/[a-z0-9][a-z0-9-]+[a-z0-9]$'],
    identifierSelectors: [],
    listingCardSelector: "[data-test-id='category-tile-product'], .tile",
    listingAnchorSelector: "[data-test-id='category-tile-product-link'] a, .tile__link a",
    listingPriceSelector: '.tile__price .tile__price__value',
    listingBadgeMountSelector: '.tile__price',
  },


  {
    link: 'farmaciatei.ro',
    displayName: 'Farmacia Tei',
    injectTarget: null,
    selectors_inject: ['#add-to-cart-btn[data-price]', '.regular-price.text-bold-700'],
    selectors_inject_waitFor: ['#add-to-cart-btn'],
    selectors_checkPrice: ['#add-to-cart-btn[data-price]'],
    pattern_inStock: ['.product-stock-summary .fa-check'],
    pattern_outOfStock: ['/stoc\\s+epuizat|indisponibil/i', '.product-block-out-of-stock'],
    pattern_whitelistNotFound: ['/pagina nu a fost gasita|404/i'],
    productPagePatterns: ['comenzi\\.farmaciatei\\.ro\\/.*-p\\d+$', 'farmaciatei\\.ro\\/.*-p\\d+$'],
    identifierSelectors: [],
    listingCardSelector: '.product-item.product-details',
    listingAnchorSelector: 'a.product-image-listing, a.item-title',
    listingPriceSelector: '.price-box .regular-price .price',
    listingBadgeMountSelector: '.price-wrapper',
  },


  {
    link: 'springfarma.com',
    displayName: 'Spring Farma',
    injectTarget: '.product-info-price',
    selectors_inject: [
      '.product-info-price [data-price-type="finalPrice"]',
      'meta[property="product:price:amount"]',
      '.product-info-price .special-price .price',
      '.product-info-price .price-final_price .price',
    ],
    selectors_inject_waitFor: ['.product-info-main', '.product-info-price'],
    selectors_checkPrice: [
      '.product-info-price [data-price-type="finalPrice"]',
      'meta[property="product:price:amount"]',
      '.product-info-price .price',
    ],
    pattern_inStock: ['.stock.available', '/\\b(?:in|\\u00een)\\s+stoc\\b/i'],
    pattern_outOfStock: ['.stock.unavailable', '/indisponibil/i', '/stoc\\s+epuizat/i'],
    pattern_whitelistNotFound: ['/404|pagina nu a fost gasita|page not found/i'],
    productPagePatterns: ['springfarma\\.com\\/[^/]+\\.html(?:$|[?#])'],
    identifierSelectors: [
      { selector: '.product.attribute.ean td.col.data', field: 'ean' },
    ],
    originalPriceSelectors: [
      { selector: '[data-price-type="oldPrice"]', attribute: 'data-price-amount', priority: 1 },
      { selector: '.old-price .price', priority: 2 },
    ],
    priceContainerSelector: '.product-info-price',
    priceContainerScoreBoosts: [
      { selector: '.product-info-price', boost: 20 },
      { selector: '[data-price-type="finalPrice"]', boost: 15 },
    ],
    priceOverrideSelector: '.product-info-price [data-price-type="finalPrice"]',
    priceOverrideAttribute: 'data-price-amount',
    variantObserverSelector: '.product-info-price',
    variantObserverDebounceMs: 300,
    titleSelector: 'h1.page-title',
    canonicalUrlStripParams: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      '_ga',
      '_gl',
      'gclid',
      'fbclid',
      'ref',
    ],
    canonicalUrlStripPatterns: ['_ga_[A-Z0-9]+=.*?(?:&|$)'],
    productCodeUrlPatterns: [],
    titleStripPrefixes: [],
    listingCardSelector: 'li.product-item',
    listingAnchorSelector: 'a.product-item-link',
    listingPriceSelector: '[data-price-type="finalPrice"] .price',
    listingBadgeMountSelector: '.price-box',
  },


  {
    link: 'elefant.ro',
    displayName: 'Elefant.ro',
    injectTarget: null,
    selectors_inject: ['.product-price .current-price', '.product-price .price'],
    selectors_inject_waitFor: ['.product-price'],
    selectors_checkPrice: ['.product-price .current-price'],
    pattern_inStock: ['/\\bin stoc\\b|disponibil/i'],
    pattern_outOfStock: ['/stoc\\s+epuizat|indisponibil|momentan indisponibil/i'],
    pattern_whitelistNotFound: ['/(?:title>|eroare\\s*)404/i'],
    productPagePatterns: ['elefant\\.ro\\/.*\\/\\d+\\.html', 'elefant\\.ro\\/.*_[a-f0-9]+\\.html'],
    identifierSelectors: [],
    listingCardSelector: '.product-tile, .product-item',
    listingAnchorSelector: "a.product-title[href*='.html']",
    listingPriceSelector: '.product-price .current-price, .product-price .price',
    listingBadgeMountSelector: '.product-price',
  },


  {
    link: 'evomag.ro',
    additionalLinks: ['www.evomag.ro'],
    displayName: 'evoMAG',
    injectTarget: 'div.price_ajax',
    selectors_inject: [
      '[itemprop="price"]',
      'div.pret_rons',
      'div.price_ajax',
    ],
    selectors_inject_waitFor: [
      'body.htmlbody_product',
      'h1.product_name',
      '[itemprop="price"]',
    ],
    selectors_checkPrice: [
      '[itemprop="price"]',
      'div.pret_rons',
    ],
    pattern_inStock: [
      '.stock_instocmagazin',
      '/stoc magazin/i',
      '/in stoc/i',
    ],
    pattern_outOfStock: [
      '.stock_epuizat',
      '/stoc epuizat/i',
      '/indisponibil/i',
      '/produsul nu este disponibil/i',
    ],
    pattern_whitelistNotFound: [
      '/404|pagina nu a fost gasita|page not found/i',
    ],
    productPagePatterns: [
      'evomag\\.ro\\/.*-\\d+\\.html',
    ],
    identifierSelectors: [
      { selector: '.code-value', field: 'mpn' },
    ],
    originalPriceSelectors: [
      { selector: 'div.price_ajax > div:first-child', priority: 1 },
    ],
    priceParseMode: 'int-sup',
    priceContainerSelector: 'div.price_ajax',
    priceDecimalSelector: 'sup.price_sup',
    priceBadContextSelectors: [
      '.product-right-credit',
    ],
    priceContainerScoreBoosts: [
      { selector: '[itemprop="price"]', boost: 50 },
      { selector: 'div.pret_rons', boost: 20 },
      { selector: 'div.price_ajax', boost: 15 },
    ],
    priceOverrideSelector: '[itemprop="price"]',
    priceOverrideAttribute: 'content',
    titleSelector: 'h1.product_name',
    canonicalUrlStripParams: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      '_ga',
      '_gl',
      'gclid',
      'fbclid',
      'ref',
    ],
    canonicalUrlStripPatterns: [
      '_ga_[A-Z0-9]+=.*?(?:&|$)',
    ],
    productCodeUrlPatterns: [
      '-(\\d+)\\.html$',
    ],
    listingCardSelector: '.nice_product_item',
    listingAnchorSelector: '.npi_name a',
    listingPriceSelector: '.real_price',
    listingBadgeMountSelector: '.npi_price',
  },


  {
    link: 'kfea.ro',
    additionalLinks: ['www.kfea.ro'],
    displayName: 'Kfea',
    injectTarget: '.price-box',
    selectors_inject: [
      '.final-price .price-wrapper',
      '.price-final_price',
    ],
    selectors_inject_waitFor: [
      'body.catalog-product-view',
      '.product-info-main',
      '.final-price',
    ],
    selectors_checkPrice: [
      '.final-price .price-wrapper',
      '/"price":\\s*(\\d+\\.?\\d*)/i',
    ],
    identifierSelectors: [
      { selector: '.product-info-main div.flex.text-sm.text-grey-1 > span:last-child', field: 'sku' },
      { selector: '.product-info-main div.flex.text-sm.text-grey-1 > span:last-child', field: 'ean' },
    ],
    pattern_inStock: [
      '.product-info-main p.stock.available',
      '.product-info-main p.available.stock',
      '#product-addtocart-button:not([disabled])',
      '/Disponibilitate:[\\s\\S]{0,160}(?:\\b(?:in|\\u00een)\\s+stoc\\b|disponibil(?:\\s+in\\s+stoc)?)/i',
    ],
    pattern_outOfStock: [
      '.product-info-main p.stock.unavailable',
      '.product-info-main p.unavailable.stock',
      '#product-addtocart-button[disabled]',
      '/Disponibilitate:[\\s\\S]{0,160}(?:stoc\\s+epuizat|indisponibil|produsul\\s+nu\\s+este\\s+disponibil)/i',
    ],
    pattern_whitelistNotFound: [
      '/404|pagina nu a fost gasita|page not found/i',
    ],


    productPagePatterns: ['kfea\\.ro\\/.+'],
    originalPriceSelectors: [
      { selector: '.old-price .price-wrapper', priority: 1 },
      { selector: '.old-price .price', priority: 2 },
    ],
    priceContainerSelector: '.product-info-main',
    priceBadContextSelectors: [
      'span.ml-1',
      'span.font-semibold.text-primary',
    ],
    priceContainerScoreBoosts: [
      { selector: '.final-price .price-wrapper', boost: 30 },
      { selector: '.price-box', boost: 15 },
    ],
    titleSelector: '.product-info-main p.title-font.text-6xl, .product-info-main p.text-6xl, .product-info-main h1, h1.page-title, h1[itemprop="name"], h1',
    canonicalUrlStripParams: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      '_ga',
      '_gl',
      'gclid',
      'fbclid',
      'ref',
    ],
    canonicalUrlStripPatterns: ['_ga_[A-Z0-9]+=.*?(?:&|$)'],
    productCodeUrlPatterns: ['\\/([^\\/\\?#]+)\\/?$'],
    listingCardSelector: '.products-grid .product-item',
    listingAnchorSelector: 'a.product-item-photo',
    listingPriceSelector: '.price-box.price-final_price [data-price-type="finalPrice"] .price, .price-box.price-final_price .special-price .price',
    listingBadgeMountSelector: '.default-prices .price-box.price-final_price, .price-box.price-final_price, [data-role="priceBox"]',
  },


  {
    link: 'libris.ro',
    additionalLinks: ['www.libris.ro'],
    displayName: 'Libris',
    injectTarget: '.item-price',
    selectors_inject: [
      '.price-discount-containerx .pr-pret-redus',
      '.price-prp-containerx .pr-pret-redus',
      '.pr-pret-redus',
    ],
    selectors_inject_waitFor: [
      'h1',
      '.pr-pret-redus',
    ],
    selectors_checkPrice: [
      '.pr-pret-redus',
    ],
    pattern_inStock: [
      '.pr-timp-livrare-text',
      '/[Ii]n stoc/i',
      '/Livrare in/i',
    ],
    pattern_outOfStock: [
      '/stoc epuizat/i',
      '/indisponibil/i',
      '/momentan indisponibil/i',
    ],
    pattern_whitelistNotFound: [
      '/pagina 404|romanul.*Eroare/i',
      'img[alt*=\"404\"]',
    ],
    productPagePatterns: [
      'libris\\.ro\\/(?:carte|carte-engleza|joc|ebook|produs)\\/[^/]+\\/\\d+',
    ],
    identifierSelectors: [
      { selector: 'script[type="application/ld+json"]', field: 'ean', jsonPath: 'gtin13' },
      { selector: 'script[type="application/ld+json"]', field: 'ean', jsonPath: 'isbn' },
      { selector: 'script[type="application/ld+json"]', field: 'mpn', jsonPath: 'sku' },
    ],
    originalPriceSelectors: [
      { selector: '.price-discount-containerx .price-normal', priority: 1 },
      { selector: '.pr-pret-intreg', priority: 2 },
      { selector: '.pr-pret-prp', priority: 3 },
    ],
    titleSelector: 'h1',
    canonicalUrlStripParams: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'gclid',
      'fbclid',
      'srsltid',
    ],
    productCodeUrlPatterns: [
      '\\/(?:carte|carte-engleza|joc|ebook|produs)\\/[^/]+\\/(\\d+)$',
    ],
    listingCardSelector: 'li.categ-prod-item',
    listingAnchorSelector: '.item-title a',
    listingPriceSelector: '.item-price .price-reduced',
    listingBadgeMountSelector: '.item-price',
  },
];








const CONFIG_SOURCE_MODE_DEFAULT = 'hardcoded_only';


function getConfigSourceMode() {
  return CONFIG_SOURCE_MODE_DEFAULT;
}


function getConfigSourceModeForHost() {
  return CONFIG_SOURCE_MODE_DEFAULT;
}


function areDynamicConfigsStale() {
  return false;
}


async function hydrateDynamicConfigsFromStorage() {
  return [];
}


async function loadDynamicConfigs() {
  return [];
}



const EXTRACTION_CONFIG = {

  schemaProductInfoJSON: '<script[^>]*>\\s*(\\[?\\s*\\{\\s*(?:"[^"]+\\"\\s*:\\s*\\"[^"]*\\",\\s*)*[\'\\"]@context[\'\\"]\\s*:\\s*(?:\\{\\s*[\'\\"]@vocab[\'\\"]\\s*:\\s*)?[\'\\"][^\'\\"]*schema\\.org[\\s\\S]*?)(?:<|\\\\x3C)\\/script>',


  schemaDataFix: [
    { find: /,\s*}/g, replace: '}' },
    { find: /(\s*)\/\/\s*("[^"]+"\s*:\s*")/g, replace: '$1$2' }
  ],


  microdataPattern: /(?:itemprop|property)="(price|priceCurrency|availability|product:price:amount|product:price:currency|product:availability|currency)"\s+(?:[a-z]+="[^"]*"\s+)*(?:content|href)="([^"]*)"/gi,
  microdataPatternInverse: /(?:content|href)="([^"]*)"\s+(?:[a-z]+="[^"]*"\s+)*(?:itemprop|property)="(price|priceCurrency|availability|product:price:amount|product:price:currency|product:availability|currency)"/gi,


  whitelistNotFound: /Cloudflare Ray ID|>Ray ID: <|::CLOUDFLARE_ERROR_1|cf-error-details|502 Bad Gateway|500 Internal Server Error|title>403 Forbidden<|title>Just a moment\.\.\.<|cdn-cgi\.styles\.challenges\.css|404.{0,10}Not Found|503.{0,10}Service Unavailable/i,


  waitForMinContentSize: 5000,


  waitForMaxCounter: 15,


  waitForInterval: 1000,


  selectorMatchMax: 12,


  FLAGS: {
    IGNORE_SCHEMA_DATA: 16
  }
};
