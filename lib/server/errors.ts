export interface ApiErrorResponse {
  status: number;
  body: { error: string; details?: string };
}

/**
 * Map a thrown value to an HTTP response.
 *
 * Rate limits from Yahoo/Google are surfaced as 429 so the client can show a
 * "try again shortly" message rather than a generic failure.
 */
export function toApiError(error: unknown): ApiErrorResponse {
  const message = error instanceof Error ? error.message : String(error);
  const asString = String(error);

  if (message.includes("429") || asString.includes("Too Many Requests")) {
    return {
      status: 429,
      body: {
        error: "Rate Limit Exceeded. Please try again in 1 minute.",
        details: "External API provider is busy.",
      },
    };
  }

  return {
    status: 500,
    body: { error: message || "Internal Server Error", details: asString },
  };
}
