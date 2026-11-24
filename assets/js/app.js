import {
  HERO_BANNER,
  CATEGORY_TILES,
  PRODUCTS,
  BODY_SHAPES,
  STYLE_SPECTRUMS,
  DROPOFF_STATIONS,
  POLICY_DOCS,
  INITIAL_SUBMISSIONS
} from "./data.js";

const STORAGE_KEY = "cfd_store_v2";
const FREE_SHIP_THRESHOLD = 299000;

const state = {
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
    occasion: "Đi học / Dạo phố",
    anchorId: ""
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
  submissions: [...INITIAL_SUBMISSIONS],
  cart: ["CFD-UPC-001", "CFD-SEC-005"],
  wishlist: ["CFD-SEC-003", "CFD-UPC-008"],
  voucherCode: "",
  checkoutDoneOrder: null
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.cart)) state.cart = parsed.cart;
    if (Array.isArray(parsed.wishlist)) state.wishlist = parsed.wishlist;
    if (Array.isArray(parsed.submissions)) state.submissions = parsed.submissions;
    if (typeof parsed.voucherCode === "string") state.voucherCode = parsed.voucherCode;
  } catch {
    // Ignore storage errors in private mode
  }
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cart: state.cart,
        wishlist: state.wishlist,
        submissions: state.submissions,
        voucherCode: state.voucherCode
      })
    );
  } catch {
    // Ignore storage errors
  }
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

function showToast(message) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3000);
}

function getFilteredProducts() {
  const { search, tier, category, style, priceRange, sort } = state.filters;
  const q = search.trim().toLowerCase();

  let list = PRODUCTS.filter((p) => {
    if (q) {
      const hay = `${p.name} ${p.brand} ${p.category} ${p.style} ${p.fabric} ${p.id}`.toLowerCase();
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

function generateAIOutfits(cfg) {
  const anchor = PRODUCTS.find((p) => p.id === cfg.anchorId) || null;
  const outers = PRODUCTS.filter((p) => p.slot === "outer");
  const tops = PRODUCTS.filter((p) => p.slot === "top");
  const bottoms = PRODUCTS.filter((p) => p.slot === "bottom");
  const accs = PRODUCTS.filter((p) => p.slot === "accessory");

  const combos = [];
  const usedSignatures = new Set();

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const outer of [null, ...outers]) {
        for (const acc of accs) {
          const pieces = [outer, top, bottom, acc].filter(Boolean);
          if (anchor && !pieces.some((p) => p.id === anchor.id)) continue;

          const totalPrice = pieces.reduce((sum, p) => sum + p.price, 0);
          const totalOriginal = pieces.reduce((sum, p) => sum + p.originalPrice, 0);

          let score = 70;
          const bodyMatches = pieces.filter((p) => p.bodyFit.includes(cfg.bodyShape)).length;
          score += (bodyMatches / pieces.length) * 16;

          const styleMatches = pieces.filter((p) => p.style === cfg.style).length;
          score += Math.min(10, styleMatches * 4.5);

          if (cfg.occasion === "Đi làm / Thuyết trình" && pieces.some((p) => p.style === "Minimalist")) {
            score += 5;
          } else if (cfg.occasion === "Cuối tuần / Dạo phố" && pieces.some((p) => p.tier === "B")) {
            score += 4;
          }

          if (totalPrice <= cfg.budget) {
            score += 5;
          } else {
            score -= Math.min(18, Math.round((totalPrice - cfg.budget) / 25000) * 3);
          }

          const finalScore = Math.max(68, Math.min(98, Math.round(score)));
          const baseSig = `${outer ? outer.id : "none"}-${top.id}-${bottom.id}`;
          const totalCo2 = pieces.reduce((s, p) => s + p.co2SavedKg, 0);
          const discountPct = Math.round(((totalOriginal - totalPrice) / totalOriginal) * 100);

          combos.push({
            id: `${baseSig}-${acc.id}`,
            baseSig,
            outer,
            top,
            bottom,
            accessory: acc,
            pieces,
            score: finalScore,
            totalPrice,
            totalOriginal,
            discountPct,
            totalCo2,
            withinBudget: totalPrice <= cfg.budget
          });
        }
      }
    }
  }

  combos.sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice);
  const topDistinct = [];
  for (const combo of combos) {
    if (usedSignatures.has(combo.baseSig)) continue;
    usedSignatures.add(combo.baseSig);
    topDistinct.push(combo);
    if (topDistinct.length >= 3) break;
  }
  return topDistinct;
}

/* ==================== STOREFRONT VIEW ==================== */

function renderProductCardsHTML(products) {
  if (!products.length) {
    return `<div class="empty-state" style="grid-column: 1 / -1;">
         <p><strong>Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.</strong></p>
         <button class="btn-outline btn-sm" id="reset-filters-empty-btn">Xóa bộ lọc để xem toàn bộ sản phẩm</button>
       </div>`;
  }

  return products
    .map((p) => {
      const savePct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
      const inCart = state.cart.includes(p.id);
      const isSaved = state.wishlist.includes(p.id);
      const badgeHtml =
        p.tier === "B"
          ? `<span class="card-tag upcycled">Upcycled</span>`
          : `<span class="card-tag sale">-${savePct}%</span>`;

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
              <span>${escapeHtml(p.brand)}</span>
              <span>Size ${escapeHtml(p.size.split(" ")[0])}</span>
            </div>
            <h3 class="product-title" data-open-product="${p.id}">${escapeHtml(p.name)}</h3>
            <div class="product-price-row">
              <span class="price-now">${formatVND(p.price)}</span>
              <span class="price-old">${formatVND(p.originalPrice)}</span>
            </div>
            <div class="product-bottom-meta">
              <span class="swatch-dots" title="${escapeHtml(p.colorName)}">
                ${p.colors.map((c) => `<span class="swatch-dot" style="background:${c}"></span>`).join("")}
              </span>
              <span class="hygiene-note">✓ Đã giặt hấp</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMarketplaceView() {
  const products = getFilteredProducts();
  const f = state.filters;
  const cardsHtml = renderProductCardsHTML(products);

  const tierOptions = [
    ["all", "Tất cả sản phẩm"],
    ["A", "Secondhand Tuyển Chọn"],
    ["B", "Upcycled Độc Bản"]
  ];
  const categoryOptions = ["all", "Áo khoác", "Áo", "Quần & Váy", "Túi & Phụ kiện"];
  const styleOptions = ["all", "Streetwear", "Minimalist", "Y2K Vintage", "Eco-Vintage"];
  const priceOptions = [
    ["all", "Tất cả mức giá"],
    ["under150", "Dưới 150.000đ"],
    ["150to250", "150.000đ – 250.000đ"],
    ["above250", "Trên 250.000đ"]
  ];

  return `
    <section class="view-section">
      <!-- Editorial Full-Bleed Fashion Hero -->
      <div class="hero-banner">
        <img class="hero-bg-img" src="${escapeHtml(HERO_BANNER.image)}" alt="Thời trang tuần hoàn tuyển chọn CFD" />
        <div class="hero-scrim"></div>
        <div class="container">
          <div class="hero-inner">
            <div class="hero-kicker">${HERO_BANNER.kicker}</div>
            <h1 class="hero-title">${HERO_BANNER.title}</h1>
            <p class="hero-subtitle">${HERO_BANNER.subtitle}</p>
            <div class="hero-actions">
              <button class="btn-hero-white" id="hero-shop-btn">Mua sắm ngay</button>
              <button class="btn-hero-ghost" data-nav="ai-stylist">Phối đồ cùng AI</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 4-Column Commercial USP Strip -->
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>
            </div>
            <div>
              <div class="usp-title">Giặt hấp diệt khuẩn</div>
              <div class="usp-desc">Sạch chuẩn y tế trước khi lên kệ</div>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
            </div>
            <div>
              <div class="usp-title">Freeship từ 299.000đ</div>
              <div class="usp-desc">Đóng gói bằng bao bì sinh học</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4-Column Category Visual Strip -->
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

      <!-- Storefront Catalog: Sidebar Filters + Product Grid -->
      <div class="container section-block" id="catalog-anchor">
        <div class="section-header-row">
          <div>
            <h2 class="section-heading">Sản phẩm đang mở bán</h2>
            <p class="section-lead">Mỗi sản phẩm là duy nhất — được đo số đo thực tế và chụp ảnh trực tiếp tại Studio</p>
          </div>
        </div>

        <!-- Mobile quick category pills -->
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
          <!-- Left Sticky Filter Sidebar -->
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

          <!-- Main Product Area -->
          <div>
            <div class="catalog-toolbar">
              <div class="catalog-search-inline">
                <svg class="header-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  type="search"
                  id="catalog-search-input"
                  placeholder="Tìm tên sản phẩm, thương hiệu, chất liệu..."
                  value="${escapeHtml(f.search)}"
                />
              </div>

              <div class="catalog-toolbar-right">
                <span class="muted-xs tabular" id="market-count-label" style="margin:0;">
                  Hiển thị <strong>${products.length}</strong> / ${PRODUCTS.length} sản phẩm
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
  const outfits = generateAIOutfits(cfg);
  const selectedBody = BODY_SHAPES.find((b) => b.id === cfg.bodyShape) || BODY_SHAPES[0];

  return `
    ${outfits
      .map(
        (outfit, idx) => `
      <article class="outfit-card ${idx === 0 ? "best-match" : ""}">
        <div class="outfit-header">
          <div>
            <div class="muted-xs" style="text-transform:uppercase; letter-spacing:0.06em;">
              ${idx === 0 ? "ĐỀ XUẤT PHÙ HỢP NHẤT" : `GỢI Ý PHỐI #${idx + 1}`} • ${escapeHtml(cfg.occasion)}
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
              <div class="piece-role">${piece.slot === "outer" ? "Khoác ngoài" : piece.slot === "top" ? "Áo chính" : piece.slot === "bottom" ? "Quần / Váy" : "Phụ kiện"}</div>
              <div style="font-size:12.5px; font-weight:600; line-height:1.3">${escapeHtml(piece.name)}</div>
              <div class="tabular" style="font-size:13px; font-weight:700">${formatVND(piece.price)}</div>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="ai-explain-box">
          <strong>Gợi ý từ AI Stylist:</strong> ${selectedBody.rule}
          Phối màu <strong>${outfit.pieces.map((p) => p.colorName.split("/")[0].trim()).join(" / ")}</strong> giúp tổng thể hài hòa cho dịp <em>${escapeHtml(cfg.occasion)}</em>.
          ${outfit.withinBudget ? "" : " (Lưu ý: Tổng set nhỉnh hơn nhẹ mức ngân sách đang chọn.)"}
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

  return `
    <section class="view-section">
      <div class="page-header-strip">
        <div class="container">
          <h1>Phối đồ AI thông minh</h1>
          <p>Chọn vóc dáng, phong cách và ngân sách — hệ thống tự động gợi ý các bộ trang phục hoàn chỉnh từ kho đồ hiện có.</p>
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
              max="750000"
              step="25000"
              value="${cfg.budget}"
            />
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--ink-subtle)">
              <span>220.000đ</span>
              <span>750.000đ</span>
            </div>
          </div>

          <div class="control-group">
            <div class="control-label"><span>4. Dịp sử dụng</span></div>
            <select id="ai-occasion-select" class="input-control">
              ${["Đi học / Dạo phố", "Đi làm / Thuyết trình", "Cuối tuần / Dạo phố"]
                .map((occ) => `<option value="${occ}" ${cfg.occasion === occ ? "selected" : ""}>${occ}</option>`)
                .join("")}
            </select>
          </div>

          <div class="control-group">
            <div class="control-label"><span>5. Ghim sẵn 1 món đồ (tùy chọn)</span></div>
            <select id="ai-anchor-select" class="input-control">
              <option value="">-- Để AI tự chọn toàn bộ --</option>
              ${PRODUCTS.map(
                (p) =>
                  `<option value="${p.id}" ${cfg.anchorId === p.id ? "selected" : ""}>${escapeHtml(p.name)} (${formatVND(p.price)})</option>`
              ).join("")}
            </select>
          </div>

          <button class="btn-primary" style="width:100%" id="run-ai-match-btn">
            Cập nhật gợi ý phối đồ
          </button>
        </div>

        <div class="outfit-results-stack" id="ai-outfits-stack">
          ${renderAIOutfitsStackHTML(cfg)}
        </div>
      </div>
    </section>
  `;
}

/* ==================== SELL & CONSIGN VIEW ==================== */

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
  const sf = state.sellForm;
  const evalRes = evaluateSellerIntake(sf);
  const stages = ["Tiếp nhận", "Kiểm định", "Giặt hấp", "Chụp Studio", "Đang bán / Đã chi"];

  return `
    <section class="view-section">
      <div class="page-header-strip">
        <div class="container">
          <h1>Đăng bán &amp; Ký gửi quần áo cũ</h1>
          <p>Dọn tủ đồ nhanh gọn — chọn nhận tiền ngay qua MoMo/ZaloPay hoặc ký gửi 60 ngày để nhận lại 60–70% giá bán.</p>
        </div>
      </div>

      <div class="container">
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
            <h3 style="margin-top:0">Thông tin sản phẩm gửi bán</h3>
            <div class="form-grid-2">
              <div class="field-group">
                <label for="sell-name">Tên sản phẩm</label>
                <input id="sell-name" class="input-control" type="text" value="${escapeHtml(sf.itemName)}" />
              </div>
              <div class="field-group">
                <label for="sell-cat">Danh mục</label>
                <select id="sell-cat" class="input-control">
                  ${["Áo khoác", "Áo", "Quần & Váy", "Túi & Phụ kiện"]
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
              <h3 style="margin:0">Đơn ký gửi của bạn</h3>
              <span class="header-badge">${state.submissions.length}</span>
            </div>
            <p class="muted-xs" style="margin-bottom:14px;">
              Sản phẩm không đạt chuẩn được thông báo trong 48 giờ để bạn nhận lại tại trạm hoặc chuyển quyên góp/tái chế.
            </p>

            <div class="submission-list">
              ${state.submissions
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
      </div>
    </section>
  `;
}

/* ==================== MODALS & DRAWERS ==================== */

function openProductModal(productId) {
  const p = PRODUCTS.find((item) => item.id === productId);
  if (!p) return;
  const modal = document.getElementById("product-modal");
  const body = document.getElementById("product-modal-body");
  const savePct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
  const inCart = state.cart.includes(p.id);
  const isSaved = state.wishlist.includes(p.id);

  const measureEntries = Object.entries(p.measurements)
    .map(([k, v]) => `<span class="spec-pill"><strong>${k}:</strong> ${v}</span>`)
    .join("");

  body.innerHTML = `
    <div class="dpp-grid">
      <div class="dpp-visual">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />
      </div>

      <div>
        <div class="muted-xs" style="text-transform:uppercase; letter-spacing:0.06em;">
          ${escapeHtml(p.brand)} • ${escapeHtml(p.tierLabel)} • ${p.id}
        </div>
        <h2 id="modal-product-title" style="margin:6px 0 8px; font-size:22px;">${escapeHtml(p.name)}</h2>

        <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:10px;" class="tabular">
          <span style="font-size:24px; font-weight:800;">${formatVND(p.price)}</span>
          <span class="price-old" style="font-size:15px">${formatVND(p.originalPrice)}</span>
          <span style="font-size:13px; font-weight:700; color:var(--sale)">Tiết kiệm ${savePct}%</span>
        </div>

        <div class="spec-pills">
          <span class="spec-pill">Size: ${escapeHtml(p.size)}</span>
          <span class="spec-pill">Chất liệu: ${escapeHtml(p.fabric)}</span>
          ${measureEntries}
        </div>

        <div class="dpp-passport-box">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">
            Cam kết chất lượng &amp; Nguồn gốc sản phẩm
          </div>
          <div class="dpp-layers">
            <div><strong>✓ Kiểm định 3-Không:</strong> ${escapeHtml(p.condition)}</div>
            <div><strong>✓ Vệ sinh y tế:</strong> ${escapeHtml(p.hygieneBatch)}</div>
            <div><strong>✓ Nguồn gốc:</strong> ${escapeHtml(p.origin)}</div>
            <div><strong>✓ Tác động xanh:</strong> Giảm <strong>${p.co2SavedKg} kg CO₂</strong> &amp; tiết kiệm <strong>${p.waterSavedL.toLocaleString("vi-VN")} lít nước</strong></div>
          </div>
        </div>

        ${p.legalDisclaimer ? `<div class="disclaimer-box">${escapeHtml(p.legalDisclaimer)}</div>` : ""}

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
          <button class="btn-primary" style="flex:1" id="modal-add-cart">
            ${inCart ? "✓ Đã có trong giỏ hàng" : "+ Thêm vào giỏ hàng"}
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
    addToCart(p.id);
    openProductModal(p.id);
  });

  document.getElementById("modal-wish-btn")?.addEventListener("click", () => {
    toggleWishlist(p.id);
    openProductModal(p.id);
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
  const badge = document.getElementById("wishlist-count");
  if (badge) badge.textContent = String(state.wishlist.length);

  const container = document.getElementById("wishlist-items-container");
  if (!container) return;

  const items = state.wishlist.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
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
        <div class="tabular" style="font-size:13.5px; font-weight:700; margin-top:4px">${formatVND(p.price)}</div>
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
  const countBadge = document.getElementById("cart-count");
  if (countBadge) countBadge.textContent = String(state.cart.length);

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
          Tiền được giữ tại ví trung gian CFD Escrow và chỉ chuyển cho người bán sau khi bạn kiểm tra hàng đúng mô tả.
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

  const cartItems = state.cart.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);

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

  const subtotal = cartItems.reduce((s, p) => s + p.price, 0);
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
      .map(
        (p) => `
      <div class="cart-item-row">
        <div class="cart-thumb"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" /></div>
        <div>
          <div style="font-size:13px; font-weight:600; line-height:1.3">${escapeHtml(p.name)}</div>
          <div class="muted-xs">${escapeHtml(p.brand)} • Size ${escapeHtml(p.size.split(" ")[0])}</div>
          <div class="tabular" style="font-size:13.5px; font-weight:700; margin-top:4px">${formatVND(p.price)}</div>
        </div>
        <button class="btn-outline-sm" data-remove-cart="${p.id}">Xóa</button>
      </div>
    `
      )
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
      state.cart = state.cart.filter((x) => x !== id);
      saveState();
      renderCartDrawer();
      if (state.activeView === "market") refreshCatalogGrid();
    });
  });

  document.getElementById("apply-voucher-btn")?.addEventListener("click", () => {
    const val = document.getElementById("voucher-input")?.value || "";
    state.voucherCode = val.trim();
    saveState();
    renderCartDrawer();
    if (state.voucherCode.toUpperCase() === "CFDSV15") {
      showToast("Đã áp dụng mã CFDSV15 giảm 15%!");
    } else if (state.voucherCode) {
      showToast("Mã không hợp lệ. Thử mã CFDSV15 để được giảm 15%.");
    }
  });

  document.getElementById("checkout-confirm-btn")?.addEventListener("click", () => {
    const method = document.getElementById("checkout-method")?.value || "Ví MoMo (Escrow CFD)";
    state.checkoutDoneOrder = {
      id: `CFD-ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      method,
      total: finalTotal,
      station: method.includes("KTX") ? "Trạm KTX ĐHQG-HCM" : "Giao hàng nội thành TP.HCM / Thủ Đức"
    };
    state.cart = [];
    saveState();
    renderCartDrawer();
    if (state.activeView === "market") refreshCatalogGrid();
    showToast("Đặt hàng thành công!");
  });
}

/* ==================== CART & WISHLIST HELPERS ==================== */

function addToCart(productId) {
  if (!state.cart.includes(productId)) {
    state.cart.push(productId);
    saveState();
    renderCartDrawer();
    if (state.activeView === "market") refreshCatalogGrid();
    showToast("Đã thêm sản phẩm vào giỏ hàng.");
  } else {
    showToast("Sản phẩm đã có trong giỏ hàng (mỗi mẫu chỉ có 1 chiếc).");
  }
}

function toggleWishlist(productId) {
  if (state.wishlist.includes(productId)) {
    state.wishlist = state.wishlist.filter((id) => id !== productId);
    showToast("Đã bỏ khỏi danh sách yêu thích.");
  } else {
    state.wishlist.push(productId);
    showToast("Đã lưu vào danh sách yêu thích.");
  }
  saveState();
  renderWishlistDrawer();
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
}

function refreshCatalogGrid() {
  const products = getFilteredProducts();
  const grid = document.getElementById("market-product-grid");
  const countEl = document.getElementById("market-count-label");
  if (grid) grid.innerHTML = renderProductCardsHTML(products);
  if (countEl) countEl.innerHTML = `Hiển thị <strong>${products.length}</strong> / ${PRODUCTS.length} sản phẩm`;

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
      let added = 0;
      ids.forEach((id) => {
        if (!state.cart.includes(id)) {
          state.cart.push(id);
          added++;
        }
      });
      saveState();
      renderCartDrawer();
      openCartDrawer();
      showToast(added ? `Đã thêm ${added} món từ set phối vào giỏ hàng!` : "Cả bộ đồ đã có sẵn trong giỏ.");
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

  document.getElementById("run-ai-match-btn")?.addEventListener("click", () => {
    renderActiveView();
    showToast("Đã cập nhật gợi ý phối đồ phù hợp nhất!");
  });

  bindAIOutfitActions();
}

function bindSellEvents() {
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

    state.submissions = [newEntry, ...state.submissions];
    saveState();
    renderActiveView();
    showToast(`Đã tạo phiếu ${newEntry.id}. Mang đồ tới trạm để kiểm định nhanh!`);
  });
}

/* ==================== BOOTSTRAP ==================== */

function init() {
  loadState();

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
      state.filters.tier = mode === "tierA" ? "A" : mode === "tierB" ? "B" : "all";
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

  const prodModal = document.getElementById("product-modal");
  document.getElementById("product-modal-close")?.addEventListener("click", () => {
    prodModal.hidden = true;
  });
  prodModal?.addEventListener("click", (e) => {
    if (e.target.id === "product-modal") prodModal.hidden = true;
  });

  const infoModal = document.getElementById("info-modal");
  document.getElementById("info-modal-close")?.addEventListener("click", () => {
    infoModal.hidden = true;
  });
  infoModal?.addEventListener("click", (e) => {
    if (e.target.id === "info-modal") infoModal.hidden = true;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (prodModal) prodModal.hidden = true;
      if (infoModal) infoModal.hidden = true;
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
  renderCartDrawer();
  renderWishlistDrawer();
  navigateTo(initialHash || "market");
}

document.addEventListener("DOMContentLoaded", init);
