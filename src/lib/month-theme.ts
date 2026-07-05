/**
 * 月別テーマ設定 — 季節に合わせた背景パターン
 */
export interface MonthTheme {
  id: "june" | "july" | "august" | "september" | "october" | "november" | "december";
  label: string;
  emoji: string;
  bgBase: string;
  bgGradFrom: string;
  bgGradTo: string;
  bgPattern: string;     // CSS background-image: url("data:image/svg+xml,...")
  accent: string;
  accentSoft: string;
  cellBorder: string;
  headerBorder: string;
}

function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function svg100(content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${content}</svg>`;
}

function stars(n: number, s = 1.5) {
  let c = "";
  for (let i = 0; i < n; i++) {
    const x = (i * 37 + 13) % 100, y = (i * 53 + 7) % 100;
    const r = s * (0.5 + ((i * 31) % 10) / 10);
    const o = 0.3 + ((i * 23) % 5) / 20;
    c += `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${o}"/>`;
  }
  return c;
}

function fireworks() {
  return `
    <circle cx="20" cy="15" r="4" fill="none" stroke="rgba(255,180,200,0.4)" stroke-width="0.5"/>
    <circle cx="20" cy="15" r="8" fill="none" stroke="rgba(255,180,200,0.2)" stroke-width="0.4"/>
    <line x1="20" y1="7" x2="20" y2="3" stroke="rgba(255,200,100,0.3)" stroke-width="0.5"/>
    <line x1="20" y1="23" x2="20" y2="27" stroke="rgba(255,200,100,0.3)" stroke-width="0.5"/>
    <line x1="12" y1="15" x2="8" y2="15" stroke="rgba(255,200,100,0.3)" stroke-width="0.5"/>
    <line x1="28" y1="15" x2="32" y2="15" stroke="rgba(255,200,100,0.3)" stroke-width="0.5"/>
    <line x1="14" y1="9" x2="11" y2="6" stroke="rgba(255,150,200,0.25)" stroke-width="0.4"/>
    <line x1="26" y1="9" x2="29" y2="6" stroke="rgba(255,150,200,0.25)" stroke-width="0.4"/>
    <line x1="14" y1="21" x2="11" y2="24" stroke="rgba(255,150,200,0.25)" stroke-width="0.4"/>
    <line x1="26" y1="21" x2="29" y2="24" stroke="rgba(255,150,200,0.25)" stroke-width="0.4"/>`;
}

function rain() {
  let l = "";
  for (let i = 0; i < 12; i++) {
    const x = (i * 23 + 5) % 100, y = (i * 37 + 10) % 100;
    l += `<line x1="${x}" y1="${y}" x2="${x-1}" y2="${y+4}" stroke="rgba(150,180,220,0.3)" stroke-width="0.5" stroke-linecap="round"/>`;
  }
  return l;
}

function hydrangea() {
  let p = "";
  const spots = [[25,30,0.3],[70,20,1.2],[50,70,0.8]];
  for (const [cx,cy,a] of spots) {
    for (let i = 0; i < 4; i++) {
      const angle = a + (i * Math.PI) / 2;
      const px = cx + Math.cos(angle) * 3, py = cy + Math.sin(angle) * 3;
      p += `<circle cx="${px}" cy="${py}" r="2.5" fill="rgba(160,130,200,0.25)"/>`;
    }
    p += `<circle cx="${cx}" cy="${cy}" r="1.5" fill="rgba(200,180,220,0.3)"/>`;
  }
  return p + rain();
}

function maple() {
  return `
    <path d="M50,20 L52,28 L58,25 L55,32 L62,33 L56,38 L60,44 L53,41 L50,48 L47,41 L40,44 L44,38 L38,33 L45,32 L42,25 L48,28Z" fill="rgba(200,120,50,0.2)" transform="scale(0.3) translate(100,50)"/>
    <path d="M50,20 L52,28 L58,25 L55,32 L62,33 L56,38 L60,44 L53,41 L50,48 L47,41 L40,44 L44,38 L38,33 L45,32 L42,25 L48,28Z" fill="rgba(220,80,30,0.18)" transform="scale(0.25) translate(80,180)"/>`;
}

type Raw = Omit<MonthTheme, "id" | "label" | "emoji">;

const THEMES: Record<string, Raw> = {
  june: {
    bgBase: "#0c0e1a", bgGradFrom: "#0c0e1a", bgGradTo: "#12182a",
    bgPattern: svgUrl(svg100(hydrangea())),
    accent: "#a78bfa", accentSoft: "#a78bfa20",
    cellBorder: "#6366f120", headerBorder: "#6366f130",
  },
  july: {
    bgBase: "#0a0a18", bgGradFrom: "#0a0a18", bgGradTo: "#0f0820",
    bgPattern: svgUrl(svg100(stars(20, 1.2) + fireworks())),
    accent: "#f43f5e", accentSoft: "#f43f5e20",
    cellBorder: "#f43f5e15", headerBorder: "#f43f5e25",
  },
  august: {
    bgBase: "#120a08", bgGradFrom: "#120a08", bgGradTo: "#1a0e10",
    bgPattern: svgUrl(svg100(`
      <rect x="15" y="20" width="10" height="14" rx="5" fill="none" stroke="rgba(255,120,80,0.3)" stroke-width="0.6"/>
      <line x1="20" y1="20" x2="20" y2="12" stroke="rgba(255,120,80,0.25)" stroke-width="0.5"/>
      <rect x="70" y="50" width="10" height="14" rx="5" fill="none" stroke="rgba(255,150,60,0.25)" stroke-width="0.6"/>
      <line x1="75" y1="50" x2="75" y2="42" stroke="rgba(255,150,60,0.2)" stroke-width="0.5"/>
      <rect x="40" y="75" width="10" height="14" rx="5" fill="none" stroke="rgba(255,100,100,0.2)" stroke-width="0.6"/>
      <line x1="45" y1="75" x2="45" y2="67" stroke="rgba(255,100,100,0.18)" stroke-width="0.5"/>
      ${stars(8, 0.8)}
    `)),
    accent: "#f97316", accentSoft: "#f9731620",
    cellBorder: "#f9731615", headerBorder: "#f9731625",
  },
  september: {
    bgBase: "#0d0f08", bgGradFrom: "#0d0f08", bgGradTo: "#15120a",
    bgPattern: svgUrl(svg100(`
      <circle cx="75" cy="20" r="8" fill="rgba(255,230,150,0.2)"/>
      <circle cx="70" cy="18" r="8" fill="rgba(10,12,8,0.6)"/>
      ${maple()}${stars(5, 0.6)}
    `)),
    accent: "#d4a017", accentSoft: "#d4a01720",
    cellBorder: "#d4a01715", headerBorder: "#d4a01725",
  },
  october: {
    bgBase: "#100a0d", bgGradFrom: "#100a0d", bgGradTo: "#150e14",
    bgPattern: svgUrl(svg100(`
      <ellipse cx="30" cy="70" rx="6" ry="5" fill="rgba(255,150,50,0.2)"/>
      <rect x="29" y="64" width="2" height="4" rx="1" fill="rgba(100,80,40,0.3)"/>
      <line x1="75" y1="15" x2="75" y2="35" stroke="rgba(200,200,200,0.2)" stroke-width="0.5"/>
      <path d="M65,25 Q75,20 85,25" fill="none" stroke="rgba(200,200,200,0.15)" stroke-width="0.4"/>
      <path d="M68,30 Q75,27 82,30" fill="none" stroke="rgba(200,200,200,0.12)" stroke-width="0.4"/>
      ${stars(6, 0.5)}
    `)),
    accent: "#ea580c", accentSoft: "#ea580c20",
    cellBorder: "#ea580c15", headerBorder: "#ea580c25",
  },
  november: {
    bgBase: "#0d0b08", bgGradFrom: "#0d0b08", bgGradTo: "#15120d",
    bgPattern: svgUrl(svg100(`
      ${maple()}
      <path d="M50,20 L52,28 L58,25 L55,32 L62,33 L56,38 L60,44 L53,41 L50,48 L47,41 L40,44 L44,38 L38,33 L45,32 L42,25 L48,28Z" fill="rgba(180,60,20,0.15)" transform="scale(0.2) translate(200,250)"/>
      <path d="M50,20 L52,28 L58,25 L55,32 L62,33 L56,38 L60,44 L53,41 L50,48 L47,41 L40,44 L44,38 L38,33 L45,32 L42,25 L48,28Z" fill="rgba(200,100,30,0.18)" transform="scale(0.18) translate(350,50)"/>
    `)),
    accent: "#c2410c", accentSoft: "#c2410c20",
    cellBorder: "#c2410c15", headerBorder: "#c2410c25",
  },
  december: {
    bgBase: "#080c15", bgGradFrom: "#080c15", bgGradTo: "#0e1225",
    bgPattern: svgUrl(svg100(`
      ${stars(25, 1)}
      <g transform="translate(25,55) scale(0.3)">
        <line x1="0" y1="-8" x2="0" y2="8" stroke="rgba(200,220,255,0.25)" stroke-width="0.8"/>
        <line x1="-7" y1="-4" x2="7" y2="4" stroke="rgba(200,220,255,0.25)" stroke-width="0.8"/>
        <line x1="-7" y1="4" x2="7" y2="-4" stroke="rgba(200,220,255,0.25)" stroke-width="0.8"/>
      </g>
      <g transform="translate(75,40) scale(0.2)">
        <line x1="0" y1="-8" x2="0" y2="8" stroke="rgba(200,220,255,0.2)" stroke-width="0.8"/>
        <line x1="-7" y1="-4" x2="7" y2="4" stroke="rgba(200,220,255,0.2)" stroke-width="0.8"/>
        <line x1="-7" y1="4" x2="7" y2="-4" stroke="rgba(200,220,255,0.2)" stroke-width="0.8"/>
      </g>
      <circle cx="15" cy="85" r="1.5" fill="rgba(255,255,255,0.2)"/>
      <circle cx="55" cy="90" r="1.2" fill="rgba(255,255,255,0.18)"/>
      <circle cx="85" cy="88" r="1.8" fill="rgba(255,255,255,0.15)"/>
    `)),
    accent: "#22c55e", accentSoft: "#22c55e20",
    cellBorder: "#22c55e15", headerBorder: "#22c55e25",
  },
};

const MONTH_EMOJI: Record<string, string> = {
  june: "🌧️", july: "🎆", august: "🏮", september: "🌙",
  october: "🎃", november: "🍁", december: "🎄",
};

function fallback(): MonthTheme {
  return {
    id: "july", label: "july", emoji: "📹",
    bgBase: "#0a0a18", bgGradFrom: "#0a0a18", bgGradTo: "#0f0820",
    bgPattern: "", accent: "#f43f5e", accentSoft: "#f43f5e20",
    cellBorder: "#f43f5e15", headerBorder: "#f43f5e25",
  };
}

export function getMonthTheme(month: string): MonthTheme {
  const raw = THEMES[month];
  if (!raw) return fallback();
  return {
    id: month as MonthTheme["id"],
    label: month,
    emoji: MONTH_EMOJI[month] || "📹",
    ...raw,
  };
}
