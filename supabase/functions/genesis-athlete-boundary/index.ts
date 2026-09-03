import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type JsonRecord = Record<string, unknown>;
type AthleteBoundaryAction =
  | "RESOLVE_COACH_INVITE"
  | "COMPLETE_ONBOARDING"
  | "EVALUATE_BADGES";

type RequestBody = {
  action?: unknown;
  code?: unknown;
  athleteId?: unknown;
  fullName?: unknown;
  age?: unknown;
  weight?: unknown;
  height?: unknown;
  gender?: unknown;
  goal?: unknown;
  injuries?: unknown;
  frontPath?: unknown;
  sidePath?: unknown;
  backPath?: unknown;
  legalAccepted?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_CHARACTERS = 32_768;
const ACTIONS = new Set<AthleteBoundaryAction>([
  "RESOLVE_COACH_INVITE",
  "COMPLETE_ONBOARDING",
  "EVALUATE_BADGES",
]);
const ATHLETE_PLANS = new Set(["IGNICION", "EVOLUCION", "ELITE"]);

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const asBoundedString = (value: unknown, maxLength: number): string | null => {
  const normalized = asTrimmedString(value);
  return normalized && normalized.length <= maxLength ? normalized : null;
};

const asOptionalString = (value: unknown, maxLength: number): string | null => {
  if (value === null || value === undefined || value === "") return null;
  return asBoundedString(value, maxLength);
};

const asFiniteNumber = (
  value: unknown,
  minimum: number,
  maximum: number,
): number | null =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum
    ? value
    : null;

const asInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
): number | null => {
  const number = asFiniteNumber(value, minimum, maximum);
  return number !== null && Number.isSafeInteger(number) ? number : null;
};

const asNonnegativeInteger = (value: unknown): number | null =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0
    ? value
    : null;

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
    case "INVALID_INVITE_CODE":
    case "INVALID_ATHLETE_ID":
    case "INVALID_ONBOARDING_INPUT":
    case "LEGAL_ACCEPTANCE_REQUIRED":
    case "INVITE_CODE_REQUIRED":
    case "FULL_NAME_REQUIRED":
    case "THREE_PHOTOS_REQUIRED":
    case "ONBOARDING_PHOTO_PATHS_MUST_BE_DISTINCT":
    case "FRONT_PHOTO_PATH_OWNERSHIP_INVALID":
    case "SIDE_PHOTO_PATH_OWNERSHIP_INVALID":
    case "BACK_PHOTO_PATH_OWNERSHIP_INVALID":
    case "INVALID_FRONT_WEEK0_PHOTO_PATH":
    case "INVALID_SIDE_WEEK0_PHOTO_PATH":
    case "INVALID_BACK_WEEK0_PHOTO_PATH":
      return 400;
    case "AUTH_CLAIMS_INVALID":
    case "ACTOR_SESSION_INVALID":
    case "AUTH_REQUIRED":
      return 401;
    case "ACTOR_FORBIDDEN":
    case "ATHLETE_ACCOUNT_NOT_ACTIVE":
    case "BADGE_ACCESS_DENIED":
      return 403;
    case "INVITE_NOT_FOUND":
    case "INVALID_OR_UNAUTHORIZED_INVITE_CODE":
    case "ATHLETE_PROFILE_NOT_FOUND":
    case "BADGE_ATHLETE_PROFILE_NOT_FOUND":
      return 404;
    case "ONBOARDING_ALREADY_COMPLETED":
    case "ONBOARDING_STATE_CHANGED":
    case "ONBOARDING_EVIDENCE_OBJECT_MISSING":
      return 409;
    default:
      return 403;
  }
};

const DATABASE_ERROR_MARKERS = new Map<string, string>([
  ["AUTH_REQUIRED", "AUTH_REQUIRED"],
  ["ATHLETE_ACCOUNT_NOT_ACTIVE", "ATHLETE_ACCOUNT_NOT_ACTIVE"],
  ["ATHLETE_PROFILE_NOT_FOUND", "ATHLETE_PROFILE_NOT_FOUND"],
  ["ONBOARDING_ALREADY_COMPLETED", "ONBOARDING_ALREADY_COMPLETED"],
  ["LEGAL_ACCEPTANCE_REQUIRED", "LEGAL_ACCEPTANCE_REQUIRED"],
  ["INVITE_CODE_REQUIRED", "INVITE_CODE_REQUIRED"],
  ["FULL_NAME_REQUIRED", "FULL_NAME_REQUIRED"],
  ["THREE_PHOTOS_REQUIRED", "THREE_PHOTOS_REQUIRED"],
  [
    "ONBOARDING_PHOTO_PATHS_MUST_BE_DISTINCT",
    "ONBOARDING_PHOTO_PATHS_MUST_BE_DISTINCT",
  ],
  ["FRONT_PHOTO_PATH_OWNERSHIP_INVALID", "FRONT_PHOTO_PATH_OWNERSHIP_INVALID"],
  ["SIDE_PHOTO_PATH_OWNERSHIP_INVALID", "SIDE_PHOTO_PATH_OWNERSHIP_INVALID"],
  ["BACK_PHOTO_PATH_OWNERSHIP_INVALID", "BACK_PHOTO_PATH_OWNERSHIP_INVALID"],
  ["INVALID_FRONT_WEEK0_PHOTO_PATH", "INVALID_FRONT_WEEK0_PHOTO_PATH"],
  ["INVALID_SIDE_WEEK0_PHOTO_PATH", "INVALID_SIDE_WEEK0_PHOTO_PATH"],
  ["INVALID_BACK_WEEK0_PHOTO_PATH", "INVALID_BACK_WEEK0_PHOTO_PATH"],
  ["ONBOARDING_EVIDENCE_OBJECT_MISSING", "ONBOARDING_EVIDENCE_OBJECT_MISSING"],
  [
    "INVALID_OR_UNAUTHORIZED_INVITE_CODE",
    "INVALID_OR_UNAUTHORIZED_INVITE_CODE",
  ],
  ["ONBOARDING_STATE_CHANGED", "ONBOARDING_STATE_CHANGED"],
  ["GENESIS_BADGES: authentication required", "AUTH_REQUIRED"],
  [
    "GENESIS_BADGES: active Genesis identity required",
    "ATHLETE_ACCOUNT_NOT_ACTIVE",
  ],
  ["GENESIS_BADGES: athlete id required", "INVALID_ATHLETE_ID"],
  ["GENESIS_BADGES: athlete access denied", "BADGE_ACCESS_DENIED"],
  [
    "GENESIS_BADGES: athlete profile not found",
    "BADGE_ATHLETE_PROFILE_NOT_FOUND",
  ],
]);

const safeDatabaseErrorCode = (error: unknown): string | null => {
  const record = asRecord(error);
  const message = asTrimmedString(record?.message);

  for (const [marker, code] of DATABASE_ERROR_MARKERS) {
    if (message.includes(marker)) return code;
  }

  return null;
};

const rpcFailure = (
  action: AthleteBoundaryAction,
  error: unknown,
): Response => {
  const record = asRecord(error);
  const safeCode = safeDatabaseErrorCode(error);

  console.error("Genesis athlete boundary RPC error", {
    action,
    databaseCode: asTrimmedString(record?.code).slice(0, 64) || null,
    message: asTrimmedString(record?.message).slice(0, 256) || null,
  });

  if (safeCode) {
    return json(
      { ok: false, allowed: false, code: safeCode, action },
      statusForCode(safeCode),
    );
  }

  return json(
    {
      ok: false,
      allowed: false,
      code: "BOUNDARY_EXECUTION_FAILED",
      action,
      retryable: true,
    },
    503,
  );
};

const businessResult = (
  action: AthleteBoundaryAction,
  value: unknown,
): { result: JsonRecord } | { response: Response } => {
  const result = asRecord(value);

  if (!result) {
    return {
      response: json(
        {
          ok: false,
          allowed: false,
          code: "BOUNDARY_RESPONSE_INVALID",
          action,
          retryable: true,
        },
        502,
      ),
    };
  }

  const code = asTrimmedString(result.code) || "BOUNDARY_RESPONSE_INVALID";

  if (result.allowed !== true || code !== "OK") {
    if (code === "BOUNDARY_RESPONSE_INVALID") {
      return {
        response: json(
          {
            ok: false,
            allowed: false,
            code,
            action,
            retryable: true,
          },
          502,
        ),
      };
    }

    return {
      response: json(
        { ok: false, allowed: false, code, action },
        statusForCode(code),
      ),
    };
  }

  return { result };
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
      const rawBody = await req.text();

      if (!rawBody || rawBody.length > MAX_REQUEST_CHARACTERS) {
        return json({ ok: false, code: "INVALID_REQUEST" }, 400);
      }

      const parsedBody = asRecord(JSON.parse(rawBody));

      if (!parsedBody) {
        return json({ ok: false, code: "INVALID_REQUEST" }, 400);
      }

      body = parsedBody as RequestBody;
    } catch {
      return json({ ok: false, code: "INVALID_JSON" }, 400);
    }

    const normalizedAction = asTrimmedString(body.action).toUpperCase();

    if (!ACTIONS.has(normalizedAction as AthleteBoundaryAction)) {
      return json({ ok: false, code: "INVALID_ACTION" }, 400);
    }

    const action = normalizedAction as AthleteBoundaryAction;
    const userClaims = asRecord(ctx.userClaims);
    const jwtClaims = asRecord(ctx.jwtClaims);
    const actorUserId = asTrimmedString(userClaims?.id);
    const actorSessionId = asTrimmedString(jwtClaims?.session_id);

    if (!UUID_RE.test(actorUserId) || !UUID_RE.test(actorSessionId)) {
      return json(
        { ok: false, allowed: false, code: "AUTH_CLAIMS_INVALID", action },
        401,
      );
    }

    if (action === "RESOLVE_COACH_INVITE") {
      const code = asBoundedString(body.code, 128)?.toUpperCase() || null;

      if (!code) {
        return json(
          { ok: false, allowed: false, code: "INVALID_INVITE_CODE", action },
          400,
        );
      }

      const { data, error } = await ctx.supabaseAdmin.rpc(
        "genesis_athlete_resolve_coach_invite",
        {
          p_actor_user_id: actorUserId,
          p_actor_session_id: actorSessionId,
          p_code: code,
        },
      );

      if (error) return rpcFailure(action, error);

      const checked = businessResult(action, data);
      if ("response" in checked) return checked.response;

      const coachId = asTrimmedString(checked.result.coach_id);
      const coachUserId = asTrimmedString(checked.result.coach_user_id);
      const coachName = asOptionalString(checked.result.coach_name, 200);
      const athletePlan = asTrimmedString(checked.result.athlete_plan).toUpperCase();

      if (
        !UUID_RE.test(coachId) ||
        !UUID_RE.test(coachUserId) ||
        !ATHLETE_PLANS.has(athletePlan)
      ) {
        return json(
          {
            ok: false,
            allowed: false,
            code: "BOUNDARY_RESPONSE_INVALID",
            action,
            retryable: true,
          },
          502,
        );
      }

      return json({
        ok: true,
        allowed: true,
        code: "OK",
        action,
        coach_id: coachId,
        coach_user_id: coachUserId,
        coach_name: coachName,
        athlete_plan: athletePlan,
      });
    }

    if (action === "EVALUATE_BADGES") {
      const athleteId = asTrimmedString(body.athleteId);

      if (!UUID_RE.test(athleteId)) {
        return json(
          { ok: false, allowed: false, code: "INVALID_ATHLETE_ID", action },
          400,
        );
      }

      const { data, error } = await ctx.supabaseAdmin.rpc(
        "genesis_athlete_evaluate_badges",
        {
          p_actor_user_id: actorUserId,
          p_actor_session_id: actorSessionId,
          p_athlete_id: athleteId,
        },
      );

      if (error) return rpcFailure(action, error);

      const checked = businessResult(action, data);
      if ("response" in checked) return checked.response;

      const newBadges = asNonnegativeInteger(checked.result.new_badges);
      const totalBadges = asNonnegativeInteger(checked.result.total_badges);
      const fenix12w = checked.result.fenix_12w;

      if (
        newBadges === null ||
        totalBadges === null ||
        typeof fenix12w !== "boolean"
      ) {
        return json(
          {
            ok: false,
            allowed: false,
            code: "BOUNDARY_RESPONSE_INVALID",
            action,
            retryable: true,
          },
          502,
        );
      }

      return json({
        ok: true,
        allowed: true,
        code: "OK",
        action,
        new_badges: newBadges,
        total_badges: totalBadges,
        fenix_12w: fenix12w,
      });
    }

    const code = asBoundedString(body.code, 128)?.toUpperCase() || null;
    const fullName = asBoundedString(body.fullName, 200);
    const age = asInteger(body.age, 1, 130);
    const weight = asFiniteNumber(body.weight, 1, 1_000);
    const height = asFiniteNumber(body.height, 1, 300);
    const gender = asBoundedString(body.gender, 64);
    const goal = asBoundedString(body.goal, 2_000);
    const injuries = asOptionalString(body.injuries, 4_000);
    const frontPath = asBoundedString(body.frontPath, 1_024);
    const sidePath = asBoundedString(body.sidePath, 1_024);
    const backPath = asBoundedString(body.backPath, 1_024);
    const legalAccepted = body.legalAccepted === true;

    if (
      !code ||
      !fullName ||
      age === null ||
      weight === null ||
      height === null ||
      !gender ||
      !goal ||
      !frontPath ||
      !sidePath ||
      !backPath
    ) {
      return json(
        {
          ok: false,
          allowed: false,
          code: "INVALID_ONBOARDING_INPUT",
          action,
        },
        400,
      );
    }

    if (!legalAccepted) {
      return json(
        {
          ok: false,
          allowed: false,
          code: "LEGAL_ACCEPTANCE_REQUIRED",
          action,
        },
        400,
      );
    }

    const { data, error } = await ctx.supabaseAdmin.rpc(
      "genesis_athlete_complete_onboarding",
      {
        p_actor_user_id: actorUserId,
        p_actor_session_id: actorSessionId,
        p_code: code,
        p_full_name: fullName,
        p_age: age,
        p_weight: weight,
        p_height: height,
        p_gender: gender,
        p_goal: goal,
        p_injuries: injuries,
        p_front_url: frontPath,
        p_side_url: sidePath,
        p_back_url: backPath,
        p_legal_accepted: legalAccepted,
      },
    );

    if (error) return rpcFailure(action, error);

    const checked = businessResult(action, data);
    if ("response" in checked) return checked.response;

    const athleteId = asTrimmedString(checked.result.athlete_id);
    const coachId = asTrimmedString(checked.result.coach_id);
    const coachUserId = asTrimmedString(checked.result.coach_user_id);
    const athletePlan = asTrimmedString(checked.result.athlete_plan).toUpperCase();

    if (
      !UUID_RE.test(athleteId) ||
      !UUID_RE.test(coachId) ||
      !UUID_RE.test(coachUserId) ||
      !ATHLETE_PLANS.has(athletePlan)
    ) {
      return json(
        {
          ok: false,
          allowed: false,
          code: "BOUNDARY_RESPONSE_INVALID",
          action,
          retryable: true,
        },
        502,
      );
    }

    return json({
      ok: true,
      allowed: true,
      code: "OK",
      action,
      athlete_id: athleteId,
      coach_id: coachId,
      coach_user_id: coachUserId,
      athlete_plan: athletePlan,
    });
  }),
};
