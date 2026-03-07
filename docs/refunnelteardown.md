Here is a microscopic, millisecond-by-millisecond teardown of the Refunnel landing page’s interactions, micro-animations, structure, and copy.
The Physics Engine & The Hook (0:00 – 0:04)
0:00: The page loads with a stark, high-contrast minimalist header. Navigation elements (Product, Case Studies, Playbooks, etc.) are standard, but the visual weight is entirely at the bottom of the viewport. A deep purple-to-peach gradient sits at the bottom edge, glowing upwards against the white background.
0:01: The H1, "One Platform for Sourcing, Tracking, and Whitelisting Community UGC," fades in. The copy immediately positions the tool as an all-in-one centralized dashboard.
0:02: As the scroll initiates, the first scroll-triggered animations fire. The bottom gradient expands upward, acting as a transition mask. From the left, a highly detailed 3D rendered, glassy retro microphone floats into the viewport. Generating precise 3D assets like this to serve as visual anchors is an incredibly effective way to elevate a landing page beyond standard flat vector illustrations. It rotates on a slight Y-axis, giving it physical presence.
0:03 – 0:04: A 3D silver ring light floats in from the right. Simultaneously, UI elements detach from the gradient pool: two metric bubbles ("195 Invites Sent," "623 Creators Found") pop into place with a subtle spring-physics bounce. Below them, an array of stylized social media UGC cards (mimicking Instagram and TikTok interfaces) slide upwards.
The Agitation & Parallax (0:05 – 0:08)
0:05: A seamless, infinite marquee of high-tier social proof (logos including SPACES, RIDGE, Tommy John, DUDE, Crocs) scrolls right-to-left.
0:06 – 0:08: The core problem statement anchors to the center of the screen: "95% of your brand's UGC goes unnoticed by you." As the user scrolls, this text remains fixed (position: sticky) while the constellation of UGC cards continues to float upwards on the Z-axis in a parallax effect. The cards have soft drop shadows, simulating physical cards passing over the text. This interaction physically mimics the feeling of content slipping past a brand's radar.
Dashboard Teasers & Solution Framing (0:09 – 0:16)
0:09 – 0:12: Transitioning to the solution: "Capture every post that mentions your brand." A crisp mockup of the Refunnel dashboard slides smoothly up from the bottom. Showing the internal "done-for-you" architecture directly proves that the chaotic social feed can be tamed into a clean, trackable UI.
0:13 – 0:14: "Run contests & missions..." Silver 3D headphones float on the left. Instead of a full dashboard, a floating UI card overlaying a heavily blurred background pops up. Micro-interactions fire sequentially: the main mission card appears, followed milliseconds later by a floating heart bubble ("388k likes") and an avatar stack.
0:15 – 0:16: "Creator whitelisting, reimagined. No Facebook oath. Zero friction. All in 1 click." This is a brilliant piece of landing page copy—it names the exact technical nightmare (Facebook Business Manager oaths) and offers the immediate dream state. A 3D camera and tripod frame the edges, while a dynamic "Request Whitelisting" UI card slides in, complete with a green ROI graph trending upward.
Trust Proxies & The Bento Box (0:17 – 0:22)
0:17: A highly unconventional interactive section appears: "Why is Refunnel the best creator management platform?" Below it are three pill-shaped CTA buttons: Ask ChatGPT, Ask Claude, Ask Perplexity. Instead of telling the user they are the best, they are outsourcing their social proof to AI LLMs, assuming the user will click and see a positive brand sentiment analysis.
0:18 – 0:22: The page transitions into a full-width deep purple container utilizing a "Bento Box" layout for "More Features." The cards use a glassmorphism effect (translucent backgrounds with solid foregrounds). The left card showcases a stacked bar chart for "Content Count" (IG Reels, Stories, TikToks). The right shows a TikTok Shop leaderboard mockup. The visual hierarchy here shifts from broad marketing promises to specific, actionable data retention features ("Power your email retention").
The Conversion Trap & Footer Reveal (0:23 – 0:31)
0:23 – 0:27: The testimonial section drops the standard grid in favor of a horizontal slider. Brand names (obvi, sundays, SEEQ) act as a sticky top menu. The cards themselves are text-heavy, focusing on the pain of manual tracking vs. the relief of an automated system.
0:28 – 0:29: The final CTA: "Let's chat!" It utilizes a split-screen layout. The left reinforces scale ("1M+ UGC Sourced," "20K+ Creators Whitelisted"), while the right offers a clean, multi-field lead capture form.
0:30 – 0:31: The scroll terminates with a massive typographic reveal. The word "REFUNNEL" spans the entire width of the page in a thin outline font. As the user reaches the absolute bottom of the scroll, a scroll-trigger animation fills the empty text outline with the exact same purple-to-peach gradient that opened the site, creating a perfect visual loop. Above it, the word "GROW" appears with four upward-pointing arrows, serving as the final subliminal directive.
Structural Synthesis:
The site relies heavily on scroll-triggered staggered animations (likely built using a library like GSAP). Every time a new section enters the viewport, the elements do not simply appear; the 3D anchors float in slightly slower than the text, and the UI mockups slide up with a slight delay. This pacing forces the user's eye to read the headline first, then validates the claim immediately with a visual "proof" graphic popping into place.

1. Global Tech Stack & Performance Rules
Framework: Next.js (App Router).
Styling: Tailwind CSS for layout, typography, and utility classes.
Animations: GSAP (specifically ScrollTrigger and SplitText if available, or Framer Motion as a fallback for simple springs).
3D Assets: React Three Fiber (R3F) or Spline React components for lightweight 3D element embedding.
Performance Constraint: To prevent Vercel runtime timeout errors, all heavy animation libraries (GSAP, R3F) MUST be wrapped in client components ('use client') and dynamically imported using next/dynamic with ssr: false. Static text and layout frames must remain Server Components.
2. Section-by-Section Implementation Blueprint
Phase 1: The Physics Engine Hero (0% - 15% Scroll)

Visuals: Stark white background. A deep purple-to-peach gradient sits at the absolute bottom of the viewport (fixed bottom-0 w-full h-32 blur-3xl opacity-80).
Micro-Animations: * Load event: H1 fades up (Y +20px to 0, opacity 0 to 1) using a standard ease-out over 0.8s.
Delayed load (0.4s): Render two floating 3D elements (e.g., a retro microphone and a ring light) using Spline components injected on the left and right flanks. Apply a continuous slow Math.sin() floating loop on their Y-axis.
Data Badges: Use a spring-physics animation (gsap.from(..., { y: 50, opacity: 0, ease: "elastic.out(1, 0.5)" })) to pop up floating metric cards ("195 Invites Sent").
Phase 2: The Agitation & Parallax (15% - 30% Scroll)

Layout: A container wrapping a sticky text block and an absolute-positioned array of UGC (User Generated Content) cards mimicking TikTok/IG interfaces.
GSAP Interaction: * Use ScrollTrigger. Set pin: true on the central H2 text ("95% of your brand's UGC goes unnoticed...").
Target the array of UGC cards. Use scrub: 1 to tie their Y-axis translation to the scroll bar.
The Depth Illusion: Assign different Y-translation values based on an HTML data-speed attribute on each card. Cards appearing "closer" (larger scale, higher z-index, larger drop shadow) should move faster than cards "further away" to create true parallax.
Phase 3: Dashboard Teasers & Staggered Arrays (30% - 50% Scroll)

Layout: Alternating left-right splits (Text on left, UI mockup on right, then vice-versa).
Micro-Animations: When the UI mockups enter the viewport (start: "top 80%" in ScrollTrigger):
Slide the main dashboard container up.
Use gsap.to(..., { stagger: 0.15 }) to reveal internal dashboard elements sequentially (e.g., a chart column animating up, then a floating "Request Whitelisting" badge popping in, then an ROI graph trending up).
This staggering proves the UI is complex but organized.
Phase 4: Bento Box Feature Grid (50% - 75% Scroll)

Layout: Transition to a full-width deep purple container (bg-purple-900). Implement a CSS Grid layout (grid-cols-1 md:grid-cols-3 md:grid-rows-2).
Styling (Glassmorphism): The feature cards must look like frosted glass resting on the purple background.
Tailwind classes: bg-white/10 backdrop-blur-lg border border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-3xl.
Interaction: Subtle hover states. On card hover, elevate the card (-translate-y-2) and slightly increase the border opacity (border-white/40) with a duration-300 ease-in-out transition.
Phase 5: Trust Proxies & Infinite Slider (75% - 90% Scroll)

Layout: A horizontal testimonial scroller. Do not use standard grid columns.
GSAP Interaction: Create an infinite marquee effect for the testimonial cards. Use gsap.to(..., { xPercent: -100, repeat: -1, ease: "none", duration: 20 }).
UX Detail: Add pauseOnHover: true logic so users can actually read the text when they mouse over a specific card.
Phase 6: The Typographic Conversion Trap (90% - 100% Scroll)

Layout: A massive, full-width H1 at the very bottom spelling your brand name or a keyword like "GROW".
Styling: Start as an outline text: text-transparent bg-clip-text -webkit-text-stroke-1 text-purple-300.
GSAP Interaction: As the user reaches the absolute bottom of the page (start: "top bottom", end: "bottom bottom", scrub: true), animate the background size or a clip-path of a duplicate solid-text layer over the outline text, effectively "filling it up" with a gradient as they hit the end of the scroll.
