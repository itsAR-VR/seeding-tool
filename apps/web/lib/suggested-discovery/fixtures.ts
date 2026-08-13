/**
 * Suggested Discovery — demo fixtures.
 *
 * Synthetic profiles that exercise the real classification path
 * (classifyDiscoveryText) without a browser, login, or API key, so the
 * Discover UI can be demoed end to end. Clearly marked mode: "demo".
 */

import type { SuggestedProfile } from "./types";

export const FIXTURE_PROFILES: readonly SuggestedProfile[] = [
  {
    handle: "trail.kate",
    displayName: "Kate Wilder",
    bio: "Backpacking the PCT one section at a time 🥾 Gear reviews & trail recipes\n📍 Portland, OR",
    category: "Outdoor enthusiast",
    followers: 84200,
    following: 610,
    posts: 431,
    externalUrl: "https://trailkate.example.com",
    isVerified: false,
    profileUrl: "https://www.instagram.com/trail.kate/",
    discoveredFrom: "",
    screenshotFile: null,
  },
  {
    handle: "nora.glowskin",
    displayName: "Nora Kim",
    bio: "Derm-approved skincare routines ✨ ingredient deep dives, honest reviews\nPR: nora@example.com",
    category: "Beauty blogger",
    followers: 152000,
    following: 388,
    posts: 1204,
    externalUrl: null,
    isVerified: true,
    profileUrl: "https://www.instagram.com/nora.glowskin/",
    discoveredFrom: "",
    screenshotFile: null,
  },
  {
    handle: "liftwithleo",
    displayName: "Leo Martinez",
    bio: "Strength coach 💪 supplements that actually work, 5x5 programs\n📩 DM for coaching",
    category: "Fitness trainer",
    followers: 67800,
    following: 901,
    posts: 890,
    externalUrl: "https://leocoaching.example.com",
    isVerified: false,
    profileUrl: "https://www.instagram.com/liftwithleo/",
    discoveredFrom: "",
    screenshotFile: null,
  },
  {
    handle: "urban.plantdad",
    displayName: "Theo",
    bio: "Turning my apartment into a jungle 🌿 plant care, propagation station tours",
    category: "Home & garden",
    followers: 23400,
    following: 445,
    posts: 267,
    externalUrl: null,
    isVerified: false,
    profileUrl: "https://www.instagram.com/urban.plantdad/",
    discoveredFrom: "",
    screenshotFile: null,
  },
  {
    handle: "fork.and.fable",
    displayName: "Fable Kitchen",
    bio: "Weeknight recipes that don't suck 🍝 cast iron everything, meal prep Sundays",
    category: "Food & Beverage",
    followers: 98100,
    following: 512,
    posts: 743,
    externalUrl: "https://forkandfable.example.com",
    isVerified: false,
    profileUrl: "https://www.instagram.com/fork.and.fable/",
    discoveredFrom: "",
    screenshotFile: null,
  },
];
