import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type JsonRecord = Record<string, unknown>;
type LifecycleAction = "APPROVE" | "SUSPEND" | "REACTIVATE" | "HARD_DELETE";

type RequestBody = {
  targetUserId?: unknown;
  action?: unknown;
  confirmation?: unknown;
};

type StorageObject = {
  bucketId: string;
  name: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set<LifecycleAction>([
  "APPROVE",
  "SUSPEND",
  "REACTIVATE",
  "HARD_DELETE",
]);
const STORAGE_BATCH_SIZE = 100;

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const json = (body: JsonRecord, status = 200, extraHeaders?: HeadersInit) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });

const statusForCode = (code: string): number => {
  switch (code) {
    case "INVALID_ACTION":
    case "INVALID_REQUEST":
      return 400;
    case "ACTOR_SESSION_INVALID":
      return 401;
    case "ACTOR_FORBIDDEN":
    case "SELF_ACTION_BLOCKED":
      return 403;
    case "TARGET_NOT_FOUND":
      return 404;
    case "INVALID_TRANSITION":
    case "LAST_ACTIVE_SUPER_ADMIN":
    case "DEPENDENCIES_EXIST":
      return 409;
    default:
      return 403;
  }
};

const safePreflight = (value: JsonRecord) => ({
  allowed: value.allowed === true,
  code: asTrimmedString(value.code) || "PREFLIGHT_DENIED",
  action: asTrimmedString(value.action) || null,
  targetRole: asTrimmedString(value.target_role) || null,
  targetStatus: asTrimmedString(value.target_status) || null,
  activeSuperAdmins:
    typeof value.active_super_admins === "number"
      ? value.active_super_admins
      : null,
  blockers: asRecord(value.blockers),
  cleanup: asRecord(value.cleanup),
});

const requestIp = (req: Request): string | null => {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || req.headers.get("cf-connecting-ip")?.trim() || "";
  return candidate ? candidate.slice(0, 128) : null;
};

const parseStorageObjects = (value: unknown): StorageObject[] | null => {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const objects: StorageObject[] = [];

  for (const item of value) {
    const record = asRecord(item);
    const bucketId = asTrimmedString(record?.bucket_id);
    const name = asTrimmedString(record?.name);

    if (!bucketId || !name) return null;

    const key = `${bucketId}\u0000${name}`;
    if (seen.has(key)) continue;

    seen.add(key);
    objects.push({ bucketId, name });
  }

  return objects;
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return json(
        { ok: false, code: "METHOD_NOT_ALLOWED" },
        405,
        { Allow: "POST" },
      );
    }

    let body: RequestBody;

    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return json({ ok: false, code: "INVALID_JSON" }, 400);
    }

    const targetUserId = asTrimmedString(body?.targetUserId);
    const normalizedAction = asTrimmedString(body?.action).toUpperCase();

    if (!UUID_RE.test(targetUserId)) {
      return json({ ok: false, code: "INVALID_TARGET_USER_ID" }, 400);
    }

    if (!ACTIONS.has(normalizedAction as LifecycleAction)) {
      return json({ ok: false, code: "INVALID_ACTION" }, 400);
    }

    const action = normalizedAction as LifecycleAction;
    const userClaims = asRecord(ctx.userClaims);
    const jwtClaims = asRecord(ctx.jwtClaims);
    const actorUserId = asTrimmedString(userClaims?.id);
    const actorSessionId = asTrimmedString(jwtClaims?.session_id);

    if (!UUID_RE.test(actorUserId) || !UUID_RE.test(actorSessionId)) {
      return json({ ok: false, code: "AUTH_CLAIMS_INVALID" }, 401);
    }

    if (actorUserId === targetUserId) {
      return json({ ok: false, code: "SELF_ACTION_BLOCKED" }, 403);
    }

    if (
      action === "HARD_DELETE" &&
      asTrimmedString(body?.confirmation) !== `HARD_DELETE:${targetUserId}`
    ) {
      return json({ ok: false, code: "HARD_DELETE_CONFIRMATION_REQUIRED" }, 400);
    }
    if (action === "APPROVE") {
      const { data: approvalData, error: approvalError } =
        await ctx.supabaseAdmin.rpc("genesis_account_lifecycle_approve_coach", {
          p_actor_user_id: actorUserId,
          p_actor_session_id: actorSessionId,
          p_target_user_id: targetUserId,
          p_ip_address: requestIp(req),
        });

      if (approvalError) {
        console.error("Genesis lifecycle approval error", {
          code: approvalError.code,
          message: approvalError.message,
        });

        return json(
          { ok: false, code: "APPROVAL_EXECUTION_FAILED", retryable: true },
          503,
        );
      }

      const approval = asRecord(approvalData);
      const approvalCode =
        asTrimmedString(approval?.code) || "APPROVAL_RESPONSE_INVALID";

      if (approval?.allowed !== true) {
        return json(
          { ok: false, code: approvalCode },
          statusForCode(approvalCode),
        );
      }

      return json({
        ok: true,
        code: "OK",
        action,
        targetUserId,
        targetStatus: asTrimmedString(approval.target_status) || null,
      });
    }
    const { data: preflightData, error: preflightError } =
      await ctx.supabaseAdmin.rpc("genesis_account_lifecycle_preflight", {
        p_actor_user_id: actorUserId,
        p_actor_session_id: actorSessionId,
        p_target_user_id: targetUserId,
        p_action: action,
      });

    if (preflightError) {
      console.error("Genesis lifecycle preflight error", {
        code: preflightError.code,
        message: preflightError.message,
      });

      return json(
        { ok: false, code: "PREFLIGHT_UNAVAILABLE", retryable: true },
        503,
      );
    }

    const preflightRecord = asRecord(preflightData);

    if (!preflightRecord) {
      return json(
        { ok: false, code: "PREFLIGHT_RESPONSE_INVALID", retryable: true },
        503,
      );
    }

    const preflight = safePreflight(preflightRecord);

    if (!preflight.allowed) {
      return json(
        { ok: false, ...preflight },
        statusForCode(preflight.code),
      );
    }

    const ipAddress = requestIp(req);

    if (action === "SUSPEND" || action === "REACTIVATE") {
      const { data: executionData, error: executionError } =
        await ctx.supabaseAdmin.rpc("genesis_account_lifecycle_apply_status", {
          p_actor_user_id: actorUserId,
          p_actor_session_id: actorSessionId,
          p_target_user_id: targetUserId,
          p_action: action,
          p_ip_address: ipAddress,
        });

      if (executionError) {
        console.error("Genesis lifecycle status execution error", {
          code: executionError.code,
          message: executionError.message,
        });

        return json(
          { ok: false, code: "STATUS_EXECUTION_FAILED", retryable: true },
          503,
        );
      }

      const execution = asRecord(executionData);
      const executionCode = asTrimmedString(execution?.code) || "EXECUTION_RESPONSE_INVALID";

      if (execution?.allowed !== true) {
        return json(
          { ok: false, code: executionCode },
          statusForCode(executionCode),
        );
      }

      return json({
        ok: true,
        code: "OK",
        action,
        targetUserId,
        targetStatus: asTrimmedString(execution.target_status) || null,
        sessionsRevoked:
          typeof execution.sessions_revoked === "number"
            ? execution.sessions_revoked
            : 0,
      });
    }

    const { data: beginData, error: beginError } =
      await ctx.supabaseAdmin.rpc("genesis_account_lifecycle_begin_hard_delete", {
        p_actor_user_id: actorUserId,
        p_actor_session_id: actorSessionId,
        p_target_user_id: targetUserId,
        p_ip_address: ipAddress,
      });

    if (beginError) {
      console.error("Genesis lifecycle hard-delete preparation error", {
        code: beginError.code,
        message: beginError.message,
      });

      return json(
        { ok: false, code: "HARD_DELETE_PREPARATION_FAILED", retryable: true },
        503,
      );
    }

    const begin = asRecord(beginData);
    const beginCode = asTrimmedString(begin?.code) || "PREPARATION_RESPONSE_INVALID";

    if (begin?.allowed !== true) {
      return json(
        { ok: false, code: beginCode },
        statusForCode(beginCode),
      );
    }

    const storageObjects = parseStorageObjects(begin.storage_objects);

    if (!storageObjects) {
      return json(
        {
          ok: false,
          code: "STORAGE_INVENTORY_INVALID",
          retryable: true,
          targetStatus: "SUSPENDED",
        },
        503,
      );
    }

    const objectsByBucket = new Map<string, string[]>();

    for (const object of storageObjects) {
      const names = objectsByBucket.get(object.bucketId) ?? [];
      names.push(object.name);
      objectsByBucket.set(object.bucketId, names);
    }

    for (const [bucketId, names] of objectsByBucket) {
      for (let offset = 0; offset < names.length; offset += STORAGE_BATCH_SIZE) {
        const batch = names.slice(offset, offset + STORAGE_BATCH_SIZE);
        const { error: storageError } = await ctx.supabaseAdmin.storage
          .from(bucketId)
          .remove(batch);

        if (storageError) {
          console.error("Genesis lifecycle storage cleanup error", {
            bucketId,
            code: storageError.name,
            message: storageError.message,
          });

          return json(
            {
              ok: false,
              code: "STORAGE_CLEANUP_FAILED",
              retryable: true,
              targetStatus: "SUSPENDED",
            },
            502,
          );
        }
      }
    }

    const { error: chatCleanupError } = await ctx.supabaseAdmin
      .from("chat_messages")
      .delete()
      .or(`sender_id.eq.${targetUserId},recipient_id.eq.${targetUserId}`);

    if (chatCleanupError) {
      console.error("Genesis lifecycle chat cleanup error", {
        code: chatCleanupError.code,
        message: chatCleanupError.message,
      });

      return json(
        {
          ok: false,
          code: "DATABASE_CLEANUP_FAILED",
          retryable: true,
          targetStatus: "SUSPENDED",
        },
        502,
      );
    }

    const { error: deleteUserError } =
      await ctx.supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteUserError) {
      console.error("Genesis lifecycle Auth deletion error", {
        status: deleteUserError.status,
        message: deleteUserError.message,
      });

      return json(
        {
          ok: false,
          code: "AUTH_DELETE_FAILED",
          retryable: true,
          targetStatus: "SUSPENDED",
        },
        502,
      );
    }

    const { error: completionAuditError } = await ctx.supabaseAdmin
      .from("audit_logs")
      .insert({
        user_id: actorUserId,
        role: "SUPER_ADMIN",
        event_type: "ACCOUNT_HARD_DELETE_COMPLETED",
        details: JSON.stringify({
          target_user_id: targetUserId,
          storage_objects_deleted: storageObjects.length,
        }),
        ip_address: ipAddress,
      });

    if (completionAuditError) {
      console.error("Genesis lifecycle completion audit error", {
        code: completionAuditError.code,
        message: completionAuditError.message,
      });
    }

    return json({
      ok: true,
      code: "OK",
      action,
      targetUserId,
      deleted: true,
      storageObjectsDeleted: storageObjects.length,
      completionAuditRecorded: !completionAuditError,
    });
  }),
};
