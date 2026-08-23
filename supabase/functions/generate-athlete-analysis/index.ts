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
  }>
  error?: {
    message?: string
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GEMINI_MODEL = 'gemini-3.7-flash'
const MAX_GEMINI_ATTEMPTS = 3
const RETRYABLE_GEMINI_STATUSES = new Set([408, 429, 500, 502, 503, 504])

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

      const compliancePromise = athlete.user_id
        ? ctx.supabaseAdmin
          .from('daily_logs')
          .select('log_date, compliance_score')
          .eq('user_id', athlete.user_id)
          .gte('log_date', sinceDate)
          .order('log_date', { ascending: true })
        : Promise.resolve({ data: [], error: null })

      const [metricsResult, complianceResult] = await Promise.all([
        metricsPromise,
        compliancePromise,
      ])

      if (metricsResult.error) {
        console.error('Genesis AI metrics query error', metricsResult.error)
      }

      if (complianceResult.error) {
        console.error('Genesis AI compliance query error', complianceResult.error)
      }

      const metrics = metricsResult.data ?? []
      const complianceLogs = complianceResult.data ?? []

      const avgSleep = average(metrics.map((row) => row.sleep_hours))
      const avgHrv = average(metrics.map((row) => row.hrv))
      const avgRhr = average(metrics.map((row) => row.rhr))
      const avgSteps = average(metrics.map((row) => row.steps))
      const avgCompliance = average(complianceLogs.map((row) => row.compliance_score))

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
        'No uses markdown, asteriscos, tablas ni bloques de código.',
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
        `TELEMETRÍA DE LOS ÚLTIMOS 7 DÍAS (desde ${sinceDate})`,
        `Días con telemetría: ${metrics.length}`,
        `Sueño promedio: ${formatMetric(avgSleep, ' h')}`,
        `HRV promedio: ${formatMetric(avgHrv, ' ms')}`,
        `RHR promedio: ${formatMetric(avgRhr, ' bpm')}`,
        `Pasos promedio: ${formatMetric(avgSteps)}`,
        `Días con cumplimiento registrado: ${complianceLogs.length}`,
        `Cumplimiento promedio: ${formatMetric(avgCompliance, '%')}`,
        '',
        'Prioriza patrones y tendencias sobre valores aislados. Si no hay suficientes días de telemetría, dilo expresamente.',
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

      for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
        try {
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
                  temperature: 0.25,
                  maxOutputTokens: 700,
                },
              }),
            },
          )

          providerStatus = geminiResponse.status
          geminiData = await geminiResponse.json().catch(() => ({})) as GeminiPayload

          if (geminiResponse.ok) {
            break
          }

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

      const analysis = geminiData?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text ?? '')
        .join('')
        .trim()

      if (!analysis) {
        console.error('Gemini returned no usable content', {
          providerStatus,
        })

        return Response.json(
          { error: 'AI provider returned no usable content' },
          { status: 502 },
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
          auditorVersion: '2.0',
          model: GEMINI_MODEL,
          telemetryDays: metrics.length,
          complianceDays: complianceLogs.length,
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
