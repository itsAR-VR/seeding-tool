import { log } from "@/lib/logger";

const TRACK17_BASE_URL = "https://api.17track.net/track/v2.2";

/**
 * Track17 API client for shipment tracking.
 *
 * Uses the REST API at https://api.17track.net/track/v2.2
 * Auth via `17token` header with TRACK17_API_KEY from env.
 *
 * Docs: https://api.17track.net/track/v2.2
 */

function getApiKey(): string {
  const key = process.env.TRACK17_API_KEY;
  if (!key) {
    throw new Error("TRACK17_API_KEY is not set");
  }
  return key;
}

async function track17Fetch<T>(
  path: string,
  body: unknown
): Promise<T> {
  const url = `${TRACK17_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "17token": getApiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    log("error", "track17.api_error", {
      path,
      status: res.status,
      body: text,
    });
    throw new Error(`Track17 API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ------- Types -------

export interface Track17RegisterResponse {
  code: number;
  data: {
    accepted: Array<{ number: string; carrier: number }>;
    rejected: Array<{ number: string; error: { code: number; message: string } }>;
  };
}

export interface Track17TrackInfo {
  number: string;
  carrier: number;
  param: unknown;
  tag: string; // NotFound | InTransit | Expired | Delivered | etc.
  track_info: {
    latest_status: {
      status: string;
      sub_status: string;
    };
    latest_event: {
      time_iso: string;
      description: string;
      location: string;
    } | null;
    milestone: Array<{
      key_stage: string;
      time_iso: string;
    }>;
  };
}

export interface Track17GetTrackInfoResponse {
  code: number;
  data: {
    accepted: Track17TrackInfo[];
    rejected: Array<{ number: string; error: { code: number; message: string } }>;
  };
}

export interface Track17StopTrackResponse {
  code: number;
  data: {
    accepted: Array<{ number: string }>;
    rejected: Array<{ number: string; error: { code: number; message: string } }>;
  };
}

// ------- API Functions -------

/**
 * Register a tracking number with Track17 for monitoring.
 *
 * @param trackingNumber - The shipment tracking number
 * @param carrier - Optional carrier code (17track numeric carrier ID)
 */
export async function registerTracking(
  trackingNumber: string,
  carrier?: number
): Promise<Track17RegisterResponse> {
  log("info", "track17.register", { trackingNumber, carrier });

  const body = carrier
    ? [{ number: trackingNumber, carrier }]
    : [{ number: trackingNumber }];

  return track17Fetch<Track17RegisterResponse>("/register", body);
}

/**
 * Get current tracking status for a tracking number.
 *
 * @param trackingNumber - The shipment tracking number
 */
export async function getTrackingStatus(
  trackingNumber: string
): Promise<Track17GetTrackInfoResponse> {
  log("info", "track17.gettrackinfo", { trackingNumber });

  return track17Fetch<Track17GetTrackInfoResponse>("/gettrackinfo", [
    { number: trackingNumber },
  ]);
}

/**
 * Stop tracking a shipment (e.g. after delivery confirmed).
 *
 * @param trackingNumber - The shipment tracking number
 */
export async function stopTracking(
  trackingNumber: string
): Promise<Track17StopTrackResponse> {
  log("info", "track17.stoptrack", { trackingNumber });

  return track17Fetch<Track17StopTrackResponse>("/stoptrack", [
    { number: trackingNumber },
  ]);
}

/**
 * Map Track17 tag/status to our internal FulfillmentEvent status.
 */
export function mapTrack17Status(tag: string, subStatus?: string): string {
  const tagMap: Record<string, string> = {
    NotFound: "confirmed",
    InfoReceived: "confirmed",
    InTransit: "in_transit",
    OutForDelivery: "out_for_delivery",
    Delivered: "delivered",
    AvailableForPickup: "out_for_delivery",
    Exception: "failure",
    Expired: "failure",
    Pending: "confirmed",
  };

  return tagMap[tag] || "in_transit";
}
