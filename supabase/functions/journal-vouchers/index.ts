// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JwtPayload = {
  sub: string;
  role?: string;
  appRole?: string;
  app_role?: string;
  orgId?: string;
  org_id?: string;
  exp?: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AT_ERP_JWT_SECRET = Deno.env.get("AT_ERP_JWT_SECRET") ?? "";
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

function b64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function bytesToB64Url(bytes: Uint8Array): string {
  let value = "";
  bytes.forEach((byte) => (value += String.fromCharCode(byte)));
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyHs256Jwt(token: string): Promise<JwtPayload | null> {
  try {
    const [header, payload, signature, extra] = token.split(".");
    if (!header || !payload || !signature || extra || !AT_ERP_JWT_SECRET) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(AT_ERP_JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)),
    );
    if (bytesToB64Url(signed) !== signature) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64UrlToBytes(payload))) as JwtPayload;
    if (!claims.sub || (claims.exp && Date.now() / 1000 > claims.exp)) return null;
    return claims;
  } catch {
    return null;
  }
}

function actorOrgId(actor: JwtPayload): string {
  return String(actor.orgId || actor.org_id || "");
}

function actorRole(actor: JwtPayload): string {
  return String(actor.appRole || actor.app_role || actor.role || "").toUpperCase();
}

const allowedRoles = new Set([
  "SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AR_SPECIALIST",
]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AT_ERP_JWT_SECRET) {
    return json(500, { error: "Journal voucher function secrets are not configured" });
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const actor = token ? await verifyHs256Jwt(token) : null;
  if (!actor) return json(401, { error: "Invalid or expired application token" });
  if (!allowedRoles.has(actorRole(actor))) return json(403, { error: "Journal voucher access is not permitted" });

  const body = await request.json().catch(() => ({}));
  const orgId = actorOrgId(actor);
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
      prepared_by: actor.sub,
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
      p_posted_by: actor.sub,
    });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { voucher: data });
  }

  return json(400, { error: "Unsupported action" });
});
