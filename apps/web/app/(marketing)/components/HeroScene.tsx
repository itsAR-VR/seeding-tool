const creatorQueue = [
  { name: "Mia Torres", meta: "94 fit", fill: "url(#creatorWarm)", selected: true, y: 182 },
  { name: "Noah Chen", meta: "Address ready", fill: "url(#creatorCool)", selected: false, y: 240 },
  { name: "Jules Carter", meta: "Label due", fill: "url(#creatorMint)", selected: false, y: 298 },
] as const;

const workflowRows = [
  {
    title: "Offer locked",
    chipClass: "scene-chip scene-chip-warm",
    chipLabel: "Queued",
    signalClass: "scene-signal scene-signal-warm",
    y: 256,
  },
  {
    title: "Address stored",
    chipClass: "scene-chip scene-chip-cool",
    chipLabel: "Ready",
    signalClass: "scene-signal scene-signal-cool",
    y: 306,
  },
  {
    title: "Post linked",
    chipClass: "scene-chip scene-chip-mint",
    chipLabel: "Live",
    signalClass: "scene-signal scene-signal-good",
    y: 356,
  },
] as const;

const statCards = [
  { label: "Approved", value: "24", accent: "#1a3f92", y: 186 },
  { label: "Shipped", value: "17", accent: "#e05a2b", y: 252 },
  { label: "Posts", value: "9", accent: "#16795f", y: 318 },
] as const;

export default function HeroScene() {
  return (
    <svg
      className="hero-scene"
      viewBox="0 0 620 540"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Campaign control surface with creator queue, outreach state, shipment status, and live posting metrics in one seeding operating view"
    >
      <defs>
        <linearGradient id="creatorWarm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255, 213, 188, 0.95)" />
          <stop offset="100%" stopColor="rgba(222, 109, 66, 0.95)" />
        </linearGradient>
        <linearGradient id="creatorCool" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(203, 220, 255, 0.96)" />
          <stop offset="100%" stopColor="rgba(40, 84, 187, 0.95)" />
        </linearGradient>
        <linearGradient id="creatorMint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(210, 252, 236, 0.95)" />
          <stop offset="100%" stopColor="rgba(35, 143, 106, 0.95)" />
        </linearGradient>
      </defs>

      <rect x="48" y="54" width="524" height="432" rx="34" className="scene-frame" />

      <rect x="88" y="92" width="444" height="38" rx="19" className="scene-note" />
      <rect x="104" y="102" width="104" height="18" rx="9" className="scene-toolbar-pill" />
      <text x="121" y="114.5" className="scene-kicker">SPRING SEND</text>
      <rect x="226" y="100" width="162" height="22" rx="11" className="scene-search-shell" />
      <text x="244" y="114.5" className="scene-panel-copy-light">
        Search creator, reply, SKU
      </text>
      <rect x="410" y="102" width="96" height="18" rx="9" className="scene-toolbar-pill scene-toolbar-pill-live" />
      <text x="429" y="114.5" className="scene-kicker scene-kicker-live">
        LIVE BOARD
      </text>

      <rect x="88" y="154" width="126" height="252" rx="24" className="scene-card-frame" />
      <text x="106" y="178" className="scene-kicker">
        CREATOR QUEUE
      </text>

      {creatorQueue.map((creator) => (
        <g key={creator.name}>
          <rect
            x="102"
            y={creator.y}
            width="98"
            height="44"
            rx="16"
            className={creator.selected ? "scene-queue-row scene-queue-row-selected" : "scene-queue-row"}
          />
          <circle cx="118" cy={creator.y + 22} r="12" fill={creator.fill} />
          <text x="136" y={creator.y + 19} className="scene-panel-title-light">
            {creator.name}
          </text>
          <text x="136" y={creator.y + 32} className="scene-panel-caption">
            {creator.meta}
          </text>
        </g>
      ))}

      <rect x="232" y="154" width="214" height="252" rx="28" className="scene-board-shell" />
      <text x="254" y="178" className="scene-kicker scene-kicker-dark">
        ACTIVE CREATOR
      </text>
      <rect x="248" y="192" width="182" height="56" rx="18" className="scene-lane-shell" />
      <circle cx="274" cy="220" r="18" fill="url(#creatorWarm)" />
      <text x="304" y="214" className="scene-panel-title-dark">
        Mia Torres
      </text>
      <text x="304" y="229" className="scene-panel-copy-dark">
        Serum bundle + rights
      </text>
      <rect x="372" y="202" width="42" height="18" rx="9" className="scene-chip scene-chip-warm" />
      <text x="393" y="215" textAnchor="middle" className="scene-chip-text">
        94 fit
      </text>
      <rect x="232" y="154" width="214" height="252" rx="28" className="scene-scan" />

      {workflowRows.map((row) => (
        <g key={row.title}>
          <rect x="248" y={row.y} width="182" height="38" rx="15" className="scene-lane-shell" />
          <circle cx="264" cy={row.y + 19} r="5" className={row.signalClass} />
          <text x="278" y={row.y + 23} className="scene-panel-title-dark">
            {row.title}
          </text>
          <rect x="372" y={row.y + 10} width="42" height="18" rx="9" className={row.chipClass} />
          <text x="393" y={row.y + 23} textAnchor="middle" className="scene-chip-text">
            {row.chipLabel}
          </text>
        </g>
      ))}

      <rect x="248" y="370" width="182" height="24" rx="12" className="scene-main-footer" />
      <text x="264" y="386" className="scene-panel-copy-dark">
        Reply draft ready
      </text>

      <rect x="464" y="154" width="78" height="252" rx="24" className="scene-card-frame" />
      <text x="480" y="178" className="scene-kicker">
        TODAY
      </text>
      {statCards.map((stat) => (
        <g key={stat.label}>
          <rect x="476" y={stat.y} width="54" height="50" rx="16" className="scene-stat-card" />
          <rect x="486" y={stat.y + 10} width="16" height="4" rx="2" fill={stat.accent} />
          <text x="486" y={stat.y + 27} className="scene-stat-value">
            {stat.value}
          </text>
          <text x="486" y={stat.y + 37} className="scene-stat-label">
            {stat.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
