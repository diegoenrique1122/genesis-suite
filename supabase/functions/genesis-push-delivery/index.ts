import "@supabase/functions-js/edge-runtime.d.ts";

import { withSupabase } from "@supabase/server";

// @ts-types="npm:@types/web-push@3.6.4"
import webPush from "web-push";

type JsonRecord = Record<string, unknown>;

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type VapidConfigResult =
  | {
      ok: true;
      config: VapidConfig;
    }
  | {
      ok: false;
      code: string;
    };

type SettlementOutcome =
  | "DELIVERED"
  | "RETRY"
  | "GONE"
  | "DEAD";

type SettlementInput = {
  jobId: string;
  expectedAttemptCount: number;
  outcome: SettlementOutcome;
  httpStatus?: number | null;
  errorCode?: string | null;
  retryAfterSeconds?: number | null;
};

type AdminRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{
    data: unknown;
    error: unknown;
  }>;
};

const REQUIRED_WEB_PUSH_METHODS = [
  "generateVAPIDKeys",
  "setVapidDetails",
  "sendNotification",
  "generateRequestDetails",
] as const;

const VAPID_PUBLIC_KEY_LENGTH = 87;
const VAPID_PRIVATE_KEY_LENGTH = 43;

const BASE64URL_RE =
  /^[A-Za-z0-9_-]+$/;

const VAPID_SUBJECT_RE =
  /^(?:mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/i;

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

const asTrimmedString = (
  value: unknown,
): string =>
  typeof value === "string"
    ? value.trim()
    : "";

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

const readVapidConfig =
  (): VapidConfigResult => {
    const publicKey =
      asTrimmedString(
        Deno.env.get(
          "GENESIS_VAPID_PUBLIC_KEY",
        ),
      );

    const privateKey =
      asTrimmedString(
        Deno.env.get(
          "GENESIS_VAPID_PRIVATE_KEY",
        ),
      );

    const subject =
      asTrimmedString(
        Deno.env.get(
          "GENESIS_VAPID_SUBJECT",
        ),
      );

    if (
      !publicKey ||
      !privateKey ||
      !subject
    ) {
      return {
        ok: false,
        code: "VAPID_CONFIG_MISSING",
      };
    }

    if (
      publicKey.length !==
        VAPID_PUBLIC_KEY_LENGTH ||
      !BASE64URL_RE.test(publicKey)
    ) {
      return {
        ok: false,
        code: "VAPID_PUBLIC_KEY_INVALID",
      };
    }

    if (
      privateKey.length !==
        VAPID_PRIVATE_KEY_LENGTH ||
      !BASE64URL_RE.test(privateKey)
    ) {
      return {
        ok: false,
        code: "VAPID_PRIVATE_KEY_INVALID",
      };
    }

    if (
      !VAPID_SUBJECT_RE.test(subject)
    ) {
      return {
        ok: false,
        code: "VAPID_SUBJECT_INVALID",
      };
    }

    return {
      ok: true,
      config: {
        publicKey,
        privateKey,
        subject,
      },
    };
  };

/*
 * C3B14.2C.3C.2C
 *
 * SECURITY STATE:
 *
 * - service-to-service authentication only
 * - VAPID configuration contract wired
 * - claim RPC contract wired
 * - fenced settlement RPC contract wired
 * - settlement requires expected attempt_count
 * - no Push request can be emitted
 *
 * IMPORTANT:
 *
 * claimJobs and settleJob are intentionally NOT invoked yet.
 * sendNotification is intentionally NOT invoked yet.
 *
 * This function remains NOT ARMED.
 */
export default {
  fetch: withSupabase(
    {
      auth: "secret",
    },
    async (
      req,
      ctx,
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

      const vapid =
        readVapidConfig();

      if (!vapid.ok) {
        return json(
          {
            ok: false,
            code: vapid.code,
            retryable: false,
          },
          503,
        );
      }

      try {
        webPush.setVapidDetails(
          vapid.config.subject,
          vapid.config.publicKey,
          vapid.config.privateKey,
        );
      } catch {
        return json(
          {
            ok: false,
            code: "VAPID_CONFIG_INVALID",
            retryable: false,
          },
          503,
        );
      }

      /*
       * The Edge Function client is intentionally not parameterized
       * with generated Database types. Narrow only the RPC surface
       * required by this worker so custom RPC arguments remain typed
       * without widening the full admin client.
       */
      const adminRpc =
        ctx.supabaseAdmin as unknown as AdminRpcClient;

      /*
       * Wiring only.
       *
       * These closures establish the exact database RPC contract
       * that the armed sender will use in the next phase.
       *
       * They are deliberately not executed in C3B14.2C.3C.2C.
       */
      const claimJobs =
        async (
          limit: number,
        ) =>
          await adminRpc.rpc(
            "genesis_claim_push_delivery_jobs",
            {
              p_limit: limit,
            },
          );

      const settleJob =
        async (
          input: SettlementInput,
        ) =>
          await adminRpc.rpc(
            "genesis_settle_push_delivery",
            {
              p_job_id:
                input.jobId,
              p_expected_attempt_count:
                input.expectedAttemptCount,
              p_outcome:
                input.outcome,
              p_http_status:
                input.httpStatus ?? null,
              p_error_code:
                input.errorCode ?? null,
              p_retry_after_seconds:
                input.retryAfterSeconds ??
                null,
            },
          );

      /*
       * Keep the closures part of the compiled contract without
       * executing them before the sender is explicitly armed.
       */
      void claimJobs;
      void settleJob;

      return json(
        {
          ok: false,
          code: "PUSH_DELIVERY_NOT_ARMED",
          retryable: false,
          vapidConfigured: true,
          claimSettleWiring: true,
        },
        503,
      );
    },
  ),
};