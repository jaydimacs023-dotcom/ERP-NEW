// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JwtPayload = {
  sub: string;
  orgId?: string;
  org_id?: string;
  role?: string;
  exp?: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AT_ERP_JWT_SECRET = Deno.env.get("AT_ERP_JWT_SECRET") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function b64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyHs256Jwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
    const expected = bytesToB64Url(signature);
    if (expected !== sigB64) return null;

    const payloadJson = new TextDecoder().decode(b64UrlToBytes(payloadB64));
    const payload = JSON.parse(payloadJson) as JwtPayload;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !AT_ERP_JWT_SECRET) {
    return json(401, { error: "Missing auth token or AT_ERP_JWT_SECRET" });
  }

  const payload = await verifyHs256Jwt(token, AT_ERP_JWT_SECRET);
  if (!payload?.sub) return json(401, { error: "Invalid token" });

  const actorUserId = payload.sub;
  const actorOrgId = payload.orgId || payload.org_id;
  if (!actorOrgId) return json(403, { error: "Token missing org claim" });

  const body = await req.json().catch(() => null);
  if (!body?.action) return json(400, { error: "Missing action" });

  // Action 1: create payment (draft/posted)
  if (body.action === "create_payment") {
    const payment = body.payment || {};
    if (payment.orgId !== actorOrgId) return json(403, { error: "org mismatch" });

    const insertPayload = {
      ...payment,
      org_id: actorOrgId,
      created_by: actorUserId,
      updated_by: actorUserId,
      created_at: payment.createdAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("payments")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) return json(400, { error: error.message, details: error });
    return json(200, { payment: data });
  }

  // Action 2: apply payment to invoice with strict org checks
  if (body.action === "apply_payment") {
    const { paymentId, invoiceId, amountApplied, orgId } = body;
    if (!paymentId || !invoiceId || !amountApplied || amountApplied <= 0) {
      return json(400, { error: "Invalid apply payload" });
    }
    if (orgId !== actorOrgId) return json(403, { error: "org mismatch" });

    const { data: payment, error: pErr } = await admin
      .from("payments")
      .select("id, org_id, total_applied, customer_deposit_balance")
      .eq("id", paymentId)
      .single();
    if (pErr || !payment) return json(404, { error: "Payment not found" });
    if (payment.org_id !== actorOrgId) return json(403, { error: "Cross-org payment access denied" });

    const { data: invoice, error: iErr } = await admin
      .from("invoices")
      .select("id, org_id, amount_paid, balance_due")
      .eq("id", invoiceId)
      .single();
    if (iErr || !invoice) return json(404, { error: "Invoice not found" });
    if (invoice.org_id !== actorOrgId) return json(403, { error: "Cross-org invoice access denied" });

    const now = new Date().toISOString();

    const { data: application, error: appErr } = await admin
      .from("payment_applications")
      .insert({
        payment_id: paymentId,
        invoice_id: invoiceId,
        amount_applied: amountApplied,
        is_reversed: false,
        created_at: now,
        updated_at: now,
        created_by: actorUserId,
      })
      .select("*")
      .single();
    if (appErr) return json(400, { error: appErr.message, details: appErr });

    // Optional app-managed totals (if trigger is unavailable)
    await admin
      .from("payments")
      .update({
        total_applied: Number(payment.total_applied || 0) + Number(amountApplied),
        customer_deposit_balance: Number(payment.customer_deposit_balance || 0) - Number(amountApplied),
        updated_at: now,
        updated_by: actorUserId,
      })
      .eq("id", paymentId)
      .eq("org_id", actorOrgId);

    await admin
      .from("invoices")
      .update({
        amount_paid: Number(invoice.amount_paid || 0) + Number(amountApplied),
        balance_due: Math.max(Number(invoice.balance_due || 0) - Number(amountApplied), 0),
        updated_at: now,
      })
      .eq("id", invoiceId)
      .eq("org_id", actorOrgId);

    return json(200, { application });
  }

  return json(400, { error: "Unsupported action" });
});
