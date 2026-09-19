// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateErpRequest } from "../_shared/erp-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}


const allowedRoles = new Set([
  "SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AR_SPECIALIST",
]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: "Journal voucher function secrets are not configured" });
  }

  const actor = await authenticateErpRequest(request, admin);
  if (!actor) return json(401, { error: "Invalid, expired, or unlinked Supabase session" });
  if (!allowedRoles.has(actor.role)) return json(403, { error: "Journal voucher access is not permitted" });

  const body = await request.json().catch(() => ({}));
  const orgId = actor.role === "SYSTEM_ADMIN" ? String(body.orgId || body.org_id || "") : actor.orgId;
  if (!orgId) return json(403, { error: "Missing organization scope" });

  if (body.action === "list") {
    const { data, error } = await admin.from("journal_vouchers").select("*")
      .eq("org_id", orgId).order("journal_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { vouchers: data || [] });
  }

  const id = String(body.id || "");

  if (body.action === "lines") {
    const { data: voucher } = await admin.from("journal_vouchers").select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
    if (!voucher) return json(404, { error: "Journal voucher not found" });
    const { data, error } = await admin.from("journal_voucher_lines").select("*")
      .eq("journal_voucher_id", id).order("created_at");
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { lines: data || [] });
  }

  if (body.action === "create") {
    const voucher = body.voucher || {};
    const { data, error } = await admin.from("journal_vouchers").insert({
      ...voucher,
      org_id: orgId,
      company_id: orgId,
      prepared_by: actor.id,
      status: "ON_HOLD",
    }).select("*").single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { voucher: data });
  }

  if (!id) return json(400, { error: "Journal voucher id is required" });

  if (body.action === "update") {
    const updates = body.updates || {};
    for (const field of ["id", "org_id", "jv_number", "status", "gl_reference", "posted_by", "posted_at", "prepared_by"]) {
      delete updates[field];
    }
    const { data, error } = await admin.from("journal_vouchers").update(updates)
      .eq("id", id).eq("org_id", orgId).eq("status", "ON_HOLD").select("*").single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { voucher: data });
  }

  if (body.action === "replace_lines") {
    const { data: voucher } = await admin.from("journal_vouchers").select("id")
      .eq("id", id).eq("org_id", orgId).eq("status", "ON_HOLD").maybeSingle();
    if (!voucher) return json(400, { error: "Only On Hold vouchers may be edited" });
    const { data, error } = await admin.rpc("replace_journal_voucher_lines", {
      p_voucher_id: id,
      p_lines: body.lines || [],
    });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { lines: data || [] });
  }

  if (body.action === "delete") {
    const { error } = await admin.from("journal_vouchers").delete()
      .eq("id", id).eq("org_id", orgId).eq("status", "ON_HOLD");
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { success: true });
  }

  if (body.action === "post") {
    const { data: voucher } = await admin.from("journal_vouchers").select("id")
      .eq("id", id).eq("org_id", orgId).maybeSingle();
    if (!voucher) return json(404, { error: "Journal voucher not found" });
    const { data, error } = await admin.rpc("post_journal_voucher", {
      p_voucher_id: id,
      p_posted_by: actor.id,
    });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { voucher: data });
  }

  return json(400, { error: "Unsupported action" });
});
