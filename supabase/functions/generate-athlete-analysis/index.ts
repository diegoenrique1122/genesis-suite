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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GEMINI_MODEL = 'gemini-3.7-flash'
const MAX_GEMINI_ATTEMPTS = 3
const OUTPUT_TOKENS_BY_ATTEMPT = [1600, 2400, 3200] as const
const RETRYABLE_GEMINI_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const REQUIRED_ANALYSIS_HEADERS = [
  'PUNTOS CRÍTICOS:',
  'ENTRENAMIENTO:',
  'NUTRICIÓN:',
] as const

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

const hasCompleteAnalysisStructure = (analysis: string): boolean => {
  if (!analysis) return false

  const upper = analysis.toUpperCase()
  const positions = REQUIRED_ANALYSIS_HEADERS.map((header) => upper.indexOf(header))

  if (positions.some((position) => position < 0)) return false
  if (!(positions[0] < positions[1] && positions[1] < positions[2])) return false

  const criticalContent = analysis
    .slice(positions[0] + REQUIRED_ANALYSIS_HEADERS[0].length, positions[1])
    .trim()

  const trainingContent = analysis
    .slice(positions[1] + REQUIRED_ANALYSIS_HEADERS[1].length, positions[2])
    .trim()

  const nutritionContent = analysis
    .slice(positions[2] + REQUIRED_ANALYSIS_HEADERS[2].length)
    .trim()

  return [criticalContent, trainingContent, nutritionContent]
    .every((section) => section.length >= 12)
}

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
        'Eres el Auditor IA V2 de Genesis OS para apoyo a un coach de fitness y nutrición.',
        'Usa EXCLUSIVAMENTE los datos proporcionados. No inventes ni infieras datos faltantes.',
        'No diagnostiques enfermedades, no prescribas medicamentos y no sustituyas evaluación médica.',
        'Si una señal requiere valoración clínica o los datos son insuficientes, indícalo claramente y recomienda evaluación por un profesional sanitario.',
        'Mantén separadas las fuentes: TELEMETRÍA WEARABLE y AUTO-REPORTE MANUAL nunca son la misma medición.',
        'No promedies ni fusiones pasos o sueño manuales con pasos o sueño wearable. Si difieren, descríbelo únicamente como discrepancia entre fuentes.',
        'Un compliance_score ausente significa NO EVALUADO; nunca lo interpretes como 0%.',
        'No uses markdown, asteriscos, tablas ni bloques de código.',
        'Debes completar SIEMPRE las tres secciones. No termines la respuesta antes de escribir NUTRICIÓN completa.',
        'Responde en español y en máximo 3 secciones breves con estos encabezados exactos:',
        'PUNTOS CRÍTICOS:',
        'ENTRENAMIENTO:',
        'NUTRICIÓN:',
        '',
        'PERFIL DEL ATLETA',
        `Edad: ${formatValue(athlete.age)}`,
        `Peso: ${athlete.weight === null || athlete.weight === undefined ? 'No registrado' : `${athlete.weight} kg`}`,
        `Estatura: ${athlete.height === null || athlete.height === undefined ? 'No registrada' : `${athlete.height} cm`}`,
        `Género/sexo registrado: ${formatValue(athlete.gender)}`,
        `Objetivo: ${formatValue(athlete.goal)}`,
        `Lesiones o limitaciones: ${formatValue(athlete.injuries, 'No registradas')}`,
        `Plan B2C: ${formatValue(athlete.b2c_plan)}`,
        `Inicio del programa: ${formatValue(athlete.program_start_date)}`,
        `Campos de perfil faltantes: ${missingProfileFields.length ? missingProfileFields.join(', ') : 'Ninguno de los campos principales'}`,
        '',
        `TELEMETRÍA WEARABLE DE LOS ÚLTIMOS 7 DÍAS (desde ${sinceDate})`,
        `Días con telemetría wearable: ${metrics.length}`,
        `Sueño wearable promedio: ${formatMetric(avgSleep, ' h')}`,
        `HRV wearable promedio: ${formatMetric(avgHrv, ' ms')}`,
        `RHR wearable promedio: ${formatMetric(avgRhr, ' bpm')}`,
        `Pasos wearable promedio: ${formatMetric(avgSteps)}`,
        '',
        `AUTO-REPORTE MANUAL DE DISCIPLINA (desde ${sinceDate})`,
        `Días con check-in manual: ${manualLogs.length}`,
        `Zona horaria del check-in más reciente: ${formatValue(latestManualTimeZone, 'No disponible')}`,
        `Agua reportada promedio: ${formatMetric(avgManualWater, ' L')}`,
        `Sueño reportado promedio: ${formatMetric(avgManualSleep, ' h')}`,
        `Pasos reportados promedio: ${formatMetric(avgManualSteps)}`,
        `Entrenamiento reportado: YES=${trainingYes}, PARTIAL=${trainingPartial}, NO=${trainingNo}`,
        `Comidas reportadas: YES=${mealsYes}, PARTIAL=${mealsPartial}, NO=${mealsNo}, PENDING=${mealsPending}`,
        `Días con cumplimiento formal evaluado: ${complianceScores.length}`,
        `Cumplimiento formal promedio: ${avgCompliance === null ? 'No evaluado' : `${avgCompliance}%`}`,
        '',
        'Prioriza patrones y tendencias sobre valores aislados. Si no hay suficientes días en una fuente, dilo expresamente.',
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
                  temperature: 0.2,
                  maxOutputTokens,
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
            const complete = hasCompleteAnalysisStructure(candidateText)
            const providerStoppedNormally = finishReason === null || finishReason === 'STOP'

            if (candidateText && complete && providerStoppedNormally) {
              analysis = candidateText
              providerFinishReason = finishReason
              providerAttempt = attempt
              break
            }

            console.error('Gemini incomplete analysis', {
              attempt,
              finishReason,
              textLength: candidateText.length,
              completeStructure: complete,
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

        const backoffMs = 750 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 250)
        await sleep(backoffMs)
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
          auditorVersion: '2.2',
          model: GEMINI_MODEL,
          telemetryDays: metrics.length,
          disciplineDays: manualLogs.length,
          complianceDays: complianceScores.length,
          manualTimeZone: latestManualTimeZone,
          providerFinishReason,
          providerAttempt,
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
