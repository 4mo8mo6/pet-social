import type { PetProfile } from "./pet";

export type PetAvatarInput = Partial<PetProfile>;

export type PetAvatarSpecies = "cat" | "dog" | "rabbit" | "fox" | "other";
export type PetAvatarExpression =
  | "gentle"
  | "happy"
  | "cool"
  | "curious"
  | "shy"
  | "proud";

export type PetAvatarSpec = {
  species: PetAvatarSpecies;
  seed: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkColor: string;
  blushColor: string;
  backgroundColor: string;
  expression: PetAvatarExpression;
  sizeScale: number;
  marks: {
    stripes: boolean;
    spots: boolean;
    socks: boolean;
    chest: boolean;
    tailTip: boolean;
    earTip: boolean;
    scarf: boolean;
    star: boolean;
    fluffy: boolean;
  };
};

const DEFAULT_PET: Required<PetAvatarInput> = {
  petName: "",
  species: "",
  color: "",
  size: "",
  personality: "",
  specialTraits: "",
};

const COLOR_PALETTES = [
  {
    keywords: ["橘白", "白橘", "orange white"],
    primaryColor: "#f59e0b",
    secondaryColor: "#fff7ed",
    accentColor: "#fed7aa",
    darkColor: "#7c2d12",
    backgroundColor: "#fff7ed",
  },
  {
    keywords: ["黑白", "白黑", "奶牛", "tuxedo"],
    primaryColor: "#1f2937",
    secondaryColor: "#f8fafc",
    accentColor: "#cbd5e1",
    darkColor: "#111827",
    backgroundColor: "#f8fafc",
  },
  {
    keywords: ["纯黑", "乌黑", "墨", "黑", "black"],
    primaryColor: "#1f2937",
    secondaryColor: "#64748b",
    accentColor: "#f59e0b",
    darkColor: "#0f172a",
    backgroundColor: "#f1f5f9",
  },
  {
    keywords: ["灰白", "白灰", "银", "灰", "gray", "grey"],
    primaryColor: "#94a3b8",
    secondaryColor: "#f8fafc",
    accentColor: "#cbd5e1",
    darkColor: "#334155",
    backgroundColor: "#f8fafc",
  },
  {
    keywords: ["奶油", "米白", "米色", "cream"],
    primaryColor: "#fde68a",
    secondaryColor: "#fff7ed",
    accentColor: "#fbbf24",
    darkColor: "#92400e",
    backgroundColor: "#fffbeb",
  },
  {
    keywords: ["金", "黄", "gold", "yellow"],
    primaryColor: "#fbbf24",
    secondaryColor: "#fef3c7",
    accentColor: "#f97316",
    darkColor: "#78350f",
    backgroundColor: "#fffbeb",
  },
  {
    keywords: ["棕", "咖啡", "brown"],
    primaryColor: "#92400e",
    secondaryColor: "#fcd9b6",
    accentColor: "#d97706",
    darkColor: "#451a03",
    backgroundColor: "#fff7ed",
  },
  {
    keywords: ["白", "white"],
    primaryColor: "#f8fafc",
    secondaryColor: "#e2e8f0",
    accentColor: "#f9a8d4",
    darkColor: "#475569",
    backgroundColor: "#f8fafc",
  },
  {
    keywords: ["粉", "pink"],
    primaryColor: "#f9a8d4",
    secondaryColor: "#fff1f2",
    accentColor: "#fb7185",
    darkColor: "#9f1239",
    backgroundColor: "#fff1f2",
  },
  {
    keywords: ["蓝", "blue"],
    primaryColor: "#7dd3fc",
    secondaryColor: "#eff6ff",
    accentColor: "#38bdf8",
    darkColor: "#075985",
    backgroundColor: "#eff6ff",
  },
  {
    keywords: ["绿", "green"],
    primaryColor: "#86efac",
    secondaryColor: "#ecfdf5",
    accentColor: "#34d399",
    darkColor: "#166534",
    backgroundColor: "#ecfdf5",
  },
];

const FALLBACK_PALETTES = [
  ["#fbbf24", "#fff7ed", "#fb923c", "#78350f", "#fffbeb"],
  ["#a78bfa", "#f5f3ff", "#f9a8d4", "#4c1d95", "#faf5ff"],
  ["#60a5fa", "#eff6ff", "#fbbf24", "#1e3a8a", "#eff6ff"],
  ["#34d399", "#ecfdf5", "#fda4af", "#064e3b", "#f0fdf4"],
] as const;

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function includesAny(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword.toLowerCase()));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveSpecies(species: string, traits: string): PetAvatarSpecies {
  const source = `${species} ${traits}`;

  if (includesAny(source, ["猫", "cat"])) {
    return "cat";
  }

  if (includesAny(source, ["狗", "犬", "dog", "puppy"])) {
    return "dog";
  }

  if (includesAny(source, ["兔", "rabbit", "bunny"])) {
    return "rabbit";
  }

  if (includesAny(source, ["狐", "fox"])) {
    return "fox";
  }

  return "other";
}

function resolvePalette(color: string, seed: number) {
  const source = normalizeText(color);
  const matchedPalette = COLOR_PALETTES.find((palette) =>
    includesAny(source, palette.keywords)
  );

  if (matchedPalette) {
    return matchedPalette;
  }

  const fallback = FALLBACK_PALETTES[seed % FALLBACK_PALETTES.length];
  return {
    primaryColor: fallback[0],
    secondaryColor: fallback[1],
    accentColor: fallback[2],
    darkColor: fallback[3],
    backgroundColor: fallback[4],
  };
}

function resolveExpression(personality: string): PetAvatarExpression {
  if (includesAny(personality, ["活泼", "开心", "元气", "外向", "playful", "happy"])) {
    return "happy";
  }

  if (includesAny(personality, ["高冷", "冷静", "酷", "quiet", "cool"])) {
    return "cool";
  }

  if (includesAny(personality, ["好奇", "探索", "curious"])) {
    return "curious";
  }

  if (includesAny(personality, ["黏人", "撒娇", "温柔", "害羞", "shy", "sweet"])) {
    return "shy";
  }

  if (includesAny(personality, ["傲娇", "骄傲", "proud"])) {
    return "proud";
  }

  return "gentle";
}

function resolveSizeScale(size: string) {
  if (includesAny(size, ["小", "small"])) {
    return 0.92;
  }

  if (includesAny(size, ["大", "large", "big"])) {
    return 1.08;
  }

  return 1;
}

export function buildPetAvatarSpec(input: PetAvatarInput): PetAvatarSpec {
  const pet = { ...DEFAULT_PET, ...input };
  const normalized = {
    petName: normalizeText(pet.petName),
    species: normalizeText(pet.species),
    color: normalizeText(pet.color),
    size: normalizeText(pet.size),
    personality: normalizeText(pet.personality),
    specialTraits: normalizeText(pet.specialTraits),
  };
  const seed = hashText(Object.values(normalized).join("|")) || 7;
  const species = resolveSpecies(normalized.species, normalized.specialTraits);
  const palette = resolvePalette(
    normalized.color ||
      `${normalized.petName} ${normalized.specialTraits} ${normalized.personality}`,
    seed
  );
  const traitSource = `${normalized.color} ${normalized.personality} ${normalized.specialTraits}`;

  return {
    species,
    seed,
    primaryColor: palette.primaryColor,
    secondaryColor: palette.secondaryColor,
    accentColor: palette.accentColor,
    darkColor: palette.darkColor,
    blushColor: "#fb7185",
    backgroundColor: palette.backgroundColor,
    expression: resolveExpression(traitSource),
    sizeScale: resolveSizeScale(normalized.size),
    marks: {
      stripes:
        includesAny(traitSource, ["条纹", "虎斑", "stripe"]) || seed % 5 === 0,
      spots:
        includesAny(traitSource, ["斑点", "花", "spot", "patch"]) || seed % 7 === 0,
      socks: includesAny(traitSource, ["白袜", "小靴", "爪", "socks"]),
      chest:
        includesAny(traitSource, ["胸", "围脖", "领口", "白色毛", "chest"]) ||
        normalized.color.includes("白"),
      tailTip: includesAny(traitSource, ["尾巴尖", "尾尖", "tail"]),
      earTip: includesAny(traitSource, ["耳尖", "耳朵", "卷耳", "ear"]),
      scarf: includesAny(traitSource, ["围巾", "项圈", "铃铛", "collar"]),
      star: includesAny(traitSource, ["星", "闪", "亮", "star"]) || seed % 11 === 0,
      fluffy: includesAny(traitSource, ["蓬松", "毛茸茸", "fluffy"]),
    },
  };
}

export function hexToNumber(hexColor: string, fallback: number) {
  const normalized = hexColor.replace("#", "");

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return fallback;
  }

  return Number.parseInt(normalized, 16);
}

function renderEars(spec: PetAvatarSpec) {
  if (spec.species === "dog") {
    return `
      <ellipse cx="78" cy="80" rx="21" ry="34" fill="${spec.primaryColor}" transform="rotate(-24 78 80)" />
      <ellipse cx="162" cy="80" rx="21" ry="34" fill="${spec.primaryColor}" transform="rotate(24 162 80)" />
      <ellipse cx="80" cy="86" rx="10" ry="22" fill="${spec.secondaryColor}" opacity="0.74" transform="rotate(-24 80 86)" />
      <ellipse cx="160" cy="86" rx="10" ry="22" fill="${spec.secondaryColor}" opacity="0.74" transform="rotate(24 160 86)" />
    `;
  }

  if (spec.species === "rabbit") {
    return `
      <ellipse cx="91" cy="48" rx="15" ry="44" fill="${spec.primaryColor}" transform="rotate(-10 91 48)" />
      <ellipse cx="149" cy="48" rx="15" ry="44" fill="${spec.primaryColor}" transform="rotate(10 149 48)" />
      <ellipse cx="92" cy="51" rx="7" ry="29" fill="${spec.secondaryColor}" opacity="0.86" transform="rotate(-10 92 51)" />
      <ellipse cx="148" cy="51" rx="7" ry="29" fill="${spec.secondaryColor}" opacity="0.86" transform="rotate(10 148 51)" />
    `;
  }

  return `
    <path d="M76 86 L95 36 L111 91 Z" fill="${spec.primaryColor}" />
    <path d="M164 86 L145 36 L129 91 Z" fill="${spec.primaryColor}" />
    <path d="M86 79 L96 53 L104 82 Z" fill="${spec.secondaryColor}" opacity="0.82" />
    <path d="M154 79 L144 53 L136 82 Z" fill="${spec.secondaryColor}" opacity="0.82" />
    ${
      spec.marks.earTip
        ? `<path d="M95 36 L89 54 L101 54 Z" fill="${spec.accentColor}" opacity="0.9" />
           <path d="M145 36 L139 54 L151 54 Z" fill="${spec.accentColor}" opacity="0.9" />`
        : ""
    }
  `;
}

function renderTail(spec: PetAvatarSpec) {
  if (spec.species === "rabbit") {
    return `<circle cx="176" cy="144" r="17" fill="${spec.secondaryColor}" stroke="${spec.primaryColor}" stroke-width="5" />`;
  }

  if (spec.species === "dog") {
    return `
      <path d="M165 136 C205 98 213 151 183 153" fill="none" stroke="${spec.primaryColor}" stroke-width="15" stroke-linecap="round" />
      ${
        spec.marks.tailTip
          ? `<path d="M190 117 C205 123 205 147 184 151" fill="none" stroke="${spec.secondaryColor}" stroke-width="8" stroke-linecap="round" />`
          : ""
      }
    `;
  }

  if (spec.species === "fox") {
    return `
      <path d="M160 135 C202 94 219 140 184 178 C174 158 165 145 160 135 Z" fill="${spec.primaryColor}" />
      <path d="M184 178 C203 162 208 142 200 130 C213 141 210 168 184 178 Z" fill="${spec.secondaryColor}" />
    `;
  }

  return `
    <path d="M163 142 C205 118 198 177 167 165" fill="none" stroke="${spec.primaryColor}" stroke-width="13" stroke-linecap="round" />
    ${
      spec.marks.tailTip
        ? `<path d="M190 130 C204 143 194 171 170 164" fill="none" stroke="${spec.secondaryColor}" stroke-width="7" stroke-linecap="round" />`
        : ""
    }
  `;
}

function renderEyes(spec: PetAvatarSpec) {
  if (spec.expression === "cool" || spec.expression === "proud") {
    return `
      <path d="M92 101 L107 97" stroke="${spec.darkColor}" stroke-width="5" stroke-linecap="round" />
      <path d="M133 97 L148 101" stroke="${spec.darkColor}" stroke-width="5" stroke-linecap="round" />
      <circle cx="100" cy="106" r="4" fill="${spec.darkColor}" />
      <circle cx="140" cy="106" r="4" fill="${spec.darkColor}" />
    `;
  }

  if (spec.expression === "curious") {
    return `
      <circle cx="98" cy="104" r="8" fill="${spec.darkColor}" />
      <circle cx="142" cy="100" r="8" fill="${spec.darkColor}" />
      <circle cx="101" cy="101" r="2.5" fill="#ffffff" />
      <circle cx="145" cy="97" r="2.5" fill="#ffffff" />
    `;
  }

  return `
    <circle cx="98" cy="103" r="7" fill="${spec.darkColor}" />
    <circle cx="142" cy="103" r="7" fill="${spec.darkColor}" />
    <circle cx="101" cy="100" r="2.4" fill="#ffffff" />
    <circle cx="145" cy="100" r="2.4" fill="#ffffff" />
  `;
}

function renderMouth(spec: PetAvatarSpec) {
  if (spec.expression === "cool") {
    return `<path d="M112 123 Q120 127 128 123" fill="none" stroke="${spec.darkColor}" stroke-width="3" stroke-linecap="round" />`;
  }

  if (spec.expression === "curious") {
    return `<circle cx="120" cy="124" r="5" fill="none" stroke="${spec.darkColor}" stroke-width="3" />`;
  }

  if (spec.expression === "proud") {
    return `<path d="M112 123 Q123 130 131 120" fill="none" stroke="${spec.darkColor}" stroke-width="3" stroke-linecap="round" />`;
  }

  return `<path d="M108 123 Q120 135 132 123" fill="none" stroke="${spec.darkColor}" stroke-width="3.5" stroke-linecap="round" />`;
}

function renderMarks(spec: PetAvatarSpec) {
  return `
    ${
      spec.marks.chest
        ? `<ellipse cx="120" cy="153" rx="28" ry="22" fill="${spec.secondaryColor}" opacity="0.88" />`
        : ""
    }
    ${
      spec.marks.stripes
        ? `<path d="M94 83 L103 100 M120 76 L120 96 M146 83 L137 100" stroke="${spec.darkColor}" stroke-width="4" stroke-linecap="round" opacity="0.24" />
           <path d="M95 144 L81 151 M145 144 L159 151" stroke="${spec.darkColor}" stroke-width="4" stroke-linecap="round" opacity="0.2" />`
        : ""
    }
    ${
      spec.marks.spots
        ? `<circle cx="92" cy="139" r="9" fill="${spec.secondaryColor}" opacity="0.8" />
           <circle cx="147" cy="151" r="7" fill="${spec.secondaryColor}" opacity="0.72" />`
        : ""
    }
    ${
      spec.marks.socks
        ? `<ellipse cx="93" cy="177" rx="14" ry="8" fill="${spec.secondaryColor}" />
           <ellipse cx="147" cy="177" rx="14" ry="8" fill="${spec.secondaryColor}" />`
        : ""
    }
    ${
      spec.marks.fluffy
        ? `<path d="M82 132 L67 143 L86 146 L73 162 L95 157" fill="none" stroke="${spec.secondaryColor}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.78" />
           <path d="M158 132 L173 143 L154 146 L167 162 L145 157" fill="none" stroke="${spec.secondaryColor}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.78" />`
        : ""
    }
  `;
}

function renderAccessories(spec: PetAvatarSpec) {
  return `
    ${
      spec.marks.scarf
        ? `<path d="M92 137 Q120 151 148 137" fill="none" stroke="${spec.accentColor}" stroke-width="8" stroke-linecap="round" />
           <circle cx="120" cy="145" r="5" fill="#fef3c7" stroke="${spec.darkColor}" stroke-width="1.5" />`
        : ""
    }
    ${
      spec.marks.star
        ? `<path d="M166 70 L170 79 L180 80 L172 86 L174 96 L166 90 L157 96 L160 86 L152 80 L162 79 Z" fill="${spec.accentColor}" stroke="${spec.darkColor}" stroke-width="2" opacity="0.94" />`
        : ""
    }
  `;
}

export function buildPetAvatarSvg(
  input: PetAvatarInput,
  options: { size?: number; transparent?: boolean } = {}
) {
  const spec = buildPetAvatarSpec(input);
  const size = options.size ?? 240;
  const gradientId = `petAvatarBg${spec.seed}`;
  const title = escapeXml(input.petName || "宠物头像");
  const background = options.transparent
    ? ""
    : `<rect width="240" height="240" rx="48" fill="url(#${gradientId})" />
    <circle cx="53" cy="54" r="18" fill="${spec.accentColor}" opacity="0.16" />
    <circle cx="188" cy="52" r="24" fill="${spec.primaryColor}" opacity="0.1" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 240 240" role="img" aria-label="${title}">
    <defs>
      <linearGradient id="${gradientId}" x1="28" y1="16" x2="212" y2="220" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${spec.backgroundColor}" />
        <stop offset="0.58" stop-color="#ffffff" />
        <stop offset="1" stop-color="${spec.secondaryColor}" />
      </linearGradient>
    </defs>
    ${background}
    <ellipse cx="120" cy="191" rx="58" ry="14" fill="${spec.darkColor}" opacity="0.13" />
    <g transform="translate(0 ${spec.sizeScale < 1 ? 7 : spec.sizeScale > 1 ? -5 : 0}) scale(${spec.sizeScale}) translate(${120 - 120 * spec.sizeScale} ${122 - 122 * spec.sizeScale})">
      ${renderTail(spec)}
      ${renderEars(spec)}
      <ellipse cx="120" cy="151" rx="48" ry="39" fill="${spec.primaryColor}" />
      <circle cx="120" cy="96" r="48" fill="${spec.primaryColor}" />
      ${renderMarks(spec)}
      <ellipse cx="93" cy="115" rx="13" ry="9" fill="${spec.blushColor}" opacity="${spec.expression === "shy" ? "0.44" : "0.24"}" />
      <ellipse cx="147" cy="115" rx="13" ry="9" fill="${spec.blushColor}" opacity="${spec.expression === "shy" ? "0.44" : "0.24"}" />
      ${renderEyes(spec)}
      <path d="M116 114 Q120 118 124 114 Q121 121 116 114" fill="${spec.darkColor}" opacity="0.82" />
      ${renderMouth(spec)}
      <ellipse cx="99" cy="176" rx="17" ry="10" fill="${spec.primaryColor}" />
      <ellipse cx="141" cy="176" rx="17" ry="10" fill="${spec.primaryColor}" />
      ${renderAccessories(spec)}
    </g>
  </svg>`;
}

export function buildPetAvatarDataUri(
  input: PetAvatarInput,
  options: { size?: number; transparent?: boolean } = {}
) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    buildPetAvatarSvg(input, options)
  )}`;
}

export function buildPetAvatarBase64DataUri(
  input: PetAvatarInput,
  options: { size?: number; transparent?: boolean } = {}
) {
  const svg = buildPetAvatarSvg(input, options);
  const bytes = new TextEncoder().encode(svg);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return `data:image/svg+xml;base64,${globalThis.btoa(binary)}`;
}

export function buildPetAvatarAlt(input: PetAvatarInput) {
  const name = input.petName?.trim() || "这只宠物";
  const color = input.color?.trim() || "自定义颜色";
  const size = input.size?.trim() || "自定义体型";
  const species = input.species?.trim() || "宠物";

  return `${name}的卡通头像：${color}${size}${species}`;
}
