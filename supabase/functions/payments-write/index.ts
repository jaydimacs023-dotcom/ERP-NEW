// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateErpRequest } from "../_shared/erp-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const body = await req.json().catch(() => null);
  if (!body?.action) return json(400, { error: "Missing action" });

  const actor = await authenticateErpRequest(req, admin);
  if (!actor) return json(401, { error: "Invalid, expired, or unlinked Supabase session" });
  if (!["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AR_SPECIALIST", "TREASURY"].includes(actor.role)) {
    return json(403, { error: "This role cannot manage AR payments" });
  }
  const actorOrgId = actor.role === "SYSTEM_ADMIN"
    ? String(body.orgId || body.org_id || body.payment?.orgId || body.payment?.org_id || "")
    : actor.orgId;
  const actorUserId = actor.id;
  if (!actorOrgId) return json(403, { error: "Missing organization scope" });

  // Action 1: create payment (draft/posted)
  if (body.action === "create_payment") {
    const payment = body.payment || {};
    const paymentOrgId = payment.orgId || payment.org_id;
    if (paymentOrgId !== actorOrgId) return json(403, { error: "org mismatch" });

    // Generate the next payment number atomically using database function
    // This prevents race conditions when multiple concurrent requests are made
    let paymentNo = payment.paymentNo || payment.payment_no;
    if (!paymentNo) {
      // Call the database function to generate the next unique payment number
      const { data: result, error: fnError } = await admin
        .rpc("get_next_payment_no", { p_org_id: actorOrgId });
      
      if (fnError) {
        console.error("[payments-write] Error calling get_next_payment_no:", fnError);
        return json(400, { error: `Failed to generate payment number: ${fnError.message}` });
      }
      
      if (!result) {
        return json(400, { error: "Failed to generate payment number" });
      }
      
      paymentNo = result;
    }

    const normalizedPayment = camelToSnakeKeys(payment);
    const insertPayload = {
      ...normalizedPayment,
      payment_no: paymentNo,  // Use the atomically generated payment_no
      org_id: actorOrgId,
      created_by: actorUserId,
      updated_by: actorUserId,
      created_at: normalizedPayment.created_at ?? normalizedPayment.createdAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("payments")
      .insert(insertPayload)
      .select("*")
      .single();
    
    if (error) {
      // If duplicate key error despite using atomic generation, it's likely a real collision
      console.error("[payments-write] Insert error:", error);
      return json(400, { 
        error: `Failed to insert payment: ${error.message}`,
        code: error.code,
        details: error.details 
      });
    }
    
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
    const availableDepositBalance = Math.max(Number(payment.customer_deposit_balance || 0), 0);
    const appliedAmount = Number(amountApplied || 0);
    if (availableDepositBalance + 0.01 < appliedAmount) {
      return json(400, {
        error: "Payment application exceeds available unapplied customer deposit balance",
        availableDepositBalance,
        amountApplied: appliedAmount,
      });
    }
    const projectedDepositBalance = Math.max(availableDepositBalance - appliedAmount, 0);

    const { data: application, error: appErr } = await admin
      .from("payment_applications")
      .insert({
        payment_id: paymentId,
        invoice_id: invoiceId,
        amount_applied: appliedAmount,
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
        total_applied: Number(payment.total_applied || 0) + appliedAmount,
        customer_deposit_balance: projectedDepositBalance,
        updated_at: now,
        updated_by: actorUserId,
      })
      .eq("id", paymentId)
      .eq("org_id", actorOrgId);

    await admin
      .from("invoices")
      .update({
        amount_paid: Number(invoice.amount_paid || 0) + appliedAmount,
        balance_due: Math.max(Number(invoice.balance_due || 0) - appliedAmount, 0),
        updated_at: now,
      })
      .eq("id", invoiceId)
      .eq("org_id", actorOrgId);

    return json(200, { application });
  }

  return json(400, { error: "Unsupported action" });
});
