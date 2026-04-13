// src/lib/workoutPrescriber.js
import { calculateZones, getSessionIntensityModifier } from './trainingZones';
import { base44 } from '@/api/base44Client';

export async function generateWorkoutPrescription(workout, profile, todayMetrics, recentMetrics, recentActivities) {
  if (!workout || !profile) return null;

  const zones = calculateZones(profile);
  const hrv14Day = recentMetrics && recentMetrics.length > 0
    ? recentMetrics.slice(0, 14).filter(m => m.hrv).reduce((s, m, _, a) => s + (m.hrv || 0) / a.length, 0)
    : todayMetrics?.hrv || 50;
  
  const modifier = getSessionIntensityModifier(
    todayMetrics?.readiness_score || 50,
    todayMetrics?.tsb || 0,
    todayMetrics?.hrv,
    hrv14Day
  );

  const adjustedDuration = Math.round((workout.duration_minutes || 60) * modifier.modifier);
  const last7TSS = recentActivities && recentActivities.length > 0
    ? recentActivities.slice(0, 7).reduce((s, a) => s + (a.training_stress_score || a.tss || 0), 0)
    : 0;

  const sportZones = {
    bike: zones.bike ? `FTP: ${zones.bike.ftp}W
Cycling power zones:
- Z1 Recovery: 0-${zones.bike.z1.max}W
- Z2 Endurance: ${zones.bike.z2.min}-${zones.bike.z2.max}W
- Z3 Tempo: ${zones.bike.z3.min}-${zones.bike.z3.max}W
- Z4 Threshold: ${zones.bike.z4.min}-${zones.bike.z4.max}W
- Z5 VO2Max: ${zones.bike.z5.min}-${zones.bike.z5.max}W` : '',
    run: zones.run ? `Threshold run pace: ${zones.run.threshold}
Running pace zones:
- Z1 Recovery: ${zones.run.z1.pace}
- Z2 Endurance: ${zones.run.z2.pace}
- Z3 Tempo: ${zones.run.z3.pace}
- Z4 Threshold: ${zones.run.z4.pace}
- Z5 VO2Max: ${zones.run.z5.pace}` : '',
    swim: zones.swim ? `CSS: ${zones.swim.css}
Swim pace zones:
- Z1 Recovery: ${zones.swim.z1.pace}
- Z2 Endurance: ${zones.swim.z2.pace}
- Z3 Tempo: ${zones.swim.z3.pace}
- Z4 CSS: ${zones.swim.z4.pace}` : '',
  };

  const prompt = `You are an elite endurance coach writing a complete structured workout prescription for a triathlete.

ATHLETE ZONES:
${sportZones[workout.sport] || 'Sport zones not calculated yet'}

Heart rate zones (all sports):
${zones.hrZones ? `- Z1: <${zones.hrZones.z1.max}bpm
- Z2: ${zones.hrZones.z2.min}-${zones.hrZones.z2.max}bpm
- Z3: ${zones.hrZones.z3.min}-${zones.hrZones.z3.max}bpm
- Z4: ${zones.hrZones.z4.min}-${zones.hrZones.z4.max}bpm
- Z5: ${zones.hrZones.z5.min}bpm+` : 'Heart rate zones not calculated'}

TODAY'S READINESS DATA:
- Readiness: ${todayMetrics?.readiness_score || '?'}/100
- HRV: ${todayMetrics?.hrv || '?'}ms (14-day avg: ${Math.round(hrv14Day)}ms)
- TSB (Form): ${todayMetrics?.tsb || '?'}
- Sleep: ${todayMetrics?.sleep_hours || '?'}h (${todayMetrics?.sleep_quality || '?'})
- Body Battery: ${todayMetrics?.body_battery || '?'}/100
- Last 7-day TSS: ${last7TSS}
- Intensity recommendation: ${modifier.label} (${Math.round(modifier.modifier * 100)}% of planned)

PLANNED SESSION:
Sport: ${workout.sport}
Original duration: ${workout.duration_minutes} minutes
Adjusted duration based on readiness: ${adjustedDuration} minutes
Intensity: ${workout.intensity}
Title: ${workout.title}
Description: ${workout.description || 'Not specified'}

Write a complete structured workout prescription. Include:

1. SESSION OVERVIEW (2-3 sentences: what this session achieves, why this intensity is right today)

2. READINESS ASSESSMENT (1-2 sentences referencing actual numbers: HRV, TSB, sleep)

3. FULL SESSION STRUCTURE with each block on its own line:
Format each block as: [Block name]: [duration] | [target metric] | [why/coaching note]

For cycling: include watts range AND heart rate range for each block
For running: include pace range AND heart rate range for each block  
For swimming: include pace per 100m AND heart rate for each block

4. KEY EXECUTION CUES (3 bullet points)

5. EXPECTED TSS: realistic estimate for the adjusted session

6. POST-SESSION SIGNAL: what to look for after to know recovery is working

Be specific and direct — no generic advice.`;

  try {
    const prescription = await base44.integrations.Core.InvokeLLM({ prompt });
    return {
      prescription,
      adjustedDuration,
      modifier,
      zones,
    };
  } catch (err) {
    console.error('Failed to generate prescription:', err);
    return null;
  }
}