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
      client_id: clientId, client_secret: clientSecret,
      refresh_token: profile.strava_refresh_token, grant_type: 'refresh_token',
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

function fmtPace(speedMs) {
  if (!speedMs || speedMs <= 0) return undefined;
  const secPerKm = 1000 / speedMs;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function deriveIntensityLevel(act, ftp) {
  if (act.weighted_average_watts && ftp) {
    const IF = act.weighted_average_watts / ftp;
    if (IF < 0.75) return 'easy';
    if (IF < 0.85) return 'moderate';
    if (IF < 0.95) return 'hard';
    return 'race_pace';
  }
  if (act.suffer_score) {
    if (act.suffer_score < 50) return 'easy';
    if (act.suffer_score < 100) return 'moderate';
    if (act.suffer_score < 150) return 'hard';
    return 'race_pace';
  }
  return undefined;
}

function calcAerobicDecoupling(act) {
  // Strava doesn't expose half-way HR directly — use heartrate_smooth or estimate
  // We'll store null and let detailed activity fetch populate this
  return undefined;
}

function mapStravaActivity(act, ftp) {
  const sportMap = {
    Run: 'run', VirtualRun: 'run',
    Ride: 'bike', VirtualRide: 'bike', EBikeRide: 'bike',
    Swim: 'swim', OpenWaterSwim: 'swim',
    WeightTraining: 'strength', Yoga: 'strength',
  };
  const sport = sportMap[act.type] || 'other';
  const durationMin = Math.round((act.elapsed_time || 0) / 60);
  const movingMin = Math.round((act.moving_time || 0) / 60);
  const distKm = act.distance ? parseFloat((act.distance / 1000).toFixed(3)) : undefined;
  const avgSpeedKph = act.average_speed ? parseFloat((act.average_speed * 3.6).toFixed(2)) : undefined;
  const maxSpeedKph = act.max_speed ? parseFloat((act.max_speed * 3.6).toFixed(2)) : undefined;

  const avgPace = sport === 'run' ? fmtPace(act.average_speed) : undefined;
  const avgPacePer100m = sport === 'swim' && act.average_speed && act.average_speed > 0
    ? parseFloat((100 / act.average_speed).toFixed(1)) : undefined;

  const np = act.weighted_average_watts ? Math.round(act.weighted_average_watts) : undefined;
  const avgPow = act.average_watts ? Math.round(act.average_watts) : undefined;
  const IF = np && ftp ? parseFloat((np / ftp).toFixed(3)) : undefined;
  const VI = np && avgPow && avgPow > 0 ? parseFloat((np / avgPow).toFixed(3)) : undefined;
  const EF = np && act.average_heartrate ? parseFloat((np / act.average_heartrate).toFixed(3)) : undefined;

  // TSS from power
  let tssCalc;
  if (IF && movingMin && ftp) {
    tssCalc = Math.round((movingMin * 60 * np * IF) / (ftp * 3600) * 100);
  }

  // Best efforts
  let bestEfforts;
  if (act.best_efforts && act.best_efforts.length > 0) {
    bestEfforts = JSON.stringify(act.best_efforts.map(e => ({
      name: e.name,
      distance: e.distance,
      elapsed_time: e.elapsed_time,
      pr_rank: e.pr_rank,
    })));
  }

  // Splits
  let splitsMetric;
  if (act.splits_metric && act.splits_metric.length > 0) {
    splitsMetric = JSON.stringify(act.splits_metric.map(s => ({
      distance: s.distance,
      elapsed_time: s.elapsed_time,
      moving_time: s.moving_time,
      average_speed: s.average_speed,
      average_heartrate: s.average_heartrate,
      elevation_difference: s.elevation_difference,
    })));
  }

  return {
    date: act.start_date_local?.split('T')[0],
    sport,
    title: act.name || `${act.type} Activity`,
    duration_minutes: durationMin,
    moving_time_minutes: movingMin,
    distance_km: distKm,
    avg_speed_kph: avgSpeedKph,
    max_speed_kph: maxSpeedKph,
    avg_hr: act.average_heartrate ? Math.round(act.average_heartrate) : undefined,
    max_hr: act.max_heartrate ? Math.round(act.max_heartrate) : undefined,
    avg_pace: avgPace,
    avg_pace_per_100m: avgPacePer100m,
    avg_power: avgPow,
    max_power_watts: act.max_watts ? Math.round(act.max_watts) : undefined,
    normalized_power: np,
    intensity_factor: IF,
    variability_index: VI,
    efficiency_factor: EF,
    training_stress_score: tssCalc,
    tss: act.suffer_score || undefined,
    suffer_score: act.suffer_score || undefined,
    avg_cadence: act.average_cadence ? Math.round(act.average_cadence) : undefined,
    calories: act.calories || undefined,
    kilojoules: act.kilojoules ? Math.round(act.kilojoules) : undefined,
    elevation_gain: act.total_elevation_gain ? Math.round(act.total_elevation_gain) : undefined,
    elevation_loss: act.elev_low !== undefined ? undefined : undefined, // not in summary
    avg_temp_celsius: act.average_temp !== undefined ? act.average_temp : undefined,
    device_name: act.device_name || undefined,
    intensity_level: deriveIntensityLevel(act, ftp),
    best_efforts: bestEfforts,
    splits_metric: splitsMetric,
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
    const ftp = profile.current_ftp || null;
    const accessToken = await refreshTokenIfNeeded(base44, profile);

    // Fetch athlete stats
    const statsRes = await fetch(`https://www.strava.com/api/v3/athletes/${profile.strava_athlete_id}/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const statsUpdate = {};
      if (stats.ytd_run_totals) {
        statsUpdate.ytd_run_distance_km = parseFloat((stats.ytd_run_totals.distance / 1000).toFixed(1));
        statsUpdate.ytd_run_time_hours = parseFloat((stats.ytd_run_totals.moving_time / 3600).toFixed(1));
      }
      if (stats.ytd_ride_totals) {
        statsUpdate.ytd_ride_distance_km = parseFloat((stats.ytd_ride_totals.distance / 1000).toFixed(1));
        statsUpdate.ytd_ride_time_hours = parseFloat((stats.ytd_ride_totals.moving_time / 3600).toFixed(1));
      }
      if (stats.ytd_swim_totals) {
        statsUpdate.ytd_swim_distance_km = parseFloat((stats.ytd_swim_totals.distance / 1000).toFixed(1));
        statsUpdate.ytd_swim_time_hours = parseFloat((stats.ytd_swim_totals.moving_time / 3600).toFixed(1));
      }
      if (Object.keys(statsUpdate).length > 0) {
        await base44.asServiceRole.entities.AthleteProfile.update(profile.id, statsUpdate);
      }
    }

    // Fetch last 80 activities
    const activitiesRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=80', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const stravaActivities = await activitiesRes.json();
    if (!Array.isArray(stravaActivities)) {
      return Response.json({ error: 'Failed to fetch activities', details: stravaActivities }, { status: 400 });
    }

    // Use user-scoped entity calls so created_by is set to the user's email
    const existing = await base44.entities.Activity.filter({ source: 'strava' });
    const existingIds = new Set(existing.map(a => a.external_id).filter(Boolean));

    const toCreate = stravaActivities
      .filter(a => !existingIds.has(String(a.id)))
      .map(a => mapStravaActivity(a, ftp));

    let created = 0;
    if (toCreate.length > 0) {
      for (let i = 0; i < toCreate.length; i += 25) {
        const chunk = toCreate.slice(i, i + 25);
        await base44.entities.Activity.bulkCreate(chunk);
        created += chunk.length;
      }
    }

    return Response.json({ synced: created, total_strava: stravaActivities.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});