#!/usr/bin/env node
/**
 * Generates the 3D SVG assets used by the profile README.
 * Run: node scripts/gen-3d-assets.mjs
 * Output: assets/3d/*.svg  (committed, so the README never depends on a live service)
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "3d");
const ACCENT = "#7C3AED";
const INK = "#0b0b12";
const FONT = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ---------- color helpers ---------- */
const rgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const hex = (arr) =>
  "#" + arr.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
const light = (c, t = 0.35) => mix(c, "#ffffff", t);
const dark = (c, t = 0.45) => mix(c, "#000000", t);
const luma = (c) => {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Brand colors that are too dark on a dark tile get lifted to stay legible. */
const readable = (c) => (luma(c) < 0.14 ? light(c, 0.72) : c);

/* ---------- icon source (simple-icons, fetched once) ---------- */
const iconCache = new Map();
async function icon(slug) {
  if (iconCache.has(slug)) return iconCache.get(slug);
  let path = null;
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`);
    if (res.ok) {
      const svg = await res.text();
      path = svg.match(/\sd="([^"]+)"/)?.[1] ?? null;
    }
  } catch {
    path = null;
  }
  iconCache.set(slug, path);
  return path;
}

/* ---------- primitives ---------- */
let uid = 0;
const nextId = (p) => `${p}${++uid}`;

/** Isometric cube, origin at its centre. */
function cube(cx, cy, s, color) {
  const a = s * 0.5;
  const b = s * 0.29;
  const hh = s * 0.5;
  const p = (pts) => pts.map(([x, y]) => `${(cx + x).toFixed(2)},${(cy + y).toFixed(2)}`).join(" ");
  return `<g>
    <polygon points="${p([[-a, -hh], [0, -hh + b], [0, b], [-a, 0]])}" fill="${dark(color, 0.35)}"/>
    <polygon points="${p([[a, -hh], [0, -hh + b], [0, b], [a, 0]])}" fill="${dark(color, 0.12)}"/>
    <polygon points="${p([[0, -hh - b], [a, -hh], [0, -hh + b], [-a, -hh]])}" fill="${light(color, 0.3)}"/>
    <polygon points="${p([[0, -hh - b], [a, -hh], [0, -hh + b], [-a, -hh]])}" fill="#ffffff" opacity="0.14"/>
  </g>`;
}

/** Glossy 3D tile with a real brand icon + label. */
function tile({ x, y, w, h, color, label, iconPath, iconColor }) {
  const g = nextId("tg");
  const sheen = nextId("sh");
  const s = h * 0.42; // icon box
  const ix = x + 22;
  const iy = y + (h - s) / 2;
  const scale = s / 24;
  return `<g>
    <rect x="${x}" y="${y + 7}" width="${w}" height="${h}" rx="18" fill="#000000" opacity="0.4"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="url(#${g})" stroke="#ffffff" stroke-opacity="0.13"/>
    <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h * 0.42}" rx="17" fill="url(#${sheen})"/>
    <rect x="${x + 1}" y="${y + h - 3}" width="${w - 2}" height="2" rx="1" fill="${color}" opacity="0.5"/>
    ${
      iconPath
        ? `<g transform="translate(${ix} ${iy}) scale(${scale})" fill="${iconColor ?? readable(color)}"><path d="${iconPath}"/></g>`
        : ""
    }
    <text x="${ix + s + 14}" y="${y + h / 2 + 7}" font-family="${FONT}" font-size="19" font-weight="600" fill="#ececf1" letter-spacing="0.2">${label}</text>
    <defs>
      <linearGradient id="${g}" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="${mix(INK, color, 0.16)}"/>
        <stop offset="1" stop-color="${mix(INK, color, 0.05)}"/>
      </linearGradient>
      <linearGradient id="${sheen}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
  </g>`;
}

/* ---------- section label (glass pill) ---------- */
function sectionLabel(title, { w, h = 64, cubeSize = 26, kicker = "" } = {}) {
  const g = nextId("pg");
  const width = w ?? Math.round(96 + title.length * 15.4 + (kicker ? kicker.length * 7 : 0));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h + 10}" viewBox="0 0 ${width} ${h + 10}" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#221a33"/>
      <stop offset="0.55" stop-color="#151020"/>
      <stop offset="1" stop-color="#100d18"/>
    </linearGradient>
    <linearGradient id="${g}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="3" y="${8}" width="${width - 6}" height="${h}" rx="${h / 2}" fill="#000000" opacity="0.45"/>
  <rect x="3" y="2" width="${width - 6}" height="${h}" rx="${h / 2}" fill="url(#${g})" stroke="#ffffff" stroke-opacity="0.14"/>
  <rect x="4" y="3" width="${width - 8}" height="${h * 0.4}" rx="${h / 2}" fill="url(#${g}s)"/>
  <rect x="26" y="${h - 4}" width="${width - 52}" height="2" rx="1" fill="${ACCENT}" opacity="0.55"/>
  ${cube(46, 2 + h / 2, cubeSize, ACCENT)}
  <text x="76" y="${2 + h / 2 + 9}" font-family="${FONT}" font-size="26" font-weight="700" fill="#f4f4f5" letter-spacing="0.3">${title}</text>
  ${kicker ? `<text x="${width - 26}" y="${2 + h / 2 + 6}" text-anchor="end" font-family="${FONT}" font-size="12" letter-spacing="3" fill="#A78BFA">${kicker}</text>` : ""}
</svg>`;
}

/* ---------- button (3D, linkable) ---------- */
function button({ label, color, iconPath, w = 0, h = 56 }) {
  const width = w || Math.round(88 + label.length * 12.2 + (iconPath ? 26 : 0));
  const g = nextId("bg");
  const s = 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h + 8}" viewBox="0 0 ${width} ${h + 8}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="${light(color, 0.14)}"/>
      <stop offset="0.5" stop-color="${dark(color, 0.28)}"/>
      <stop offset="1" stop-color="${dark(color, 0.55)}"/>
    </linearGradient>
  </defs>
  <rect x="3" y="7" width="${width - 6}" height="${h}" rx="16" fill="#000000" opacity="0.5"/>
  <rect x="3" y="1" width="${width - 6}" height="${h}" rx="16" fill="url(#${g})" stroke="#ffffff" stroke-opacity="0.28"/>
  <rect x="4" y="2" width="${width - 8}" height="${h * 0.42}" rx="15" fill="#ffffff" opacity="0.13"/>
  ${
    iconPath
      ? `<g transform="translate(${24} ${1 + (h - s) / 2}) scale(${s / 24})" fill="#ffffff" opacity="0.95"><path d="${iconPath}"/></g>`
      : ""
  }
  <text x="${iconPath ? 24 + s + 12 : width / 2}" ${iconPath ? "" : 'text-anchor="middle"'} y="${1 + h / 2 + 7}" font-family="${FONT}" font-size="17" font-weight="700" letter-spacing="0.6" fill="#ffffff">${label}</text>
</svg>`;
}

/* ---------- divider ---------- */
function divider() {
  const g = nextId("dg");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="16" viewBox="0 0 1600 16">
  <defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
      <stop offset="0.18" stop-color="${ACCENT}" stop-opacity="0.55"/>
      <stop offset="0.5" stop-color="#A78BFA" stop-opacity="0.9"/>
      <stop offset="0.82" stop-color="${ACCENT}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="4" width="1600" height="6" rx="3" fill="${ACCENT}" opacity="0.14"/>
  <rect x="0" y="2" width="1600" height="3" rx="1.5" fill="url(#${g})"/>
  <rect x="0" y="7" width="1600" height="1.5" rx="0.75" fill="#ffffff" opacity="0.16"/>
</svg>`;
}

/* ---------- footer scene ---------- */
function footer() {
  const cubes = [
    [180, 120, 46, ACCENT],
    [300, 150, 30, "#8B5CF6"],
    [1290, 118, 40, "#A78BFA"],
    [1430, 152, 28, ACCENT],
    [740, 176, 22, "#6D28D9"],
  ]
    .map(([x, y, s, c]) => cube(x, y, s, c))
    .join("");
  const g = nextId("fg");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="240" viewBox="0 0 1600 240" role="img" aria-label="Thanks for stopping by">
  <defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK}"/>
      <stop offset="0.6" stop-color="#120e1f"/>
      <stop offset="1" stop-color="#1a1230"/>
    </linearGradient>
    <radialGradient id="${g}h" cx="0.5" cy="1" r="0.7">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.4"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="240" fill="url(#${g})"/>
  <rect width="1600" height="240" fill="url(#${g}h)"/>
  <g stroke="${ACCENT}" stroke-opacity="0.16">
    <line x1="0" y1="196" x2="1600" y2="196"/>
    <line x1="0" y1="216" x2="1600" y2="216"/>
    <line x1="0" y1="234" x2="1600" y2="234"/>
    <line x1="200" y1="240" x2="800" y2="150"/>
    <line x1="520" y1="240" x2="800" y2="150"/>
    <line x1="1080" y1="240" x2="800" y2="150"/>
    <line x1="1400" y1="240" x2="800" y2="150"/>
  </g>
  ${cubes}
  <text x="800" y="108" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="700" fill="#f4f4f5">Thanks for stopping by</text>
  <text x="800" y="140" text-anchor="middle" font-family="${FONT}" font-size="13" letter-spacing="4" fill="#A78BFA">BUILD SOMETHING THAT LASTS</text>
</svg>`;
}

/* ---------- content ---------- */
const TECH = [
  ["react", "React", "#61DAFB"],
  ["nextdotjs", "Next.js", "#FFFFFF"],
  ["typescript", "TypeScript", "#3178C6"],
  ["javascript", "JavaScript", "#F7DF1E"],
  ["tailwindcss", "Tailwind", "#06B6D4"],
  ["vuedotjs", "Vue", "#4FC08D"],
  ["nodedotjs", "Node.js", "#5FA04E"],
  ["laravel", "Laravel", "#FF2D20"],
  ["fastapi", "FastAPI", "#009688"],
  ["go", "Go", "#00ADD8"],
  ["php", "PHP", "#777BB4"],
  ["python", "Python", "#3776AB"],
  ["tensorflow", "TensorFlow", "#FF6F00"],
  ["pytorch", "PyTorch", "#EE4C2C"],
  ["scikitlearn", "scikit-learn", "#F7931E"],
  ["opencv", "OpenCV", "#5C3EE8"],
  ["huggingface", "Hugging Face", "#FFD21E"],
  ["pandas", "pandas", "#E70488"],
  ["postgresql", "PostgreSQL", "#4169E1"],
  ["mysql", "MySQL", "#4479A1"],
  ["mongodb", "MongoDB", "#47A248"],
  ["redis", "Redis", "#DC382D"],
  ["amazonwebservices", "AWS", "#FF9900"],
  ["docker", "Docker", "#2496ED"],
  ["kubernetes", "Kubernetes", "#326CE5"],
  ["githubactions", "GitHub Actions", "#2088FF"],
  ["terraform", "Terraform", "#7B42BC"],
  ["flutter", "Flutter", "#02569B"],
  ["firebase", "Firebase", "#FFCA28"],
  ["git", "Git", "#F05032"],
];

async function buildTechWall() {
  const COLS = 4;
  const TW = 296;
  const TH = 84;
  const GX = 18;
  const GY = 20;
  const PAD = 44;
  const rows = Math.ceil(TECH.length / COLS);
  const width = PAD * 2 + COLS * TW + (COLS - 1) * GX;
  const height = PAD * 2 + rows * TH + (rows - 1) * GY;
  const tiles = [];
  for (let i = 0; i < TECH.length; i++) {
    const [slug, label, color] = TECH[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    tiles.push(
      tile({
        x: PAD + col * (TW + GX),
        y: PAD + row * (TH + GY),
        w: TW,
        h: TH,
        color,
        label,
        iconPath: await icon(slug),
      })
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tech stack">
  <rect width="${width}" height="${height}" fill="none"/>
  ${tiles.join("\n  ")}
</svg>`;
}

/* ---------- main ---------- */
await mkdir(OUT, { recursive: true });

const sections = [
  ["about", "About Me"],
  ["tools", "Languages & Tools"],
  ["stats", "GitHub Stats"],
  ["stack", "Tech Stack"],
  ["projects", "Featured Projects"],
  ["contrib", "3D Contribution Graph"],
  ["activity", "Contribution Activity"],
  ["snake", "Contribution Snake"],
  ["coding", "Coding Profiles"],
  ["focus", "Current Focus"],
];

for (const [slug, title] of sections) {
  await writeFile(join(OUT, `section-${slug}.svg`), sectionLabel(title));
}

const socials = [
  ["portfolio", "PORTFOLIO", "#7C3AED", "vercel"],
  ["linkedin", "LINKEDIN", "#0A66C2", "linkedin"],
  ["email", "EMAIL", "#EA4335", "gmail"],
  ["github", "GITHUB", "#24292F", "github"],
  ["leetcode", "LEETCODE", "#FFA116", "leetcode"],
  ["geeksforgeeks", "GEEKSFORGEEKS", "#2F8D46", "geeksforgeeks"],
  ["hackerrank", "HACKERRANK", "#2EC866", "hackerrank"],
];

for (const [slug, label, color, iconSlug] of socials) {
  await writeFile(
    join(OUT, `btn-${slug}.svg`),
    button({ label, color, iconPath: await icon(iconSlug) })
  );
}

await writeFile(join(OUT, "tech.svg"), await buildTechWall());
await writeFile(join(OUT, "divider.svg"), divider());
await writeFile(join(OUT, "footer.svg"), footer());

console.log(`wrote assets to ${OUT}`);
