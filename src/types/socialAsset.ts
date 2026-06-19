/**
 * Core domain types for the Rahasya Social Distribution Engine.
 * These mirror the Supabase schema precisely.
 */

// ─── Social Asset (source of truth — pre-existing table) ──────────────────

export interface SocialAsset {
  id: number;
  created_at: string;
  horoscope_date: string; // ISO date e.g. "2024-01-15"
  sign: ZodiacSign;
  mood: string;
  quote: string;
  image_url: string;

  published: boolean;

  pinterest_published: boolean;
  pinterest_published_at: string | null;

  instagram_published: boolean;
  instagram_published_at: string | null;

  facebook_published: boolean;
  facebook_published_at: string | null;

  twitter_published: boolean;
  twitter_published_at: string | null;

  threads_published: boolean;
  threads_published_at: string | null;

  // Concurrency locking fields (added via migration)
  processing: boolean;
  processing_started_at: string | null;
}

// ─── Social Post Log (audit trail) ────────────────────────────────────────

export interface SocialPostLog {
  id: number;
  asset_id: number;
  platform: Platform;
  status: PostStatus;
  post_id: string | null;
  post_url: string | null;
  published_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export type SocialPostLogInsert = Omit<SocialPostLog, "id" | "created_at">;

// ─── Social Queue ──────────────────────────────────────────────────────────

export interface SocialQueueItem {
  id: number;
  asset_id: number;
  platform: Platform;
  status: QueueStatus;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string;
}

export type SocialQueueItemInsert = Omit<SocialQueueItem, "id" | "created_at">;

// ─── Enumerations ──────────────────────────────────────────────────────────

export type Platform = "facebook" | "instagram" | "threads";

export type PostStatus = "success" | "failed" | "skipped";

export type QueueStatus = "pending" | "processing" | "completed" | "failed";

export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

// ─── Publisher Result ──────────────────────────────────────────────────────

export interface PublishResult {
  success: boolean;
  platform: Platform;
  assetId: number;
  postId?: string;
  postUrl?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// ─── Platform Caption ──────────────────────────────────────────────────────

export interface PlatformCaption {
  platform: Platform;
  text: string;
  hashtags: string[];
}

// ─── Image Validation Result ───────────────────────────────────────────────

export interface ImageValidationResult {
  valid: boolean;
  url: string;
  error?: string;
  contentType?: string;
  sizeBytes?: number;
}
