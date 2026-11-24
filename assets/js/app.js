import {
  PRODUCTS,
  BODY_SHAPES,
  STYLE_SPECTRUMS,
  DROPOFF_STATIONS,
  WORKSHOP_ZONES,
  FINANCIAL_BASELINE,
  TEAM_MEMBERS,
  INITIAL_SUBMISSIONS
} from "./data.js";
import {
  renderBrandLogoSVG,
  renderGarmentSVG,
  renderVirtualTryOnSVG,
  renderFloorplanSVG
} from "./svg-art.js";

const STORAGE_KEY = "cfd_poc_state_v1";

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
    budget: 500000,
    occasion: "Đi học / Giảng đường",
    anchorId: ""
  },
  aiScanTick: 0,
  sellForm: {
    itemName: "Áo Khoác Jean Oversize Vintage",
    category: "Áo khoác",
    brand: "Zara / Local Brand",
    originalPrice: 550000,
    condition: "95",
    noStructuralDamage: true,
    noSurfaceDefect: true,
    preWashed: true,
    payoutMode: "consign",
    stationId: "ktx-b"
  },
  submissions: [...INITIAL_SUBMISSIONS],
  activeZone: 1,
  ecoItemsPerSemester: 6,
  financeSim: {
    users: 8200,
    arpu: 100000
  },
  cart: ["CFD-UPC-001", "CFD-SEC-003"],
  checkoutDoneOrder: null
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.cart)) state.cart = parsed.cart;
    if (Array.isArray(parsed.submissions)) state.submissions = parsed.submissions;
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
        submissions: state.submissions
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

function formatMillion(val) {
  if (Math.abs(val) >= 1000) {
    return (val / 1000).toFixed(2).replace(/\.00$/, "") + " tỷ VNĐ";
  }
  return Math.round(val).toLocaleString("vi-VN") + " triệu VNĐ";
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

function getFilteredProducts() {
  const { search, tier, category, style, priceRange, sort } = state.filters;
  const q = search.trim().toLowerCase();

  let list = PRODUCTS.filter((p) => {
    if (q) {
      const hay = `${p.name} ${p.category} ${p.style} ${p.fabric} ${p.id} ${p.origin}`.toLowerCase();
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
  } else if (sort === "eco-desc") {
    list = [...list].sort((a, b) => b.co2SavedKg - a.co2SavedKg);
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

          // Score calculation based on PDF rule + data model
          let score = 70;
          const bodyMatches = pieces.filter((p) => p.bodyFit.includes(cfg.bodyShape)).length;
          score += (bodyMatches / pieces.length) * 16;

          const styleMatches = pieces.filter((p) => p.style === cfg.style).length;
          score += Math.min(10, styleMatches * 4.5);

          if (cfg.occasion === "Thuyết trình / Phỏng vấn") {
            if (pieces.some((p) => p.style === "Minimalist")) score += 5;
          } else if (cfg.occasion === "Cà phê cuối tuần") {
            if (pieces.some((p) => p.tier === "B")) score += 4;
          }

          if (totalPrice <= cfg.budget) {
            score += 5;
          } else {
            score -= Math.min(18, Math.round((totalPrice - cfg.budget) / 25000) * 3);
          }

          const finalScore = Math.max(68, Math.min(98, Math.round(score)));
          const baseSig = `${outer ? outer.id : "none"}-${top.id}-${bottom.id}`;

          const totalCo2 = pieces.reduce((s, p) => s + p.co2SavedKg, 0);
          const totalWater = pieces.reduce((s, p) => s + p.waterSavedL, 0);
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
            totalWater,
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

/* ==================== RENDERERS ==================== */

function renderProductCardsHTML(products) {
  if (!products.length) {
    return `<div class="empty-state" style="grid-column: 1 / -1;">
         <p><strong>Không tìm thấy sản phẩm khớp bộ lọc hiện tại.</strong></p>
         <button class="btn-outline btn-sm" id="reset-filters-btn">Xóa bộ lọc để xem toàn bộ sản phẩm</button>
       </div>`;
  }

  return products
    .map((p) => {
      const savePct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
      const inCart = state.cart.includes(p.id);
      return `
        <article class="product-card" data-product-id="${p.id}">
          <div class="product-media" data-open-product="${p.id}">
            <span class="tier-badge ${p.tier === "A" ? "tier-a" : "tier-b"}">${p.tier === "A" ? "Nhóm A • Chuẩn 3-Không" : "Nhóm B • Upcycled 1-of-1"}</span>
            <span class="qa-badge">✓ Đã hấp y tế</span>
            ${renderGarmentSVG(p)}
            <span class="eco-badge">-${p.co2SavedKg.toFixed(1)} kg CO₂</span>
          </div>
          <div class="product-body">
            <div class="product-meta-line">
              <span>${p.id}</span>
              <span>${p.style} • Size ${p.size.split(" ")[0]}</span>
            </div>
            <h3 class="product-title" data-open-product="${p.id}">${escapeHtml(p.name)}</h3>
            <div class="product-specs">
              <span class="spec-pill">${escapeHtml(p.silhouetteTag)}</span>
              <span class="spec-pill">${escapeHtml(p.colorName)}</span>
            </div>
            <div class="product-price-row">
              <span class="price-now">${formatVND(p.price)}</span>
              <span class="price-old">${formatVND(p.originalPrice)}</span>
              <span class="price-save">-${savePct}%</span>
            </div>
            <div class="product-actions">
              <button class="btn-primary btn-sm" data-add-cart="${p.id}">
                ${inCart ? "✓ Trong giỏ hàng" : "+ Thêm vào giỏ"}
              </button>
              <button class="btn-outline btn-sm" data-open-product="${p.id}" title="Xem Hộ Chiếu Sản Phẩm Số">
                Hộ chiếu số
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMarketplaceView() {
  const products = getFilteredProducts();
  const spotlight = [PRODUCTS[0], PRODUCTS[1], PRODUCTS[3], PRODUCTS[4]];
  const f = state.filters;
  const cardsHtml = renderProductCardsHTML(products);

  return `
    <section class="view-section container">
      <!-- Hero Campaign -->
      <div class="hero-card">
        <div class="hero-content">
          <div class="hero-eyebrow">
            <span>DATA-DRIVEN CIRCULAR ECOSYSTEM • PILOT LÀNG ĐẠI HỌC TP.HCM</span>
          </div>
          <h1 class="hero-title">
            Thời trang tuần hoàn thông minh — <em>Độc bản, sạch chuẩn y tế</em> &amp; phối đồ AI
          </h1>
          <p class="hero-lead">
            Nền tảng kết nối <strong>Gen Z Trend Seeker</strong> và <strong>Minimalism Seller</strong>.
            Mọi sản phẩm secondhand &amp; upcycled đều vượt qua quy trình kiểm định <strong>3 Không</strong>,
            giặt hấp diệt khuẩn và số hóa Metadata minh bạch vòng đời.
          </p>
          <div class="hero-actions">
            <button class="hero-btn-light" id="scroll-to-catalog-btn">Khám phá Sàn Ngay (${PRODUCTS.length} mẫu)</button>
            <button class="hero-btn-ghost" data-nav="ai-stylist">Thử AI Phối Đồ Anti-Bias</button>
            <button class="hero-btn-ghost" data-nav="sell">Bán / Ký gửi đồ cũ</button>
          </div>
          <div class="hero-trust-strip">
            <div>
              <div class="trust-stat-val">30% – 70%</div>
              <div class="trust-stat-lbl">Rẻ hơn đồ mới cùng phân khúc</div>
            </div>
            <div>
              <div class="trust-stat-val">3 Lớp QA</div>
              <div class="trust-stat-lbl">Kiểm định 3-Không &amp; Hấp y tế</div>
            </div>
            <div>
              <div class="trust-stat-val">100% Minh bạch</div>
              <div class="trust-stat-lbl">Hộ chiếu số &amp; Tác động CO₂</div>
            </div>
          </div>
        </div>

        <div class="hero-visual-panel">
          <div class="hero-visual-header">
            <span class="live-pulse">STUDIO BOX • VỪA LÊN KỆ</span>
            <span>TRẠM LÀNG ĐH</span>
          </div>
          <div class="hero-spotlight-grid">
            ${spotlight
              .map(
                (item) => `
              <div class="spotlight-mini-card" data-open-product="${item.id}">
                <div class="spotlight-mini-thumb">${renderGarmentSVG(item)}</div>
                <div class="spotlight-mini-title">${escapeHtml(item.name)}</div>
                <div class="spotlight-mini-meta">
                  <strong style="color:var(--forest)">${formatVND(item.price)}</strong>
                  <span style="color:var(--terracotta)">-${item.co2SavedKg}kg CO₂</span>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>

      <!-- Marketplace Catalog Section -->
      <div class="section-head" id="catalog-anchor">
        <div>
          <div class="section-kicker">SÀN THƯƠNG MẠI TUẦN HOÀN</div>
          <h2 class="section-title">Kho đồ Secondhand tuyển chọn &amp; Bộ sưu tập Upcycled</h2>
          <p class="section-sub">Nhấn vào bất kỳ sản phẩm nào để xem <strong>Hộ chiếu Sản phẩm Số (Digital Product Passport)</strong>, thông số đo thực tế từ Studio và chứng nhận hấp diệt khuẩn.</p>
        </div>
        <div class="mono-text" id="market-count-label" style="font-size:13px; color:var(--ink-muted)">
          Hiển thị <strong>${products.length}</strong> / ${PRODUCTS.length} sản phẩm
        </div>
      </div>

      <!-- Filter Toolbar -->
      <div class="filter-toolbar">
        <div class="filter-row">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              id="market-search-input"
              placeholder="Tìm theo tên món, chất liệu (denim, linen...), phong cách, mã SKU..."
              value="${escapeHtml(f.search)}"
            />
          </div>
          <select id="market-sort-select" class="select-control" aria-label="Sắp xếp sản phẩm">
            <option value="featured" ${f.sort === "featured" ? "selected" : ""}>Sắp xếp: Đề xuất Studio</option>
            <option value="price-asc" ${f.sort === "price-asc" ? "selected" : ""}>Giá: Thấp đến cao</option>
            <option value="discount-desc" ${f.sort === "discount-desc" ? "selected" : ""}>Tiết kiệm % nhiều nhất</option>
            <option value="eco-desc" ${f.sort === "eco-desc" ? "selected" : ""}>Giảm CO₂ cao nhất</option>
          </select>
        </div>

        <div class="filter-row">
          <div class="chip-group">
            <span class="chip-label">Phân luồng:</span>
            ${[
              ["all", "Tất cả"],
              ["A", "Nhóm A • Secondhand 3-Không"],
              ["B", "Nhóm B • Upcycled Độc bản"]
            ]
              .map(
                ([val, label]) =>
                  `<button class="filter-chip ${f.tier === val ? "active" : ""}" data-filter-tier="${val}">${label}</button>`
              )
              .join("")}
          </div>

          <div class="chip-group">
            <span class="chip-label">Danh mục:</span>
            ${["all", "Áo khoác", "Áo", "Quần & Váy", "Túi & Phụ kiện"]
              .map(
                (cat) =>
                  `<button class="filter-chip ${f.category === cat ? "active" : ""}" data-filter-cat="${cat}">${cat === "all" ? "Tất cả" : cat}</button>`
              )
              .join("")}
          </div>
        </div>

        <div class="filter-row">
          <div class="chip-group">
            <span class="chip-label">Phổ phong cách:</span>
            ${["all", "Streetwear", "Minimalist", "Y2K Vintage", "Eco-Vintage"]
              .map(
                (st) =>
                  `<button class="filter-chip ${f.style === st ? "active" : ""}" data-filter-style="${st}">${st === "all" ? "Mọi phong cách" : st}</button>`
              )
              .join("")}
          </div>

          <div class="chip-group">
            <span class="chip-label">Ngân sách:</span>
            ${[
              ["all", "Tất cả"],
              ["under150", "< 150k"],
              ["150to250", "150k – 250k"],
              ["above250", "> 250k"]
            ]
              .map(
                ([val, lbl]) =>
                  `<button class="filter-chip ${f.priceRange === val ? "active" : ""}" data-filter-price="${val}">${lbl}</button>`
              )
              .join("")}
          </div>
        </div>
      </div>

      <!-- Product Grid -->
      <div class="product-grid" id="market-product-grid">
        ${cardsHtml}
      </div>
    </section>
  `;
}

function renderAIOutfitsStackHTML(cfg) {
  const outfits = generateAIOutfits(cfg);
  const selectedBody = BODY_SHAPES.find((b) => b.id === cfg.bodyShape) || BODY_SHAPES[0];
  return `
          <div class="panel-card" style="padding:14px 18px; background:var(--forest-soft); border-color:#b7d8c9;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <strong>Quy tắc hình thể đang áp dụng (${selectedBody.name}):</strong>
                <span style="font-size:13.5px; color:var(--forest-deep)"> ${selectedBody.rule}</span>
              </div>
              <span class="mono-badge" style="background:var(--forest); color:var(--lime)">
                Engine v1.4 • ${outfits.length} bộ tối ưu
              </span>
            </div>
          </div>

          ${outfits
            .map(
              (outfit, idx) => `
            <article class="outfit-card ${idx === 0 ? "best-match" : ""}">
              <div class="outfit-header">
                <div>
                  <span class="mono-text" style="font-size:11.5px; color:var(--ink-subtle)">
                    ${idx === 0 ? "★ ĐỀ XUẤT TỐI ƯU NHẤT" : `PHƯƠNG ÁN PHỐI #${idx + 1}`} • ${cfg.occasion.toUpperCase()}
                  </span>
                  <h3 style="margin:2px 0 0; font-size:18px;">
                    Set ${cfg.style} cho dáng ${selectedBody.name}
                  </h3>
                </div>
                <span class="match-score-pill">Độ khớp AI: ${outfit.score}%</span>
              </div>

              <div class="outfit-layout">
                <div class="tryon-canvas">
                  ${renderVirtualTryOnSVG(cfg.bodyShape, outfit)}
                  <div class="tryon-caption">
                    Virtual Try-On Silhouette Preview<br/>
                    <span style="color:var(--forest); font-weight:700">${outfit.withinBudget ? "✓ Trong ngân sách" : "⚠ Vượt nhẹ ngân sách"}</span>
                  </div>
                </div>

                <div>
                  <div class="outfit-pieces">
                    ${outfit.pieces
                      .map(
                        (piece) => `
                      <div class="piece-mini" data-open-product="${piece.id}">
                        <div class="piece-role">${piece.slot === "outer" ? "Khoác ngoài" : piece.slot === "top" ? "Áo chính" : piece.slot === "bottom" ? "Quần / Váy" : "Phụ kiện"}</div>
                        <div class="piece-mini-img">${renderGarmentSVG(piece)}</div>
                        <div style="font-size:12px; font-weight:700; line-height:1.3">${escapeHtml(piece.name)}</div>
                        <div class="mono-text" style="font-size:12px; color:var(--forest); font-weight:700">${formatVND(piece.price)}</div>
                      </div>
                    `
                      )
                      .join("")}
                  </div>

                  <div class="ai-explain-box">
                    <strong>Giải thích từ AI Stylist:</strong>
                    Kết hợp <em>${outfit.pieces.map((p) => p.silhouetteTag).join(" + ")}</em> giúp ${selectedBody.rule.toLowerCase()}
                    Bảng màu <strong>${outfit.pieces.map((p) => p.colorName.split("/")[0].trim()).join(" / ")}</strong> cân bằng thị giác cho ngữ cảnh <em>${cfg.occasion}</em>.
                  </div>
                </div>
              </div>

              <div class="outfit-footer">
                <div style="display:flex; gap:18px; flex-wrap:wrap; align-items:center;">
                  <div>
                    <div class="muted-xs">Tổng giá cả set</div>
                    <strong class="mono-text" style="font-size:19px; color:var(--forest)">${formatVND(outfit.totalPrice)}</strong>
                    <span class="price-old" style="margin-left:6px">${formatVND(outfit.totalOriginal)}</span>
                  </div>
                  <div>
                    <div class="muted-xs">Tiết kiệm chi phí</div>
                    <strong class="mono-text" style="color:var(--terracotta)">-${outfit.discountPct}%</strong>
                  </div>
                  <div>
                    <div class="muted-xs">Tác động xanh của set</div>
                    <strong class="mono-text" style="color:var(--forest)">-${outfit.totalCo2.toFixed(1)} kg CO₂ • ${outfit.totalWater.toLocaleString("vi-VN")}L nước</strong>
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
    <section class="view-section container">
      <div class="section-head" style="margin-top:0">
        <div>
          <div class="section-kicker">AI STYLING ASSISTANT • MỤC 10.2.1 &amp; 11.1.4</div>
          <h2 class="section-title">Phòng Thí Nghiệm AI Phối Đồ &amp; Chống Định Kiến Hình Thể</h2>
          <p class="section-sub">
            Kết hợp bộ lọc đa tầng <strong>Body Shape</strong> + <strong>Style Spectrum</strong> trên Metadata số hóa tại Studio Box
            để loại bỏ định kiến thuật toán (AI Bias) và tối ưu ngân sách sinh viên.
          </p>
        </div>
      </div>

      <div class="ai-lab-grid">
        <!-- Left Input Controls -->
        <div class="panel-card">
          <div class="bias-callout">
            <strong>Cơ chế Anti-AI Bias (Mục 10.2.1):</strong> Thuật toán không chỉ ưu tiên số đo chuẩn mà phân bổ trọng số công bằng cho mọi hình dáng cơ thể và phom L–XL/Free-size.
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>1. Hình dáng cơ thể (Body Shape)</span>
              <span class="mono-text" style="font-size:11px; color:var(--forest)">Dữ liệu đa tầng</span>
            </div>
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
            <div class="control-label">
              <span>2. Phổ phong cách (Style Spectrum)</span>
            </div>
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
              <span>3. Ngân sách tối đa cho cả set</span>
              <strong id="ai-budget-label" class="mono-text" style="color:var(--forest)">${formatVND(cfg.budget)}</strong>
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
              <span>220.000đ (Sinh viên tiết kiệm)</span>
              <span>750.000đ (Full Upcycled)</span>
            </div>
          </div>

          <div class="control-group">
            <div class="control-label"><span>4. Ngữ cảnh sử dụng</span></div>
            <select id="ai-occasion-select" class="input-control">
              ${["Đi học / Giảng đường", "Thuyết trình / Phỏng vấn", "Cà phê cuối tuần"]
                .map((occ) => `<option value="${occ}" ${cfg.occasion === occ ? "selected" : ""}>${occ}</option>`)
                .join("")}
            </select>
          </div>

          <div class="control-group">
            <div class="control-label"><span>5. Ghim 1 món từ kho (tùy chọn)</span></div>
            <select id="ai-anchor-select" class="input-control">
              <option value="">-- Để AI tự động phối toàn bộ --</option>
              ${PRODUCTS.map(
                (p) =>
                  `<option value="${p.id}" ${cfg.anchorId === p.id ? "selected" : ""}>${escapeHtml(p.name)} (${formatVND(p.price)})</option>`
              ).join("")}
            </select>
          </div>

          <button class="btn-primary" style="width:100%" id="run-ai-match-btn">
            ⚡ Chạy AI Matching &amp; Cập nhật Phối Đồ
          </button>
        </div>

        <!-- Right Output Outfits -->
        <div class="outfit-results-stack" id="ai-outfits-stack">
          ${renderAIOutfitsStackHTML(cfg)}
        </div>
      </div>
    </section>
  `;
}

function evaluateSellerIntake(sf) {
  const allThreeNo = sf.noStructuralDamage && sf.noSurfaceDefect && sf.preWashed;
  const basePrice = Math.max(100000, Number(sf.originalPrice) || 400000);

  if (!sf.preWashed && !sf.noStructuralDamage && !sf.noSurfaceDefect) {
    return {
      groupCode: "C",
      groupClass: "group-c",
      groupLabel: "Nhóm C • Recycle (Tái chế công nghiệp Zero-Waste)",
      explanation: "Sản phẩm chưa đáp ứng điều kiện tái lưu thông hoặc upcycle. CFD chuyển giao đối tác xử lý sợi tái chế để đảm bảo mục tiêu không rác thải dệt may.",
      directPrice: 0,
      consignPrice: 0,
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
      groupLabel: "Nhóm A • Ready-to-Resale (Đạt chuẩn '3 Không')",
      explanation: "Sản phẩm đủ điều kiện tái lưu thông ngay sau bước giặt sấy công nghiệp, hấp diệt khuẩn y tế và chụp Studio số hóa.",
      directPrice,
      consignListPrice,
      sellerNet,
      canDirect: true,
      canConsign: true
    };
  }

  // Minor structural or surface defect -> Group B Upcycling Potential
  const directPrice = 12000;
  const consignListPrice = Math.round((basePrice * 0.42) / 5000) * 5000;
  const sellerNet = Math.round(consignListPrice * 0.6); // 40% discount covers upcycling + hygiene + digitization
  return {
    groupCode: "B",
    groupClass: "group-b",
    groupLabel: "Nhóm B • Upcycling Potential (Tái thiết kế sáng tạo)",
    explanation: "Có lỗi nhẹ về cấu trúc/bề mặt nhưng chất liệu tốt. Được phân luồng sang Phân khu 3 để sinh viên thiết kế cắt may thành mẫu Độc bản 1-of-1.",
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
  const stages = ["Tiếp nhận", "QA 3-Không", "Hấp diệt khuẩn", "Studio số hóa", "Đang bán / Đã chi trả"];

  return `
    <section class="view-section container">
      <div class="section-head" style="margin-top:0">
        <div>
          <div class="section-kicker">CỔNG MINIMALISM SELLER • MỤC 11.4.1 &amp; 11.4.4</div>
          <h2 class="section-title">Đăng Bán Nhanh &amp; Ký Gửi Quần Áo Tuần Hoàn</h2>
          <p class="section-sub">
            Dành cho sinh viên Làng ĐH &amp; nhân viên văn phòng thanh lý tủ đồ. Hệ thống tự động kiểm tra tiêu chuẩn
            <strong>"3 Không"</strong> và ước tính ngay mức thu mua <strong>Mua đứt (MoMo/ZaloPay)</strong> hoặc <strong>Ký gửi 60 ngày</strong>.
          </p>
        </div>
      </div>

      <div class="sell-grid">
        <!-- Form Panel -->
        <div class="panel-card">
          <h3 style="margin-top:0">1. Thông tin sản phẩm cần thanh lý</h3>
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

          <h3>2. Bộ tiêu chí kiểm định "3 Không" (Mục 11.4.4a)</h3>
          <div class="qa-checklist">
            <label class="qa-check-item">
              <input type="checkbox" id="qa-struct" ${sf.noStructuralDamage ? "checked" : ""} />
              <span><strong>Không hư hỏng cấu trúc:</strong> Không rách, thủng, mất cúc hoặc hỏng khóa kéo (trừ đồ đưa sang Upcycle).</span>
            </label>
            <label class="qa-check-item">
              <input type="checkbox" id="qa-surface" ${sf.noSurfaceDefect ? "checked" : ""} />
              <span><strong>Không biến dạng bề mặt nặng:</strong> Không xù lông quá mức, ố vàng vùng nhạy cảm hoặc phai màu hóa chất.</span>
            </label>
            <label class="qa-check-item">
              <input type="checkbox" id="qa-wash" ${sf.preWashed ? "checked" : ""} />
              <span><strong>Đã vệ sinh sơ bộ:</strong> Đã giặt sạch và làm khô trước khi bàn giao cho trạm tiếp nhận.</span>
            </label>
          </div>

          <div class="classification-banner ${evalRes.groupClass}">
            <div style="font-family:var(--font-mono); font-size:11.5px; font-weight:700">KẾT QUẢ PHÂN LUỒNG TỰ ĐỘNG</div>
            <div style="font-size:16px; font-weight:800; margin:3px 0">${evalRes.groupLabel}</div>
            <div style="font-size:13px">${evalRes.explanation}</div>
          </div>

          <h3>3. Chọn cơ chế thanh toán</h3>
          <div class="payout-cards">
            <div class="payout-option ${sf.payoutMode === "direct" ? "selected" : ""} ${!evalRes.canDirect ? "disabled" : ""}" data-payout="direct">
              <div style="font-size:12px; font-weight:700; color:var(--terracotta)">MUA ĐỨT (DIRECT PURCHASE)</div>
              <div class="mono-text" style="font-size:20px; font-weight:800; margin:4px 0; color:var(--forest)">
                ${evalRes.canDirect ? formatVND(evalRes.directPrice) : "0đ (Tái chế)"}
              </div>
              <div class="muted-xs">Nhận tiền NGAY qua MoMo / ZaloPay (khung thu mua 10k–30k/món khi qua QA).</div>
            </div>

            <div class="payout-option ${sf.payoutMode === "consign" ? "selected" : ""} ${!evalRes.canConsign ? "disabled" : ""}" data-payout="consign">
              <div style="font-size:12px; font-weight:700; color:var(--forest)">KÝ GỬI 60 NGÀY (CONSIGNMENT)</div>
              <div class="mono-text" style="font-size:20px; font-weight:800; margin:4px 0; color:var(--forest)">
                ${evalRes.canConsign ? `~${formatVND(evalRes.sellerNet)}` : "Không áp dụng"}
              </div>
              <div class="muted-xs">
                ${evalRes.canConsign ? `Giá bán dự kiến ${formatVND(evalRes.consignListPrice)} (chiết khấu 30–40% phí vệ sinh &amp; Studio). Đối soát ngày 15 &amp; 30.` : "Chỉ chuyển đối tác tái chế Zero-Waste."}
              </div>
            </div>
          </div>

          <div class="field-group">
            <label for="sell-station">4. Chọn trạm ký gửi vệ tinh / điểm thu gom</label>
            <select id="sell-station" class="input-control">
              ${DROPOFF_STATIONS.map(
                (st) => `<option value="${st.id}" ${sf.stationId === st.id ? "selected" : ""}>${st.name} (${st.fee})</option>`
              ).join("")}
            </select>
          </div>

          <button class="btn-primary" style="width:100%" id="submit-sell-btn">
            Tạo Phiếu Thu Gom / Ký Gửi &amp; Lấy Mã QR
          </button>
        </div>

        <!-- Right Tracking Timeline -->
        <div class="panel-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="margin:0">Theo dõi xử lý của tôi</h3>
            <span class="mono-badge" style="background:var(--forest-soft); color:var(--forest)">${state.submissions.length} phiếu</span>
          </div>
          <p class="muted-xs" style="margin-bottom:14px;">
            Chính sách hoàn trả minh bạch (Mục 11.4.4d): hàng không đạt chuẩn được thông báo trong 48h để nhận lại hoặc chuyển quyên góp/tái chế.
          </p>

          <div class="submission-list">
            ${state.submissions
              .map(
                (sub) => `
              <div class="submission-card">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                  <strong class="mono-text" style="font-size:12px; color:var(--forest)">${escapeHtml(sub.id)}</strong>
                  <span style="font-size:11.5px; color:var(--ink-subtle)">${escapeHtml(sub.createdAt)}</span>
                </div>
                <div style="font-weight:700; font-size:14.5px; margin:4px 0">${escapeHtml(sub.itemName)}</div>
                <div style="font-size:12.5px; color:var(--ink-muted)">
                  <strong>Phân loại:</strong> ${escapeHtml(sub.group)}<br/>
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
    </section>
  `;
}

function renderEcoMetricsHTML(n) {
  const co2 = (n * 6.5).toFixed(1);
  const water = (n * 1950).toLocaleString("vi-VN");
  const moneySaved = (n * 290000).toLocaleString("vi-VN");
  const textileDiverted = (n * 0.48).toFixed(2);
  return `
          <div class="impact-metric-box">
            <div class="muted-xs">Khí thải CO₂ cắt giảm</div>
            <div class="impact-metric-val">-${co2} kg</div>
            <div class="muted-xs">So với mua sản phẩm thời trang nhanh mới</div>
          </div>
          <div class="impact-metric-box">
            <div class="muted-xs">Lượng nước ngọt bảo tồn</div>
            <div class="impact-metric-val">${water} L</div>
            <div class="muted-xs">Tiết kiệm từ khâu nhuộm &amp; canh tác bông</div>
          </div>
          <div class="impact-metric-box">
            <div class="muted-xs">Chi phí sinh viên tiết kiệm</div>
            <div class="impact-metric-val">${moneySaved}đ</div>
            <div class="muted-xs">Trung bình rẻ hơn 50% so với hàng mới</div>
          </div>
          <div class="impact-metric-box">
            <div class="muted-xs">Rác thải dệt may chặn lại</div>
            <div class="impact-metric-val">${textileDiverted} kg</div>
            <div class="muted-xs">Không bị thải ra bãi rác mỗi học kỳ</div>
          </div>
  `;
}

function renderEcosystemView() {
  const activeZone = WORKSHOP_ZONES.find((z) => z.id === state.activeZone) || WORKSHOP_ZONES[0];
  const n = state.ecoItemsPerSemester;

  return `
    <section class="view-section container">
      <div class="section-head" style="margin-top:0">
        <div>
          <div class="section-kicker">CHUỖI CUNG ỨNG NGƯỢC 5 GIAI ĐOẠN • CHƯƠNG 11</div>
          <h2 class="section-title">Trạm Xử Lý Trung Tâm 100m² (One-Way Flow) &amp; Tác Động Môi Trường</h2>
          <p class="section-sub">
            Đặt tại khu vực tiếp giáp <strong>Làng Đại học (Thủ Đức / Dĩ An)</strong>, thiết kế theo nguyên tắc dòng chảy một chiều
            triệt tiêu 100% rủi ro nhiễm chéo và tối ưu công suất <strong>1.500 – 2.000 sản phẩm/tháng</strong>.
          </p>
        </div>
      </div>

      <div class="hub-layout">
        <div class="panel-card">
          <h3 style="margin-top:0">Sơ đồ mặt bằng 5 phân khu (Nhấp chọn phân khu để khám phá)</h3>
          <div class="zone-tabs">
            ${WORKSHOP_ZONES.map(
              (z) => `
              <button class="zone-tab ${z.id === state.activeZone ? "active" : ""}" data-zone-btn="${z.id}">
                <span class="zone-tab-num">${z.code}</span>
                <span class="zone-tab-name">${z.name.split("&")[0].trim()}</span>
              </button>
            `
            ).join("")}
          </div>

          <div id="floorplan-svg-wrap">
            ${renderFloorplanSVG(state.activeZone)}
          </div>
        </div>

        <div class="panel-card" style="border-color:var(--forest)">
          <div class="mono-text" style="font-size:11.5px; color:var(--terracotta); font-weight:700">${activeZone.code} • ${activeZone.areaPct}</div>
          <h3 style="margin:6px 0 12px; font-size:21px">${activeZone.name}</h3>
          <div style="display:grid; gap:12px; font-size:13.5px;">
            <div style="background:var(--bg); padding:12px; border-radius:10px; border:1px solid var(--border)">
              <strong>Vai trò vận hành:</strong><br/>${activeZone.flowRole}
            </div>
            <div style="background:var(--bg); padding:12px; border-radius:10px; border:1px solid var(--border)">
              <strong>Thiết bị &amp; Chiến lược Asset-light (Bảng 19):</strong><br/>${activeZone.equipment}
            </div>
            <div style="background:var(--forest-soft); padding:12px; border-radius:10px; border:1px solid #b7d8c9; color:var(--forest-deep)">
              <strong>Quy trình chuẩn hóa:</strong><br/>${activeZone.process}
            </div>
          </div>
        </div>
      </div>

      <!-- Eco Impact Simulator -->
      <div class="panel-card" style="margin-top:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <div class="section-kicker">CÔNG CỤ ĐO LƯỜNG TÁC ĐỘNG BỀN VỮNG</div>
            <h3 style="margin:0">Ước tính đóng góp Xanh của bạn khi chuyển sang Thời trang Tuần hoàn</h3>
          </div>
          <div style="min-width:260px;">
            <label for="eco-slider" style="font-size:13px; font-weight:700; display:flex; justify-content:space-between;">
              <span>Số món đồ secondhand/upcycle mỗi học kỳ:</span>
              <span id="eco-count-label" class="mono-text" style="color:var(--forest)">${n} món</span>
            </label>
            <input id="eco-slider" type="range" class="range-input" min="1" max="24" value="${n}" />
          </div>
        </div>

        <div class="impact-grid" id="eco-impact-grid">
          ${renderEcoMetricsHTML(n)}
        </div>
      </div>

      <!-- IP & Legal Protection Framework -->
      <div class="section-head">
        <div>
          <div class="section-kicker">SỞ HỮU TRÍ TUỆ &amp; PHÁP LÝ UPCYCLING • MỤC 10.4</div>
          <h2 class="section-title">Khung bảo hộ tài sản vô hình &amp; Tuân thủ thương hiệu gốc</h2>
        </div>
      </div>
      <div class="ip-grid">
        <div class="panel-card">
          <div class="mono-text" style="font-size:11px; color:var(--forest); font-weight:700">TRADEMARK</div>
          <h4 style="margin:6px 0">Nhãn hiệu Nhóm 25 &amp; 35</h4>
          <p class="muted-xs">Đăng ký bảo hộ tên thương hiệu CFD &amp; logo vòng lặp vô cực tại Cục Sở hữu trí tuệ VN.</p>
        </div>
        <div class="panel-card">
          <div class="mono-text" style="font-size:11px; color:var(--terracotta); font-weight:700">INDUSTRIAL DESIGN</div>
          <h4 style="margin:6px 0">Kiểu dáng Bộ sưu tập giới hạn</h4>
          <p class="muted-xs">Bảo hộ thiết kế Upcycled độc bản, chống sao chép ý tưởng từ các đối thủ trên thị trường.</p>
        </div>
        <div class="panel-card">
          <div class="mono-text" style="font-size:11px; color:var(--forest); font-weight:700">TRADE SECRET</div>
          <h4 style="margin:6px 0">Thuật toán AI &amp; NDA</h4>
          <p class="muted-xs">Quản trị mã nguồn qua Git Enterprise kèm điều khoản bảo mật NDA cho toàn đội ngũ core-team.</p>
        </div>
        <div class="panel-card">
          <div class="mono-text" style="font-size:11px; color:var(--terracotta); font-weight:700">BRAND DISCLAIMER</div>
          <h4 style="margin:6px 0">Nhãn phụ minh bạch IP</h4>
          <p class="muted-xs">Giữ nguyên logo gốc và gắn nhãn: <em>"Sản phẩm được tái tạo độc lập từ nguyên liệu chính hãng"</em>.</p>
        </div>
      </div>
    </section>
  `;
}

function renderBreakEvenChartSVG(simUsers, arpu) {
  const maxUsers = 20000;
  const maxMoney = 2600; // triệu VNĐ
  const w = 620;
  const h = 280;
  const padL = 56;
  const padR = 24;
  const padT = 22;
  const padB = 42;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xFor = (u) => padL + (Math.min(u, maxUsers) / maxUsers) * plotW;
  const yFor = (m) => padT + plotH - (Math.min(m, maxMoney) / maxMoney) * plotH;

  // Baseline costs in report: Fixed = 420M, Total at 3000 users = 820M -> variable ~ 133.33M per 1000? Wait:
  // In Table 26 (p.66): Fixed = 420tr, Variable at Y1 = 400tr (for 3000 users -> or constant step). Using Table 26 exact break-even: 820tr at 8200 users (when ARPU = 100k).
  // Let's model Total Cost smoothly passing through (0, 420) and (8200, 820) so Break-Even visually locks at 8.200 users when ARPU = 100k!
  const varSlopePerUser = (820 - 420) / 8200; // ~0.04878 tr/user
  const costAt = (u) => 420 + varSlopePerUser * u;
  const revAt = (u) => (u * arpu) / 1_000_000;

  const currentRev = revAt(simUsers);
  const currentCost = costAt(simUsers);

  // Break-even dynamic users: 420 / (arpu/1e6 - varSlopePerUser)
  const unitMargin = arpu / 1_000_000 - varSlopePerUser;
  const beUsers = unitMargin > 0 ? Math.round(420 / unitMargin) : null;
  const beRev = beUsers ? revAt(beUsers) : null;

  const gridLines = [0, 500, 1000, 1500, 2000, 2500]
    .map(
      (m) => `
      <line x1="${padL}" y1="${yFor(m)}" x2="${w - padR}" y2="${yFor(m)}" stroke="#E1DDD2" stroke-dasharray="3 3"/>
      <text x="${padL - 8}" y="${yFor(m) + 4}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#78827B">${m}tr</text>
    `
    )
    .join("");

  const xTicks = [0, 5000, 10000, 15000, 20000]
    .map(
      (u) => `
      <text x="${xFor(u)}" y="${h - 14}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#78827B">${(u / 1000).toFixed(0)}k</text>
    `
    )
    .join("");

  const beMarker =
    beUsers && beUsers <= maxUsers && beRev <= maxMoney
      ? `
      <line x1="${xFor(beUsers)}" y1="${yFor(beRev)}" x2="${xFor(beUsers)}" y2="${yFor(0)}" stroke="#C25934" stroke-dasharray="4 3" stroke-width="1.5"/>
      <circle cx="${xFor(beUsers)}" cy="${yFor(beRev)}" r="5.5" fill="#C25934" stroke="#FFFFFF" stroke-width="2"/>
      <text x="${xFor(beUsers)}" y="${yFor(beRev) - 10}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#C25934">
        Hòa vốn: ${beUsers.toLocaleString("vi-VN")} users
      </text>
    `
      : "";

  const clampedSimX = xFor(Math.min(simUsers, maxUsers));
  const clampedSimRevY = yFor(Math.min(currentRev, maxMoney));

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Biểu đồ phân tích điểm hòa vốn CFD">
      ${gridLines}
      ${xTicks}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${yFor(0)}" stroke="#9CA3AF" stroke-width="1.2"/>
      <line x1="${padL}" y1="${yFor(0)}" x2="${w - padR}" y2="${yFor(0)}" stroke="#9CA3AF" stroke-width="1.2"/>

      <!-- Fixed Cost Line -->
      <line x1="${xFor(0)}" y1="${yFor(420)}" x2="${xFor(maxUsers)}" y2="${yFor(420)}" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="5 4"/>
      <!-- Total Cost Line -->
      <line x1="${xFor(0)}" y1="${yFor(costAt(0))}" x2="${xFor(maxUsers)}" y2="${yFor(costAt(maxUsers))}" stroke="#B45309" stroke-width="2.5"/>
      <!-- Revenue Line -->
      <line x1="${xFor(0)}" y1="${yFor(0)}" x2="${xFor(maxUsers)}" y2="${yFor(revAt(maxUsers))}" stroke="#0F3D2E" stroke-width="3"/>

      ${beMarker}

      <!-- Active Simulation Point -->
      <circle cx="${clampedSimX}" cy="${clampedSimRevY}" r="6" fill="#10B981" stroke="#09261D" stroke-width="2"/>
      <text x="${w - padR}" y="${padT + 10}" text-anchor="end" font-family="Be Vietnam Pro, sans-serif" font-size="10.5" font-weight="700" fill="#0F3D2E">
        ━ Doanh thu &nbsp; ━ Tổng chi phí &nbsp; ┅ Chi phí cố định (420tr)
      </text>
      <text x="${padL + plotW / 2}" y="${h - 2}" text-anchor="middle" font-size="10" fill="#555E58">Quy mô người dùng hoạt động (users/năm)</text>
    </svg>
  `;
}

function renderFinanceMetricsHTML(users, arpu) {
  const revM = (users * arpu) / 1_000_000;
  const varSlopePerUser = (820 - 420) / 8200;
  const totalCostM = 420 + varSlopePerUser * users;
  const profitM = revM - totalCostM;
  const unitMargin = arpu / 1_000_000 - varSlopePerUser;
  const beUsers = unitMargin > 0 ? Math.round(420 / unitMargin) : "Không đạt";
  return `
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:14px;">
            <div class="impact-metric-box">
              <div class="muted-xs">Doanh thu ước tính</div>
              <div class="mono-text" style="font-weight:800; color:var(--forest); font-size:15px">${formatMillion(revM)}</div>
            </div>
            <div class="impact-metric-box">
              <div class="muted-xs">Chi phí vận hành</div>
              <div class="mono-text" style="font-weight:800; color:var(--amber); font-size:15px">${formatMillion(totalCostM)}</div>
            </div>
            <div class="impact-metric-box">
              <div class="muted-xs">Lợi nhuận gộp</div>
              <div class="mono-text" style="font-weight:800; color:${profitM >= 0 ? "var(--forest)" : "var(--terracotta)"}; font-size:15px">
                ${profitM >= 0 ? "+" : ""}${formatMillion(profitM)}
              </div>
            </div>
          </div>
          <p class="muted-xs" style="margin-top:10px;">
            Ngưỡng hòa vốn ở ARPU ${formatVND(arpu)}: <strong>${typeof beUsers === "number" ? beUsers.toLocaleString("vi-VN") + " người dùng" : beUsers}</strong>.
          </p>
  `;
}

function renderPitchView() {
  const { users, arpu } = state.financeSim;

  return `
    <section class="view-section container">
      <div class="section-head" style="margin-top:0">
        <div>
          <div class="section-kicker">HỒ SƠ DỰ ÁN KHỞI NGHIỆP • CHƯƠNG 5, 7, 9, 12, 13</div>
          <h2 class="section-title">Circular Fashion Digital (CFD) — Mô Hình Kinh Doanh &amp; Tài Chính</h2>
          <p class="section-sub">
            Thị trường tiền tiêu sinh viên <strong>2,16 triệu người</strong> (TAM <strong>216 tỷ VNĐ/năm</strong>).
            Hiện hoàn tất <strong>Gate 2 — Business Case</strong> (Stage-Gate) và sẵn sàng triển khai Pilot tại Làng ĐH ĐHQG-HCM.
          </p>
        </div>
      </div>

      <!-- KPI Strip -->
      <div class="kpi-strip">
        <div class="kpi-card">
          <div class="kpi-label">Tổng vốn đầu tư (Chương 13)</div>
          <div class="kpi-val">1,2 tỷ VNĐ</div>
          <div class="kpi-sub">720tr VCSH (60%) + 480tr Vay NH (8%/năm)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Điểm hòa vốn chuẩn (Bảng 26)</div>
          <div class="kpi-val">8.200 users</div>
          <div class="kpi-sub">Tương ứng doanh thu 820 triệu VNĐ/năm</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Hiệu quả đầu tư (Bảng 27)</div>
          <div class="kpi-val">ROI 25% • IRR ~22%</div>
          <div class="kpi-sub">NPV ~600 triệu • Hoàn vốn (PP) ~4 năm</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Kiểm soát CAC (Mục 8.7.5)</div>
          <div class="kpi-val">&lt; 30.000đ</div>
          <div class="kpi-sub">ARPU 100k–300k/năm • Phí sàn 5–10%</div>
        </div>
      </div>

      <!-- Interactive Financial Break-even Simulator -->
      <div class="finance-grid">
        <div class="panel-card">
          <h3 style="margin-top:0">Mô phỏng Điểm Hòa Vốn &amp; Độ Nhạy Doanh Thu</h3>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;">
            <button class="filter-chip" data-fin-preset="3000,100000">Năm 1 (3.000 users)</button>
            <button class="filter-chip" data-fin-preset="8200,100000">Điểm hòa vốn (8.200)</button>
            <button class="filter-chip" data-fin-preset="20000,120000">Năm 2 (20.000)</button>
            <button class="filter-chip" data-fin-preset="50000,150000">Năm 3 (50.000)</button>
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>Số người dùng hoạt động / năm</span>
              <strong id="fin-users-label" class="mono-text" style="color:var(--forest)">${users.toLocaleString("vi-VN")} người</strong>
            </div>
            <input id="fin-users-slider" type="range" class="range-input" min="1000" max="50000" step="500" value="${users}" />
          </div>

          <div class="control-group">
            <div class="control-label">
              <span>Doanh thu TB / người / năm (ARPU)</span>
              <strong id="fin-arpu-label" class="mono-text" style="color:var(--forest)">${formatVND(arpu)}</strong>
            </div>
            <input id="fin-arpu-slider" type="range" class="range-input" min="80000" max="300000" step="10000" value="${arpu}" />
          </div>

          <div id="fin-metrics-summary">
            ${renderFinanceMetricsHTML(users, arpu)}
          </div>
        </div>

        <div class="panel-card">
          <h3 style="margin-top:0">Biểu đồ Đường Doanh Thu vs Tổng Chi Phí</h3>
          <div class="chart-box" id="fin-chart-box">
            ${renderBreakEvenChartSVG(users, arpu)}
          </div>
        </div>
      </div>

      <!-- 3-Phase Market Expansion + Budget Allocation -->
      <div class="section-head">
        <div>
          <div class="section-kicker">LỘ TRÌNH TĂNG TRƯỞNG &amp; PHÂN BỔ NGUỒN LỰC</div>
          <h2 class="section-title">Chiến lược mở rộng 3 Giai đoạn &amp; Kế hoạch 6 tháng tiền ra mắt</h2>
        </div>
      </div>

      <div class="roadmap-grid">
        ${FINANCIAL_BASELINE.stages
          .map(
            (st) => `
          <div class="panel-card">
            <div class="mono-text" style="font-size:11.5px; color:var(--terracotta); font-weight:700">${st.phase}</div>
            <h3 style="margin:6px 0 8px; font-size:18px">${st.title}</h3>
            <p class="muted-xs" style="margin-bottom:12px">${st.market}</p>
            <div style="display:grid; gap:6px; font-size:13px;">
              <div><strong>MPR:</strong> <span class="mono-text">${st.mpr}</span></div>
              <div><strong>Người dùng:</strong> <span class="mono-text">${st.users}</span></div>
              <div><strong>Doanh thu dự kiến:</strong> <strong class="mono-text" style="color:var(--forest)">${st.revenue}</strong></div>
              <div><strong>Biên lợi nhuận gộp:</strong> <span class="mono-text">${st.grossMargin}</span></div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="finance-grid" style="margin-top:20px;">
        <div class="panel-card">
          <h3 style="margin-top:0">Phân bổ vốn huy động (Bảng 16)</h3>
          ${FINANCIAL_BASELINE.budgetAllocation
            .map(
              (b) => `
            <div style="margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700;">
                <span>${b.label}</span>
                <span class="mono-text" style="color:var(--forest)">${b.pct}%</span>
              </div>
              <div style="height:9px; background:var(--bg-alt); border-radius:99px; overflow:hidden; margin:4px 0;">
                <div style="width:${b.pct}%; height:100%; background:var(--forest); border-radius:99px;"></div>
              </div>
              <div class="muted-xs">${b.purpose}</div>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="panel-card">
          <h3 style="margin-top:0">Biểu đồ GANTT 6 tháng chuẩn bị (Bảng 20)</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Hoạt động chính</th>
                <th>Mục tiêu đầu ra</th>
              </tr>
            </thead>
            <tbody>
              ${FINANCIAL_BASELINE.gantt6Months
                .map(
                  (g) => `
                <tr>
                  <td><span class="mono-badge" style="background:${g.color}; color:#fff">${g.month}</span></td>
                  <td><strong>${g.task}</strong></td>
                  <td style="font-size:12.5px; color:var(--ink-muted)">${g.goal}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Founding Team -->
      <div class="section-head">
        <div>
          <div class="section-kicker">NHÓM 02 • LỚP L04 – HK 252 • ĐẠI HỌC BÁCH KHOA TP.HCM</div>
          <h2 class="section-title">Đội ngũ sáng lập &amp; Giảng viên hướng dẫn</h2>
          <p class="section-sub">Giảng viên giảng dạy: <strong>Thầy Nguyễn Hữu Sơn</strong> • Bộ môn Khởi nghiệp (IM1021)</p>
        </div>
      </div>

      <div class="team-grid">
        ${TEAM_MEMBERS.map(
          (m) => `
          <div class="team-card">
            <div class="team-avatar">${m.initials}</div>
            <div style="font-weight:800; font-size:15px;">${m.name}</div>
            <div style="font-size:12px; font-weight:700; color:var(--terracotta); margin:3px 0 8px;">${m.role}</div>
            <div class="muted-xs">${m.focus}</div>
          </div>
        `
        ).join("")}
      </div>
    </section>
  `;
}

/* ==================== MODAL & DRAWER RENDERERS ==================== */

function openProductModal(productId) {
  const p = PRODUCTS.find((item) => item.id === productId);
  if (!p) return;
  const modal = document.getElementById("product-modal");
  const body = document.getElementById("product-modal-body");
  const savePct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
  const inCart = state.cart.includes(p.id);

  const measureEntries = Object.entries(p.measurements)
    .map(([k, v]) => `<span class="spec-pill"><strong>${k}:</strong> ${v}</span>`)
    .join("");

  body.innerHTML = `
    <div class="dpp-grid">
      <div class="dpp-visual">
        ${renderGarmentSVG(p)}
        <div style="display:flex; gap:8px; margin-top:12px; align-items:center;">
          <span class="muted-xs">Bảng màu thực tế:</span>
          ${p.colors.map((c) => `<span style="width:18px; height:18px; border-radius:50%; background:${c}; border:1px solid #ccc; display:inline-block;"></span>`).join("")}
        </div>
      </div>

      <div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
          <span class="tier-badge ${p.tier === "A" ? "tier-a" : "tier-b"}" style="position:static">${p.tierLabel}</span>
          <span class="mono-badge" style="background:var(--bg); color:var(--ink); border-color:var(--border)">SKU: ${p.id}</span>
        </div>

        <h2 id="modal-product-title" style="margin:4px 0 8px; font-size:22px;">${escapeHtml(p.name)}</h2>

        <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:10px;">
          <span class="price-now" style="font-size:24px">${formatVND(p.price)}</span>
          <span class="price-old" style="font-size:15px">${formatVND(p.originalPrice)}</span>
          <span class="price-save">Tiết kiệm ${savePct}%</span>
        </div>

        <div class="product-specs" style="margin-bottom:12px;">
          <span class="spec-pill">Size: ${escapeHtml(p.size)}</span>
          <span class="spec-pill">Chất liệu: ${escapeHtml(p.fabric)}</span>
          ${measureEntries}
        </div>

        <div class="dpp-passport-box">
          <div style="font-family:var(--font-mono); font-size:11px; font-weight:700; color:var(--forest)">
            DIGITAL PRODUCT PASSPORT • HỘ CHIẾU VÒNG ĐỜI SẢN PHẨM
          </div>
          <div class="dpp-layers">
            <div><strong>✓ Lớp 1 (QA 3-Không):</strong> ${escapeHtml(p.condition)}</div>
            <div><strong>✓ Lớp 2 (Vệ sinh y tế):</strong> ${escapeHtml(p.hygieneBatch)}</div>
            <div><strong>✓ Lớp 3 (Nguồn gốc &amp; Studio):</strong> ${escapeHtml(p.origin)}</div>
            <div><strong>🌱 Tác động môi trường:</strong> Giảm <strong>${p.co2SavedKg} kg CO₂</strong> &amp; tiết kiệm <strong>${p.waterSavedL.toLocaleString("vi-VN")} lít nước</strong></div>
          </div>
        </div>

        ${
          p.legalDisclaimer
            ? `<div class="disclaimer-box">⚖ Tuân thủ IP (Mục 10.4.4): ${escapeHtml(p.legalDisclaimer)}</div>`
            : ""
        }

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
          <button class="btn-primary" id="modal-add-cart" data-id="${p.id}">
            ${inCart ? "✓ Đã có trong giỏ hàng" : "+ Thêm vào giỏ hàng"}
          </button>
          <button class="btn-outline" id="modal-pin-ai" data-id="${p.id}">
            ✨ Phối set với món này bằng AI
          </button>
        </div>
      </div>
    </div>
  `;

  modal.hidden = false;

  document.getElementById("modal-add-cart")?.addEventListener("click", () => {
    addToCart(p.id);
    openProductModal(p.id);
  });

  document.getElementById("modal-pin-ai")?.addEventListener("click", () => {
    modal.hidden = true;
    state.aiConfig.anchorId = p.id;
    state.aiConfig.style = p.style;
    navigateTo("ai-stylist");
    showToast(`Đã ghim "${p.name}" vào AI Styling Assistant!`);
  });
}

function renderCartDrawer() {
  const countBadge = document.getElementById("cart-count");
  if (countBadge) countBadge.textContent = String(state.cart.length);

  const container = document.getElementById("cart-items-container");
  const footer = document.getElementById("cart-footer");
  if (!container || !footer) return;

  if (state.checkoutDoneOrder) {
    container.innerHTML = `
      <div class="panel-card" style="background:var(--forest-soft); border-color:#9ecbb6;">
        <div class="mono-text" style="font-size:11px; font-weight:700; color:var(--forest)">ĐẶT HÀNG THÀNH CÔNG • ESCROW BẢO VỆ</div>
        <h3 style="margin:6px 0">Mã đơn: ${escapeHtml(state.checkoutDoneOrder.id)}</h3>
        <p style="font-size:13.5px; margin:6px 0">
          Phương thức: <strong>${escapeHtml(state.checkoutDoneOrder.method)}</strong><br/>
          Tổng thanh toán: <strong class="mono-text">${formatVND(state.checkoutDoneOrder.total)}</strong><br/>
          Điểm giao nhận: <strong>${escapeHtml(state.checkoutDoneOrder.station)}</strong>
        </p>
        <p class="muted-xs">
          Tiền được giữ tại ví trung gian CFD Escrow và chỉ giải ngân cho người ký gửi sau khi bạn xác nhận đúng mô tả Studio.
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
        <p>Giỏ hàng tuần hoàn của bạn đang trống.</p>
        <button class="btn-primary btn-sm" id="cart-browse-btn">Khám phá sàn ngay</button>
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
  const origTotal = cartItems.reduce((s, p) => s + p.originalPrice, 0);
  const co2Total = cartItems.reduce((s, p) => s + p.co2SavedKg, 0);

  container.innerHTML = cartItems
    .map(
      (p) => `
    <div class="cart-item-row">
      <div class="cart-thumb">${renderGarmentSVG(p)}</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; line-height:1.3">${escapeHtml(p.name)}</div>
        <div class="muted-xs">${p.id} • Size ${escapeHtml(p.size.split(" ")[0])}</div>
        <div class="mono-text" style="font-size:13.5px; font-weight:700; color:var(--forest); margin-top:3px">
          ${formatVND(p.price)}
        </div>
      </div>
      <button class="btn-outline-sm" data-remove-cart="${p.id}" aria-label="Xóa khỏi giỏ">Xóa</button>
    </div>
  `
    )
    .join("");

  footer.innerHTML = `
    <div style="display:grid; gap:6px; font-size:13px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between">
        <span>Tiết kiệm so với mua mới:</span>
        <strong class="mono-text" style="color:var(--terracotta)">-${formatVND(origTotal - subtotal)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between">
        <span>Tác động xanh đơn hàng:</span>
        <strong class="mono-text" style="color:var(--forest)">-${co2Total.toFixed(1)} kg CO₂</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:16px; padding-top:6px; border-top:1px solid var(--border)">
        <strong>Tổng cộng (Free ship Làng ĐH):</strong>
        <strong class="mono-text" style="color:var(--forest)">${formatVND(subtotal)}</strong>
      </div>
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label for="checkout-method" style="font-size:12px;">Cổng thanh toán trung gian (Escrow)</label>
      <select id="checkout-method" class="input-control" style="padding:8px 10px; font-size:12.5px;">
        <option value="Ví MoMo (Escrow CFD)">Ví MoMo — Thanh toán trung gian</option>
        <option value="ZaloPay (Escrow CFD)">ZaloPay — Thanh toán trung gian</option>
        <option value="Nhận hàng tại Trạm KTX ĐHQG (0đ Ship)">Nhận &amp; kiểm tra tại Trạm KTX ĐHQG</option>
      </select>
    </div>

    <button class="btn-primary" style="width:100%" id="checkout-confirm-btn">
      Xác nhận Đặt Hàng Mô Phỏng (${formatVND(subtotal)})
    </button>
  `;

  container.querySelectorAll("[data-remove-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-cart");
      state.cart = state.cart.filter((x) => x !== id);
      saveState();
      renderCartDrawer();
      renderActiveView();
    });
  });

  document.getElementById("checkout-confirm-btn")?.addEventListener("click", () => {
    const methodEl = document.getElementById("checkout-method");
    const method = methodEl ? methodEl.value : "Ví MoMo (Escrow CFD)";
    state.checkoutDoneOrder = {
      id: `CFD-ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      method,
      total: subtotal,
      station: method.includes("KTX") ? "Trạm KTX ĐHQG-HCM" : "Giao xanh nội khu Thủ Đức / TP.HCM"
    };
    state.cart = [];
    saveState();
    renderCartDrawer();
    renderActiveView();
    showToast("Đơn hàng mô phỏng đã được ghi nhận qua CFD Escrow!");
  });
}

function addToCart(productId) {
  if (!state.cart.includes(productId)) {
    state.cart.push(productId);
    saveState();
    renderCartDrawer();
    showToast("Đã thêm sản phẩm vào giỏ hàng tuần hoàn.");
  } else {
    showToast("Sản phẩm này đã nằm trong giỏ hàng (mẫu độc bản số lượng 1).");
  }
}

function openCartDrawer() {
  renderCartDrawer();
  document.getElementById("cart-drawer").hidden = false;
}

function closeCartDrawer() {
  document.getElementById("cart-drawer").hidden = true;
}

/* ==================== ROUTING & EVENT BINDING ==================== */

function navigateTo(view) {
  const valid = ["market", "ai-stylist", "sell", "ecosystem", "pitch"];
  state.activeView = valid.includes(view) ? view : "market";
  window.location.hash = state.activeView;

  document.querySelectorAll("[data-nav]").forEach((el) => {
    const target = el.getAttribute("data-nav");
    if (el.classList.contains("nav-link")) {
      el.classList.toggle("active", target === state.activeView);
    }
  });

  const mobilePanel = document.getElementById("mobile-nav-panel");
  if (mobilePanel) mobilePanel.classList.remove("open");

  renderActiveView();
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  } else if (state.activeView === "sell") {
    root.innerHTML = renderSellView();
    bindSellEvents();
  } else if (state.activeView === "ecosystem") {
    root.innerHTML = renderEcosystemView();
    bindEcosystemEvents();
  } else {
    root.innerHTML = renderPitchView();
    bindPitchEvents();
  }

  bindSharedProductTriggers();
}

function bindSharedProductTriggers() {
  document.querySelectorAll("[data-open-product]").forEach((el) => {
    el.addEventListener("click", () => openProductModal(el.getAttribute("data-open-product")));
  });
  document.querySelectorAll("[data-add-cart]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(el.getAttribute("data-add-cart"));
      renderActiveView();
    });
  });
  document.querySelectorAll("#app-root [data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigateTo(el.getAttribute("data-nav")));
  });
}

function bindMarketplaceEvents() {
  document.getElementById("scroll-to-catalog-btn")?.addEventListener("click", () => {
    document.getElementById("catalog-anchor")?.scrollIntoView({ behavior: "smooth" });
  });

  const searchInput = document.getElementById("market-search-input");
  searchInput?.addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    const products = getFilteredProducts();
    const grid = document.getElementById("market-product-grid");
    const countEl = document.getElementById("market-count-label");
    if (grid) grid.innerHTML = renderProductCardsHTML(products);
    if (countEl) countEl.innerHTML = `Hiển thị <strong>${products.length}</strong> / ${PRODUCTS.length} sản phẩm`;
    document.getElementById("reset-filters-btn")?.addEventListener("click", () => {
      state.filters = { search: "", tier: "all", category: "all", style: "all", priceRange: "all", sort: "featured" };
      renderActiveView();
    });
    bindSharedProductTriggers();
  });

  document.getElementById("market-sort-select")?.addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    renderActiveView();
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

  document.getElementById("reset-filters-btn")?.addEventListener("click", () => {
    state.filters = { search: "", tier: "all", category: "all", style: "all", priceRange: "all", sort: "featured" };
    renderActiveView();
  });
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
      showToast(added ? `Đã thêm ${added} món từ set AI vào giỏ hàng!` : "Cả bộ đồ đã có sẵn trong giỏ hàng.");
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
    state.aiScanTick += 1;
    renderActiveView();
    showToast("AI Matching hoàn tất: Đã tối ưu hóa phối đồ không định kiến!");
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
        ? "0đ • Cộng điểm Tín Chỉ Xanh"
        : sf.payoutMode === "direct"
        ? `${formatVND(evalRes.directPrice)} (Thanh toán ngay)`
        : `Niêm yết ${formatVND(evalRes.consignListPrice)} (Nhận ~${formatVND(evalRes.sellerNet)})`;

    const newEntry = {
      id: `CFD-IN-2026-${Math.floor(200 + Math.random() * 799)}`,
      itemName: sf.itemName.trim(),
      category: sf.category,
      group: evalRes.groupLabel.split("•")[0].trim(),
      mode: modeLabel,
      estimatedValue: valueLabel,
      station: station.name,
      stageIndex: 0,
      createdAt: "Hôm nay (24/11/2026)"
    };

    state.submissions = [newEntry, ...state.submissions];
    saveState();
    renderActiveView();
    showToast(`Đã tạo phiếu ${newEntry.id}! Hãy mang đồ tới ${station.name.split("—")[0].trim()}.`);
  });
}

function bindEcosystemEvents() {
  document.querySelectorAll("[data-zone-btn], .floor-zone").forEach((el) =>
    el.addEventListener("click", () => {
      const zId = Number(el.getAttribute("data-zone-btn") || el.getAttribute("data-zone"));
      state.activeZone = zId;
      renderActiveView();
    })
  );

  document.getElementById("eco-slider")?.addEventListener("input", (e) => {
    state.ecoItemsPerSemester = Number(e.target.value);
    const lbl = document.getElementById("eco-count-label");
    const grid = document.getElementById("eco-impact-grid");
    if (lbl) lbl.textContent = `${state.ecoItemsPerSemester} món`;
    if (grid) grid.innerHTML = renderEcoMetricsHTML(state.ecoItemsPerSemester);
  });
}

function updateFinancePanel() {
  const { users, arpu } = state.financeSim;
  const uLbl = document.getElementById("fin-users-label");
  const aLbl = document.getElementById("fin-arpu-label");
  const sum = document.getElementById("fin-metrics-summary");
  const chart = document.getElementById("fin-chart-box");
  if (uLbl) uLbl.textContent = `${users.toLocaleString("vi-VN")} người`;
  if (aLbl) aLbl.textContent = formatVND(arpu);
  if (sum) sum.innerHTML = renderFinanceMetricsHTML(users, arpu);
  if (chart) chart.innerHTML = renderBreakEvenChartSVG(users, arpu);
}

function bindPitchEvents() {
  document.querySelectorAll("[data-fin-preset]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [u, a] = btn.getAttribute("data-fin-preset").split(",").map(Number);
      state.financeSim.users = u;
      state.financeSim.arpu = a;
      renderActiveView();
    })
  );

  document.getElementById("fin-users-slider")?.addEventListener("input", (e) => {
    state.financeSim.users = Number(e.target.value);
    updateFinancePanel();
  });

  document.getElementById("fin-arpu-slider")?.addEventListener("input", (e) => {
    state.financeSim.arpu = Number(e.target.value);
    updateFinancePanel();
  });
}

/* ==================== BOOTSTRAP ==================== */

function init() {
  loadState();

  const logoHeader = document.getElementById("brand-logo-slot");
  const logoFooter = document.getElementById("footer-logo-slot");
  if (logoHeader) logoHeader.innerHTML = renderBrandLogoSVG(28);
  if (logoFooter) logoFooter.innerHTML = renderBrandLogoSVG(28);

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(btn.getAttribute("data-nav"));
    });
  });

  document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
    document.getElementById("mobile-nav-panel")?.classList.toggle("open");
  });

  document.getElementById("cart-open-btn")?.addEventListener("click", openCartDrawer);
  document.getElementById("cart-close-btn")?.addEventListener("click", closeCartDrawer);
  document.getElementById("cart-drawer")?.addEventListener("click", (e) => {
    if (e.target.id === "cart-drawer") closeCartDrawer();
  });

  const prodModal = document.getElementById("product-modal");
  document.getElementById("product-modal-close")?.addEventListener("click", () => {
    prodModal.hidden = true;
  });
  prodModal?.addEventListener("click", (e) => {
    if (e.target.id === "product-modal") prodModal.hidden = true;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (prodModal) prodModal.hidden = true;
      closeCartDrawer();
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
  navigateTo(initialHash || "market");
}

document.addEventListener("DOMContentLoaded", init);
