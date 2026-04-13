import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { code } = body;

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.errors) {
      return Response.json({ error: 'Token exchange failed', details: tokenData }, { status: 400 });
    }

    // Save tokens to the athlete's profile
    const profiles = await base44.asServiceRole.entities.AthleteProfile.filter({ created_by: user.email });
    if (profiles.length > 0) {
      await base44.asServiceRole.entities.AthleteProfile.update(profiles[0].id, {
        strava_connected: true,
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expires_at: tokenData.expires_at,
        strava_athlete_id: String(tokenData.athlete?.id || ''),
      });
    }

    return Response.json({ success: true, athlete: tokenData.athlete });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});