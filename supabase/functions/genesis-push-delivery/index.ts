import "@supabase/functions-js/edge-runtime.d.ts";

import { withSupabase } from "@supabase/server";

// @ts-types="npm:@types/web-push@3.6.4"
import webPush from "web-push";

type JsonRecord = Record<string, unknown>;

const REQUIRED_WEB_PUSH_METHODS = [
  "generateVAPIDKeys",
  "setVapidDetails",
  "sendNotification",
  "generateRequestDetails",
] as const;

const webPushSurface =
  webPush as unknown as Record<
    string,
    unknown
  >;

for (
  const method
  of REQUIRED_WEB_PUSH_METHODS
) {
  if (
    typeof webPushSurface[method] !==
    "function"
  ) {
    throw new Error(
      `GENESIS_PUSH_DELIVERY_WEB_PUSH_METHOD_MISSING:${method}`,
    );
  }
}

const json = (
  body: JsonRecord,
  status = 200,
  extraHeaders?: HeadersInit,
) =>
  Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    },
  );

/*
 * C3B14.2C.3C.2B
 *
 * SECURITY STATE:
 *
 * - service-to-service authentication only
 * - no browser/user authority
 * - no VAPID secrets loaded
 * - no jobs claimed
 * - no Push requests emitted
 *
 * Intentionally NOT ARMED.
 */
export default {
  fetch: withSupabase(
    {
      auth: "secret",
    },
    async (
      req,
      _ctx,
    ) => {
      if (req.method !== "POST") {
        return json(
          {
            ok: false,
            code: "METHOD_NOT_ALLOWED",
          },
          405,
          {
            Allow: "POST",
          },
        );
      }

      return json(
        {
          ok: false,
          code: "PUSH_DELIVERY_NOT_ARMED",
          retryable: false,
        },
        503,
      );
    },
  ),
};