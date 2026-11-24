import {
  HERO_BANNER,
  CATEGORY_TILES,
  DEMO_ACCOUNTS,
  SELLERS,
  PRODUCTS,
  SAMPLE_UPLOAD_PHOTOS,
  INITIAL_CONVERSATIONS,
  BODY_SHAPES,
  STYLE_SPECTRUMS,
  DROPOFF_STATIONS,
  POLICY_DOCS,
  INITIAL_SUBMISSIONS
} from "./data.js";

const SHARED_STORAGE_KEY = "cfd_shared_v3";
const TAB_USER_KEY = "cfd_tab_user_v3";
const CHANNEL_NAME = "cfd_live_sync_v3";
const FREE_SHIP_THRESHOLD = 299000;
const TAB_ID = `tab_${Math.random().toString(36).slice(2, 10)}`;

let syncChannel = null;
try {
  if ("BroadcastChannel" in window) {
    syncChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  syncChannel = null;
}

function getDefaultSharedState() {
  return {
    users: DEMO_ACCOUNTS.map((u) => ({ ...u })),
    userProducts: [],
    conversations: INITIAL_CONVERSATIONS.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({ ...m }))
    })),
    orders: [
      {
        id: "CFD-ORD-2084",
        userId: "acc_buyer",
        items: [{ id: "CFD-SEC-005", name: "Áo Thun Cotton Trắng Form Chuẩn", price: 85000 }],
        total: 85000,
        method: "Ví MoMo (Escrow CFD)",
        station: "Trạm KTX ĐHQG-HCM",
        status: "Đã xác nhận Escrow",
        createdAt: "20/11/2026"
      }
    ],
    submissions: [...INITIAL_SUBMISSIONS],
    userCarts: {
      guest: ["CFD-UPC-001", "CFD-SEC-005"],
      acc_buyer: ["CFD-UPC-001", "CFD-SEC-005"],
      acc_seller: []
    },
    userWishlists: {
      guest: ["CFD-SEC-003", "CFD-UPC-008"],
      acc_buyer: ["CFD-SEC-003", "CFD-UPC-008"],
      acc_seller: []
    },
    userAgreedPrices: {},
    tabPresence: {}
  };
}

const state = {
  shared: getDefaultSharedState(),
  currentUserId: null,
  activeView: "market",
  filters: {
    search: "",
    tier: "all",
    category: "all",
    style: "all",
    priceRange: "all",
    sort: "featured"
  },
  aiConfig: {
    bodyShape: "pear",
    style: "Streetwear",
    budget: 520000,
    occasion: "Đi học / Hằng ngày",
    anchorId: ""
  },
  aiShuffleSeed: 0,
  sellMode: "c2c", // "c2c" | "cfd"
  c2cForm: {
    name: "",
    category: "Áo",
    brand: "",
    size: "M (Free)",
    style: "Streetwear",
    price: 160000,
    originalPrice: 450000,
    fabric: "100% Cotton",
    condition: "Độ mới 95% • Đã giặt sạch, không lỗi",
    image: SAMPLE_UPLOAD_PHOTOS[0].url
  },
  sellForm: {
    itemName: "Áo Khoác Jean Oversize Vintage",
    category: "Áo khoác",
    originalPrice: 550000,
    condition: "95",
    noStructuralDamage: true,
    noSurfaceDefect: true,
    preWashed: true,
    payoutMode: "consign",
    stationId: "ktx-b"
  },
  voucherCode: "",
  checkoutDoneOrder: null,
  activeChatId: null,
  chatThreadOpenMobile: false,
  offerBoxOpen: false,
  autoReplyEnabled: true,
  authTab: "login",
  accountTab: "orders"
};

/* ==================== STORAGE & CROSS-TAB SYNC ==================== */

function loadSharedState() {
  try {
    const raw = localStorage.getItem(SHARED_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const def = getDefaultSharedState();
    state.shared = {
      ...def,
      ...parsed,
      users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : def.users,
      userProducts: Array.isArray(parsed.userProducts) ? parsed.userProducts : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : def.conversations,
      orders: Array.isArray(parsed.orders) ? parsed.orders : def.orders,
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : def.submissions,
      userCarts: parsed.userCarts || def.userCarts,
      userWishlists: parsed.userWishlists || def.userWishlists,
      userAgreedPrices: parsed.userAgreedPrices || {},
      tabPresence: parsed.tabPresence || {}
    };
  } catch {
    // Ignore storage read error
  }
}

function saveSharedState(broadcast = true) {
  try {
    localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(state.shared));
    if (broadcast && syncChannel) {
      syncChannel.postMessage({ type: "SYNC_STATE", fromTab: TAB_ID });
    }
  } catch {
    showToast("Bộ nhớ trình duyệt đầy — hãy thử ảnh nhỏ hơn hoặc xóa bớt tin cũ.");
  }
}

function loadTabUser() {
  try {
    const uid = sessionStorage.getItem(TAB_USER_KEY);
    if (uid && state.shared.users.some((u) => u.id === uid)) {
      state.currentUserId = uid;
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

function setTabUser(userId) {
  state.currentUserId = userId;
  try {
    if (userId) sessionStorage.setItem(TAB_USER_KEY, userId);
    else sessionStorage.removeItem(TAB_USER_KEY);
  } catch {
    // Ignore
  }
  updatePresence();
  renderHeaderBadges();
  renderCartDrawer();
  renderWishlistDrawer();
}

function updatePresence(remove = false) {
  loadSharedState();
  const now = Date.now();
  const next = {};
  Object.entries(state.shared.tabPresence || {}).forEach(([tid, info]) => {
    if (info && now - info.ts < 15000 && tid !== TAB_ID) {
      next[tid] = info;
    }
  });
  if (!remove && state.currentUserId) {
    next[TAB_ID] = { userId: state.currentUserId, ts: now };
  }
  state.shared.tabPresence = next;
  saveSharedState(false);
}

function isUserLiveInOtherTab(userId) {
  const now = Date.now();
  return Object.entries(state.shared.tabPresence || {}).some(
    ([tid, info]) => tid !== TAB_ID && info && info.userId === userId && now - info.ts < 15000
  );
}

/* ==================== USER & DATA HELPERS ==================== */

function getCurrentUser() {
  if (!state.currentUserId) return null;
  return state.shared.users.find((u) => u.id === state.currentUserId) || null;
}

function getUserBucketKey() {
  return state.currentUserId || "guest";
}

function getCartIds() {
  const key = getUserBucketKey();
  return state.shared.userCarts[key] || [];
}

function setCartIds(ids) {
  const key = getUserBucketKey();
  state.shared.userCarts[key] = ids;
  saveSharedState();
}

function getWishlistIds() {
  const key = getUserBucketKey();
  return state.shared.userWishlists[key] || [];
}

function setWishlistIds(ids) {
  const key = getUserBucketKey();
  state.shared.userWishlists[key] = ids;
  saveSharedState();
}

function getAgreedPrices() {
  const key = getUserBucketKey();
  return state.shared.userAgreedPrices[key] || {};
}

function getEffectivePrice(product, forUserId = getUserBucketKey()) {
  const agreedMap = state.shared.userAgreedPrices[forUserId] || {};
  return agreedMap[product.id] || product.price;
}

function getAllProducts() {
  return [...state.shared.userProducts, ...PRODUCTS];
}

function getSellerProfile(sellerId) {
  if (SELLERS[sellerId]) return SELLERS[sellerId];
  const user = state.shared.users.find((u) => u.id === sellerId);
  if (user) {
    return {
      id: user.id,
      name: user.name,
      initials: user.initials || user.name.slice(0, 2).toUpperCase(),
      location: user.location || "TP.HCM",
      rating: user.rating || 5.0,
      responseTime: "Thành viên đang hoạt động"
    };
  }
  return SELLERS.seller_cfd;
}

function getUnreadChatCount() {
  const uid = state.currentUserId;
  if (!uid) return 0;
  return state.shared.conversations.filter(
    (c) => (c.buyerId === uid || c.sellerId === uid) && (c.unreadFor || []).includes(uid)
  ).length;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatVND(amount) {
  return Number(amount).toLocaleString("vi-VN") + "đ";
}

function formatTimeNow() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function showToast(message) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3200);
}

/* ==================== FILTER & AI STYLIST ENGINE ==================== */

function getFilteredProducts() {
  const { search, tier, category, style, priceRange, sort } = state.filters;
  const q = search.trim().toLowerCase();
  const all = getAllProducts();

  let list = all.filter((p) => {
    if (q) {
      const seller = getSellerProfile(p.sellerId);
      const hay = `${p.name} ${p.brand} ${p.category} ${p.style} ${p.fabric} ${p.id} ${seller.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (tier !== "all" && p.tier !== tier) return false;
    if (category !== "all" && p.category !== category) return false;
    if (style !== "all" && p.style !== style) return false;
    if (priceRange === "under150" && p.price >= 150000) return false;
    if (priceRange === "150to250" && (p.price < 150000 || p.price > 250000)) return false;
    if (priceRange === "above250" && p.price <= 250000) return false;
    return true;
  });

  if (sort === "price-asc") {
    list = [...list].sort((a, b) => a.price - b.price);
  } else if (sort === "price-desc") {
    list = [...list].sort((a, b) => b.price - a.price);
  } else if (sort === "discount-desc") {
    list = [...list].sort(
      (a, b) => (b.originalPrice - b.price) / b.originalPrice - (a.originalPrice - a.price) / a.originalPrice
    );
  }
  return list;
}

function scorePieceBody(piece, bodyShape) {
  if (Array.isArray(piece.preferredBodies) && piece.preferredBodies.includes(bodyShape)) return 16;
  if (Array.isArray(piece.goodBodies) && piece.goodBodies.includes(bodyShape)) return 6;
  if (Array.isArray(piece.bodyFit) && piece.bodyFit.includes(bodyShape)) return 8;
  return -8;
}

function generateAIOutfits(cfg, shuffleSeed = 0) {
  const all = getAllProducts();
  const anchor = all.find((p) => p.id === cfg.anchorId) || null;
  const outers = all.filter((p) => p.slot === "outer");
  const tops = all.filter((p) => p.slot === "top");
  const bottoms = all.filter((p) => p.slot === "bottom");
  const dresses = all.filter((p) => p.slot === "dress");
  const accs = all.filter((p) => p.slot === "accessory");

  const candidates = [];

  function evaluateCombo(pieces) {
    if (anchor && !pieces.some((p) => p.id === anchor.id)) return;
    const totalPrice = pieces.reduce((sum, p) => sum + p.price, 0);
    const totalOriginal = pieces.reduce((sum, p) => sum + p.originalPrice, 0);

    let score = 45;
    const bodyAvg = pieces.reduce((sum, p) => sum + scorePieceBody(p, cfg.bodyShape), 0) / pieces.length;
    score += bodyAvg;

    const styleHits = pieces.filter((p) => p.style === cfg.style).length;
    score += styleHits * 15;

    const occasionHits = pieces.filter((p) => Array.isArray(p.occasions) && p.occasions.includes(cfg.occasion)).length;
    score += occasionHits * 9;

    // Budget sweet spot: reward sets near target budget without exceeding
    if (totalPrice <= cfg.budget) {
      score += totalPrice >= cfg.budget * 0.52 ? 12 : 5;
    } else {
      score -= Math.min(28, Math.round((totalPrice - cfg.budget) / 20000) * 4);
    }

    // Slight variety jitter only when user clicks Shuffle
    if (shuffleSeed > 0) {
      const hash = pieces.reduce((acc, p) => acc + p.id.charCodeAt(p.id.length - 1), 0);
      score += ((hash + shuffleSeed * 7) % 11) - 5;
    }

    const finalScore = Math.max(66, Math.min(99, Math.round(score)));
    const totalCo2 = pieces.reduce((s, p) => s + p.co2SavedKg, 0);
    const discountPct = Math.round(((totalOriginal - totalPrice) / totalOriginal) * 100);
    const outer = pieces.find((p) => p.slot === "outer") || null;
    const mainTop = pieces.find((p) => p.slot === "top" || p.slot === "dress") || null;
    const bottom = pieces.find((p) => p.slot === "bottom") || null;
    const acc = pieces.find((p) => p.slot === "accessory") || null;

    candidates.push({
      id: pieces.map((p) => p.id).join("-"),
      pieces,
      outer,
      mainTop,
      bottom,
      accessory: acc,
      score: finalScore,
      totalPrice,
      totalOriginal,
      discountPct,
      totalCo2,
      withinBudget: totalPrice <= cfg.budget
    });
  }

  // 1. Top + Bottom (+ optional Outer) + Accessory combos
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const outer of [null, ...outers]) {
        for (const acc of accs) {
          evaluateCombo([outer, top, bottom, acc].filter(Boolean));
        }
      }
    }
  }

  // 2. Dress (+ optional Outer) + Accessory combos
  for (const dress of dresses) {
    for (const outer of [null, ...outers]) {
      for (const acc of accs) {
        evaluateCombo([outer, dress, acc].filter(Boolean));
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice);

  // Strict diversity selection: avoid repeating mainTop, bottom, or outer across the 4 looks (unless pinned)
  const picked = [];
  const usedMain = new Set();
  const usedBottom = new Set();
  const usedOuter = new Set();
  const usedSigs = new Set();

  for (const c of candidates) {
    if (usedSigs.has(c.id)) continue;
    const mainId = c.mainTop?.id;
    const botId = c.bottom?.id;
    const outId = c.outer?.id;

    if (mainId && mainId !== cfg.anchorId && usedMain.has(mainId)) continue;
    if (botId && botId !== cfg.anchorId && usedBottom.has(botId)) continue;
    if (outId && outId !== cfg.anchorId && usedOuter.has(outId)) continue;

    picked.push(c);
    usedSigs.add(c.id);
    if (mainId) usedMain.add(mainId);
    if (botId) usedBottom.add(botId);
    if (outId) usedOuter.add(outId);
    if (picked.length >= 4) break;
  }

  // Fallback fill if anchor pinned reduces unique combinations
  if (picked.length < 4) {
    for (const c of candidates) {
      if (usedSigs.has(c.id)) continue;
      picked.push(c);
      usedSigs.add(c.id);
      if (picked.length >= 4) break;
    }
  }

  return picked;
}

/* ==================== STOREFRONT VIEW ==================== */

function renderProductCardsHTML(products) {
  if (!products.length) {
    return `<div class="empty-state" style="grid-column: 1 / -1;">
         <p><strong>Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.</strong></p>
         <button class="btn-outline btn-sm" id="reset-filters-empty-btn">Xóa bộ lọc để xem toàn bộ sản phẩm</button>
       </div>`;
  }

  const cartIds = getCartIds();
  const wishlistIds = getWishlistIds();

  return products
    .map((p) => {
      const savePct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
      const inCart = cartIds.includes(p.id);
      const isSaved = wishlistIds.includes(p.id);
      const seller = getSellerProfile(p.sellerId);
      const effectivePrice = getEffectivePrice(p);

      let badgeHtml = `<span class="card-tag sale">-${savePct}%</span>`;
      if (p.tier === "B") badgeHtml = `<span class="card-tag upcycled">Upcycled</span>`;
      else if (p.tier === "C2C") badgeHtml = `<span class="card-tag c2c">Thành viên bán</span>`;

      return `
        <article class="product-card" data-product-id="${p.id}">
          <div class="product-media" data-open-product="${p.id}">
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />
            ${badgeHtml}
            <button
              class="wishlist-toggle ${isSaved ? "active" : ""}"
              data-toggle-wish="${p.id}"
              aria-label="${isSaved ? "Bỏ yêu thích" : "Thêm vào yêu thích"}"
              title="${isSaved ? "Đã lưu" : "Lưu yêu thích"}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </button>
            <button class="quick-add-bar" data-add-cart="${p.id}">
              ${inCart ? "✓ Đã có trong giỏ hàng" : "+ Thêm nhanh vào giỏ"}
            </button>
          </div>
          <div class="product-info">
            <div class="product-meta-row">
              <span>${escapeHtml(seller.name)}</span>
              <span>Size ${escapeHtml(p.size.split(" ")[0])}</span>
            </div>
            <h3 class="product-title" data-open-product="${p.id}">${escapeHtml(p.name)}</h3>
            <div class="product-price-row">
              <span class="price-now">${formatVND(effectivePrice)}</span>
              <span class="price-old">${formatVND(p.originalPrice)}</span>
            </div>
            <div class="product-bottom-meta">
              <span class="swatch-dots" title="${escapeHtml(p.colorName || p.style)}">
                ${(p.colors || ["#111111"]).map((c) => `<span class="swatch-dot" style="background:${c}"></span>`).join("")}
              </span>
              <span class="hygiene-note">${p.tier === "C2C" ? "💬 Chat trực tiếp" : "✓ Đã giặt hấp"}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMarketplaceView() {
  const allProducts = getAllProducts();
  const products = getFilteredProducts();
  const f = state.filters;
  const cardsHtml = renderProductCardsHTML(products);

  const tierOptions = [
    ["all", "Tất cả sản phẩm"],
    ["A", "Secondhand Tuyển Chọn"],
    ["B", "Upcycled Độc Bản"],
    ["C2C", "Thành viên đăng bán"]
  ];
  const categoryOptions = ["all", "Áo khoác", "Áo", "Quần", "Váy & Đầm", "Túi & Phụ kiện"];
  const styleOptions = ["all", "Streetwear", "Minimalist", "Y2K Vintage", "Eco-Vintage"];
  const priceOptions = [
    ["all", "Tất cả mức giá"],
    ["under150", "Dưới 150.000đ"],
    ["150to250", "150.000đ – 250.000đ"],
    ["above250", "Trên 250.000đ"]
  ];

  return `
    <section class="view-section">
      <div class="hero-banner">
        <img class="hero-bg-img" src="${escapeHtml(HERO_BANNER.image)}" alt="Thời trang tuần hoàn CFD" />
        <div class="hero-scrim"></div>
        <div class="container">
          <div class="hero-inner">
            <div class="hero-kicker">${HERO_BANNER.kicker}</div>
            <h1 class="hero-title">${HERO_BANNER.title}</h1>
            <p class="hero-subtitle">${HERO_BANNER.subtitle}</p>
            <div class="hero-actions">
              <button class="btn-hero-white" id="hero-shop-btn">Mua sắm ngay</button>
              <button class="btn-hero-ghost" data-nav="ai-stylist">Phối đồ cùng AI</button>
              <button class="btn-hero-ghost" data-nav="sell">Đăng bán ngay</button>
            </div>
          </div>
        </div>
      </div>

      <div class="usp-strip">
        <div class="container usp-grid">
          <div class="usp-item">
            <div class="usp-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <div>
              <div class="usp-title">Kiểm định 3-Không</div>
              <div class="usp-desc">Không rách thủng, không xù ố</div>
            </div>
          </div>
          <div class="usp-item">
            <div class="usp-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <div class="usp-title">Chat &amp; Trả giá trực tiếp</div>
              <div class="usp-desc">Trao đổi với người bán trước khi mua</div>
            </div>
          </div>
          <div class="usp-item">
            <div class="usp-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
            <div>
              <div class="usp-title">Bảo vệ thanh toán Escrow</div>
              <div class="usp-desc">Đổi trả 7 ngày nếu sai mô tả</div>
            </div>
          </div>
          <div class="usp-item">
            <div class="usp-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/></svg>
            </div>
            <div>
              <div class="usp-title">Freeship từ 299.000đ</div>
              <div class="usp-desc">Đóng gói bằng bao bì sinh học</div>
            </div>
          </div>
        </div>
      </div>

      <div class="container section-block">
        <div class="section-header-row">
          <div>
            <h2 class="section-heading">Danh mục nổi bật</h2>
            <p class="section-lead">Chọn nhanh theo nhóm trang phục hoặc phong cách yêu thích</p>
          </div>
        </div>

        <div class="category-grid">
          ${CATEGORY_TILES.map(
            (cat) => `
            <button class="category-tile" data-cat-jump="${escapeHtml(cat.id)}">
              <img src="${escapeHtml(cat.image)}" alt="${escapeHtml(cat.title)}" loading="lazy" />
              <div class="category-tile-overlay">
                <div class="category-tile-title">${escapeHtml(cat.title)}</div>
                <div class="category-tile-sub">${escapeHtml(cat.subtitle)}</div>
              </div>
            </button>
          `
          ).join("")}
        </div>
      </div>

      <div class="container section-block" id="catalog-anchor">
        <div class="section-header-row">
          <div>
            <h2 class="section-heading">Sản phẩm đang mở bán</h2>
            <p class="section-lead">Bấm vào sản phẩm để xem số đo thực tế, nhắn tin trả giá hoặc mua ngay</p>
          </div>
        </div>

        <div class="mobile-filter-pills">
          ${categoryOptions
            .map(
              (cat) =>
                `<button class="filter-pill ${f.category === cat ? "active" : ""}" data-filter-cat="${cat}">${cat === "all" ? "Tất cả" : cat}</button>`
            )
            .join("")}
          ${tierOptions
            .slice(1)
            .map(
              ([val, lbl]) =>
                `<button class="filter-pill ${f.tier === val ? "active" : ""}" data-filter-tier="${val}">${lbl}</button>`
            )
            .join("")}
        </div>

        <div class="shop-layout">
          <aside class="filter-sidebar" aria-label="Bộ lọc sản phẩm">
            <div class="filter-sidebar-head">
              <h3>Bộ lọc</h3>
              <button class="text-reset-btn" id="reset-filters-btn">Xóa tất cả</button>
            </div>

            <div class="filter-group">
              <div class="filter-group-title">Phân loại</div>
              <div class="filter-option-list">
                ${tierOptions
                  .map(
                    ([val, label]) => `
                  <button class="filter-list-btn ${f.tier === val ? "active" : ""}" data-filter-tier="${val}">
                    <span>${label}</span>
                  </button>`
                  )
                  .join("")}
              </div>
            </div>

            <div class="filter-group">
              <div class="filter-group-title">Danh mục</div>
              <div class="filter-option-list">
                ${categoryOptions
                  .map(
                    (cat) => `
                  <button class="filter-list-btn ${f.category === cat ? "active" : ""}" data-filter-cat="${cat}">
                    <span>${cat === "all" ? "Tất cả danh mục" : cat}</span>
                  </button>`
                  )
                  .join("")}
              </div>
            </div>

            <div class="filter-group">
              <div class="filter-group-title">Phong cách</div>
              <div class="filter-option-list">
                ${styleOptions
                  .map(
                    (st) => `
                  <button class="filter-list-btn ${f.style === st ? "active" : ""}" data-filter-style="${st}">
                    <span>${st === "all" ? "Tất cả phong cách" : st}</span>
                  </button>`
                  )
                  .join("")}
              </div>
            </div>

            <div class="filter-group">
              <div class="filter-group-title">Mức giá</div>
              <div class="filter-option-list">
                ${priceOptions
                  .map(
                    ([val, lbl]) => `
                  <button class="filter-list-btn ${f.priceRange === val ? "active" : ""}" data-filter-price="${val}">
                    <span>${lbl}</span>
                  </button>`
                  )
                  .join("")}
              </div>
            </div>
          </aside>

          <div>
            <div class="catalog-toolbar">
              <div class="catalog-search-inline">
                <svg class="header-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  type="search"
                  id="catalog-search-input"
                  placeholder="Tìm tên sản phẩm, shop bán, chất liệu..."
                  value="${escapeHtml(f.search)}"
                />
              </div>

              <div class="catalog-toolbar-right">
                <span class="muted-xs tabular" id="market-count-label" style="margin:0;">
                  Hiển thị <strong>${products.length}</strong> / ${allProducts.length} sản phẩm
                </span>
                <select id="market-sort-select" class="select-control" aria-label="Sắp xếp">
                  <option value="featured" ${f.sort === "featured" ? "selected" : ""}>Sắp xếp: Nổi bật</option>
                  <option value="price-asc" ${f.sort === "price-asc" ? "selected" : ""}>Giá: Thấp đến cao</option>
                  <option value="price-desc" ${f.sort === "price-desc" ? "selected" : ""}>Giá: Cao đến thấp</option>
                  <option value="discount-desc" ${f.sort === "discount-desc" ? "selected" : ""}>Giảm % nhiều nhất</option>
                </select>
              </div>
            </div>

            <div class="product-grid" id="market-product-grid">
              ${cardsHtml}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* ==================== AI STYLIST VIEW ==================== */

function renderAIOutfitsStackHTML(cfg) {
  const outfits = generateAIOutfits(cfg, state.aiShuffleSeed);
  const selectedBody = BODY_SHAPES.find((b) => b.id === cfg.bodyShape) || BODY_SHAPES[0];

  if (!outfits.length) {
    return `<div class="empty-state"><p>Không tìm thấy bộ phối phù hợp khi ghim món đồ này. Hãy thử tăng ngân sách hoặc bỏ ghim.</p></div>`;
  }

  return `
    ${outfits
      .map(
        (outfit, idx) => `
      <article class="outfit-card ${idx === 0 ? "best-match" : ""}">
        <div class="outfit-header">
          <div>
            <div class="muted-xs" style="text-transform:uppercase; letter-spacing:0.06em;">
              ${idx === 0 ? "LOOK 01 • GỢI Ý TỐI ƯU NHẤT" : `LOOK 0${idx + 1} • PHƯƠNG ÁN ĐA DẠNG`} • ${escapeHtml(cfg.occasion)}
            </div>
            <h3 style="margin:3px 0 0; font-size:18px;">
              Set ${escapeHtml(cfg.style)} cho ${escapeHtml(selectedBody.name)}
            </h3>
          </div>
          <span class="match-score-pill">Phù hợp ${outfit.score}%</span>
        </div>

        <div class="outfit-pieces">
          ${outfit.pieces
            .map(
              (piece) => `
            <div class="piece-mini" data-open-product="${piece.id}">
              <div class="piece-mini-img">
                <img src="${escapeHtml(piece.image)}" alt="${escapeHtml(piece.name)}" loading="lazy" />
              </div>
              <div class="piece-role">${
                piece.slot === "outer"
                  ? "Khoác ngoài"
                  : piece.slot === "dress"
                  ? "Đầm / Váy liền"
                  : piece.slot === "top"
                  ? "Áo chính"
                  : piece.slot === "bottom"
                  ? "Quần / Chân váy"
                  : "Phụ kiện"
              }</div>
              <div style="font-size:12.5px; font-weight:600; line-height:1.3">${escapeHtml(piece.name)}</div>
              <div class="tabular" style="font-size:13px; font-weight:700">${formatVND(piece.price)}</div>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="ai-explain-box">
          <strong>Vì sao AI chọn set này:</strong> ${selectedBody.rule}
          Phom <em>${outfit.pieces.map((p) => p.silhouetteTag).join(" + ")}</em> cùng tông màu
          <strong>${outfit.pieces.map((p) => p.colorName.split("/")[0].trim()).join(" / ")}</strong> rất hợp dịp <em>${escapeHtml(cfg.occasion)}</em>.
          ${outfit.withinBudget ? "" : " (Tổng bộ nhỉnh hơn nhẹ mức ngân sách đang chọn.)"}
        </div>

        <div class="outfit-footer">
          <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:center;" class="tabular">
            <div>
              <div class="muted-xs">Tổng giá cả set</div>
              <strong style="font-size:18px">${formatVND(outfit.totalPrice)}</strong>
              <span class="price-old" style="margin-left:6px">${formatVND(outfit.totalOriginal)}</span>
            </div>
            <div>
              <div class="muted-xs">Tiết kiệm</div>
              <strong style="color:var(--sale)">-${outfit.discountPct}%</strong>
            </div>
            <div>
              <div class="muted-xs">Giảm phát thải</div>
              <strong style="color:var(--eco)">-${outfit.totalCo2.toFixed(1)} kg CO₂</strong>
            </div>
          </div>

          <button class="btn-primary" data-add-outfit='${JSON.stringify(outfit.pieces.map((p) => p.id))}'>
            + Thêm cả ${outfit.pieces.length} món vào giỏ
          </button>
        </div>
      </article>
    `
      )
      .join("")}
  `;
}

function renderAIStylistView() {
  const cfg = state.aiConfig;
  const allProducts = getAllProducts();

  return `
    <section class="view-section">
      <div class="page-header-strip">
        <div class="container" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h1>Phối đồ AI thông minh</h1>
            <p>Đề xuất 4 bộ trang phục khác nhau hoàn toàn theo vóc dáng, phong cách, dịp mặc và ngân sách từ kho ${allProducts.length} sản phẩm.</p>
          </div>
          <button class="btn-outline" id="ai-shuffle-btn">↻ Đổi 4 gợi ý khác</button>
        </div>
      </div>

      <div class="container ai-lab-grid">
        <div class="panel-card panel-card-muted">
          <div class="control-group">
            <div class="control-label"><span>1. Vóc dáng cơ thể</span></div>
            <div class="option-grid">
              ${BODY_SHAPES.map(
                (b) => `
                <button class="option-btn ${cfg.bodyShape === b.id ? "active" : ""}" data-ai-body="${b.id}">
                  <span class="option-btn-title">${b.name}</span>
                  <span class="option-btn-sub">${b.desc}</span>
                </button>
              `
              ).join("")}
            </div>
          </div>

          <div class="control-group">
            <div class="control-label"><span>2. Phong cách ưu tiên</span></div>
            <div class="option-grid">
              ${STYLE_SPECTRUMS.map(
                (s) => `
                <button class="option-btn ${cfg.style === s.id ? "active" : ""}" data-ai-style="${s.id}">
                  <span class="option-btn-title">${s.name}</span>
                  <span class="option-btn-sub">${s.desc}</span>
                </button>
              `
              ).join("")}
            </div>
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>3. Ngân sách tối đa cho cả bộ</span>
              <strong id="ai-budget-label" class="tabular">${formatVND(cfg.budget)}</strong>
            </div>
            <input
              type="range"
              id="ai-budget-slider"
              class="range-input"
              min="220000"
              max="850000"
              step="25000"
              value="${cfg.budget}"
            />
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--ink-subtle)">
              <span>220.000đ</span>
              <span>850.000đ</span>
            </div>
          </div>

          <div class="control-group">
            <div class="control-label"><span>4. Dịp sử dụng</span></div>
            <select id="ai-occasion-select" class="input-control">
              ${["Đi học / Hằng ngày", "Đi làm / Thuyết trình", "Cuối tuần / Dạo phố", "Tiệc / Sự kiện"]
                .map((occ) => `<option value="${occ}" ${cfg.occasion === occ ? "selected" : ""}>${occ}</option>`)
                .join("")}
            </select>
          </div>

          <div class="control-group">
            <div class="control-label"><span>5. Ghim sẵn 1 món đồ (tùy chọn)</span></div>
            <select id="ai-anchor-select" class="input-control">
              <option value="">-- Để AI tự phối toàn bộ --</option>
              ${allProducts
                .map(
                  (p) =>
                    `<option value="${p.id}" ${cfg.anchorId === p.id ? "selected" : ""}>${escapeHtml(p.name)} (${formatVND(p.price)})</option>`
                )
                .join("")}
            </select>
          </div>

          <button class="btn-primary" style="width:100%" id="run-ai-match-btn">
            ↻ Tạo lại 4 set phối đồ mới
          </button>
        </div>

        <div class="outfit-results-stack" id="ai-outfits-stack">
          ${renderAIOutfitsStackHTML(cfg)}
        </div>
      </div>
    </section>
  `;
}

/* ==================== SELL & C2C POSTING VIEW ==================== */

function evaluateSellerIntake(sf) {
  const allThreeNo = sf.noStructuralDamage && sf.noSurfaceDefect && sf.preWashed;
  const basePrice = Math.max(100000, Number(sf.originalPrice) || 400000);

  if (!sf.preWashed && !sf.noStructuralDamage && !sf.noSurfaceDefect) {
    return {
      groupCode: "C",
      groupClass: "group-c",
      groupLabel: "Tái chế sợi công nghiệp (Zero-Waste)",
      explanation: "Sản phẩm chưa đủ điều kiện bán lại hoặc tái thiết kế. CFD sẽ chuyển tới đối tác tái chế sợi để tránh phát thải ra môi trường.",
      directPrice: 0,
      consignListPrice: 0,
      sellerNet: 0,
      canDirect: false,
      canConsign: false
    };
  }

  if (allThreeNo && sf.condition !== "defect") {
    const directPrice = Math.min(30000, Math.max(15000, Math.round((basePrice * 0.05) / 1000) * 1000));
    const consignListPrice = Math.round((basePrice * (sf.condition === "95" ? 0.36 : 0.28)) / 5000) * 5000;
    const sellerNet = Math.round(consignListPrice * 0.65);
    return {
      groupCode: "A",
      groupClass: "group-a",
      groupLabel: "Secondhand Tuyển Chọn (Đạt chuẩn 3-Không)",
      explanation: "Sản phẩm đủ tiêu chuẩn lên sàn sau khi được giặt hấp diệt khuẩn và chụp ảnh Studio.",
      directPrice,
      consignListPrice,
      sellerNet,
      canDirect: true,
      canConsign: true
    };
  }

  const directPrice = 12000;
  const consignListPrice = Math.round((basePrice * 0.42) / 5000) * 5000;
  const sellerNet = Math.round(consignListPrice * 0.6);
  return {
    groupCode: "B",
    groupClass: "group-b",
    groupLabel: "Phôi Upcycling (Tái thiết kế sáng tạo)",
    explanation: "Sản phẩm có lỗi nhẹ nhưng chất vải tốt, phù hợp đưa vào xưởng cắt may thành thiết kế Upcycled độc bản.",
    directPrice,
    consignListPrice,
    sellerNet,
    canDirect: true,
    canConsign: true
  };
}

function renderSellView() {
  const user = getCurrentUser();
  const c2c = state.c2cForm;
  const sf = state.sellForm;
  const evalRes = evaluateSellerIntake(sf);
  const stages = ["Tiếp nhận", "Kiểm định", "Giặt hấp", "Chụp Studio", "Đang bán / Đã chi"];
  const myListings = user ? state.shared.userProducts.filter((p) => p.sellerId === user.id) : [];

  return `
    <section class="view-section">
      <div class="page-header-strip">
        <div class="container">
          <h1>Đăng bán &amp; Ký gửi quần áo</h1>
          <p>Bạn có thể <strong>tự đăng bán trực tiếp lên Cửa hàng</strong> để chat thương lượng với người mua, hoặc gửi đồ qua <strong>hệ thống thu mua / ký gửi CFD</strong>.</p>
        </div>
      </div>

      <div class="container">
        <div class="sell-mode-tabs">
          <button class="tab-btn ${state.sellMode === "c2c" ? "active" : ""}" data-sell-mode="c2c">
            1. Tự đăng bán lên sàn (Chat trực tiếp)
          </button>
          <button class="tab-btn ${state.sellMode === "cfd" ? "active" : ""}" data-sell-mode="cfd">
            2. Bán đứt / Ký gửi 60 ngày qua CFD
          </button>
        </div>

        ${
          state.sellMode === "c2c"
            ? `
          <div class="sell-grid">
            <div class="panel-card">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
                <h3 style="margin:0">Đăng tin bán sản phẩm mới</h3>
                ${
                  user
                    ? `<span class="muted-xs">Đang đăng bằng tài khoản: <strong>${escapeHtml(user.name)}</strong></span>`
                    : `<button class="btn-outline-sm" id="sell-login-prompt-btn">Đăng nhập để đăng bán</button>`
                }
              </div>

              <div class="field-group">
                <label>Ảnh sản phẩm (Tải ảnh từ máy hoặc chọn ảnh mẫu nhanh)</label>
                <div class="upload-dropzone">
                  <div class="upload-preview-row">
                    <img id="c2c-preview-img" class="upload-preview-img" src="${escapeHtml(c2c.image)}" alt="Xem trước ảnh sản phẩm" />
                    <div>
                      <input type="file" id="c2c-file-input" accept="image/*" style="font-size:12.5px; max-width:100%;" />
                      <div class="muted-xs">Ảnh tải lên sẽ tự động nén nhẹ để hiển thị ngay trên Cửa hàng và đồng bộ giữa các tab.</div>
                    </div>
                  </div>
                  <div class="muted-xs">Hoặc chọn nhanh ảnh mẫu sẵn có:</div>
                  <div class="sample-photo-grid">
                    ${SAMPLE_UPLOAD_PHOTOS.map(
                      (sp) => `
                      <button type="button" class="sample-photo-btn ${c2c.image === sp.url ? "active" : ""}" data-sample-photo="${escapeHtml(sp.url)}" title="${escapeHtml(sp.label)}">
                        <img src="${escapeHtml(sp.url)}" alt="${escapeHtml(sp.label)}" />
                      </button>`
                    ).join("")}
                  </div>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="field-group">
                  <label for="c2c-name">Tên sản phẩm *</label>
                  <input id="c2c-name" class="input-control" type="text" placeholder="VD: Áo Khoác Kaki Cổ Bẻ Vintage" value="${escapeHtml(c2c.name)}" />
                </div>
                <div class="field-group">
                  <label for="c2c-cat">Danh mục</label>
                  <select id="c2c-cat" class="input-control">
                    ${["Áo khoác", "Áo", "Quần", "Váy & Đầm", "Túi & Phụ kiện"]
                      .map((c) => `<option value="${c}" ${c2c.category === c ? "selected" : ""}>${c}</option>`)
                      .join("")}
                  </select>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="field-group">
                  <label for="c2c-brand">Thương hiệu</label>
                  <input id="c2c-brand" class="input-control" type="text" placeholder="VD: Uniqlo, Zara, Local..." value="${escapeHtml(c2c.brand)}" />
                </div>
                <div class="field-group">
                  <label for="c2c-size">Kích cỡ (Size)</label>
                  <input id="c2c-size" class="input-control" type="text" placeholder="VD: M, L, Free..." value="${escapeHtml(c2c.size)}" />
                </div>
              </div>

              <div class="form-grid-2">
                <div class="field-group">
                  <label for="c2c-style">Phong cách</label>
                  <select id="c2c-style" class="input-control">
                    ${["Streetwear", "Minimalist", "Y2K Vintage", "Eco-Vintage"]
                      .map((s) => `<option value="${s}" ${c2c.style === s ? "selected" : ""}>${s}</option>`)
                      .join("")}
                  </select>
                </div>
                <div class="field-group">
                  <label for="c2c-fabric">Chất liệu</label>
                  <input id="c2c-fabric" class="input-control" type="text" value="${escapeHtml(c2c.fabric)}" />
                </div>
              </div>

              <div class="form-grid-2">
                <div class="field-group">
                  <label for="c2c-price">Giá muốn bán (VNĐ) *</label>
                  <input id="c2c-price" class="input-control" type="number" min="20000" step="5000" value="${c2c.price}" />
                </div>
                <div class="field-group">
                  <label for="c2c-orig-price">Giá mua mới tham khảo (VNĐ)</label>
                  <input id="c2c-orig-price" class="input-control" type="number" min="50000" step="10000" value="${c2c.originalPrice}" />
                </div>
              </div>

              <div class="field-group">
                <label for="c2c-cond">Mô tả tình trạng &amp; Số đo thực tế</label>
                <input id="c2c-cond" class="input-control" type="text" value="${escapeHtml(c2c.condition)}" />
              </div>

              <button class="btn-primary" style="width:100%" id="submit-c2c-btn">
                Đăng bán ngay lên Cửa hàng
              </button>
            </div>

            <div class="panel-card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="margin:0">Sản phẩm bạn đã đăng bán</h3>
                <span class="header-badge">${myListings.length}</span>
              </div>
              <p class="muted-xs" style="margin-bottom:14px;">
                Mẹo demo 2 ô chat: Mở thêm 1 tab trình duyệt khác, đăng nhập tài khoản <strong>Nhật Cường</strong> ở tab kia, bấm vào sản phẩm bạn vừa đăng và chat thương lượng trực tiếp!
              </p>

              ${
                !user
                  ? `<div class="empty-state">
                       <p>Đăng nhập để đăng bài và quản lý sản phẩm của bạn.</p>
                       <button class="btn-primary btn-sm" id="sell-panel-login-btn">Đăng nhập / Đăng ký</button>
                     </div>`
                  : myListings.length === 0
                  ? `<div class="empty-state">
                       <p>Bạn chưa tự đăng món đồ nào mới. Hãy điền thông tin bên trái để đăng ngay!</p>
                     </div>`
                  : `<div class="submission-list">
                       ${myListings
                         .map(
                           (item) => `
                         <div class="cart-item-row">
                           <div class="cart-thumb"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" /></div>
                           <div>
                             <div style="font-size:13.5px; font-weight:700">${escapeHtml(item.name)}</div>
                             <div class="muted-xs">${escapeHtml(item.category)} • Size ${escapeHtml(item.size)}</div>
                             <div class="tabular" style="font-weight:700; margin-top:3px">${formatVND(item.price)}</div>
                           </div>
                           <div style="display:flex; flex-direction:column; gap:6px;">
                             <button class="btn-outline-sm" data-open-product="${item.id}">Xem</button>
                             <button class="btn-outline-sm" data-delete-listing="${item.id}">Xóa</button>
                           </div>
                         </div>`
                         )
                         .join("")}
                     </div>`
              }
            </div>
          </div>
        `
            : `
          <div class="steps-strip">
            <div class="step-card">
              <span class="step-num">1</span>
              <div>
                <strong>Kiểm tra tiêu chuẩn 3-Không</strong>
                <p class="muted-xs">Hệ thống tự động ước tính giá thu mua hoặc giá niêm yết ký gửi ngay lập tức.</p>
              </div>
            </div>
            <div class="step-card">
              <span class="step-num">2</span>
              <div>
                <strong>Gửi đồ tại trạm hoặc lấy tận nơi</strong>
                <p class="muted-xs">Miễn phí thu nhận tại các điểm KTX ĐHQG, Thủ Đức hoặc thu gom tận nhà từ 5 món.</p>
              </div>
            </div>
            <div class="step-card">
              <span class="step-num">3</span>
              <div>
                <strong>Nhận thanh toán minh bạch</strong>
                <p class="muted-xs">Mua đứt nhận tiền ngay, hoặc ký gửi đối soát định kỳ vào ngày 15 &amp; 30 hằng tháng.</p>
              </div>
            </div>
          </div>

          <div class="sell-grid">
            <div class="panel-card">
              <h3 style="margin-top:0">Thông tin sản phẩm gửi qua CFD</h3>
              <div class="form-grid-2">
                <div class="field-group">
                  <label for="sell-name">Tên sản phẩm</label>
                  <input id="sell-name" class="input-control" type="text" value="${escapeHtml(sf.itemName)}" />
                </div>
                <div class="field-group">
                  <label for="sell-cat">Danh mục</label>
                  <select id="sell-cat" class="input-control">
                    ${["Áo khoác", "Áo", "Quần", "Váy & Đầm", "Túi & Phụ kiện"]
                      .map((c) => `<option value="${c}" ${sf.category === c ? "selected" : ""}>${c}</option>`)
                      .join("")}
                  </select>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="field-group">
                  <label for="sell-orig-price">Giá mua mới ước tính (VNĐ)</label>
                  <input id="sell-orig-price" class="input-control" type="number" min="100000" step="50000" value="${sf.originalPrice}" />
                </div>
                <div class="field-group">
                  <label for="sell-cond">Tình trạng thực tế</label>
                  <select id="sell-cond" class="input-control">
                    <option value="95" ${sf.condition === "95" ? "selected" : ""}>Như mới (≥ 95%)</option>
                    <option value="85" ${sf.condition === "85" ? "selected" : ""}>Đã mặc vài lần (85–94%)</option>
                    <option value="defect" ${sf.condition === "defect" ? "selected" : ""}>Có lỗi nhẹ nhưng vải tốt (Phôi Upcycle)</option>
                  </select>
                </div>
              </div>

              <h4>Tự kiểm định theo tiêu chuẩn 3-Không</h4>
              <div class="qa-checklist">
                <label class="qa-check-item">
                  <input type="checkbox" id="qa-struct" ${sf.noStructuralDamage ? "checked" : ""} />
                  <span><strong>Không hư hỏng cấu trúc:</strong> Không rách, thủng, mất cúc hoặc hỏng khóa kéo.</span>
                </label>
                <label class="qa-check-item">
                  <input type="checkbox" id="qa-surface" ${sf.noSurfaceDefect ? "checked" : ""} />
                  <span><strong>Không biến dạng bề mặt:</strong> Không xù lông quá mức, ố vàng hoặc phai màu nặng.</span>
                </label>
                <label class="qa-check-item">
                  <input type="checkbox" id="qa-wash" ${sf.preWashed ? "checked" : ""} />
                  <span><strong>Đã giặt sạch sơ bộ:</strong> Đã giặt và phơi khô trước khi gửi trạm.</span>
                </label>
              </div>

              <div class="classification-banner ${evalRes.groupClass}">
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Phân loại tự động</div>
                <div style="font-size:15.5px; font-weight:700; margin:3px 0">${evalRes.groupLabel}</div>
                <div style="font-size:13px">${evalRes.explanation}</div>
              </div>

              <h4>Chọn hình thức thanh toán</h4>
              <div class="payout-cards">
                <div class="payout-option ${sf.payoutMode === "direct" ? "selected" : ""} ${!evalRes.canDirect ? "disabled" : ""}" data-payout="direct">
                  <div style="font-size:11.5px; font-weight:700; text-transform:uppercase;">Mua đứt (Direct)</div>
                  <div class="tabular" style="font-size:19px; font-weight:800; margin:4px 0;">
                    ${evalRes.canDirect ? formatVND(evalRes.directPrice) : "0đ (Tái chế)"}
                  </div>
                  <div class="muted-xs">Nhận tiền ngay qua MoMo / ZaloPay khi qua bước kiểm định tại trạm.</div>
                </div>

                <div class="payout-option ${sf.payoutMode === "consign" ? "selected" : ""} ${!evalRes.canConsign ? "disabled" : ""}" data-payout="consign">
                  <div style="font-size:11.5px; font-weight:700; text-transform:uppercase;">Ký gửi 60 ngày</div>
                  <div class="tabular" style="font-size:19px; font-weight:800; margin:4px 0;">
                    ${evalRes.canConsign ? `~${formatVND(evalRes.sellerNet)}` : "Không áp dụng"}
                  </div>
                  <div class="muted-xs">
                    ${evalRes.canConsign ? `Giá bán dự kiến ${formatVND(evalRes.consignListPrice)} (nhận 60–70% khi bán thành công).` : "Chỉ chuyển tái chế sợi."}
                  </div>
                </div>
              </div>

              <div class="field-group">
                <label for="sell-station">Điểm gửi đồ hoặc thu gom tận nơi</label>
                <select id="sell-station" class="input-control">
                  ${DROPOFF_STATIONS.map(
                    (st) => `<option value="${st.id}" ${sf.stationId === st.id ? "selected" : ""}>${st.name} (${st.fee})</option>`
                  ).join("")}
                </select>
              </div>

              <button class="btn-primary" style="width:100%" id="submit-sell-btn">
                Tạo phiếu gửi đồ &amp; Lấy mã theo dõi
              </button>
            </div>

            <div class="panel-card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="margin:0">Đơn ký gửi CFD</h3>
                <span class="header-badge">${state.shared.submissions.length}</span>
              </div>
              <p class="muted-xs" style="margin-bottom:14px;">
                Sản phẩm không đạt chuẩn được thông báo trong 48 giờ để bạn nhận lại tại trạm hoặc chuyển quyên góp/tái chế.
              </p>

              <div class="submission-list">
                ${state.shared.submissions
                  .map(
                    (sub) => `
                  <div class="submission-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                      <strong class="tabular" style="font-size:12px;">${escapeHtml(sub.id)}</strong>
                      <span class="muted-xs">${escapeHtml(sub.createdAt)}</span>
                    </div>
                    <div style="font-weight:700; font-size:14px; margin:4px 0">${escapeHtml(sub.itemName)}</div>
                    <div class="muted-xs" style="line-height:1.5">
                      <strong>Nhóm:</strong> ${escapeHtml(sub.group)}<br/>
                      <strong>Hình thức:</strong> ${escapeHtml(sub.mode)} • <strong>${escapeHtml(sub.estimatedValue)}</strong><br/>
                      <strong>Điểm gửi:</strong> ${escapeHtml(sub.station)}
                    </div>
                    <div class="stage-pills">
                      ${stages
                        .map(
                          (st, i) => `<span class="stage-pill ${i <= sub.stageIndex ? "done" : ""}">${i <= sub.stageIndex ? "✓ " : ""}${st}</span>`
                        )
                        .join("")}
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          </div>
        `
        }
      </div>
    </section>
  `;
}

/* ==================== AUTH & ACCOUNT MODALS ==================== */

function openAuthModal(defaultTab = "login") {
  state.authTab = defaultTab;
  const modal = document.getElementById("auth-modal");
  const body = document.getElementById("auth-modal-body");

  body.innerHTML = `
    <div class="auth-tabs">
      <button class="tab-btn ${state.authTab === "login" ? "active" : ""}" data-auth-tab="login">Đăng nhập</button>
      <button class="tab-btn ${state.authTab === "register" ? "active" : ""}" data-auth-tab="register">Đăng ký tài khoản</button>
    </div>

    ${
      state.authTab === "login"
        ? `
      <h2 id="auth-modal-title" style="margin:0 0 6px; font-size:20px;">Đăng nhập tài khoản CFD</h2>
      <p class="muted-xs" style="margin-bottom:14px;">Lưu giỏ hàng, theo dõi đơn mua, đăng bán đồ cũ và chat trực tiếp.</p>

      <form id="login-form">
        <div class="field-group">
          <label for="login-ident">Email hoặc Số điện thoại</label>
          <input id="login-ident" class="input-control" type="text" placeholder="cuong@cfd.vn hoặc 0901234567" required />
        </div>
        <div class="field-group">
          <label for="login-pass">Mật khẩu</label>
          <input id="login-pass" class="input-control" type="password" placeholder="••••••" value="123456" required />
        </div>
        <button type="submit" class="btn-primary" style="width:100%">Đăng nhập</button>
      </form>

      <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--border);">
        <div style="font-size:12px; font-weight:700; color:var(--ink-muted);">Đăng nhập nhanh (Mở 2 tab để chat Người mua ↔ Người bán):</div>
        <div class="quick-login-grid">
          ${DEMO_ACCOUNTS.map(
            (acc) => `
            <button type="button" class="quick-acc-card" data-quick-login="${acc.id}">
              <div style="font-weight:700; font-size:13px;">${escapeHtml(acc.name)}</div>
              <div class="muted-xs">${escapeHtml(acc.roleLabel)} • ${escapeHtml(acc.email)}</div>
            </button>`
          ).join("")}
        </div>
      </div>
    `
        : `
      <h2 id="auth-modal-title" style="margin:0 0 6px; font-size:20px;">Tạo tài khoản mua sắm mới</h2>
      <p class="muted-xs" style="margin-bottom:14px;">Nhận ngay mã ưu đãi CFDSV15 và mở khóa tính năng đăng bán &amp; chat.</p>

      <form id="register-form">
        <div class="field-group">
          <label for="reg-name">Họ và tên / Tên shop *</label>
          <input id="reg-name" class="input-control" type="text" placeholder="VD: Hoàng Duy" required />
        </div>
        <div class="field-group">
          <label for="reg-ident">Email hoặc Số điện thoại *</label>
          <input id="reg-ident" class="input-control" type="text" placeholder="duy@gmail.com" required />
        </div>
        <div class="field-group">
          <label for="reg-loc">Khu vực</label>
          <input id="reg-loc" class="input-control" type="text" value="TP.HCM" />
        </div>
        <div class="field-group">
          <label for="reg-pass">Mật khẩu *</label>
          <input id="reg-pass" class="input-control" type="password" placeholder="Tối thiểu 4 ký tự" required />
        </div>
        <button type="submit" class="btn-primary" style="width:100%">Đăng ký &amp; Đăng nhập ngay</button>
      </form>
    `
    }
  `;

  modal.hidden = false;

  body.querySelectorAll("[data-auth-tab]").forEach((btn) =>
    btn.addEventListener("click", () => openAuthModal(btn.getAttribute("data-auth-tab")))
  );

  body.querySelectorAll("[data-quick-login]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const uid = btn.getAttribute("data-quick-login");
      setTabUser(uid);
      modal.hidden = true;
      renderActiveView();
      const user = getCurrentUser();
      showToast(`Đã đăng nhập: ${user?.name}`);
    })
  );

  document.getElementById("login-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const ident = (document.getElementById("login-ident")?.value || "").trim().toLowerCase();
    const pass = document.getElementById("login-pass")?.value || "";
    const found = state.shared.users.find(
      (u) => (u.email.toLowerCase() === ident || u.phone === ident) && u.password === pass
    );
    if (!found) {
      showToast("Sai email/SĐT hoặc mật khẩu (mật khẩu tài khoản mẫu: 123456).");
      return;
    }
    setTabUser(found.id);
    modal.hidden = true;
    renderActiveView();
    showToast(`Chào mừng ${found.name}!`);
  });

  document.getElementById("register-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (document.getElementById("reg-name")?.value || "").trim();
    const ident = (document.getElementById("reg-ident")?.value || "").trim();
    const loc = (document.getElementById("reg-loc")?.value || "").trim() || "TP.HCM";
    const pass = document.getElementById("reg-pass")?.value || "";
    if (!name || !ident || pass.length < 4) {
      showToast("Vui lòng nhập đầy đủ họ tên, email/SĐT và mật khẩu ≥ 4 ký tự.");
      return;
    }
    const exists = state.shared.users.some(
      (u) => u.email.toLowerCase() === ident.toLowerCase() || u.phone === ident
    );
    if (exists) {
      showToast("Email hoặc SĐT này đã tồn tại. Vui lòng đăng nhập.");
      return;
    }
    const newUser = {
      id: `user_${Date.now()}`,
      name,
      email: ident.includes("@") ? ident : `${ident}@cfd.vn`,
      phone: ident.includes("@") ? "" : ident,
      password: pass,
      initials: name.slice(0, 2).toUpperCase(),
      location: loc,
      roleLabel: "Thành viên"
    };
    state.shared.users.push(newUser);
    saveSharedState();
    setTabUser(newUser.id);
    modal.hidden = true;
    renderActiveView();
    showToast(`Tạo tài khoản thành công! Chào ${newUser.name}.`);
  });
}

function openAccountModal(defaultTab = state.accountTab || "orders") {
  const user = getCurrentUser();
  if (!user) {
    openAuthModal("login");
    return;
  }
  state.accountTab = defaultTab;

  const modal = document.getElementById("account-modal");
  const body = document.getElementById("account-modal-body");

  const myOrders = state.shared.orders.filter((o) => o.userId === user.id);
  const myProducts = state.shared.userProducts.filter((p) => p.sellerId === user.id);
  const myConvs = state.shared.conversations.filter((c) => c.buyerId === user.id || c.sellerId === user.id);
  const wishItems = getWishlistIds()
    .map((id) => getAllProducts().find((p) => p.id === id))
    .filter(Boolean);

  let tabContent = "";
  if (state.accountTab === "orders") {
    tabContent = myOrders.length
      ? myOrders
          .map(
            (o) => `
          <div class="submission-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong class="tabular">${escapeHtml(o.id)}</strong>
              <span class="hygiene-note">${escapeHtml(o.status)}</span>
            </div>
            <div class="muted-xs" style="margin:4px 0;">Ngày: ${escapeHtml(o.createdAt)} • ${escapeHtml(o.method)}</div>
            <div style="font-size:13px; margin:6px 0;">
              ${o.items.map((it) => `• ${escapeHtml(it.name)} (${formatVND(it.price)})`).join("<br/>")}
            </div>
            <div class="tabular" style="font-weight:700;">Tổng thanh toán: ${formatVND(o.total)}</div>
          </div>`
          )
          .join("")
      : `<div class="empty-state"><p>Bạn chưa có đơn hàng nào.</p></div>`;
  } else if (state.accountTab === "selling") {
    tabContent = myProducts.length
      ? myProducts
          .map(
            (p) => `
          <div class="cart-item-row">
            <div class="cart-thumb"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" /></div>
            <div>
              <div style="font-weight:700; font-size:13.5px">${escapeHtml(p.name)}</div>
              <div class="muted-xs">${escapeHtml(p.category)} • Size ${escapeHtml(p.size)}</div>
              <div class="tabular" style="font-weight:700">${formatVND(p.price)}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-outline-sm" data-acc-view-prod="${p.id}">Xem</button>
              <button class="btn-outline-sm" data-acc-del-prod="${p.id}">Xóa</button>
            </div>
          </div>`
          )
          .join("")
      : `<div class="empty-state"><p>Bạn chưa tự đăng bán sản phẩm nào.</p><button class="btn-primary btn-sm" id="acc-go-sell-btn">Đăng bán ngay</button></div>`;
  } else if (state.accountTab === "messages") {
    tabContent = myConvs.length
      ? myConvs
          .map((c) => {
            const p = getAllProducts().find((x) => x.id === c.productId);
            const peerId = c.buyerId === user.id ? c.sellerId : c.buyerId;
            const peer = getSellerProfile(peerId);
            const last = c.messages[c.messages.length - 1];
            const lastTxt = last ? (last.type === "offer" ? `Đề xuất giá ${formatVND(last.offerPrice)}` : last.text) : "";
            return `
              <div class="cart-item-row" style="cursor:pointer" data-acc-open-chat="${c.id}">
                <div class="cart-thumb">${p ? `<img src="${escapeHtml(p.image)}" alt="" />` : ""}</div>
                <div>
                  <div style="font-weight:700; font-size:13.5px">${escapeHtml(peer.name)}</div>
                  <div class="muted-xs">${p ? escapeHtml(p.name) : ""}</div>
                  <div class="muted-xs" style="color:var(--ink)">${escapeHtml(lastTxt)}</div>
                </div>
                <button class="btn-primary btn-sm">Mở chat</button>
              </div>`;
          })
          .join("")
      : `<div class="empty-state"><p>Chưa có cuộc trò chuyện nào.</p></div>`;
  } else {
    tabContent = wishItems.length
      ? wishItems
          .map(
            (p) => `
          <div class="cart-item-row">
            <div class="cart-thumb"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" /></div>
            <div>
              <div style="font-weight:700; font-size:13.5px">${escapeHtml(p.name)}</div>
              <div class="tabular" style="font-weight:700">${formatVND(p.price)}</div>
            </div>
            <button class="btn-primary btn-sm" data-acc-wish-cart="${p.id}">+ Vào giỏ</button>
          </div>`
          )
          .join("")
      : `<div class="empty-state"><p>Danh sách yêu thích đang trống.</p></div>`;
  }

  body.innerHTML = `
    <div class="account-header-bar">
      <div style="display:flex; align-items:center; gap:12px;">
        <span class="user-avatar-xs logged" style="width:42px; height:42px; font-size:15px;">${escapeHtml(user.initials || "U")}</span>
        <div>
          <h2 id="account-modal-title" style="margin:0; font-size:19px;">${escapeHtml(user.name)}</h2>
          <div class="muted-xs">${escapeHtml(user.roleLabel || "Thành viên")} • ${escapeHtml(user.location || "TP.HCM")} • ${escapeHtml(user.email)}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; padding-right:36px;">
        <button class="btn-outline-sm" id="acc-switch-btn">Đổi tài khoản</button>
        <button class="btn-outline-sm" id="acc-logout-btn">Đăng xuất</button>
      </div>
    </div>

    <div class="account-tabs">
      <button class="tab-btn ${state.accountTab === "orders" ? "active" : ""}" data-acc-tab="orders">Đơn mua (${myOrders.length})</button>
      <button class="tab-btn ${state.accountTab === "selling" ? "active" : ""}" data-acc-tab="selling">Đang bán (${myProducts.length})</button>
      <button class="tab-btn ${state.accountTab === "messages" ? "active" : ""}" data-acc-tab="messages">Tin nhắn (${myConvs.length})</button>
      <button class="tab-btn ${state.accountTab === "wishlist" ? "active" : ""}" data-acc-tab="wishlist">Đã thích (${wishItems.length})</button>
    </div>

    <div class="account-list-grid">
      ${tabContent}
    </div>
  `;

  modal.hidden = false;

  body.querySelectorAll("[data-acc-tab]").forEach((btn) =>
    btn.addEventListener("click", () => openAccountModal(btn.getAttribute("data-acc-tab")))
  );

  document.getElementById("acc-switch-btn")?.addEventListener("click", () => {
    modal.hidden = true;
    openAuthModal("login");
  });

  document.getElementById("acc-logout-btn")?.addEventListener("click", () => {
    setTabUser(null);
    modal.hidden = true;
    renderActiveView();
    showToast("Đã đăng xuất khỏi phiên hiện tại.");
  });

  document.getElementById("acc-go-sell-btn")?.addEventListener("click", () => {
    modal.hidden = true;
    state.sellMode = "c2c";
    navigateTo("sell");
  });

  body.querySelectorAll("[data-acc-view-prod]").forEach((btn) =>
    btn.addEventListener("click", () => {
      modal.hidden = true;
      openProductModal(btn.getAttribute("data-acc-view-prod"));
    })
  );

  body.querySelectorAll("[data-acc-del-prod]").forEach((btn) =>
    btn.addEventListener("click", () => {
      deleteUserProduct(btn.getAttribute("data-acc-del-prod"));
      openAccountModal("selling");
    })
  );

  body.querySelectorAll("[data-acc-open-chat]").forEach((btn) =>
    btn.addEventListener("click", () => {
      modal.hidden = true;
      state.activeChatId = btn.getAttribute("data-acc-open-chat");
      state.chatThreadOpenMobile = true;
      openChatModal();
    })
  );

  body.querySelectorAll("[data-acc-wish-cart]").forEach((btn) =>
    btn.addEventListener("click", () => {
      addToCart(btn.getAttribute("data-acc-wish-cart"));
    })
  );
}

/* ==================== SHOPEE-STYLE BUYER <-> SELLER CHAT ==================== */

function startChatWithSeller(productId) {
  const user = getCurrentUser();
  if (!user) {
    showToast("Vui lòng đăng nhập để nhắn tin trực tiếp với người bán.");
    openAuthModal("login");
    return;
  }

  const product = getAllProducts().find((p) => p.id === productId);
  if (!product) return;
  if (product.sellerId === user.id) {
    showToast("Đây là sản phẩm do chính bạn đăng bán.");
    openChatModal();
    return;
  }

  let conv = state.shared.conversations.find(
    (c) => c.productId === product.id && c.buyerId === user.id && c.sellerId === product.sellerId
  );

  if (!conv) {
    conv = {
      id: `conv_${Date.now()}`,
      productId: product.id,
      buyerId: user.id,
      sellerId: product.sellerId,
      unreadFor: [],
      messages: [
        {
          id: `msg_auto_${Date.now()}`,
          senderId: product.sellerId,
          type: "text",
          text: `Chào ${user.name}! Bạn cần hỏi thêm về "${product.name}" hay muốn thương lượng giá cứ nhắn mình nhé.`,
          ts: formatTimeNow()
        }
      ]
    };
    state.shared.conversations.unshift(conv);
    saveSharedState();
  }

  state.activeChatId = conv.id;
  state.chatThreadOpenMobile = true;
  openChatModal();
}

function maybeTriggerSimulatedReply(conv, triggerType, offerAmount = 0) {
  if (!state.autoReplyEnabled) return;
  const user = getCurrentUser();
  if (!user) return;
  const peerId = conv.buyerId === user.id ? conv.sellerId : conv.buyerId;
  // Skip auto-reply if real peer is open in another browser tab
  if (isUserLiveInOtherTab(peerId)) return;
  // Only pre-seeded shop accounts auto-reply
  if (!SELLERS[peerId]) return;

  const product = getAllProducts().find((p) => p.id === conv.productId);
  if (!product) return;

  setTimeout(() => {
    loadSharedState();
    const targetConv = state.shared.conversations.find((c) => c.id === conv.id);
    if (!targetConv) return;

    if (triggerType === "offer") {
      const ratio = offerAmount / product.price;
      const lastOfferMsg = [...targetConv.messages].reverse().find((m) => m.type === "offer" && m.status === "pending");
      if (ratio >= 0.85 && lastOfferMsg) {
        lastOfferMsg.status = "accepted";
        const buyerMap = state.shared.userAgreedPrices[targetConv.buyerId] || {};
        buyerMap[product.id] = lastOfferMsg.offerPrice;
        state.shared.userAgreedPrices[targetConv.buyerId] = buyerMap;
        targetConv.messages.push({
          id: `msg_${Date.now()}`,
          senderId: peerId,
          type: "text",
          text: `Ok bạn ơi, mình chốt giá ${formatVND(lastOfferMsg.offerPrice)} cho bạn nhé! Bạn bấm "Mua với giá đã chốt" ở trên để đặt nha.`,
          ts: formatTimeNow()
        });
      } else if (lastOfferMsg) {
        lastOfferMsg.status = "rejected";
        const counter = Math.round((product.price * 0.9) / 5000) * 5000;
        targetConv.messages.push({
          id: `msg_${Date.now()}`,
          senderId: peerId,
          type: "text",
          text: `Giá ${formatVND(offerAmount)} hơi thấp so với tình trạng đồ mới á bạn. Mình bớt tối đa còn ${formatVND(counter)}, bạn thấy ổn thì gửi đề nghị lại nha!`,
          ts: formatTimeNow()
        });
      }
    } else {
      const lastTxt = ([...targetConv.messages].reverse().find((m) => m.type === "text")?.text || "").toLowerCase();
      let reply = `Dạ "${product.name}" vẫn còn hàng bạn nhé! Mình giữ đồ rất kỹ, hỗ trợ gửi qua trạm KTX hoặc ship nhanh nội thành ạ.`;
      if (lastTxt.includes("số đo") || lastTxt.includes("size") || lastTxt.includes("vừa")) {
        const specs = Object.entries(product.measurements || {})
          .map(([k, v]) => `${k} ${v}`)
          .join(", ");
        reply = `Thông số đo thực tế mẫu này là Size ${product.size}${specs ? ` (${specs})` : ""}, chất liệu ${product.fabric} ạ.`;
      } else if (lastTxt.includes("fix") || lastTxt.includes("bớt") || lastTxt.includes("giá")) {
        reply = `Bạn cứ bấm nút "Trả giá" bên dưới gửi mức giá hợp lý, nếu ổn mình duyệt chốt đơn cho bạn liền nha!`;
      }
      targetConv.messages.push({
        id: `msg_${Date.now()}`,
        senderId: peerId,
        type: "text",
        text: reply,
        ts: formatTimeNow()
      });
    }

    if (!targetConv.unreadFor.includes(user.id)) {
      const modalOpen = !document.getElementById("chat-modal")?.hidden && state.activeChatId === targetConv.id;
      if (!modalOpen) targetConv.unreadFor.push(user.id);
    }

    saveSharedState();
    renderHeaderBadges();
    if (!document.getElementById("chat-modal")?.hidden) {
      renderChatModalBody();
    }
  }, 850);
}

function renderChatModalBody() {
  const user = getCurrentUser();
  const body = document.getElementById("chat-modal-body");
  if (!body || !user) return;

  const myConvs = state.shared.conversations.filter((c) => c.buyerId === user.id || c.sellerId === user.id);
  if (!state.activeChatId && myConvs.length) {
    state.activeChatId = myConvs[0].id;
  }

  const activeConv = myConvs.find((c) => c.id === state.activeChatId) || myConvs[0] || null;
  if (activeConv && (activeConv.unreadFor || []).includes(user.id)) {
    activeConv.unreadFor = activeConv.unreadFor.filter((id) => id !== user.id);
    saveSharedState();
    renderHeaderBadges();
  }

  const sidebarHtml = myConvs.length
    ? myConvs
        .map((c) => {
          const p = getAllProducts().find((x) => x.id === c.productId);
          const peerId = c.buyerId === user.id ? c.sellerId : c.buyerId;
          const peer = getSellerProfile(peerId);
          const last = c.messages[c.messages.length - 1];
          const preview = last ? (last.type === "offer" ? `Trả giá: ${formatVND(last.offerPrice)}` : last.text) : "Bắt đầu chat...";
          const isUnread = (c.unreadFor || []).includes(user.id);

          return `
            <button class="chat-conv-item ${activeConv?.id === c.id ? "active" : ""}" data-select-conv="${c.id}">
              <img class="chat-conv-thumb" src="${escapeHtml(p?.image || SAMPLE_UPLOAD_PHOTOS[0].url)}" alt="" />
              <div style="min-width:0;">
                <div style="display:flex; justify-content:space-between; gap:6px; align-items:center;">
                  <strong style="font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(peer.name)}</strong>
                  ${isUnread ? `<span style="width:8px; height:8px; border-radius:50%; background:var(--sale); flex-shrink:0;"></span>` : ""}
                </div>
                <div class="muted-xs" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p?.name || "Sản phẩm")}</div>
                <div class="muted-xs" style="color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(preview)}</div>
              </div>
            </button>
          `;
        })
        .join("")
    : `<div style="padding:20px; font-size:13px; color:var(--ink-muted)">Chưa có hội thoại nào. Hãy chọn 1 sản phẩm và bấm <strong>Chat với người bán</strong>.</div>`;

  let threadHtml = `<div class="empty-state" style="margin:24px;">Chọn một cuộc trò chuyện bên trái hoặc bấm "Chat với người bán" trên bất kỳ sản phẩm nào.</div>`;

  if (activeConv) {
    const p = getAllProducts().find((x) => x.id === activeConv.productId);
    const isBuyer = activeConv.buyerId === user.id;
    const peerId = isBuyer ? activeConv.sellerId : activeConv.buyerId;
    const peer = getSellerProfile(peerId);
    const livePeer = isUserLiveInOtherTab(peerId);
    const buyerAgreed = p ? getEffectivePrice(p, activeConv.buyerId) : 0;
    const hasDeal = p && buyerAgreed < p.price;

    threadHtml = `
      <div class="chat-thread-header">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <button class="btn-outline-sm chat-back-btn" id="chat-mobile-back">←</button>
          <span class="user-avatar-xs logged">${escapeHtml(peer.initials)}</span>
          <div style="min-width:0;">
            <div style="font-weight:700; font-size:14px;">${escapeHtml(peer.name)}</div>
            <div class="muted-xs">${livePeer ? "🟢 Đang online" : escapeHtml(peer.responseTime)}</div>
          </div>
        </div>
      </div>

      ${
        p
          ? `
        <div class="chat-pinned-product">
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <img src="${escapeHtml(p.image)}" alt="" style="width:42px; height:52px; object-fit:cover; border-radius:2px; border:1px solid var(--border);" />
            <div style="min-width:0;">
              <div style="font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
              <div class="tabular" style="font-size:13px;">
                ${
                  hasDeal
                    ? `<strong style="color:var(--eco)">Giá đã chốt: ${formatVND(buyerAgreed)}</strong> <span class="price-old">${formatVND(p.price)}</span>`
                    : `<strong>${formatVND(p.price)}</strong>`
                }
              </div>
            </div>
          </div>
          ${
            isBuyer
              ? `<button class="btn-primary btn-sm" id="chat-buy-now-btn">${hasDeal ? "Mua với giá đã chốt" : "Mua ngay"}</button>`
              : `<span class="muted-xs">Bạn là người bán</span>`
          }
        </div>
      `
          : ""
      }

      <div class="chat-messages" id="chat-messages-scroll">
        ${activeConv.messages
          .map((m) => {
            const isMe = m.senderId === user.id;
            if (m.type === "offer") {
              const statusText =
                m.status === "accepted" ? "✓ Đã chấp nhận" : m.status === "rejected" ? "✕ Đã từ chối" : "⏳ Chờ phản hồi";
              return `
                <div class="chat-msg-wrap ${isMe ? "me" : "other"}">
                  <div class="offer-card">
                    <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--ink-muted);">Đề nghị trả giá</div>
                    <div class="tabular" style="font-size:18px; font-weight:800; margin:4px 0;">${formatVND(m.offerPrice)}</div>
                    <span class="offer-status ${m.status}">${statusText}</span>
                    ${
                      !isBuyer && m.status === "pending"
                        ? `<div style="display:flex; gap:6px; margin-top:10px;">
                             <button class="btn-primary btn-sm" data-offer-action="accept" data-msg-id="${m.id}">Chấp nhận</button>
                             <button class="btn-outline-sm" data-offer-action="reject" data-msg-id="${m.id}">Từ chối</button>
                           </div>`
                        : ""
                    }
                  </div>
                  <span class="chat-msg-time">${escapeHtml(m.ts)}</span>
                </div>`;
            }
            return `
              <div class="chat-msg-wrap ${isMe ? "me" : "other"}">
                <div class="chat-bubble">${escapeHtml(m.text)}</div>
                <span class="chat-msg-time">${escapeHtml(m.ts)}</span>
              </div>`;
          })
          .join("")}
      </div>

      ${
        state.offerBoxOpen && isBuyer && p
          ? `
        <form class="chat-offer-bar" id="chat-offer-form">
          <span style="font-size:12.5px; font-weight:700;">Mức giá đề xuất:</span>
          <input id="chat-offer-input" type="number" class="input-control" style="height:34px; width:140px;" min="20000" step="5000" value="${Math.round((p.price * 0.85) / 5000) * 5000}" />
          <button type="submit" class="btn-primary btn-sm">Gửi trả giá</button>
          <button type="button" class="btn-outline-sm" id="chat-offer-cancel">Hủy</button>
        </form>`
          : ""
      }

      <div class="quick-reply-bar">
        ${
          isBuyer
            ? `
          <button class="quick-reply-chip" data-quick-msg="Món này còn không shop?">Món này còn không shop?</button>
          <button class="quick-reply-chip" data-quick-msg="Cho mình xin thêm số đo thực tế nhé.">Xin thêm số đo</button>
          <button class="quick-reply-chip" data-quick-msg="Có fix nhẹ giá sinh viên được không ạ?">Fix nhẹ được không?</button>
          <button class="quick-reply-chip" id="chat-open-offer-btn" style="border-color:#111; color:#111; font-weight:700;">💰 Trả giá</button>
        `
            : `
          <button class="quick-reply-chip" data-quick-msg="Còn hàng bạn nhé, mình đã giặt sạch thơm rồi ạ.">Còn hàng, đã giặt sạch</button>
          <button class="quick-reply-chip" data-quick-msg="Mình có hỗ trợ giao trạm KTX Làng ĐH miễn phí nha.">Giao KTX Làng ĐH 0đ</button>
        `
        }
      </div>

      <form class="chat-composer" id="chat-send-form">
        <input type="text" id="chat-text-input" placeholder="Nhập tin nhắn trao đổi..." autocomplete="off" />
        <button type="submit" class="btn-primary btn-sm">Gửi</button>
      </form>
    `;
  }

  body.innerHTML = `
    <div class="chat-shell ${state.chatThreadOpenMobile ? "thread-open" : ""}">
      <aside class="chat-sidebar">
        <div class="chat-sidebar-head">Hộp thư (${myConvs.length})</div>
        <div class="chat-conv-list">${sidebarHtml}</div>
      </aside>
      <div class="chat-thread-pane">${threadHtml}</div>
    </div>
  `;

  const scrollEl = document.getElementById("chat-messages-scroll");
  if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;

  body.querySelectorAll("[data-select-conv]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.activeChatId = btn.getAttribute("data-select-conv");
      state.chatThreadOpenMobile = true;
      state.offerBoxOpen = false;
      renderChatModalBody();
    })
  );

  document.getElementById("chat-mobile-back")?.addEventListener("click", () => {
    state.chatThreadOpenMobile = false;
    renderChatModalBody();
  });

  document.getElementById("chat-autoreply-toggle")?.addEventListener("change", (e) => {
    state.autoReplyEnabled = e.target.checked;
  });

  document.getElementById("chat-buy-now-btn")?.addEventListener("click", () => {
    if (!activeConv) return;
    addToCart(activeConv.productId);
    document.getElementById("chat-modal").hidden = true;
    openCartDrawer();
  });

  document.getElementById("chat-open-offer-btn")?.addEventListener("click", () => {
    state.offerBoxOpen = !state.offerBoxOpen;
    renderChatModalBody();
  });

  document.getElementById("chat-offer-cancel")?.addEventListener("click", () => {
    state.offerBoxOpen = false;
    renderChatModalBody();
  });

  body.querySelectorAll("[data-quick-msg]").forEach((btn) =>
    btn.addEventListener("click", () => {
      sendChatText(activeConv.id, btn.getAttribute("data-quick-msg"));
    })
  );

  document.getElementById("chat-send-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-text-input");
    const txt = (input?.value || "").trim();
    if (!txt || !activeConv) return;
    sendChatText(activeConv.id, txt);
  });

  document.getElementById("chat-offer-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = Number(document.getElementById("chat-offer-input")?.value || 0);
    if (!val || val < 20000 || !activeConv) {
      showToast("Vui lòng nhập mức giá đề xuất hợp lệ (≥ 20.000đ).");
      return;
    }
    sendChatOffer(activeConv.id, val);
  });

  body.querySelectorAll("[data-offer-action]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!activeConv) return;
      handleOfferAction(activeConv.id, btn.getAttribute("data-msg-id"), btn.getAttribute("data-offer-action"));
    })
  );
}

function sendChatText(convId, text) {
  const user = getCurrentUser();
  if (!user) return;
  const conv = state.shared.conversations.find((c) => c.id === convId);
  if (!conv) return;

  const peerId = conv.buyerId === user.id ? conv.sellerId : conv.buyerId;
  conv.messages.push({
    id: `msg_${Date.now()}`,
    senderId: user.id,
    type: "text",
    text,
    ts: formatTimeNow()
  });
  if (!conv.unreadFor.includes(peerId)) conv.unreadFor.push(peerId);

  saveSharedState();
  renderChatModalBody();
  maybeTriggerSimulatedReply(conv, "text");
}

function sendChatOffer(convId, offerPrice) {
  const user = getCurrentUser();
  if (!user) return;
  const conv = state.shared.conversations.find((c) => c.id === convId);
  if (!conv) return;

  const peerId = conv.buyerId === user.id ? conv.sellerId : conv.buyerId;
  conv.messages.push({
    id: `msg_offer_${Date.now()}`,
    senderId: user.id,
    type: "offer",
    offerPrice,
    status: "pending",
    ts: formatTimeNow()
  });
  if (!conv.unreadFor.includes(peerId)) conv.unreadFor.push(peerId);

  state.offerBoxOpen = false;
  saveSharedState();
  renderChatModalBody();
  maybeTriggerSimulatedReply(conv, "offer", offerPrice);
}

function handleOfferAction(convId, msgId, action) {
  const conv = state.shared.conversations.find((c) => c.id === convId);
  if (!conv) return;
  const msg = conv.messages.find((m) => m.id === msgId);
  if (!msg || msg.status !== "pending") return;

  msg.status = action === "accept" ? "accepted" : "rejected";
  if (action === "accept") {
    const buyerMap = state.shared.userAgreedPrices[conv.buyerId] || {};
    buyerMap[conv.productId] = msg.offerPrice;
    state.shared.userAgreedPrices[conv.buyerId] = buyerMap;
    conv.messages.push({
      id: `msg_${Date.now()}`,
      senderId: conv.sellerId,
      type: "text",
      text: `Mình đã đồng ý chốt giá ${formatVND(msg.offerPrice)}. Bạn có thể bấm "Mua với giá đã chốt" ngay nhé!`,
      ts: formatTimeNow()
    });
    showToast(`Đã chốt giá ${formatVND(msg.offerPrice)} cho người mua!`);
  } else {
    conv.messages.push({
      id: `msg_${Date.now()}`,
      senderId: conv.sellerId,
      type: "text",
      text: `Giá ${formatVND(msg.offerPrice)} chưa khớp mong muốn của mình, bạn cân nhắc gửi đề nghị khác nha!`,
      ts: formatTimeNow()
    });
  }

  if (!conv.unreadFor.includes(conv.buyerId)) conv.unreadFor.push(conv.buyerId);
  saveSharedState();
  renderChatModalBody();
}

function openChatModal() {
  const user = getCurrentUser();
  if (!user) {
    showToast("Vui lòng đăng nhập để xem và gửi tin nhắn.");
    openAuthModal("login");
    return;
  }
  renderChatModalBody();
  document.getElementById("chat-modal").hidden = false;
}

/* ==================== PDP, POLICY, WISHLIST & CART ==================== */

function openProductModal(productId) {
  const p = getAllProducts().find((item) => item.id === productId);
  if (!p) return;
  const modal = document.getElementById("product-modal");
  const body = document.getElementById("product-modal-body");
  const savePct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
  const inCart = getCartIds().includes(p.id);
  const isSaved = getWishlistIds().includes(p.id);
  const seller = getSellerProfile(p.sellerId);
  const currentUser = getCurrentUser();
  const isOwner = currentUser && currentUser.id === p.sellerId;
  const effectivePrice = getEffectivePrice(p);
  const hasDeal = effectivePrice < p.price;

  const measureEntries = Object.entries(p.measurements || {})
    .map(([k, v]) => `<span class="spec-pill"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`)
    .join("");

  body.innerHTML = `
    <div class="dpp-grid">
      <div class="dpp-visual">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />
      </div>

      <div>
        <div class="muted-xs" style="text-transform:uppercase; letter-spacing:0.06em;">
          ${escapeHtml(p.brand)} • ${escapeHtml(p.tierLabel)} • ${escapeHtml(p.id)}
        </div>
        <h2 id="modal-product-title" style="margin:6px 0 8px; font-size:22px;">${escapeHtml(p.name)}</h2>

        <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:10px;" class="tabular">
          <span style="font-size:24px; font-weight:800; color:${hasDeal ? "var(--eco)" : "var(--ink)"};">${formatVND(effectivePrice)}</span>
          <span class="price-old" style="font-size:15px">${formatVND(hasDeal ? p.price : p.originalPrice)}</span>
          <span style="font-size:13px; font-weight:700; color:var(--sale)">
            ${hasDeal ? "Giá đã chốt qua Chat" : `Tiết kiệm ${savePct}%`}
          </span>
        </div>

        <div class="spec-pills">
          <span class="spec-pill">Size: ${escapeHtml(p.size)}</span>
          <span class="spec-pill">Chất liệu: ${escapeHtml(p.fabric)}</span>
          ${measureEntries}
        </div>

        <!-- Seller Box + Direct Chat CTA -->
        <div class="seller-badge-box">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="user-avatar-xs logged">${escapeHtml(seller.initials)}</span>
            <div>
              <div style="font-weight:700; font-size:13.5px;">${escapeHtml(seller.name)}</div>
              <div class="muted-xs">★ ${seller.rating} • ${escapeHtml(seller.location)}</div>
            </div>
          </div>
          ${
            isOwner
              ? `<span class="hygiene-note">Sản phẩm của bạn</span>`
              : `<button class="btn-outline btn-sm" id="modal-chat-seller">💬 Chat với người bán</button>`
          }
        </div>

        <div class="dpp-passport-box">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">
            Thông tin &amp; Kiểm định sản phẩm
          </div>
          <div class="dpp-layers">
            <div><strong>✓ Tình trạng:</strong> ${escapeHtml(p.condition)}</div>
            <div><strong>✓ Vệ sinh:</strong> ${escapeHtml(p.hygieneBatch)}</div>
            <div><strong>✓ Nguồn:</strong> ${escapeHtml(p.origin)}</div>
            <div><strong>✓ Tác động xanh:</strong> Giảm <strong>${p.co2SavedKg} kg CO₂</strong> &amp; tiết kiệm <strong>${p.waterSavedL.toLocaleString("vi-VN")} lít nước</strong></div>
          </div>
        </div>

        ${p.legalDisclaimer ? `<div class="disclaimer-box">${escapeHtml(p.legalDisclaimer)}</div>` : ""}

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
          <button class="btn-primary" style="flex:1" id="modal-add-cart" ${isOwner ? "disabled" : ""}>
            ${isOwner ? "Bạn đang bán sản phẩm này" : inCart ? "✓ Đã có trong giỏ hàng" : "+ Thêm vào giỏ hàng"}
          </button>
          <button class="btn-outline" id="modal-wish-btn">
            ${isSaved ? "♥ Đã lưu" : "♡ Yêu thích"}
          </button>
        </div>
        <button class="btn-outline" style="width:100%; margin-top:8px;" id="modal-pin-ai">
          Phối bộ với sản phẩm này bằng AI Stylist →
        </button>
      </div>
    </div>
  `;

  modal.hidden = false;

  document.getElementById("modal-add-cart")?.addEventListener("click", () => {
    if (isOwner) return;
    addToCart(p.id);
    openProductModal(p.id);
  });

  document.getElementById("modal-wish-btn")?.addEventListener("click", () => {
    toggleWishlist(p.id);
    openProductModal(p.id);
  });

  document.getElementById("modal-chat-seller")?.addEventListener("click", () => {
    modal.hidden = true;
    startChatWithSeller(p.id);
  });

  document.getElementById("modal-pin-ai")?.addEventListener("click", () => {
    modal.hidden = true;
    state.aiConfig.anchorId = p.id;
    state.aiConfig.style = p.style;
    navigateTo("ai-stylist");
    showToast(`Đã chọn "${p.name}" làm món phối chính.`);
  });
}

function openPolicyModal(key) {
  const doc = POLICY_DOCS[key];
  if (!doc) return;
  const modal = document.getElementById("info-modal");
  const body = document.getElementById("info-modal-body");
  body.innerHTML = `
    <h2 id="info-modal-title" style="margin:0 0 14px; font-size:20px;">${escapeHtml(doc.title)}</h2>
    <div style="display:grid; gap:10px; font-size:13.5px; color:var(--ink-muted);">
      ${doc.items.map((line) => `<p style="margin:0; padding:10px 12px; background:var(--bg-subtle); border-radius:4px;">${escapeHtml(line)}</p>`).join("")}
    </div>
  `;
  modal.hidden = false;
}

function renderWishlistDrawer() {
  const wishIds = getWishlistIds();
  const badge = document.getElementById("wishlist-count");
  if (badge) badge.textContent = String(wishIds.length);

  const container = document.getElementById("wishlist-items-container");
  if (!container) return;

  const all = getAllProducts();
  const items = wishIds.map((id) => all.find((p) => p.id === id)).filter(Boolean);
  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Bạn chưa lưu sản phẩm yêu thích nào.</p>
        <button class="btn-primary btn-sm" id="wish-browse-btn">Xem sản phẩm</button>
      </div>
    `;
    document.getElementById("wish-browse-btn")?.addEventListener("click", () => {
      closeWishlistDrawer();
      navigateTo("market");
    });
    return;
  }

  container.innerHTML = items
    .map(
      (p) => `
    <div class="cart-item-row">
      <div class="cart-thumb"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" /></div>
      <div>
        <div style="font-size:13px; font-weight:600; line-height:1.3">${escapeHtml(p.name)}</div>
        <div class="muted-xs">${escapeHtml(p.brand)} • Size ${escapeHtml(p.size.split(" ")[0])}</div>
        <div class="tabular" style="font-size:13.5px; font-weight:700; margin-top:4px">${formatVND(getEffectivePrice(p))}</div>
        <div style="display:flex; gap:6px; margin-top:6px;">
          <button class="btn-primary btn-sm" style="padding:5px 10px; font-size:11.5px;" data-wish-to-cart="${p.id}">+ Vào giỏ</button>
          <button class="btn-outline-sm" style="padding:5px 9px; font-size:11.5px;" data-wish-remove="${p.id}">Xóa</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  container.querySelectorAll("[data-wish-to-cart]").forEach((btn) =>
    btn.addEventListener("click", () => {
      addToCart(btn.getAttribute("data-wish-to-cart"));
      renderWishlistDrawer();
    })
  );
  container.querySelectorAll("[data-wish-remove]").forEach((btn) =>
    btn.addEventListener("click", () => {
      toggleWishlist(btn.getAttribute("data-wish-remove"));
    })
  );
}

function renderCartDrawer() {
  const cartIds = getCartIds();
  const countBadge = document.getElementById("cart-count");
  if (countBadge) countBadge.textContent = String(cartIds.length);

  const container = document.getElementById("cart-items-container");
  const footer = document.getElementById("cart-footer");
  if (!container || !footer) return;

  if (state.checkoutDoneOrder) {
    container.innerHTML = `
      <div class="panel-card" style="background:var(--eco-bg); border-color:var(--eco-border);">
        <div style="font-size:11px; font-weight:700; color:var(--eco);">ĐẶT HÀNG THÀNH CÔNG • ĐƯỢC BẢO VỆ ESCROW</div>
        <h3 style="margin:6px 0">Mã đơn: ${escapeHtml(state.checkoutDoneOrder.id)}</h3>
        <p style="font-size:13.5px; margin:6px 0">
          Thanh toán: <strong>${escapeHtml(state.checkoutDoneOrder.method)}</strong><br/>
          Tổng thanh toán: <strong class="tabular">${formatVND(state.checkoutDoneOrder.total)}</strong><br/>
          Giao nhận: <strong>${escapeHtml(state.checkoutDoneOrder.station)}</strong>
        </p>
        <p class="muted-xs">
          Đơn hàng đã được lưu vào Tài khoản → Đơn mua. Tiền giữ tại ví CFD Escrow tới khi bạn nhận hàng đúng mô tả.
        </p>
        <button class="btn-primary btn-sm" style="margin-top:12px" id="cart-new-shopping-btn">Tiếp tục mua sắm</button>
      </div>
    `;
    footer.innerHTML = "";
    document.getElementById("cart-new-shopping-btn")?.addEventListener("click", () => {
      state.checkoutDoneOrder = null;
      renderCartDrawer();
      closeCartDrawer();
    });
    return;
  }

  const all = getAllProducts();
  const cartItems = cartIds.map((id) => all.find((p) => p.id === id)).filter(Boolean);

  if (!cartItems.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Giỏ hàng của bạn đang trống.</p>
        <button class="btn-primary btn-sm" id="cart-browse-btn">Mua sắm ngay</button>
      </div>
    `;
    footer.innerHTML = "";
    document.getElementById("cart-browse-btn")?.addEventListener("click", () => {
      closeCartDrawer();
      navigateTo("market");
    });
    return;
  }

  const subtotal = cartItems.reduce((s, p) => s + getEffectivePrice(p), 0);
  const voucherApplied = state.voucherCode.trim().toUpperCase() === "CFDSV15";
  const discount = voucherApplied ? Math.round(subtotal * 0.15) : 0;
  const afterDiscount = subtotal - discount;
  const shipFee = afterDiscount >= FREE_SHIP_THRESHOLD ? 0 : 20000;
  const finalTotal = afterDiscount + shipFee;
  const shipProgress = Math.min(100, Math.round((afterDiscount / FREE_SHIP_THRESHOLD) * 100));
  const origTotal = cartItems.reduce((s, p) => s + p.originalPrice, 0);
  const co2Total = cartItems.reduce((s, p) => s + p.co2SavedKg, 0);

  container.innerHTML = `
    <div class="shipping-meter">
      ${
        shipFee === 0
          ? `<strong style="color:var(--eco)">✓ Đơn hàng của bạn được Miễn phí vận chuyển!</strong>`
          : `Mua thêm <strong class="tabular">${formatVND(FREE_SHIP_THRESHOLD - afterDiscount)}</strong> để được <strong>Freeship</strong>`
      }
      <div class="shipping-bar"><div class="shipping-fill" style="width:${shipProgress}%"></div></div>
    </div>
    ${cartItems
      .map((p) => {
        const eff = getEffectivePrice(p);
        return `
      <div class="cart-item-row">
        <div class="cart-thumb"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" /></div>
        <div>
          <div style="font-size:13px; font-weight:600; line-height:1.3">${escapeHtml(p.name)}</div>
          <div class="muted-xs">${escapeHtml(getSellerProfile(p.sellerId).name)} • Size ${escapeHtml(p.size.split(" ")[0])}</div>
          <div class="tabular" style="font-size:13.5px; font-weight:700; margin-top:4px">
            ${formatVND(eff)} ${eff < p.price ? `<span class="hygiene-note">(Giá đã chốt)</span>` : ""}
          </div>
        </div>
        <button class="btn-outline-sm" data-remove-cart="${p.id}">Xóa</button>
      </div>
    `;
      })
      .join("")}
  `;

  footer.innerHTML = `
    <div class="voucher-row">
      <input type="text" id="voucher-input" placeholder="Nhập mã giảm giá (VD: CFDSV15)" value="${escapeHtml(state.voucherCode)}" />
      <button class="btn-outline-sm" id="apply-voucher-btn">Áp dụng</button>
    </div>

    <div style="display:grid; gap:5px; font-size:12.5px; margin-bottom:12px;" class="tabular">
      <div style="display:flex; justify-content:space-between">
        <span>Tiết kiệm so với mua mới:</span>
        <strong style="color:var(--sale)">-${formatVND(origTotal - afterDiscount)}</strong>
      </div>
      ${
        voucherApplied
          ? `<div style="display:flex; justify-content:space-between"><span>Mã CFDSV15 (-15%):</span><strong style="color:var(--eco)">-${formatVND(discount)}</strong></div>`
          : ""
      }
      <div style="display:flex; justify-content:space-between">
        <span>Phí giao hàng:</span>
        <strong>${shipFee === 0 ? "Miễn phí" : formatVND(shipFee)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between">
        <span>Giảm phát thải CO₂:</span>
        <strong style="color:var(--eco)">-${co2Total.toFixed(1)} kg CO₂</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:15.5px; padding-top:6px; border-top:1px solid var(--border)">
        <strong>Tổng thanh toán:</strong>
        <strong>${formatVND(finalTotal)}</strong>
      </div>
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label for="checkout-method" style="font-size:12px;">Phương thức thanh toán (Escrow)</label>
      <select id="checkout-method" class="input-control" style="height:36px; font-size:12.5px;">
        <option value="Ví MoMo (Escrow CFD)">Ví MoMo — Bảo vệ người mua</option>
        <option value="ZaloPay (Escrow CFD)">ZaloPay — Bảo vệ người mua</option>
        <option value="Nhận tại Trạm KTX ĐHQG (0đ Ship)">Nhận &amp; kiểm tra tại Trạm KTX ĐHQG</option>
        <option value="COD — Thanh toán khi nhận hàng">COD — Thanh toán khi nhận hàng</option>
      </select>
    </div>

    <button class="btn-primary" style="width:100%" id="checkout-confirm-btn">
      Thanh toán đơn hàng (${formatVND(finalTotal)})
    </button>
  `;

  container.querySelectorAll("[data-remove-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-cart");
      setCartIds(getCartIds().filter((x) => x !== id));
      renderCartDrawer();
      if (state.activeView === "market") refreshCatalogGrid();
    });
  });

  document.getElementById("apply-voucher-btn")?.addEventListener("click", () => {
    const val = document.getElementById("voucher-input")?.value || "";
    state.voucherCode = val.trim();
    renderCartDrawer();
    if (state.voucherCode.toUpperCase() === "CFDSV15") {
      showToast("Đã áp dụng mã CFDSV15 giảm 15%!");
    } else if (state.voucherCode) {
      showToast("Mã không hợp lệ. Thử mã CFDSV15 để được giảm 15%.");
    }
  });

  document.getElementById("checkout-confirm-btn")?.addEventListener("click", () => {
    const method = document.getElementById("checkout-method")?.value || "Ví MoMo (Escrow CFD)";
    const order = {
      id: `CFD-ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: getUserBucketKey(),
      items: cartItems.map((p) => ({ id: p.id, name: p.name, price: getEffectivePrice(p) })),
      method,
      total: finalTotal,
      station: method.includes("KTX") ? "Trạm KTX ĐHQG-HCM" : "Giao hàng nội thành TP.HCM / Thủ Đức",
      status: "Đã xác nhận Escrow",
      createdAt: "Hôm nay"
    };
    state.shared.orders.unshift(order);
    state.checkoutDoneOrder = order;
    setCartIds([]);
    renderCartDrawer();
    if (state.activeView === "market") refreshCatalogGrid();
    showToast("Đặt hàng thành công!");
  });
}

/* ==================== CART, WISHLIST, HEADER & LISTING HELPERS ==================== */

function renderHeaderBadges() {
  const user = getCurrentUser();
  const label = document.getElementById("account-btn-label");
  const avatarSlot = document.getElementById("account-avatar-slot");
  if (label && avatarSlot) {
    if (user) {
      label.textContent = user.name;
      avatarSlot.textContent = user.initials || user.name.slice(0, 2).toUpperCase();
      avatarSlot.classList.add("logged");
    } else {
      label.textContent = "Đăng nhập";
      avatarSlot.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      avatarSlot.classList.remove("logged");
    }
  }

  const unread = getUnreadChatCount();
  const chatBadge = document.getElementById("chat-unread-count");
  const floatBadge = document.getElementById("floating-chat-count");
  if (chatBadge) chatBadge.textContent = String(unread);
  if (floatBadge) {
    floatBadge.textContent = String(unread);
    floatBadge.hidden = unread === 0;
  }

  const cartBadge = document.getElementById("cart-count");
  if (cartBadge) cartBadge.textContent = String(getCartIds().length);

  const wishBadge = document.getElementById("wishlist-count");
  if (wishBadge) wishBadge.textContent = String(getWishlistIds().length);
}

function deleteUserProduct(productId) {
  state.shared.userProducts = state.shared.userProducts.filter((p) => p.id !== productId);
  saveSharedState();
  renderActiveView();
  showToast("Đã gỡ sản phẩm khỏi Cửa hàng.");
}

function addToCart(productId) {
  const ids = getCartIds();
  if (!ids.includes(productId)) {
    setCartIds([...ids, productId]);
    renderCartDrawer();
    renderHeaderBadges();
    if (state.activeView === "market") refreshCatalogGrid();
    showToast("Đã thêm sản phẩm vào giỏ hàng.");
  } else {
    showToast("Sản phẩm đã có trong giỏ hàng (mỗi mẫu chỉ có 1 chiếc).");
  }
}

function toggleWishlist(productId) {
  const ids = getWishlistIds();
  if (ids.includes(productId)) {
    setWishlistIds(ids.filter((id) => id !== productId));
    showToast("Đã bỏ khỏi danh sách yêu thích.");
  } else {
    setWishlistIds([...ids, productId]);
    showToast("Đã lưu vào danh sách yêu thích.");
  }
  renderWishlistDrawer();
  renderHeaderBadges();
  if (state.activeView === "market") refreshCatalogGrid();
}

function openCartDrawer() {
  renderCartDrawer();
  document.getElementById("cart-drawer").hidden = false;
}

function closeCartDrawer() {
  document.getElementById("cart-drawer").hidden = true;
}

function openWishlistDrawer() {
  renderWishlistDrawer();
  document.getElementById("wishlist-drawer").hidden = false;
}

function closeWishlistDrawer() {
  document.getElementById("wishlist-drawer").hidden = true;
}

function compressUploadedImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 640;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.76));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* ==================== ROUTING & EVENT BINDING ==================== */

function navigateTo(view, scrollTargetId = null) {
  const valid = ["market", "ai-stylist", "sell"];
  state.activeView = valid.includes(view) ? view : "market";
  window.location.hash = state.activeView;

  document.querySelectorAll("[data-nav]").forEach((el) => {
    const target = el.getAttribute("data-nav");
    if (el.classList.contains("nav-link")) {
      el.classList.toggle("active", target === state.activeView);
    }
  });

  document.getElementById("mobile-nav-panel")?.classList.remove("open");
  renderActiveView();

  if (scrollTargetId) {
    setTimeout(() => {
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth" });
    }, 40);
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderActiveView() {
  const root = document.getElementById("app-root");
  if (!root) return;

  if (state.activeView === "market") {
    root.innerHTML = renderMarketplaceView();
    bindMarketplaceEvents();
  } else if (state.activeView === "ai-stylist") {
    root.innerHTML = renderAIStylistView();
    bindAIStylistEvents();
  } else {
    root.innerHTML = renderSellView();
    bindSellEvents();
  }

  bindSharedProductTriggers();
  renderHeaderBadges();
}

function refreshCatalogGrid() {
  const all = getAllProducts();
  const products = getFilteredProducts();
  const grid = document.getElementById("market-product-grid");
  const countEl = document.getElementById("market-count-label");
  if (grid) grid.innerHTML = renderProductCardsHTML(products);
  if (countEl) countEl.innerHTML = `Hiển thị <strong>${products.length}</strong> / ${all.length} sản phẩm`;

  document.getElementById("reset-filters-empty-btn")?.addEventListener("click", resetAllFilters);
  bindSharedProductTriggers();
}

function resetAllFilters() {
  state.filters = { search: "", tier: "all", category: "all", style: "all", priceRange: "all", sort: "featured" };
  const hInput = document.getElementById("header-search-input");
  if (hInput) hInput.value = "";
  renderActiveView();
}

function bindSharedProductTriggers() {
  document.querySelectorAll("[data-open-product]").forEach((el) => {
    el.addEventListener("click", () => openProductModal(el.getAttribute("data-open-product")));
  });
  document.querySelectorAll("[data-add-cart]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(el.getAttribute("data-add-cart"));
    });
  });
  document.querySelectorAll("[data-toggle-wish]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleWishlist(el.getAttribute("data-toggle-wish"));
    });
  });
  document.querySelectorAll("#app-root [data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigateTo(el.getAttribute("data-nav")));
  });
}

function bindMarketplaceEvents() {
  document.getElementById("hero-shop-btn")?.addEventListener("click", () => {
    document.getElementById("catalog-anchor")?.scrollIntoView({ behavior: "smooth" });
  });

  document.querySelectorAll("[data-cat-jump]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.filters.category = btn.getAttribute("data-cat-jump");
      renderActiveView();
      document.getElementById("catalog-anchor")?.scrollIntoView({ behavior: "smooth" });
    })
  );

  const inlineSearch = document.getElementById("catalog-search-input");
  inlineSearch?.addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    const hInput = document.getElementById("header-search-input");
    if (hInput && hInput.value !== state.filters.search) hInput.value = state.filters.search;
    refreshCatalogGrid();
  });

  document.getElementById("market-sort-select")?.addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    refreshCatalogGrid();
  });

  document.querySelectorAll("[data-filter-tier]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.filters.tier = btn.getAttribute("data-filter-tier");
      renderActiveView();
    })
  );
  document.querySelectorAll("[data-filter-cat]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.filters.category = btn.getAttribute("data-filter-cat");
      renderActiveView();
    })
  );
  document.querySelectorAll("[data-filter-style]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.filters.style = btn.getAttribute("data-filter-style");
      renderActiveView();
    })
  );
  document.querySelectorAll("[data-filter-price]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.filters.priceRange = btn.getAttribute("data-filter-price");
      renderActiveView();
    })
  );

  document.getElementById("reset-filters-btn")?.addEventListener("click", resetAllFilters);
  document.getElementById("reset-filters-empty-btn")?.addEventListener("click", resetAllFilters);
}

function bindAIOutfitActions() {
  document.querySelectorAll("[data-add-outfit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const ids = JSON.parse(btn.getAttribute("data-add-outfit"));
      const cur = getCartIds();
      const added = ids.filter((id) => !cur.includes(id));
      if (added.length) {
        setCartIds([...cur, ...added]);
        renderHeaderBadges();
      }
      renderCartDrawer();
      openCartDrawer();
      showToast(added.length ? `Đã thêm ${added.length} món từ set phối vào giỏ hàng!` : "Cả bộ đồ đã có sẵn trong giỏ.");
    })
  );
}

function bindAIStylistEvents() {
  document.querySelectorAll("[data-ai-body]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.aiConfig.bodyShape = btn.getAttribute("data-ai-body");
      renderActiveView();
    })
  );

  document.querySelectorAll("[data-ai-style]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.aiConfig.style = btn.getAttribute("data-ai-style");
      renderActiveView();
    })
  );

  document.getElementById("ai-budget-slider")?.addEventListener("input", (e) => {
    state.aiConfig.budget = Number(e.target.value);
    const lbl = document.getElementById("ai-budget-label");
    const stack = document.getElementById("ai-outfits-stack");
    if (lbl) lbl.textContent = formatVND(state.aiConfig.budget);
    if (stack) {
      stack.innerHTML = renderAIOutfitsStackHTML(state.aiConfig);
      bindAIOutfitActions();
      bindSharedProductTriggers();
    }
  });

  document.getElementById("ai-occasion-select")?.addEventListener("change", (e) => {
    state.aiConfig.occasion = e.target.value;
    renderActiveView();
  });

  document.getElementById("ai-anchor-select")?.addEventListener("change", (e) => {
    state.aiConfig.anchorId = e.target.value;
    renderActiveView();
  });

  const shuffleHandler = () => {
    state.aiShuffleSeed += 1;
    renderActiveView();
    showToast("Đã đổi sang 4 bộ phối khác từ kho!");
  };

  document.getElementById("run-ai-match-btn")?.addEventListener("click", shuffleHandler);
  document.getElementById("ai-shuffle-btn")?.addEventListener("click", shuffleHandler);

  bindAIOutfitActions();
}

function bindSellEvents() {
  document.querySelectorAll("[data-sell-mode]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.sellMode = btn.getAttribute("data-sell-mode");
      renderActiveView();
    })
  );

  document.getElementById("sell-login-prompt-btn")?.addEventListener("click", () => openAuthModal("login"));
  document.getElementById("sell-panel-login-btn")?.addEventListener("click", () => openAuthModal("login"));

  // C2C form handlers
  document.getElementById("c2c-file-input")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressUploadedImage(file, (dataUrl) => {
      state.c2cForm.image = dataUrl;
      const preview = document.getElementById("c2c-preview-img");
      if (preview) preview.src = dataUrl;
      showToast("Đã tải và tối ưu ảnh sản phẩm!");
    });
  });

  document.querySelectorAll("[data-sample-photo]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.c2cForm.image = btn.getAttribute("data-sample-photo");
      renderActiveView();
    })
  );

  document.getElementById("c2c-name")?.addEventListener("input", (e) => {
    state.c2cForm.name = e.target.value;
  });
  document.getElementById("c2c-cat")?.addEventListener("change", (e) => {
    state.c2cForm.category = e.target.value;
  });
  document.getElementById("c2c-brand")?.addEventListener("input", (e) => {
    state.c2cForm.brand = e.target.value;
  });
  document.getElementById("c2c-size")?.addEventListener("input", (e) => {
    state.c2cForm.size = e.target.value;
  });
  document.getElementById("c2c-style")?.addEventListener("change", (e) => {
    state.c2cForm.style = e.target.value;
  });
  document.getElementById("c2c-fabric")?.addEventListener("input", (e) => {
    state.c2cForm.fabric = e.target.value;
  });
  document.getElementById("c2c-price")?.addEventListener("input", (e) => {
    state.c2cForm.price = Number(e.target.value) || 120000;
  });
  document.getElementById("c2c-orig-price")?.addEventListener("input", (e) => {
    state.c2cForm.originalPrice = Number(e.target.value) || 350000;
  });
  document.getElementById("c2c-cond")?.addEventListener("input", (e) => {
    state.c2cForm.condition = e.target.value;
  });

  document.getElementById("submit-c2c-btn")?.addEventListener("click", () => {
    const user = getCurrentUser();
    if (!user) {
      showToast("Vui lòng đăng nhập để đăng bán sản phẩm lên Cửa hàng.");
      openAuthModal("login");
      return;
    }
    const c2c = state.c2cForm;
    if (!c2c.name.trim()) {
      showToast("Vui lòng nhập tên sản phẩm cần đăng bán.");
      return;
    }

    const catSlotMap = {
      "Áo khoác": "outer",
      Áo: "top",
      Quần: "bottom",
      "Váy & Đầm": "bottom",
      "Túi & Phụ kiện": "accessory"
    };

    const price = Math.max(20000, Number(c2c.price) || 150000);
    const origPrice = Math.max(price + 50000, Number(c2c.originalPrice) || price * 2);

    const newItem = {
      id: `C2C-${Math.floor(1000 + Math.random() * 8999)}`,
      name: c2c.name.trim(),
      brand: c2c.brand.trim() || "Cá nhân ký gửi",
      sellerId: user.id,
      tier: "C2C",
      tierLabel: "Thành viên đăng bán",
      category: c2c.category,
      slot: catSlotMap[c2c.category] || "top",
      style: c2c.style,
      price,
      originalPrice: origPrice,
      size: c2c.size.trim() || "M",
      measurements: { Tình_trạng: "Đo theo yêu cầu qua Chat" },
      fabric: c2c.fabric.trim() || "Cotton",
      colorName: "Theo ảnh thực tế",
      colors: ["#111111", "#8C8C8C"],
      condition: c2c.condition.trim() || "Độ mới 95% • Đã giặt sạch",
      hygieneBatch: "Người bán xác nhận đã vệ sinh sạch",
      origin: `Đăng bán trực tiếp bởi ${user.name}`,
      co2SavedKg: 5.5,
      waterSavedL: 1650,
      preferredBodies: ["hourglass", "pear", "rectangle", "inverted", "plus"],
      goodBodies: [],
      occasions: ["Đi học / Hằng ngày", "Cuối tuần / Dạo phố"],
      silhouetteTag: "C2C Selection",
      image: c2c.image
    };

    state.shared.userProducts.unshift(newItem);
    state.c2cForm.name = "";
    saveSharedState();
    renderActiveView();
    showToast(`Đã đăng "${newItem.name}" lên Cửa hàng!`);
  });

  document.querySelectorAll("[data-delete-listing]").forEach((btn) =>
    btn.addEventListener("click", () => deleteUserProduct(btn.getAttribute("data-delete-listing")))
  );

  // CFD intake form handlers
  document.getElementById("sell-name")?.addEventListener("input", (e) => {
    state.sellForm.itemName = e.target.value;
  });
  document.getElementById("sell-cat")?.addEventListener("change", (e) => {
    state.sellForm.category = e.target.value;
    renderActiveView();
  });
  document.getElementById("sell-orig-price")?.addEventListener("change", (e) => {
    state.sellForm.originalPrice = Number(e.target.value) || 400000;
    renderActiveView();
  });
  document.getElementById("sell-cond")?.addEventListener("change", (e) => {
    state.sellForm.condition = e.target.value;
    renderActiveView();
  });
  document.getElementById("qa-struct")?.addEventListener("change", (e) => {
    state.sellForm.noStructuralDamage = e.target.checked;
    renderActiveView();
  });
  document.getElementById("qa-surface")?.addEventListener("change", (e) => {
    state.sellForm.noSurfaceDefect = e.target.checked;
    renderActiveView();
  });
  document.getElementById("qa-wash")?.addEventListener("change", (e) => {
    state.sellForm.preWashed = e.target.checked;
    renderActiveView();
  });
  document.getElementById("sell-station")?.addEventListener("change", (e) => {
    state.sellForm.stationId = e.target.value;
  });

  document.querySelectorAll("[data-payout]").forEach((card) =>
    card.addEventListener("click", () => {
      if (card.classList.contains("disabled")) return;
      state.sellForm.payoutMode = card.getAttribute("data-payout");
      renderActiveView();
    })
  );

  document.getElementById("submit-sell-btn")?.addEventListener("click", () => {
    const sf = state.sellForm;
    if (!sf.itemName.trim()) {
      showToast("Vui lòng nhập tên sản phẩm cần gửi.");
      return;
    }
    const evalRes = evaluateSellerIntake(sf);
    const station = DROPOFF_STATIONS.find((s) => s.id === sf.stationId) || DROPOFF_STATIONS[0];
    const modeLabel =
      evalRes.groupCode === "C"
        ? "Chuyển tái chế Zero-Waste"
        : sf.payoutMode === "direct"
        ? "Mua đứt (MoMo / ZaloPay ngay)"
        : "Ký gửi 60 ngày (Đối soát ngày 15 & 30)";
    const valueLabel =
      evalRes.groupCode === "C"
        ? "0đ • Tích điểm Xanh"
        : sf.payoutMode === "direct"
        ? `${formatVND(evalRes.directPrice)} (Thanh toán ngay)`
        : `Niêm yết ${formatVND(evalRes.consignListPrice)} (Nhận ~${formatVND(evalRes.sellerNet)})`;

    const newEntry = {
      id: `CFD-IN-2026-${Math.floor(200 + Math.random() * 799)}`,
      itemName: sf.itemName.trim(),
      category: sf.category,
      group: evalRes.groupLabel.split("(")[0].trim(),
      mode: modeLabel,
      estimatedValue: valueLabel,
      station: station.name,
      stageIndex: 0,
      createdAt: "Hôm nay"
    };

    state.shared.submissions.unshift(newEntry);
    saveSharedState();
    renderActiveView();
    showToast(`Đã tạo phiếu ${newEntry.id}. Mang đồ tới trạm để kiểm định nhanh!`);
  });
}

/* ==================== BOOTSTRAP ==================== */

function handleExternalSync() {
  loadSharedState();
  renderHeaderBadges();
  renderCartDrawer();
  renderWishlistDrawer();
  if (!document.getElementById("chat-modal")?.hidden) {
    renderChatModalBody();
  }
  if (state.activeView === "market") {
    refreshCatalogGrid();
  } else if (state.activeView === "sell") {
    renderActiveView();
  }
}

function init() {
  loadSharedState();
  loadTabUser();
  updatePresence();

  if (syncChannel) {
    syncChannel.onmessage = (ev) => {
      if (ev.data?.type === "SYNC_STATE" && ev.data.fromTab !== TAB_ID) {
        handleExternalSync();
      }
    };
  }
  window.addEventListener("storage", (e) => {
    if (e.key === SHARED_STORAGE_KEY) handleExternalSync();
  });
  setInterval(() => updatePresence(), 5000);
  window.addEventListener("beforeunload", () => updatePresence(true));

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(btn.getAttribute("data-nav"));
    });
  });

  document.querySelectorAll("[data-footer-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-footer-filter");
      state.filters.category = "all";
      state.filters.tier = mode === "tierA" ? "A" : mode === "tierB" ? "B" : mode === "tierC2C" ? "C2C" : "all";
      navigateTo("market", "catalog-anchor");
    });
  });

  document.querySelectorAll("[data-policy]").forEach((btn) => {
    btn.addEventListener("click", () => openPolicyModal(btn.getAttribute("data-policy")));
  });

  document.getElementById("header-search-input")?.addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    if (state.activeView !== "market") {
      navigateTo("market", "catalog-anchor");
    } else {
      const inline = document.getElementById("catalog-search-input");
      if (inline && inline.value !== state.filters.search) inline.value = state.filters.search;
      refreshCatalogGrid();
    }
  });

  document.getElementById("newsletter-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("newsletter-email");
    if (emailInput && emailInput.value.trim()) {
      emailInput.value = "";
      showToast("Đăng ký thành công! Sử dụng mã CFDSV15 để giảm 15% cho đơn đầu.");
    }
  });

  document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
    document.getElementById("mobile-nav-panel")?.classList.toggle("open");
  });

  document.getElementById("account-btn")?.addEventListener("click", () => {
    if (getCurrentUser()) openAccountModal("orders");
    else openAuthModal("login");
  });

  document.getElementById("chat-open-btn")?.addEventListener("click", openChatModal);
  document.getElementById("floating-chat-btn")?.addEventListener("click", openChatModal);

  document.getElementById("cart-open-btn")?.addEventListener("click", openCartDrawer);
  document.getElementById("cart-close-btn")?.addEventListener("click", closeCartDrawer);
  document.getElementById("cart-drawer")?.addEventListener("click", (e) => {
    if (e.target.id === "cart-drawer") closeCartDrawer();
  });

  document.getElementById("wishlist-open-btn")?.addEventListener("click", openWishlistDrawer);
  document.getElementById("wishlist-close-btn")?.addEventListener("click", closeWishlistDrawer);
  document.getElementById("wishlist-drawer")?.addEventListener("click", (e) => {
    if (e.target.id === "wishlist-drawer") closeWishlistDrawer();
  });

  const bindModalClose = (modalId, closeBtnId) => {
    const m = document.getElementById(modalId);
    document.getElementById(closeBtnId)?.addEventListener("click", () => {
      if (m) m.hidden = true;
    });
    m?.addEventListener("click", (e) => {
      if (e.target.id === modalId) m.hidden = true;
    });
  };
  bindModalClose("product-modal", "product-modal-close");
  bindModalClose("auth-modal", "auth-modal-close");
  bindModalClose("account-modal", "account-modal-close");
  bindModalClose("chat-modal", "chat-modal-close");
  bindModalClose("info-modal", "info-modal-close");

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ["product-modal", "auth-modal", "account-modal", "chat-modal", "info-modal"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });
      closeCartDrawer();
      closeWishlistDrawer();
    }
  });

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash && hash !== state.activeView) {
      navigateTo(hash);
    }
  });

  const initialHash = window.location.hash.replace("#", "");
  renderHeaderBadges();
  renderCartDrawer();
  renderWishlistDrawer();
  navigateTo(initialHash || "market");
}

document.addEventListener("DOMContentLoaded", init);
