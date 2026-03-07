export default function HeroScene() {
  return (
    <svg
      className="hero-scene"
      viewBox="0 0 620 540"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Creator content, outreach, shipping, and posting states gathered into one seeding control surface"
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

      <g className="scene-card scene-card-a">
        <rect x="86" y="108" width="124" height="154" rx="26" className="scene-card-frame" />
        <rect x="100" y="124" width="96" height="84" rx="18" fill="url(#creatorWarm)" />
        <circle cx="148" cy="165" r="26" fill="rgba(29, 18, 29, 0.12)" />
        <path d="M112 226H168" className="scene-line" />
        <path d="M112 242H184" className="scene-line scene-line-soft" />
      </g>

      <g className="scene-card scene-card-b">
        <rect x="94" y="286" width="138" height="114" rx="28" className="scene-card-frame" />
        <rect x="112" y="306" width="68" height="68" rx="18" fill="url(#creatorCool)" />
        <path d="M192 316H216" className="scene-line" />
        <path d="M192 334H220" className="scene-line" />
        <rect x="188" y="352" width="46" height="22" rx="11" className="scene-chip scene-chip-cool" />
        <text x="211" y="367" textAnchor="middle" className="scene-chip-text">Email</text>
      </g>

      <g className="scene-card scene-card-c">
        <rect x="434" y="106" width="100" height="146" rx="24" className="scene-card-frame" />
        <rect x="448" y="122" width="72" height="84" rx="18" fill="url(#creatorMint)" />
        <path d="M450 220H500" className="scene-line" />
        <path d="M450 236H514" className="scene-line scene-line-soft" />
      </g>

      <g className="scene-board">
        <rect x="210" y="120" width="218" height="262" rx="36" className="scene-board-shell" />
        <rect x="234" y="146" width="92" height="14" rx="7" className="scene-board-title" />
        <rect x="236" y="182" width="168" height="48" rx="22" className="scene-lane-shell" />
        <rect x="236" y="244" width="168" height="48" rx="22" className="scene-lane-shell" />
        <rect x="236" y="306" width="168" height="48" rx="22" className="scene-lane-shell" />
        <rect x="252" y="196" width="64" height="18" rx="9" className="scene-chip scene-chip-warm" />
        <rect x="252" y="258" width="74" height="18" rx="9" className="scene-chip scene-chip-cool" />
        <rect x="252" y="320" width="68" height="18" rx="9" className="scene-chip scene-chip-mint" />
        <text x="284" y="209" textAnchor="middle" className="scene-chip-text">Shortlist</text>
        <text x="289" y="271" textAnchor="middle" className="scene-chip-text">Address</text>
        <text x="286" y="333" textAnchor="middle" className="scene-chip-text">Posted</text>
        <circle cx="382" cy="206" r="7" className="scene-signal scene-signal-warm" />
        <circle cx="382" cy="268" r="7" className="scene-signal scene-signal-cool" />
        <circle cx="382" cy="330" r="7" className="scene-signal scene-signal-good" />
        <rect x="220" y="120" width="198" height="262" rx="34" className="scene-scan" />
      </g>

      <g className="scene-message scene-message-a">
        <rect x="252" y="84" width="120" height="56" rx="18" className="scene-note" />
        <text x="274" y="107" className="scene-note-label">Reply draft</text>
        <path d="M274 121H338" className="scene-note-line" />
      </g>

      <g className="scene-ship">
        <rect x="432" y="296" width="104" height="84" rx="24" className="scene-note scene-ship-shell" />
        <rect x="454" y="318" width="42" height="26" rx="7" className="scene-box" />
        <path d="M454 330H496" className="scene-box-line" />
        <rect x="448" y="350" width="58" height="18" rx="9" className="scene-chip scene-chip-mint" />
        <text x="477" y="363" textAnchor="middle" className="scene-chip-text">Posted</text>
      </g>
    </svg>
  );
}
