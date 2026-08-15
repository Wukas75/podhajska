// Supabase Edge Function, invoked every 15 min by pg_cron (see supabase/setup_cron.sql).
// Finds batch_steps that are due and not yet notified, pushes an Expo notification
// to every registered device, then marks those steps as notified so the next
// cron run doesn't send them again.
import { withSupabase } from 'npm:@supabase/server';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

type DueStep = {
  id: string;
  batch_id: string;
  title: string;
  instruction: string | null;
  target_value: number | null;
  target_unit: string | null;
  batches: { name: string; tanks: { name: string } | null } | null;
};

type PushToken = { expo_push_token: string };

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN'); // optional, higher rate limits
    const supabase = ctx.supabaseAdmin; // bypasses RLS (service role)

    const { data: dueSteps, error: stepsError } = await supabase
      .from('batch_steps')
      .select('id, batch_id, title, instruction, target_value, target_unit, batches(name, tanks(name))')
      .eq('status', 'pending')
      .is('notified_at', null)
      .lte('due_at', new Date().toISOString())
      .returns<DueStep[]>();

    if (stepsError) {
      return Response.json({ error: stepsError.message }, { status: 500 });
    }

    if (!dueSteps || dueSteps.length === 0) {
      return Response.json({ sent: 0, steps: 0 });
    }

    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .returns<PushToken[]>();

    if (tokensError) {
      return Response.json({ error: tokensError.message }, { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      return Response.json({ sent: 0, steps: dueSteps.length, note: 'no push tokens registered' });
    }

    const messages = dueSteps.flatMap((step) =>
      tokens.map((t) => ({
        to: t.expo_push_token,
        title: `${step.batches?.tanks?.name ?? ''} ${step.batches?.name ?? ''}`.trim(),
        body: step.target_value != null ? `${step.title} (${step.target_value} ${step.target_unit ?? ''})` : step.title,
        data: { batchId: step.batch_id, batchStepId: step.id },
        channelId: 'default',
      }))
    );

    let sentCount = 0;
    for (const batch of chunk(messages, CHUNK_SIZE)) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      if (response.ok) {
        sentCount += batch.length;
      } else {
        console.error('Expo push send failed', response.status, await response.text());
      }
    }

    const notifiedIds = dueSteps.map((s) => s.id);
    const { error: updateError } = await supabase
      .from('batch_steps')
      .update({ notified_at: new Date().toISOString() })
      .in('id', notifiedIds);

    if (updateError) {
      return Response.json({ error: updateError.message, sent: sentCount }, { status: 500 });
    }

    return Response.json({ sent: sentCount, steps: notifiedIds.length });
  }),
};
