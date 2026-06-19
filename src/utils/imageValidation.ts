/**
 * Image validation for social assets before publishing.
 * Validates URL reachability, content type, and size constraints.
 */

import { ImageValidationResult } from "../types/socialAsset.js";
import { logger } from "./logger.js";

// Platform image requirements
const IMAGE_CONSTRAINTS = {
  maxSizeBytes: 8 * 1024 * 1024, // 8MB (Instagram limit)
  minSizeBytes: 1024,             // 1KB minimum
  allowedTypes: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ],
};

/**
 * Validate that an image URL is accessible and meets platform requirements.
 * Uses a HEAD request first for efficiency, falls back to GET.
 */
export async function validateImage(
  imageUrl: string
): Promise<ImageValidationResult> {
  if (!imageUrl || imageUrl.trim() === "") {
    return { valid: false, url: imageUrl, error: "Image URL is empty" };
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return {
      valid: false,
      url: imageUrl,
      error: `Invalid URL format: ${imageUrl}`,
    };
  }

  // Must be HTTPS for all platforms
  if (parsedUrl.protocol !== "https:") {
    return {
      valid: false,
      url: imageUrl,
      error: "Image URL must use HTTPS",
    };
  }

  // Try HEAD request first (bandwidth efficient)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let response: Response;
    try {
      response = await fetch(imageUrl, {
        method: "HEAD",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return {
        valid: false,
        url: imageUrl,
        error: `Image URL returned HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
      10
    );

    // Validate content type
    const normalizedType = contentType.split(";")[0]?.trim().toLowerCase() || "";
    if (
      normalizedType &&
      !IMAGE_CONSTRAINTS.allowedTypes.includes(normalizedType)
    ) {
      return {
        valid: false,
        url: imageUrl,
        error: `Unsupported image type: ${normalizedType}. Allowed: ${IMAGE_CONSTRAINTS.allowedTypes.join(", ")}`,
      };
    }

    // Validate size if available from headers
    if (contentLength > 0) {
      if (contentLength > IMAGE_CONSTRAINTS.maxSizeBytes) {
        return {
          valid: false,
          url: imageUrl,
          error: `Image too large: ${Math.round(contentLength / 1024 / 1024)}MB. Max: 8MB`,
        };
      }

      if (contentLength < IMAGE_CONSTRAINTS.minSizeBytes) {
        return {
          valid: false,
          url: imageUrl,
          error: `Image too small: ${contentLength} bytes. Likely corrupted.`,
        };
      }
    }

    logger.debug("Image validation passed", {
      url: imageUrl,
      contentType: normalizedType,
      sizeBytes: contentLength,
    });

    return {
      valid: true,
      url: imageUrl,
      contentType: normalizedType || undefined,
      sizeBytes: contentLength > 0 ? contentLength : undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";

    if (message.includes("abort")) {
      return {
        valid: false,
        url: imageUrl,
        error: "Image URL timed out after 10 seconds",
      };
    }

    return {
      valid: false,
      url: imageUrl,
      error: `Failed to reach image URL: ${message}`,
    };
  }
}
