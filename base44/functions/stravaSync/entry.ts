import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function refreshTokenIfNeeded(base44, profile) {
  const now = Math.floor(Date.now() / 1000);
  if (profile.strava_token_expires_at && profile.strava_token_expires_at > now + 60) {
    return profile.strava_access_token;
  }

  const clientId = Deno.env.get('STRAVA_CLIENT_ID');
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: profile.strava_refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();

  await base44.asServiceRole.entities.AthleteProfile.update(profile.id, {
    strava_access_token: data.access_token,
    strava_refresh_token: data.refresh_token,
    strava_token_expires_at: data.expires_at,
  });

  return data.access_token;
}

function mapStravaActivity(act) {
  const sportMap = { Run: 'run', Ride: 'bike', Swim: 'swim', WeightTraining: 'strength' };
  const sport = sportMap[act.type] || 'other';
  const durationMin = Math.round((act.moving_time || 0) / 60);
  const distKm = act.distance ? parseFloat((act.distance / 1000).toFixed(2)) : undefined;

  let avgPace;
  if (sport === 'run' && act.average_speed && act.average_speed > 0) {
    const secPerKm = 1000 / act.average_speed;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    avgPace = `${m}:${String(s).padStart(2, '0')}`;
  }

  return {
    date: act.start_date_local?.split('T')[0],
    sport,
    title: act.name || `${act.type} Activity`,
    duration_minutes: durationMin,
    distance_km: distKm,
    avg_hr: act.average_heartrate ? Math.round(act.average_heartrate) : undefined,
    max_hr: act.max_heartrate ? Math.round(act.max_heartrate) : undefined,
    avg_pace: avgPace,
    avg_power: act.average_watts ? Math.round(act.average_watts) : undefined,
    normalized_power: act.weighted_average_watts ? Math.round(act.weighted_average_watts) : undefined,
    calories: act.calories || undefined,
    elevation_gain: act.total_elevation_gain ? Math.round(act.total_elevation_gain) : undefined,
    cadence: act.average_cadence ? Math.round(act.average_cadence) : undefined,
    tss: act.suffer_score || undefined,
    source: 'strava',
    external_id: String(act.id),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.AthleteProfile.filter({ created_by: user.email });
    if (!profiles.length || !profiles[0].strava_connected) {
      return Response.json({ error: 'Strava not connected' }, { status: 400 });
    }

    const profile = profiles[0];
    const accessToken = await refreshTokenIfNeeded(base44, profile);

    // Fetch last 60 activities
    const activitiesRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=60', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const stravaActivities = await activitiesRes.json();
    if (!Array.isArray(stravaActivities)) {
      return Response.json({ error: 'Failed to fetch activities', details: stravaActivities }, { status: 400 });
    }

    // Get existing activities to avoid duplicates
    const existing = await base44.asServiceRole.entities.Activity.filter({ created_by: user.email });
    const existingIds = new Set(existing.map(a => a.external_id).filter(Boolean));

    const toCreate = stravaActivities
      .filter(a => !existingIds.has(String(a.id)))
      .map(mapStravaActivity);

    let created = 0;
    for (const act of toCreate) {
      await base44.asServiceRole.entities.Activity.create({ ...act, created_by: user.email });
      created++;
    }

    return Response.json({ synced: created, total_strava: stravaActivities.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});