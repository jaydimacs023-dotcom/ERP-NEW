// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateErpRequest } from "../_shared/erp-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, data: any) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const WRITE_ROLES = new Set(["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AP_SPECIALIST", "AP_SUPERVISOR", "AP_CLERK"]);
const POST_ROLES = new Set(["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AP_SPECIALIST", "AP_SUPERVISOR"]);
const VIEW_ROLES = new Set([...WRITE_ROLES, "PRESIDENT", "TREASURY", "AUDITOR"]);
const memoValues = (input: any) => ({
  memo_type: String(input.memoType ?? input.memo_type ?? "").toUpperCase(),
  payable_id: String(input.payableId ?? input.payable_id ?? ""),
  vendor_id: String(input.vendorId ?? input.vendor_id ?? ""),
  memo_date: String(input.memoDate ?? input.memo_date ?? ""),
  amount: Number(input.amount),
  reason: String(input.reason ?? "").trim(),
  reference: String(input.reference ?? "").trim() || null,
  adjustment_account_id: String(input.adjustmentAccountId ?? input.adjustment_account_id ?? ""),
});

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "AP memo function is not fully configured" });
  const actor = await authenticateErpRequest(request, admin);
  if (!actor) return json(401, { error: "Invalid, expired, or unlinked Supabase session" });
  const user = { id: actor.id, org_id: actor.orgId, role: actor.role };
  const body = await request.json().catch(() => ({}));
  const role = String(user.role || "").toUpperCase();
  if (!VIEW_ROLES.has(role)) return json(403, { error: "This role cannot access AP memos" });
  const orgId = role === "SYSTEM_ADMIN" ? String(body.orgId || body.org_id || "") : String(user.org_id || "");
  if (!orgId) return json(403, { error: "Missing organization scope" });

  if (body.action === "list") {
    const { data, error } = await admin.from("ap_memos").select("*").eq("org_id", orgId).eq("is_deleted", false)
      .order("memo_date", { ascending: false }).order("created_at", { ascending: false });
    return error ? json(400, { error: error.message, code: error.code }) : json(200, { memos: data || [] });
  }
  if (!WRITE_ROLES.has(role)) return json(403, { error: "This role has read-only AP memo access" });

  if (body.action === "next_number") {
    const { data, error } = await admin.rpc("next_ap_memo_number", {
      p_org_id: orgId, p_memo_type: body.memoType, p_memo_date: body.memoDate, p_actor_id: actor.id,
    });
    return error ? json(400, { error: error.message, code: error.code }) : json(200, { memoNumber: data });
  }
  if (body.action === "create") {
    const values = memoValues(body.memo || {});
    if (!["CREDIT", "DEBIT"].includes(values.memo_type) || !values.payable_id || !values.vendor_id ||
      !values.memo_date || !(values.amount > 0) || !values.reason || !values.adjustment_account_id) {
      return json(400, { error: "Type, approved bill, date, amount, reason, and adjustment account are required" });
    }
    const { data, error } = await admin.rpc("create_ap_memo", {
      p_org_id: orgId, p_memo_type: values.memo_type, p_payable_id: values.payable_id,
      p_vendor_id: values.vendor_id, p_memo_date: values.memo_date, p_amount: values.amount,
      p_reason: values.reason, p_reference: values.reference || "", p_adjustment_account_id: values.adjustment_account_id,
      p_actor_id: actor.id,
    });
    return error ? json(400, { error: error.message, code: error.code }) : json(200, { memo: data });
  }

  const id = String(body.id || "");
  if (!id) return json(400, { error: "Memo id is required" });
  const { data: existing } = await admin.from("ap_memos").select("id,status").eq("id", id).eq("org_id", orgId).eq("is_deleted", false).maybeSingle();
  if (!existing) return json(404, { error: "AP memo not found" });
  if (body.action === "update") {
    if (existing.status !== "DRAFT") return json(409, { error: "Only a draft memo can be edited" });
    const values = memoValues(body.updates || {});
    const { data, error } = await admin.from("ap_memos").update({ ...values, updated_by: actor.id, updated_at: new Date().toISOString() })
      .eq("id", id).eq("org_id", orgId).eq("status", "DRAFT").select("*").single();
    return error ? json(400, { error: error.message, code: error.code }) : json(200, { memo: data });
  }
  if (body.action === "delete") {
    if (existing.status !== "DRAFT") return json(409, { error: "Only a draft memo can be deleted" });
    const { error } = await admin.from("ap_memos").update({
      is_deleted: true, deleted_by: actor.id, deleted_at: new Date().toISOString(), updated_by: actor.id, updated_at: new Date().toISOString(),
    }).eq("id", id).eq("org_id", orgId).eq("status", "DRAFT");
    return error ? json(400, { error: error.message, code: error.code }) : json(200, { success: true });
  }

  const rpcByAction: Record<string, { name: string; requiresPostRole?: boolean; reason?: boolean }> = {
    submit: { name: "submit_ap_memo" },
    post: { name: "post_ap_memo", requiresPostRole: true },
    reverse: { name: "reverse_ap_memo", requiresPostRole: true, reason: true },
    cancel: { name: "cancel_ap_memo", reason: true },
  };
  const rpc = rpcByAction[body.action];
  if (!rpc) return json(400, { error: "Unsupported action" });
  if (rpc.requiresPostRole && !POST_ROLES.has(role)) return json(403, { error: "This role cannot post or reverse AP memos" });
  const args: Record<string, unknown> = { p_memo_id: id, p_actor_id: actor.id };
  if (rpc.reason) args.p_reason = String(body.reason || "");
  const { data, error } = await admin.rpc(rpc.name, args);
  return error ? json(400, { error: error.message, code: error.code }) : json(200, { result: data });
});
