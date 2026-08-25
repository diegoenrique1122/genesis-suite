import { withSupabase } from 'npm:@supabase/server@^1'

type RequestBody = {
  athleteId?: string
}

type NumericLike = number | string | null | undefined

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
    finishReason?: string
  }>
  error?: {
    message?: string
  }
}

type JsonRecord = Record<string, unknown>

type ManualDisciplineLog = {
  logDate: string
  timeZone: string | null
  water: number | null
  sleep: number | null
  steps: number | null
  training: 'YES' | 'PARTIAL' | 'NO' | null
  mealStatuses: Array<'YES' | 'PARTIAL' | 'NO' | 'PENDING'>
}

type StructuredAnalysis = {
  criticalPoints: string
  training: string
  nutrition: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GEMINI_MODEL = 'gemini-3.7-flash'
const MAX_GEMINI_ATTEMPTS = 2
const OUTPUT_TOKENS_BY_ATTEMPT = [1200, 1600] as const
const RETRYABLE_GEMINI_STATUSES = new Set([408, 429, 500, 502, 503, 504])

const ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    criticalPoints: {
      type: 'string',
      description: 'Resumen breve de puntos críticos. Máximo 3 frases y solo con datos disponibles.',
    },
    training: {
      type: 'string',
      description: 'Resumen breve de entrenamiento. Máximo 3 frases y solo con datos disponibles.',
    },
    nutrition: {
      type: 'string',
      description: 'Resumen breve de nutrición y disciplina. Máximo 3 frases y solo con datos disponibles.',
    },
  },
  required: ['criticalPoints', 'training', 'nutrition'],
} as const

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const toFiniteNumber = (value: NumericLike): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const average = (values: NumericLike[]): number | null => {
  const numbers = values
    .map(toFiniteNumber)
    .filter((value): value is number => value !== null)

  if (numbers.length === 0) return null

  const result = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
  return Math.round(result * 10) / 10
}

const formatValue = (
  value: unknown,
  fallback = 'No registrado',
): string => {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text ? text : fallback
}

const formatMetric = (
  value: number | null,
  suffix = '',
): string => value === null ? 'Sin datos' : `${value}${suffix}`

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

const normalizeStatus = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null => {
  const normalized = String(value ?? '').trim().toUpperCase()
  return allowed.includes(normalized as T) ? normalized as T : null
}

const parseManualDisciplineLog = (
  logDate: unknown,
  habitsData: unknown,
): ManualDisciplineLog | null => {
  const payload = asRecord(habitsData)
  if (!payload || payload.source !== 'MANUAL_DISCIPLINE') return null

  const metrics = asRecord(payload.metrics)
  const training = asRecord(payload.training)
  const meals = Array.isArray(payload.meals) ? payload.meals : []

  const mealStatuses = meals
    .map((meal) => asRecord(meal)?.status)
    .map((status) => normalizeStatus(
      status,
      ['YES', 'PARTIAL', 'NO', 'PENDING'] as const,
    ))
    .filter((status): status is 'YES' | 'PARTIAL' | 'NO' | 'PENDING' => status !== null)

  return {
    logDate: String(logDate ?? ''),
    timeZone: typeof payload.time_zone === 'string' && payload.time_zone.trim()
      ? payload.time_zone.trim()
      : null,
    water: toFiniteNumber(metrics?.water as NumericLike),
    sleep: toFiniteNumber(metrics?.sleep as NumericLike),
    steps: toFiniteNumber(metrics?.steps as NumericLike),
    training: normalizeStatus(
      training?.completed,
      ['YES', 'PARTIAL', 'NO'] as const,
    ),
    mealStatuses,
  }
}

const countStatus = <T extends string>(
  values: Array<T | null>,
  status: T,
): number => values.filter((value) => value === status).length

const extractCandidateText = (payload: GeminiPayload | null): string => (
  payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? '')
    .join('')
    .trim() ?? ''
)

const parseStructuredAnalysis = (text: string): StructuredAnalysis | null => {
  if (!text) return null

  try {
    const parsed = JSON.parse(text) as Partial<StructuredAnalysis>

    const criticalPoints = String(parsed.criticalPoints ?? '').trim()
    const training = String(parsed.training ?? '').trim()
    const nutrition = String(parsed.nutrition ?? '').trim()

    if (
      criticalPoints.length < 12 ||
      training.length < 12 ||
      nutrition.length < 12
    ) {
      return null
    }

    return {
      criticalPoints,
      training,
      nutrition,
    }
  } catch {
    return null
  }
}

const formatAnalysisForUi = (analysis: StructuredAnalysis): string => [
  'PUNTOS CRÍTICOS:',
  analysis.criticalPoints,
  '',
  'ENTRENAMIENTO:',
  analysis.training,
  '',
  'NUTRICIÓN:',
  analysis.nutrition,
].join('\n')

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405 },
      )
    }

    try {
      const body = (await req.json()) as RequestBody
      const athleteId = body?.athleteId?.trim()

      if (!athleteId || !UUID_RE.test(athleteId)) {
        return Response.json(
          { error: 'Invalid athlete id' },
          { status: 400 },
        )
      }

      const userId = String(
        ctx.userClaims?.sub ??
        (ctx.userClaims as Record<string, unknown> | undefined)?.id ??
        '',
      )

      if (!userId) {
        return Response.json(
          { error: 'Authentication required' },
          { status: 401 },
        )
      }

      const { data: identity, error: identityError } = await ctx.supabaseAdmin
        .from('users_master')
        .select('role, account_status')
        .eq('id', userId)
        .maybeSingle()

      if (identityError || !identity) {
        return Response.json(
          { error: 'Genesis identity not found' },
          { status: 403 },
        )
      }

      if (identity.account_status !== 'ACTIVE') {
        return Response.json(
          { error: 'Active Genesis account required' },
          { status: 403 },
        )
      }

      let allowed = identity.role === 'SUPER_ADMIN'

      if (identity.role === 'COACH') {
        const { data: coach, error: coachError } = await ctx.supabaseAdmin
          .from('coaches_profile')
          .select('id, b2b_plan')
          .eq('user_id', userId)
          .maybeSingle()

        if (
          coachError ||
          !coach ||
          coach.b2b_plan !== 'ELITE'
        ) {
          return Response.json(
            { error: 'Coach Elite access required' },
            { status: 403 },
          )
        }

        const { data: assignedAthlete, error: assignmentError } = await ctx.supabaseAdmin
          .from('athletes_profile')
          .select('id')
          .eq('id', athleteId)
          .eq('coach_id', coach.id)
          .maybeSingle()

        if (assignmentError || !assignedAthlete) {
          return Response.json(
            { error: 'Athlete is not assigned to this coach' },
            { status: 403 },
          )
        }

        allowed = true
      }

      if (!allowed) {
        return Response.json(
          { error: 'Role not authorized for AI analysis' },
          { status: 403 },
        )
      }

      const { data: athlete, error: athleteError } = await ctx.supabaseAdmin
        .from('athletes_profile')
        .select('id, user_id, age, weight, height, gender, goal, injuries, b2c_plan, program_start_date')
        .eq('id', athleteId)
        .maybeSingle()

      if (athleteError || !athlete) {
        return Response.json(
          { error: 'Athlete not found' },
          { status: 404 },
        )
      }

      const since = new Date()
      since.setUTCDate(since.getUTCDate() - 6)
      const sinceDate = since.toISOString().slice(0, 10)

      const metricsPromise = ctx.supabaseAdmin
        .from('athlete_daily_metrics')
        .select('date, steps, sleep_hours, hrv, rhr')
        .eq('athlete_id', athleteId)
        .gte('date', sinceDate)
        .order('date', { ascending: true })

      const disciplinePromise = athlete.user_id
        ? ctx.supabaseAdmin
          .from('daily_logs')
          .select('log_date, compliance_score, habits_data')
          .eq('user_id', athlete.user_id)
          .gte('log_date', sinceDate)
          .order('log_date', { ascending: true })
        : Promise.resolve({ data: [], error: null })

      const [metricsResult, disciplineResult] = await Promise.all([
        metricsPromise,
        disciplinePromise,
      ])

      if (metricsResult.error) {
        console.error('Genesis AI metrics query error', metricsResult.error)
      }

      if (disciplineResult.error) {
        console.error('Genesis AI discipline query error', disciplineResult.error)
      }

      const metrics = metricsResult.data ?? []
      const disciplineLogs = disciplineResult.data ?? []

      const avgSleep = average(metrics.map((row) => row.sleep_hours))
      const avgHrv = average(metrics.map((row) => row.hrv))
      const avgRhr = average(metrics.map((row) => row.rhr))
      const avgSteps = average(metrics.map((row) => row.steps))

      const complianceScores = disciplineLogs
        .map((row) => toFiniteNumber(row.compliance_score))
        .filter((value): value is number => value !== null)
      const avgCompliance = average(complianceScores)

      const manualLogs = disciplineLogs
        .map((row) => parseManualDisciplineLog(row.log_date, row.habits_data))
        .filter((row): row is ManualDisciplineLog => row !== null)

      const avgManualWater = average(manualLogs.map((row) => row.water))
      const avgManualSleep = average(manualLogs.map((row) => row.sleep))
      const avgManualSteps = average(manualLogs.map((row) => row.steps))

      const trainingStatuses = manualLogs.map((row) => row.training)
      const mealStatuses = manualLogs.flatMap((row) => row.mealStatuses)
      const latestManualTimeZone = [...manualLogs]
        .reverse()
        .find((row) => row.timeZone)?.timeZone ?? null

      const trainingYes = countStatus(trainingStatuses, 'YES')
      const trainingPartial = countStatus(trainingStatuses, 'PARTIAL')
      const trainingNo = countStatus(trainingStatuses, 'NO')

      const mealsYes = countStatus(mealStatuses, 'YES')
      const mealsPartial = countStatus(mealStatuses, 'PARTIAL')
      const mealsNo = countStatus(mealStatuses, 'NO')
      const mealsPending = countStatus(mealStatuses, 'PENDING')

      const missingProfileFields = [
        ['edad', athlete.age],
        ['peso', athlete.weight],
        ['estatura', athlete.height],
        ['género/sexo registrado', athlete.gender],
        ['objetivo', athlete.goal],
        ['lesiones o limitaciones', athlete.injuries],
      ]
        .filter(([, value]) => value === null || value === undefined || String(value).trim() === '')
        .map(([label]) => label)

      const prompt = [
        'Actúa como Auditor IA de Genesis OS para apoyar a un coach de fitness y nutrición.',
        'Usa solo los datos proporcionados. No inventes información faltante.',
        'No diagnostiques enfermedades ni prescribas medicamentos.',
        'Mantén separadas TELEMETRÍA WEARABLE y AUTO-REPORTE MANUAL.',
        'Nunca combines pasos o sueño de ambas fuentes como una sola medición.',
        'Un compliance_score ausente significa NO EVALUADO, no 0%.',
        'Cada campo de salida debe tener máximo 3 frases breves y accionables.',
        '',
        'PERFIL',
        `Edad: ${formatValue(athlete.age)}`,
        `Peso: ${athlete.weight === null || athlete.weight === undefined ? 'No registrado' : `${athlete.weight} kg`}`,
        `Estatura: ${athlete.height === null || athlete.height === undefined ? 'No registrada' : `${athlete.height} cm`}`,
        `Género/sexo registrado: ${formatValue(athlete.gender)}`,
        `Objetivo: ${formatValue(athlete.goal)}`,
        `Lesiones o limitaciones: ${formatValue(athlete.injuries, 'No registradas')}`,
        `Plan B2C: ${formatValue(athlete.b2c_plan)}`,
        `Inicio del programa: ${formatValue(athlete.program_start_date)}`,
        '',
        `WEARABLE 7 DÍAS DESDE ${sinceDate}`,
        `Días: ${metrics.length}`,
        `Sueño: ${formatMetric(avgSleep, ' h')}`,
        `HRV: ${formatMetric(avgHrv, ' ms')}`,
        `RHR: ${formatMetric(avgRhr, ' bpm')}`,
        `Pasos: ${formatMetric(avgSteps)}`,
        '',
        `DISCIPLINA MANUAL DESDE ${sinceDate}`,
        `Días: ${manualLogs.length}`,
        `Zona horaria: ${formatValue(latestManualTimeZone, 'No disponible')}`,
        `Agua: ${formatMetric(avgManualWater, ' L')}`,
        `Sueño reportado: ${formatMetric(avgManualSleep, ' h')}`,
        `Pasos reportados: ${formatMetric(avgManualSteps)}`,
        `Entrenamiento: YES=${trainingYes}, PARTIAL=${trainingPartial}, NO=${trainingNo}`,
        `Comidas: YES=${mealsYes}, PARTIAL=${mealsPartial}, NO=${mealsNo}, PENDING=${mealsPending}`,
        `Cumplimiento formal: ${avgCompliance === null ? 'No evaluado' : `${avgCompliance}%`}`,
        '',
        'Si solo existe 1 día de datos, dilo y evita afirmar tendencias.',
      ].join('\n')

      const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

      if (!geminiApiKey) {
        return Response.json(
          { error: 'AI service is not configured' },
          { status: 503 },
        )
      }

      let geminiData: GeminiPayload | null = null
      let providerStatus: number | null = null
      let providerFinishReason: string | null = null
      let providerAttempt = 0
      let analysis = ''

      for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
        try {
          const maxOutputTokens = OUTPUT_TOKENS_BY_ATTEMPT[
            Math.min(attempt - 1, OUTPUT_TOKENS_BY_ATTEMPT.length - 1)
          ]

          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiApiKey,
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: prompt },
                    ],
                  },
                ],
                generationConfig: {
                  maxOutputTokens,
                  thinkingConfig: {
                    thinkingLevel: 'low',
                  },
                  responseMimeType: 'application/json',
                  responseSchema: ANALYSIS_RESPONSE_SCHEMA,
                },
              }),
            },
          )

          providerStatus = geminiResponse.status
          geminiData = await geminiResponse.json().catch(() => ({})) as GeminiPayload

          if (geminiResponse.ok) {
            const candidate = geminiData?.candidates?.[0]
            const candidateText = extractCandidateText(geminiData)
            const finishReason = candidate?.finishReason ?? null
            const structured = parseStructuredAnalysis(candidateText)
            const providerStoppedNormally = finishReason === null || finishReason === 'STOP'

            if (structured && providerStoppedNormally) {
              analysis = formatAnalysisForUi(structured)
              providerFinishReason = finishReason
              providerAttempt = attempt
              break
            }

            console.error('Gemini invalid structured analysis', {
              attempt,
              finishReason,
              textLength: candidateText.length,
              parsed: Boolean(structured),
              maxOutputTokens,
            })

            if (attempt === MAX_GEMINI_ATTEMPTS) {
              return Response.json(
                {
                  error: 'AI provider returned an incomplete analysis. Please retry shortly.',
                  retryable: true,
                },
                { status: 503 },
              )
            }
          } else {
            const providerMessage = String(
              geminiData?.error?.message ?? 'Unknown Gemini provider error',
            ).slice(0, 300)

            console.error('Gemini API error', {
              attempt,
              status: geminiResponse.status,
              message: providerMessage,
            })

            const retryable = RETRYABLE_GEMINI_STATUSES.has(geminiResponse.status)

            if (!retryable || attempt === MAX_GEMINI_ATTEMPTS) {
              return Response.json(
                {
                  error: retryable
                    ? 'AI service is temporarily unavailable. Please retry shortly.'
                    : 'AI provider request failed',
                  retryable,
                },
                { status: retryable ? 503 : 502 },
              )
            }
          }
        } catch (providerError) {
          console.error('Gemini network error', {
            attempt,
            message: providerError instanceof Error
              ? providerError.message
              : String(providerError),
          })

          if (attempt === MAX_GEMINI_ATTEMPTS) {
            return Response.json(
              {
                error: 'AI service is temporarily unavailable. Please retry shortly.',
                retryable: true,
              },
              { status: 503 },
            )
          }
        }

        await sleep(500)
      }

      if (!analysis) {
        console.error('Gemini returned no validated analysis', {
          providerStatus,
        })

        return Response.json(
          {
            error: 'AI provider returned no validated analysis',
            retryable: true,
          },
          { status: 503 },
        )
      }

      const { error: updateError } = await ctx.supabaseAdmin
        .from('athletes_profile')
        .update({ ai_diagnosis: analysis })
        .eq('id', athleteId)

      if (updateError) {
        console.error('Genesis AI persistence error', updateError)

        return Response.json(
          { error: 'Could not persist AI analysis' },
          { status: 500 },
        )
      }

      return Response.json({
        analysis,
        meta: {
          auditorVersion: '2.3.1',
          model: GEMINI_MODEL,
          telemetryDays: metrics.length,
          disciplineDays: manualLogs.length,
          complianceDays: complianceScores.length,
          manualTimeZone: latestManualTimeZone,
          providerFinishReason,
          providerAttempt,
          responseMode: 'structured-json',
          missingProfileFields,
        },
      })
    } catch (error) {
      console.error('generate-athlete-analysis error', error)

      return Response.json(
        { error: 'Unexpected server error' },
        { status: 500 },
      )
    }
  }),
}
