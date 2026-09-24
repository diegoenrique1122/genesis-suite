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

type DeliveryJob = {
  jobId: string;
  notificationId: string;
  endpoint: string;
  p256dh: string;
  authSecret: string;
  title: string;
  message: string;
  notificationType: string;
  resourceType: string | null;
  resourceId: string | null;
  recipientRole: string;
  attemptCount: number;
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

type DeliveryCounters = {
  claimed: number;
  delivered: number;
  retry: number;
  gone: number;
  dead: number;
  settlementErrors: number;
  contractErrors: number;
};

const REQUIRED_WEB_PUSH_METHODS = [
  "generateVAPIDKeys",
  "setVapidDetails",
  "sendNotification",
  "generateRequestDetails",
] as const;

const VAPID_PUBLIC_KEY_LENGTH = 87;
const VAPID_PRIVATE_KEY_LENGTH = 43;
const DELIVERY_BATCH_LIMIT = 10;
const PUSH_TTL_SECONDS = 86_400;

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VAPID_SUBJECT_RE =
  /^(?:mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/i;

const webPushSurface = webPush as unknown as Record<
  string,
  unknown
>;

for (
  const method of REQUIRED_WEB_PUSH_METHODS
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
): string => typeof value === "string" ? value.trim() : "";

const asNullableString = (
  value: unknown,
): string | null => {
  const normalized = asTrimmedString(value);

  return normalized || null;
};

const asRecord = (
  value: unknown,
): Record<string, unknown> | null =>
  typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asHttpStatus = (
  value: unknown,
): number | null =>
  typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
    ? value
    : null;

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

const readVapidConfig = (): VapidConfigResult => {
  const publicKey = asTrimmedString(
    Deno.env.get(
      "GENESIS_VAPID_PUBLIC_KEY",
    ),
  );

  const privateKey = asTrimmedString(
    Deno.env.get(
      "GENESIS_VAPID_PRIVATE_KEY",
    ),
  );

  const subject = asTrimmedString(
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

const parseDeliveryJob = (
  value: unknown,
): DeliveryJob | null => {
  const row = asRecord(value);

  if (!row) {
    return null;
  }

  const jobId = asTrimmedString(row.job_id);

  const notificationId = asTrimmedString(
    row.notification_id,
  );

  const attemptCount = row.attempt_count;

  if (
    !UUID_RE.test(jobId) ||
    !UUID_RE.test(notificationId) ||
    typeof attemptCount !== "number" ||
    !Number.isInteger(attemptCount) ||
    attemptCount < 1
  ) {
    return null;
  }

  return {
    jobId,
    notificationId,
    endpoint: asTrimmedString(row.endpoint),
    p256dh: asTrimmedString(row.p256dh),
    authSecret: asTrimmedString(row.auth_secret),
    title: asTrimmedString(row.title),
    message: asTrimmedString(row.message),
    notificationType: asTrimmedString(
      row.notification_type,
    ),
    resourceType: asNullableString(
      row.resource_type,
    ),
    resourceId: asNullableString(
      row.resource_id,
    ),
    recipientRole: asTrimmedString(
      row.recipient_role,
    ),
    attemptCount,
  };
};

const isDeliverableJob = (
  job: DeliveryJob,
): boolean => {
  let endpointValid = false;

  try {
    const endpointUrl = new URL(job.endpoint);

    endpointValid = endpointUrl.protocol === "https:";
  } catch {
    endpointValid = false;
  }

  return (
    endpointValid &&
    Boolean(job.p256dh) &&
    Boolean(job.authSecret) &&
    Boolean(job.title) &&
    Boolean(job.message) &&
    Boolean(job.notificationType) &&
    Boolean(job.recipientRole)
  );
};

const buildPushPayload = (
  job: DeliveryJob,
): string =>
  JSON.stringify({
    title: job.title.slice(0, 120),
    body: job.message.slice(0, 300),
    notification_id: job.notificationId,
    notification_type: job.notificationType,
    resource_type: job.resourceType,
    resource_id: job.resourceId,
    recipient_role: job.recipientRole,
    tag: job.notificationId,
  });

const getErrorStatus = (
  error: unknown,
): number | null => {
  const record = asRecord(error);

  return record ? asHttpStatus(record.statusCode) : null;
};

const readRetryAfterHeader = (
  error: unknown,
): string | null => {
  const record = asRecord(error);

  if (!record) {
    return null;
  }

  const headersValue = record.headers;

  if (headersValue instanceof Headers) {
    return headersValue.get(
      "retry-after",
    );
  }

  const headers = asRecord(headersValue);

  if (!headers) {
    return null;
  }

  for (
    const [name, value] of Object.entries(headers)
  ) {
    if (
      name.toLowerCase() !==
        "retry-after"
    ) {
      continue;
    }

    if (typeof value === "string") {
      return value;
    }

    if (
      Array.isArray(value) &&
      typeof value[0] === "string"
    ) {
      return value[0];
    }
  }

  return null;
};

const parseRetryAfterSeconds = (
  value: string | null,
): number | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const numeric = Number(trimmed);

  if (
    Number.isFinite(numeric) &&
    numeric > 0
  ) {
    return Math.min(
      86_400,
      Math.max(1, Math.ceil(numeric)),
    );
  }

  const timestamp = Date.parse(trimmed);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.min(
    86_400,
    Math.max(
      1,
      Math.ceil(
        (timestamp - Date.now()) /
          1000,
      ),
    ),
  );
};

const classifyFailure = (
  job: DeliveryJob,
  error: unknown,
): SettlementInput => {
  const status = getErrorStatus(error);

  if (
    status === 404 ||
    status === 410
  ) {
    return {
      jobId: job.jobId,
      expectedAttemptCount: job.attemptCount,
      outcome: "GONE",
      httpStatus: status,
      errorCode: `WEB_PUSH_HTTP_${status}`,
    };
  }

  if (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status !== null && status >= 500) ||
    status === null
  ) {
    return {
      jobId: job.jobId,
      expectedAttemptCount: job.attemptCount,
      outcome: "RETRY",
      httpStatus: status,
      errorCode: status === null
        ? "WEB_PUSH_TRANSPORT_ERROR"
        : `WEB_PUSH_HTTP_${status}`,
      retryAfterSeconds: parseRetryAfterSeconds(
        readRetryAfterHeader(error),
      ),
    };
  }

  return {
    jobId: job.jobId,
    expectedAttemptCount: job.attemptCount,
    outcome: "DEAD",
    httpStatus: status,
    errorCode: `WEB_PUSH_HTTP_${status}`,
  };
};

const countOutcome = (
  counters: DeliveryCounters,
  outcome: SettlementOutcome,
) => {
  if (outcome === "DELIVERED") {
    counters.delivered += 1;
  } else if (outcome === "RETRY") {
    counters.retry += 1;
  } else if (outcome === "GONE") {
    counters.gone += 1;
  } else {
    counters.dead += 1;
  }
};

/*
 * C3B14.2C.3C.2I
 *
 * SECURITY CONTRACT:
 *
 * - service-to-service authentication only
 * - VAPID values remain server-side secrets
 * - jobs are claimed through the service-role RPC
 * - every result uses fenced settlement by attempt_count
 * - 404/410 permanently disable stale subscriptions
 * - transient failures retry through database backoff
 * - payloads carry semantic targets, never arbitrary URLs
 * - response bodies never expose endpoints or key material
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

      const vapid = readVapidConfig();

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

      const adminRpc = ctx.supabaseAdmin as unknown as AdminRpcClient;

      const claimJobs = async (
        limit: number,
      ) =>
        await adminRpc.rpc(
          "genesis_claim_push_delivery_jobs",
          {
            p_limit: limit,
          },
        );

      const settleJob = async (
        input: SettlementInput,
      ) =>
        await adminRpc.rpc(
          "genesis_settle_push_delivery",
          {
            p_job_id: input.jobId,
            p_expected_attempt_count: input.expectedAttemptCount,
            p_outcome: input.outcome,
            p_http_status: input.httpStatus ?? null,
            p_error_code: input.errorCode ?? null,
            p_retry_after_seconds: input.retryAfterSeconds ??
              null,
          },
        );

      let claimResult;

      try {
        claimResult = await claimJobs(
          DELIVERY_BATCH_LIMIT,
        );
      } catch {
        return json(
          {
            ok: false,
            code: "PUSH_DELIVERY_CLAIM_FAILED",
            retryable: true,
          },
          500,
        );
      }

      if (claimResult.error) {
        return json(
          {
            ok: false,
            code: "PUSH_DELIVERY_CLAIM_FAILED",
            retryable: true,
          },
          500,
        );
      }

      if (
        claimResult.data !== null &&
        !Array.isArray(claimResult.data)
      ) {
        return json(
          {
            ok: false,
            code: "PUSH_DELIVERY_CLAIM_RESULT_INVALID",
            retryable: true,
          },
          500,
        );
      }

      const rows = Array.isArray(claimResult.data) ? claimResult.data : [];

      const counters: DeliveryCounters = {
        claimed: rows.length,
        delivered: 0,
        retry: 0,
        gone: 0,
        dead: 0,
        settlementErrors: 0,
        contractErrors: 0,
      };

      for (const row of rows) {
        const job = parseDeliveryJob(row);

        if (!job) {
          counters.contractErrors += 1;
          continue;
        }

        let settlement: SettlementInput;

        if (!isDeliverableJob(job)) {
          settlement = {
            jobId: job.jobId,
            expectedAttemptCount: job.attemptCount,
            outcome: "DEAD",
            errorCode: "PUSH_JOB_CONTRACT_INVALID",
          };
        } else {
          try {
            const response = await webPush.sendNotification(
              {
                endpoint: job.endpoint,
                keys: {
                  p256dh: job.p256dh,
                  auth: job.authSecret,
                },
              },
              buildPushPayload(job),
              {
                TTL: PUSH_TTL_SECONDS,
                urgency: "normal",
              },
            );

            const status = asHttpStatus(
              response.statusCode,
            );

            settlement = status !== null &&
                (status < 200 || status >= 300)
              ? classifyFailure(
                job,
                { statusCode: status },
              )
              : {
                jobId: job.jobId,
                expectedAttemptCount: job.attemptCount,
                outcome: "DELIVERED",
                httpStatus: status,
              };
          } catch (error) {
            settlement = classifyFailure(
              job,
              error,
            );
          }
        }

        try {
          const settlementResult = await settleJob(settlement);

          if (settlementResult.error) {
            counters.settlementErrors += 1;
            continue;
          }

          countOutcome(
            counters,
            settlement.outcome,
          );
        } catch {
          counters.settlementErrors += 1;
        }
      }

      const complete = counters.settlementErrors === 0 &&
        counters.contractErrors === 0;

      return json(
        {
          ok: complete,
          code: complete
            ? rows.length === 0
              ? "PUSH_DELIVERY_NO_JOBS"
              : "PUSH_DELIVERY_COMPLETE"
            : "PUSH_DELIVERY_INCOMPLETE",
          retryable: !complete,
          summary: counters,
        },
        complete ? 200 : 500,
      );
    },
  ),
};
