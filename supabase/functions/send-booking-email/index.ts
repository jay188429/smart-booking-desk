import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EmailEvent = 'submitted' | 'confirmed';

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] || character);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendKey || !fromEmail) {
    return json({ error: 'Email function is not configured' }, 503);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Not authenticated' }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) return json({ error: 'Not authenticated' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { event?: EmailEvent; requestId?: string; slotId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!body.requestId || !body.event || !['submitted', 'confirmed'].includes(body.event)) {
    return json({ error: 'Invalid email event' }, 400);
  }

  const { data: requestRow, error: requestError } = await adminClient
    .from('requests')
    .select('id,customer_id,status,confirmed_slot_id')
    .eq('id', body.requestId)
    .maybeSingle();
  if (requestError || !requestRow) return json({ error: 'Request not found' }, 404);

  const isAdmin = user.app_metadata?.role === 'admin';
  if (body.event === 'submitted' && requestRow.customer_id !== user.id) return json({ error: 'Not request owner' }, 403);
  if (body.event === 'confirmed' && !isAdmin) return json({ error: 'Not authorized' }, 403);
  if (body.event === 'confirmed' && requestRow.status !== 'confirmed') return json({ error: 'Request is not confirmed' }, 409);

  const { data: customerResult, error: customerError } = await adminClient.auth.admin.getUserById(requestRow.customer_id);
  const recipient = customerResult?.user?.email;
  if (customerError || !recipient) return json({ error: 'Customer email not found' }, 422);

  const slotId = body.slotId || requestRow.confirmed_slot_id || '';
  const isConfirmation = body.event === 'confirmed';
  const subject = isConfirmation ? '[cal.dudu] 예약이 확정되었습니다' : '[cal.dudu] 예약 신청이 접수되었습니다';
  const title = isConfirmation ? '예약이 확정되었습니다' : '예약 신청이 접수되었습니다';
  const message = isConfirmation
    ? `운영자가 예약을 확정했습니다. 확정 시간: ${escapeHtml(slotId)}`
    : '희망하신 시간이 운영자에게 전달되었습니다. 확정되면 다시 안내해 드립니다.';

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipient],
      subject,
      html: `<div style="font-family:Arial,sans-serif;color:#102945"><h2>${title}</h2><p>${message}</p><p>cal.dudu 예약 페이지에서 현재 상태를 확인할 수 있습니다.</p></div>`,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    console.error('[booking-email] Resend error:', detail);
    return json({ error: 'Email provider rejected the message' }, 502);
  }

  return json({ success: true });
});
