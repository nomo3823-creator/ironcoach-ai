import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const body = await req.json();
    const redirectUri = body.redirect_uri;

    const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=activity:read_all,profile:read_all`;

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});