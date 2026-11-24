export function renderBrandLogoSVG(size = 28) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 32C12 22.8 18.8 17 25.4 17C30.8 17 34.4 21.3 38.1 27.1L40.4 30.8C43.5 35.7 46.6 39 50.6 39C54.6 39 58 35.8 58 32C58 28.2 54.6 25 50.6 25C47.5 25 45 26.8 42.9 29.6" stroke="#D9F99D" stroke-width="3.6" stroke-linecap="square"/>
      <path d="M52 32C52 41.2 45.2 47 38.6 47C33.2 47 29.6 42.7 25.9 36.9L23.6 33.2C20.5 28.3 17.4 25 13.4 25C9.4 25 6 28.2 6 32C6 35.8 9.4 39 13.4 39C16.5 39 19 37.2 21.1 34.4" stroke="#34D399" stroke-width="3.6" stroke-linecap="square"/>
      <line x1="18" y1="12" x2="18" y2="19" stroke="#99F6E4" stroke-width="1.5" stroke-dasharray="2 2"/>
      <line x1="46" y1="45" x2="46" y2="52" stroke="#99F6E4" stroke-width="1.5" stroke-dasharray="2 2"/>
      <circle cx="13.4" cy="32" r="3.2" fill="#FFFFFF" stroke="#0F3D2E" stroke-width="1.5"/>
      <circle cx="32" cy="32" r="3.8" fill="#D9F99D" stroke="#0F3D2E" stroke-width="1.5"/>
      <circle cx="50.6" cy="32" r="3.2" fill="#FFFFFF" stroke="#0F3D2E" stroke-width="1.5"/>
      <circle cx="25.4" cy="17" r="2.3" fill="#34D399"/>
      <circle cx="38.6" cy="47" r="2.3" fill="#D9F99D"/>
    </svg>
  `;
}

function studioGridBackdrop(skuCode) {
  return `
    <g opacity="0.45">
      <line x1="16" y1="16" x2="26" y2="16" stroke="#A3A39A" stroke-width="1"/>
      <line x1="16" y1="16" x2="16" y2="26" stroke="#A3A39A" stroke-width="1"/>
      <line x1="204" y1="16" x2="194" y2="16" stroke="#A3A39A" stroke-width="1"/>
      <line x1="204" y1="16" x2="204" y2="26" stroke="#A3A39A" stroke-width="1"/>
      <line x1="16" y1="224" x2="26" y2="224" stroke="#A3A39A" stroke-width="1"/>
      <line x1="16" y1="224" x2="16" y2="214" stroke="#A3A39A" stroke-width="1"/>
      <line x1="204" y1="224" x2="194" y2="224" stroke="#A3A39A" stroke-width="1"/>
      <line x1="204" y1="224" x2="204" y2="214" stroke="#A3A39A" stroke-width="1"/>
      <text x="110" y="223" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#78827B">STUDIO SCAN • ${skuCode}</text>
    </g>
  `;
}

export function renderGarmentSVG(product) {
  const [c1, c2, c3] = product.colors || ["#1E3A5F", "#64748B", "#E2E8F0"];
  const bg = studioGridBackdrop(product.id);
  let shape = "";

  switch (product.svgType) {
    case "denim-jacket":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.12))">
          <path d="M72 44 L44 62 L24 128 L46 135 L62 84 L62 184 L158 184 L158 84 L174 135 L196 128 L176 62 L148 44 L128 52 L110 58 L92 52 Z" fill="${c1}" stroke="#0F172A" stroke-width="2" stroke-linejoin="round"/>
          <!-- Patchwork Panel -->
          <path d="M110 58 L158 62 L158 128 L110 128 Z" fill="${c2}" opacity="0.88"/>
          <path d="M62 128 L110 128 L110 184 L62 184 Z" fill="${c2}" opacity="0.65"/>
          <!-- Collar & Placket -->
          <path d="M84 44 L110 66 L136 44 L126 38 L110 48 L94 38 Z" fill="${c3}" stroke="#0F172A" stroke-width="1.6"/>
          <line x1="110" y1="64" x2="110" y2="184" stroke="${c3}" stroke-width="2" stroke-dasharray="4 3"/>
          <!-- Contrast Pockets & Stitching -->
          <rect x="72" y="88" width="28" height="30" rx="2" fill="${c1}" stroke="${c3}" stroke-width="1.5" stroke-dasharray="3 2"/>
          <rect x="120" y="88" width="28" height="30" rx="2" fill="${c1}" stroke="${c3}" stroke-width="1.5" stroke-dasharray="3 2"/>
          <line x1="62" y1="128" x2="158" y2="128" stroke="${c3}" stroke-width="1.5" stroke-dasharray="4 2"/>
          <circle cx="110" cy="82" r="2.5" fill="#D9F99D"/>
          <circle cx="110" cy="112" r="2.5" fill="#D9F99D"/>
          <circle cx="110" cy="142" r="2.5" fill="#D9F99D"/>
          <circle cx="110" cy="170" r="2.5" fill="#D9F99D"/>
        </g>`;
      break;

    case "blazer":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.12))">
          <path d="M74 42 L42 54 L26 146 L48 150 L62 84 L60 192 L160 192 L158 84 L172 150 L194 146 L178 54 L146 42 L110 48 Z" fill="${c1}" stroke="#141816" stroke-width="2" stroke-linejoin="round"/>
          <!-- Tailored Lapels -->
          <path d="M88 44 L110 112 L78 96 L74 68 Z" fill="${c2}" stroke="#141816" stroke-width="1.5"/>
          <path d="M132 44 L110 112 L142 96 L146 68 Z" fill="${c2}" stroke="#141816" stroke-width="1.5"/>
          <path d="M92 44 L110 98 L128 44 Z" fill="#FAF9F5"/>
          <line x1="110" y1="112" x2="110" y2="192" stroke="#141816" stroke-width="1.5"/>
          <!-- Welt Pockets & Buttons -->
          <rect x="70" y="138" width="28" height="6" rx="1" fill="${c3}"/>
          <rect x="122" y="138" width="28" height="6" rx="1" fill="${c3}"/>
          <circle cx="103" cy="126" r="3.5" fill="${c3}" stroke="#141816" stroke-width="1"/>
          <circle cx="103" cy="154" r="3.5" fill="${c3}" stroke="#141816" stroke-width="1"/>
        </g>`;
      break;

    case "linen-shirt":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.09))">
          <path d="M76 46 L46 60 L30 132 L50 138 L64 86 L64 188 L156 188 L156 86 L170 138 L190 132 L174 60 L144 46 L110 52 Z" fill="${c1}" stroke="${c3}" stroke-width="2" stroke-linejoin="round"/>
          <path d="M86 44 L110 66 L134 44 L126 38 L110 48 L94 38 Z" fill="${c2}" stroke="${c3}" stroke-width="1.5"/>
          <line x1="110" y1="66" x2="110" y2="188" stroke="${c2}" stroke-width="3"/>
          <rect x="74" y="88" width="24" height="28" rx="3" fill="${c2}" opacity="0.55" stroke="${c3}" stroke-width="1.2"/>
          <circle cx="110" cy="82" r="2.2" fill="${c3}"/>
          <circle cx="110" cy="108" r="2.2" fill="${c3}"/>
          <circle cx="110" cy="134" r="2.2" fill="${c3}"/>
          <circle cx="110" cy="160" r="2.2" fill="${c3}"/>
        </g>`;
      break;

    case "cargo-pants":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.12))">
          <path d="M68 42 L152 42 L168 192 L124 192 L110 105 L96 192 L52 192 Z" fill="${c1}" stroke="#141816" stroke-width="2" stroke-linejoin="round"/>
          <!-- Waistband & Belt Loops -->
          <rect x="68" y="42" width="84" height="14" fill="${c2}" stroke="#141816" stroke-width="1.5"/>
          <!-- Reworked Denim Cargo Pockets -->
          <rect x="52" y="106" width="24" height="34" rx="2" fill="${c2}" stroke="${c3}" stroke-width="1.5" stroke-dasharray="3 2"/>
          <rect x="144" y="106" width="24" height="34" rx="2" fill="${c2}" stroke="${c3}" stroke-width="1.5" stroke-dasharray="3 2"/>
          <line x1="56" y1="158" x2="98" y2="158" stroke="${c3}" stroke-width="1.5" stroke-dasharray="3 2"/>
          <line x1="122" y1="158" x2="164" y2="158" stroke="${c3}" stroke-width="1.5" stroke-dasharray="3 2"/>
          <line x1="110" y1="56" x2="110" y2="82" stroke="${c3}" stroke-width="1.5"/>
        </g>`;
      break;

    case "cardigan":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.12))">
          <path d="M74 44 L44 60 L26 138 L48 144 L62 86 L62 188 L158 188 L158 86 L172 144 L194 138 L176 60 L146 44 L110 92 Z" fill="${c1}" stroke="#09261D" stroke-width="2" stroke-linejoin="round"/>
          <!-- Varsity Cream Placket Trim -->
          <path d="M74 44 L110 92 L146 44" fill="none" stroke="${c2}" stroke-width="6" stroke-linecap="round"/>
          <line x1="110" y1="92" x2="110" y2="188" stroke="${c2}" stroke-width="6"/>
          <line x1="62" y1="182" x2="158" y2="182" stroke="${c2}" stroke-width="5"/>
          <circle cx="110" cy="108" r="3" fill="${c3}"/>
          <circle cx="110" cy="132" r="3" fill="${c3}"/>
          <circle cx="110" cy="156" r="3" fill="${c3}"/>
          <rect x="70" y="138" width="26" height="26" rx="2" fill="none" stroke="${c2}" stroke-width="1.8"/>
          <rect x="124" y="138" width="26" height="26" rx="2" fill="none" stroke="${c2}" stroke-width="1.8"/>
        </g>`;
      break;

    case "pleated-skirt":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.12))">
          <path d="M76 48 L144 48 L174 186 L46 186 Z" fill="${c1}" stroke="#141816" stroke-width="2" stroke-linejoin="round"/>
          <!-- Asymmetric Upcycled Denim Panel -->
          <path d="M112 58 L144 58 L174 186 L118 186 Z" fill="${c2}" stroke="${c3}" stroke-width="1.5" stroke-dasharray="4 2"/>
          <rect x="76" y="46" width="68" height="13" fill="#18181B" stroke="#141816" stroke-width="1.5"/>
          <!-- Pleat lines -->
          <line x1="88" y1="59" x2="68" y2="186" stroke="${c3}" stroke-width="1.4" opacity="0.75"/>
          <line x1="100" y1="59" x2="90" y2="186" stroke="${c3}" stroke-width="1.4" opacity="0.75"/>
          <line x1="126" y1="59" x2="136" y2="186" stroke="#E2E8F0" stroke-width="1.4" opacity="0.65"/>
          <line x1="136" y1="59" x2="156" y2="186" stroke="#E2E8F0" stroke-width="1.4" opacity="0.65"/>
        </g>`;
      break;

    case "trousers":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.1))">
          <path d="M72 42 L148 42 L156 194 L118 194 L110 98 L102 194 L64 194 Z" fill="${c1}" stroke="#1F1916" stroke-width="2" stroke-linejoin="round"/>
          <rect x="72" y="42" width="76" height="13" fill="${c2}" stroke="#1F1916" stroke-width="1.5"/>
          <line x1="88" y1="58" x2="83" y2="188" stroke="${c3}" stroke-width="1.2" opacity="0.6"/>
          <line x1="132" y1="58" x2="137" y2="188" stroke="${c3}" stroke-width="1.2" opacity="0.6"/>
          <circle cx="110" cy="48.5" r="2.2" fill="${c3}"/>
        </g>`;
      break;

    case "tote-bag":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.12))">
          <path d="M76 86 C76 42, 144 42, 144 86" fill="none" stroke="${c2}" stroke-width="7" stroke-linecap="round"/>
          <rect x="56" y="84" width="108" height="106" rx="8" fill="${c1}" stroke="#141816" stroke-width="2"/>
          <!-- Patchwork Geometry -->
          <polygon points="56,130 120,115 120,190 56,190" fill="${c2}" opacity="0.9"/>
          <rect x="120" y="138" width="44" height="52" rx="4" fill="${c3}" opacity="0.88"/>
          <rect x="64" y="92" width="92" height="90" rx="5" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.7"/>
          <rect x="74" y="150" width="38" height="14" rx="2" fill="#D9F99D"/>
          <text x="93" y="160" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7.5" font-weight="700" fill="#0F3D2E">CFD 0W</text>
        </g>`;
      break;

    case "graphic-tee":
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.12))">
          <path d="M74 48 L36 66 L26 106 L58 114 L64 88 L64 188 L156 188 L156 88 L162 114 L194 106 L184 66 L146 48 L128 54 C120 64 100 64 92 54 Z" fill="${c1}" stroke="#111827" stroke-width="2" stroke-linejoin="round"/>
          <path d="M90 50 C98 66 122 66 130 50" fill="none" stroke="${c2}" stroke-width="4"/>
          <circle cx="110" cy="112" r="24" fill="none" stroke="${c3}" stroke-width="2.5"/>
          <path d="M94 112 C94 102, 106 102, 110 112 C114 122, 126 122, 126 112 C126 102, 114 102, 110 112 C106 122, 94 122, 94 112 Z" fill="none" stroke="#FFFFFF" stroke-width="2"/>
          <text x="110" y="148" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" font-weight="700" fill="${c3}">RE-CIRCULAR 2026</text>
        </g>`;
      break;

    default: // bucket-hat
      shape = `
        <g filter="drop-shadow(0 8px 12px rgba(15,61,46,0.12))">
          <path d="M70 72 L150 72 L158 116 L62 116 Z" fill="${c1}" stroke="#141816" stroke-width="2"/>
          <path d="M62 116 L158 116 L186 146 C140 158 80 158 34 146 Z" fill="${c1}" stroke="#141816" stroke-width="2" stroke-linejoin="round"/>
          <rect x="64" y="102" width="92" height="12" fill="${c3}"/>
          <!-- Bandana below -->
          <polygon points="62,158 158,158 110,204" fill="${c2}" stroke="#141816" stroke-width="1.8"/>
          <circle cx="110" cy="174" r="6" fill="none" stroke="${c1}" stroke-width="2"/>
        </g>`;
      break;
  }

  return `
    <svg viewBox="0 0 220 236" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${product.name}">
      ${bg}
      ${shape}
    </svg>
  `;
}

export function renderVirtualTryOnSVG(bodyShapeId, outfit) {
  const outer = outfit.outer;
  const top = outfit.top;
  const bottom = outfit.bottom;
  const acc = outfit.accessory;

  const topColor = outer ? outer.colors[0] : (top ? top.colors[0] : "#0F3D2E");
  const innerColor = top ? top.colors[0] : "#EDE7D9";
  const bottomColor = bottom ? bottom.colors[0] : "#27272A";
  const accColor = acc ? acc.colors[2] || acc.colors[0] : "#C25934";

  // Subtle silhouette proportions respecting selected body shape cleanly & affirmatively
  const widths = {
    hourglass: { shoulder: 40, waist: 22, hip: 38 },
    pear: { shoulder: 34, waist: 24, hip: 44 },
    rectangle: { shoulder: 36, waist: 31, hip: 36 },
    inverted: { shoulder: 44, waist: 26, hip: 33 },
    plus: { shoulder: 46, waist: 40, hip: 48 }
  }[bodyShapeId] || { shoulder: 38, waist: 26, hip: 38 };

  const cx = 90;
  return `
    <svg width="180" height="225" viewBox="0 0 180 225" xmlns="http://www.w3.org/2000/svg" aria-label="Xem trước phối đồ trên phom dáng">
      <rect x="6" y="6" width="168" height="213" rx="12" fill="#FFFFFF" stroke="#E1DDD2"/>
      <text x="90" y="23" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#555E58">BODY-FIT PREVIEW</text>
      <!-- Head -->
      <circle cx="${cx}" cy="44" r="11" fill="#E6D5C3" stroke="#0F3D2E" stroke-width="1.4"/>
      <!-- Torso / Top -->
      <path d="M${cx - widths.shoulder} 64 L${cx + widths.shoulder} 64 L${cx + widths.waist} 114 L${cx - widths.waist} 114 Z" fill="${innerColor}" stroke="#141816" stroke-width="1.5"/>
      ${outer ? `
        <path d="M${cx - widths.shoulder - 4} 62 L${cx - 8} 64 L${cx - 8} 118 L${cx - widths.waist - 6} 118 Z" fill="${topColor}" stroke="#141816" stroke-width="1.4" opacity="0.95"/>
        <path d="M${cx + widths.shoulder + 4} 62 L${cx + 8} 64 L${cx + 8} 118 L${cx + widths.waist + 6} 118 Z" fill="${topColor}" stroke="#141816" stroke-width="1.4" opacity="0.95"/>
      ` : ""}
      <!-- Bottom -->
      <path d="M${cx - widths.waist - 2} 114 L${cx + widths.waist + 2} 114 L${cx + widths.hip} 140 L${cx + widths.hip - 4} 200 L${cx + 6} 200 L${cx} 145 L${cx - 6} 200 L${cx - widths.hip + 4} 200 L${cx - widths.hip} 140 Z" fill="${bottomColor}" stroke="#141816" stroke-width="1.5"/>
      <!-- Accessory Crossbody Bag/Accent -->
      <line x1="${cx - widths.shoulder + 6}" y1="64" x2="${cx + widths.hip - 6}" y2="128" stroke="${accColor}" stroke-width="2.5" stroke-dasharray="3 2"/>
      <rect x="${cx + widths.hip - 14}" y="124" width="22" height="22" rx="4" fill="${accColor}" stroke="#141816" stroke-width="1.3"/>
      <!-- Waist indicator line -->
      <line x1="22" y1="114" x2="158" y2="114" stroke="#10B981" stroke-width="1" stroke-dasharray="3 3" opacity="0.65"/>
    </svg>
  `;
}

export function renderFloorplanSVG(activeZoneId) {
  const zones = [
    { id: 1, x: 18, y: 26, w: 122, h: 170, label: "KHU 1 (20%)", sub: "Tiếp nhận & QA 3-Không" },
    { id: 2, x: 158, y: 26, w: 122, h: 170, label: "KHU 2 (20%)", sub: "Giặt sấy & Hấp y tế" },
    { id: 3, x: 298, y: 26, w: 122, h: 170, label: "KHU 3 (20%)", sub: "Xưởng Upcycling" },
    { id: 4, x: 438, y: 26, w: 108, h: 170, label: "KHU 4 (15%)", sub: "Studio & AI Data" },
    { id: 5, x: 564, y: 26, w: 138, h: 170, label: "KHU 5 (25%)", sub: "Kho SKU & Green Ship" }
  ];

  const rects = zones.map((z, idx) => {
    const isActive = z.id === activeZoneId;
    const fill = isActive ? "#0F3D2E" : "#F7F5EF";
    const textFill = isActive ? "#FFFFFF" : "#141816";
    const subFill = isActive ? "#D9F99D" : "#555E58";
    const stroke = isActive ? "#09261D" : "#C9C3B4";
    const arrow = idx < zones.length - 1
      ? `<path d="M${z.x + z.w + 2} 111 L${z.x + z.w + 15} 111" stroke="#10B981" stroke-width="2.5" marker-end="url(#arrowHead)"/>`
      : "";
    return `
      <g class="floor-zone" data-zone="${z.id}" style="cursor:pointer;">
        <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${isActive ? 2.5 : 1.5}"/>
        <text x="${z.x + z.w / 2}" y="76" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" font-weight="700" fill="${subFill}">${z.label}</text>
        <text x="${z.x + z.w / 2}" y="106" text-anchor="middle" font-family="Be Vietnam Pro, sans-serif" font-size="11.5" font-weight="700" fill="${textFill}">${z.sub}</text>
        <text x="${z.x + z.w / 2}" y="168" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9.5" fill="${subFill}">Click để xem</text>
      </g>
      ${arrow}
    `;
  }).join("");

  return `
    <svg viewBox="0 0 720 230" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ nhà xưởng dòng chảy một chiều 100m2">
      <defs>
        <marker id="arrowHead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#10B981"/>
        </marker>
      </defs>
      <rect x="2" y="2" width="716" height="226" rx="14" fill="#FFFFFF" stroke="#E1DDD2"/>
      ${rects}
      <text x="360" y="216" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#0F3D2E" font-weight="600">
        NGUYÊN TẮC DÒNG CHẢY MỘT CHIỀU (ONE-WAY FLOW) • 80–100m² TIẾP GIÁP LÀNG ĐẠI HỌC • KHÔNG NHIỄM CHÉO
      </text>
    </svg>
  `;
}
