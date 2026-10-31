// The caller supplies the authenticated client. RLS remains the authority.
export async function loadCoachSettings(client, userId) {
  if (!userId) throw new Error('No se pudo identificar la sesión del coach.');
  const profile = await client.from('coaches_profile').select('*')
    .eq('user_id', userId).single();
  if (profile.error) throw profile.error;
  if (!profile.data?.id) throw new Error('No se encontró el perfil del coach.');

  const coach = profile.data;
  const results = await Promise.all([
    client.from('super_admin_settings').select('*').eq('id', 1).maybeSingle(),
    client.from('user_preferences')
      .select('preferred_locale, preferred_unit_system, coach_admin_unit_system')
      .eq('user_id', userId).maybeSingle(),
    client.from('athletes_profile').select('id, full_name, b2c_plan, created_at')
      .eq('coach_id', coach.id).order('created_at', { ascending: true }),
    client.from('coaches_profile')
      .select('id, full_name, b2b_plan, active_clients_count, created_at')
      .eq('referred_by_coach_id', coach.id).order('created_at', { ascending: true }),
  ]);
  for (const result of results) {
    if (result.error) throw result.error;
  }
  return {
    coach,
    globalSettings: results[0].data,
    preferences: results[1].data,
    athletes: results[2].data || [],
    referredCoaches: results[3].data || [],
  };
}

export function coachRegistrationLink(origin) {
  // RegisterCoach does not consume a referral query parameter.
  return new URL('/register/coach', origin).href;
}
