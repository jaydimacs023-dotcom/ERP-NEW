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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

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
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function bytesToB64Url(bytes: Uint8Array): string {
  let value = "";
  bytes.forEach((byte) => (value += String.fromCharCode(byte)));
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyHs256Jwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
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

function requestedOrgId(actor: JwtPayload, body: any): string {
  const ownOrgId = actorOrgId(actor);
  if (actorRole(actor) !== "SYSTEM_ADMIN") return ownOrgId;
  return String(body.orgId || body.org_id || ownOrgId || "");
}

function warehouseValues(input: any) {
  return {
    code: String(input.code || "").trim(),
    name: String(input.name || "").trim(),
    address: String(input.address || "").trim() || null,
    description: String(input.description || "").trim() || null,
    is_active: input.isActive ?? input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!AT_ERP_JWT_SECRET) {
    return json(500, { error: "AT_ERP_JWT_SECRET is not configured" });
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const actor = token ? await verifyHs256Jwt(token, AT_ERP_JWT_SECRET) : null;
  if (!actor) return json(401, { error: "Invalid or expired application token" });

  const body = await request.json().catch(() => ({}));
  const orgId = requestedOrgId(actor, body);
  if (!orgId) return json(403, { error: "Missing organization scope" });

  if (body.action === "list") {
    const { data, error } = await admin
      .from("warehouse_locations")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_deleted", false)
      .order("code");
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { locations: data || [] });
  }

  if (body.action === "create") {
    const values = warehouseValues(body.location || {});
    if (!values.code || !values.name || !values.address) {
      return json(400, { error: "Code, name, and address are required" });
    }
    const { data, error } = await admin
      .from("warehouse_locations")
      .insert({ ...values, org_id: orgId, is_deleted: false })
      .select("*")
      .single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { location: data });
  }

  const id = String(body.id || "");
  if (!id) return json(400, { error: "Warehouse location id is required" });

  if (body.action === "update") {
    const values = warehouseValues(body.updates || {});
    if (!values.code || !values.name || !values.address) {
      return json(400, { error: "Code, name, and address are required" });
    }
    const { data, error } = await admin
      .from("warehouse_locations")
      .update(values)
      .eq("id", id)
      .eq("org_id", orgId)
      .eq("is_deleted", false)
      .select("*")
      .single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { location: data });
  }

  if (body.action === "delete") {
    const { data, error } = await admin
      .from("warehouse_locations")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: actor.sub,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .eq("is_deleted", false)
      .select("id")
      .single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { success: true, id: data.id });
  }

  return json(400, { error: "Unsupported action" });
});
