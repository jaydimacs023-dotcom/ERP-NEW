// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const jwtSecret = Deno.env.get("AT_ERP_JWT_SECRET") ?? "";
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, body: any) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const decode = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
};
const encode = (bytes: Uint8Array) => {
  let value = "";
  bytes.forEach(byte => value += String.fromCharCode(byte));
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
async function actorIdFrom(request: Request): Promise<string | null> {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const [header, payload, signature, ...extra] = token.split(".");
    if (!header || !payload || !signature || extra.length || !jwtSecret) return null;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(jwtSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
    if (encode(signed) !== signature) return null;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    return claims.sub && (!claims.exp || Date.now() / 1000 <= claims.exp) ? claims.sub : null;
  } catch { return null; }
}
const WRITE = new Set(["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AP_SPECIALIST", "AP_SUPERVISOR", "AP_CLERK"]);
const POST = new Set(["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AP_SPECIALIST", "AP_SUPERVISOR"]);
const VIEW = new Set([...WRITE, "PRESIDENT", "TREASURY", "AUDITOR"]);
const fields = (input: any) => ({
  payable_id: String(input.payableId ?? input.payable_id ?? ""),
  vendor_id: input.vendorId ?? input.vendor_id ?? null,
  reclassification_date: String(input.reclassificationDate ?? input.reclassification_date ?? ""),
  original_account_id: String(input.originalAccountId ?? input.original_account_id ?? ""),
  target_account_id: String(input.targetAccountId ?? input.target_account_id ?? ""),
  amount: Number(input.amount),
  reason: String(input.reason ?? "").trim(),
  reference: String(input.reference ?? "").trim() || null,
  department_code: String(input.departmentCode ?? input.department_code ?? "").trim() || null,
  cost_center_code: String(input.costCenterCode ?? input.cost_center_code ?? "").trim() || null,
  project_code: String(input.projectCode ?? input.project_code ?? "").trim() || null,
  branch_code: String(input.branchCode ?? input.branch_code ?? "").trim() || null,
});

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (!url || !serviceKey || !jwtSecret) return reply(500, { error: "AP reclassification function is not configured" });
  const actorId = await actorIdFrom(request);
  if (!actorId) return reply(401, { error: "Invalid or expired application token" });
  const { data: user } = await admin.from("users").select("id,org_id,role,is_active").eq("id", actorId).maybeSingle();
  if (!user || user.is_active === false) return reply(403, { error: "The logged-in user is unavailable or inactive" });
  const body = await request.json().catch(() => ({}));
  const role = String(user.role || "").toUpperCase();
  if (!VIEW.has(role)) return reply(403, { error: "This role cannot access AP reclassifications" });
  const orgId = role === "SYSTEM_ADMIN" ? String(body.orgId || body.org_id || "") : String(user.org_id || "");
  if (!orgId) return reply(403, { error: "Missing organization scope" });

  if (body.action === "list") {
    const { data, error } = await admin.from("ap_reclassifications").select("*").eq("org_id", orgId)
      .eq("is_deleted", false).order("reclassification_date", { ascending: false }).order("created_at", { ascending: false });
    return error ? reply(400, { error: error.message, code: error.code }) : reply(200, { reclassifications: data || [] });
  }
  if (!WRITE.has(role)) return reply(403, { error: "This role has read-only access" });
  if (body.action === "create") {
    const value = fields(body.reclassification || {});
    const { data, error } = await admin.rpc("create_ap_reclassification", {
      p_org_id: orgId, p_payable_id: value.payable_id, p_vendor_id: value.vendor_id,
      p_date: value.reclassification_date, p_original_account_id: value.original_account_id,
      p_target_account_id: value.target_account_id, p_amount: value.amount, p_reason: value.reason,
      p_reference: value.reference || "", p_department_code: value.department_code || "",
      p_cost_center_code: value.cost_center_code || "", p_project_code: value.project_code || "",
      p_branch_code: value.branch_code || "", p_actor_id: actorId,
    });
    return error ? reply(400, { error: error.message, code: error.code }) : reply(200, { reclassification: data });
  }

  const id = String(body.id || "");
  if (!id) return reply(400, { error: "Reclassification id is required" });
  const { data: existing } = await admin.from("ap_reclassifications").select("id,status").eq("id", id)
    .eq("org_id", orgId).eq("is_deleted", false).maybeSingle();
  if (!existing) return reply(404, { error: "AP reclassification not found" });
  if (body.action === "update") {
    if (existing.status !== "DRAFT") return reply(409, { error: "Only a draft reclassification can be edited" });
    const { data, error } = await admin.from("ap_reclassifications").update({
      ...fields(body.updates || {}), updated_by: actorId, updated_at: new Date().toISOString(),
    }).eq("id", id).eq("status", "DRAFT").select("*").single();
    if (!error) await admin.from("audit_logs").insert({
      org_id: orgId, user_id: actorId, action: "UPDATE", entity_type: "PAYABLE",
      entity_id: id, details: `Updated draft AP reclassification ${data?.reclassification_number || id}.`,
    });
    return error ? reply(400, { error: error.message, code: error.code }) : reply(200, { reclassification: data });
  }
  if (body.action === "delete") {
    if (existing.status !== "DRAFT") return reply(409, { error: "Only a draft reclassification can be deleted" });
    const { error } = await admin.from("ap_reclassifications").update({
      is_deleted: true, deleted_by: actorId, deleted_at: new Date().toISOString(),
    }).eq("id", id).eq("status", "DRAFT");
    if (!error) await admin.from("audit_logs").insert({
      org_id: orgId, user_id: actorId, action: "DELETE", entity_type: "PAYABLE",
      entity_id: id, details: "Deleted draft AP reclassification.",
    });
    return error ? reply(400, { error: error.message }) : reply(200, { success: true });
  }
  const actions: Record<string, { rpc: string; post?: boolean; reason?: boolean }> = {
    submit: { rpc: "submit_ap_reclassification" },
    post: { rpc: "post_ap_reclassification", post: true },
    reverse: { rpc: "reverse_ap_reclassification", post: true, reason: true },
    cancel: { rpc: "cancel_ap_reclassification", reason: true },
  };
  const action = actions[body.action];
  if (!action) return reply(400, { error: "Unsupported action" });
  if (action.post && !POST.has(role)) return reply(403, { error: "This role cannot post or reverse reclassifications" });
  const args: Record<string, unknown> = { p_id: id, p_actor_id: actorId };
  if (action.reason) args.p_reason = String(body.reason || "");
  const { data, error } = await admin.rpc(action.rpc, args);
  return error ? reply(400, { error: error.message, code: error.code }) : reply(200, { result: data });
});
