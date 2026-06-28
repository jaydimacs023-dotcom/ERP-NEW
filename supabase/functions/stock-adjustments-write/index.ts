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
    const [header, payload, signature, ...extra] = token.split(".");
    if (!header || !payload || !signature || extra.length || !AT_ERP_JWT_SECRET) return null;
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

function requestedOrgId(actor: JwtPayload, body: any): string {
  const ownOrgId = actorOrgId(actor);
  if (actorRole(actor) !== "SYSTEM_ADMIN") return ownOrgId;
  return String(body.orgId || body.org_id || ownOrgId || "");
}

function adjustmentValues(input: any, actorId: string) {
  const type = ["DAMAGE", "WRITEOFF", "ADJUSTMENT", "CORRECTION"].includes(input.adjustmentType)
    ? input.adjustmentType
    : "ADJUSTMENT";
  const quantity = Math.abs(Number(input.quantity ?? input.quantityChange ?? 0));
  const quantityChange = ["DAMAGE", "WRITEOFF"].includes(type) ? -quantity : quantity;
  const isApproved = Boolean(input.isApproved);
  return {
    stock_item_id: String(input.stockItemId || input.stock_item_id || ""),
    warehouse_location_id: String(input.warehouseLocationId || input.warehouse_location_id || ""),
    adjustment_type: type,
    quantity_change: quantityChange,
    reason: String(input.reason || "").trim(),
    notes: String(input.notes || "").trim() || null,
    approved_by: isApproved ? actorId : null,
    approval_date: isApproved ? new Date().toISOString() : null,
  };
}

function adjustmentNumber(): string {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `ADJ-${timestamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AT_ERP_JWT_SECRET) {
    return json(500, { error: "Stock adjustment function is not fully configured" });
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const actor = token ? await verifyHs256Jwt(token) : null;
  if (!actor) return json(401, { error: "Invalid or expired application token" });

  const body = await request.json().catch(() => ({}));
  const orgId = requestedOrgId(actor, body);
  if (!orgId) return json(403, { error: "Missing organization scope" });

  if (body.action === "list") {
    const { data, error } = await admin
      .from("stock_adjustments")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { adjustments: data || [] });
  }

  if (body.action === "list_levels") {
    const { data, error } = await admin
      .from("inventory_levels")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { levels: data || [] });
  }

  if (body.action === "create") {
    const values = adjustmentValues(body.adjustment || {}, actor.sub);
    if (!values.stock_item_id || !values.warehouse_location_id || !values.quantity_change || !values.reason) {
      return json(400, { error: "Item, warehouse, quantity, and reason are required" });
    }
    const source = body.adjustment || {};
    const { data: posting, error: postingError } = await admin.rpc("post_stock_adjustment", {
      p_org_id: orgId,
      p_stock_item_id: values.stock_item_id,
      p_warehouse_location_id: values.warehouse_location_id,
      p_adjustment_type: values.adjustment_type,
      p_quantity: Math.abs(values.quantity_change),
      p_unit_cost: Number(source.unitCost || source.unit_cost || 0),
      p_posting_date: source.postingDate || source.posting_date || new Date().toISOString().slice(0, 10),
      p_reason: values.reason,
      p_notes: values.notes,
      p_actor_id: actor.sub,
    });
    if (postingError) return json(400, { error: postingError.message, code: postingError.code });
    const { data, error } = await admin
      .from("stock_adjustments")
      .select("*")
      .eq("id", posting.adjustmentId)
      .single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { adjustment: data, posting });
  }

  const id = String(body.id || "");
  if (!id) return json(400, { error: "Stock adjustment id is required" });

  if (body.action === "update") {
    const { data: existing } = await admin
      .from("stock_adjustments")
      .select("approval_date")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();
    if (existing?.approval_date) {
      return json(409, { error: "Posted stock adjustments are immutable. Create a reversal instead." });
    }
    const values = adjustmentValues(body.updates || {}, actor.sub);
    if (!values.stock_item_id || !values.warehouse_location_id || !values.quantity_change || !values.reason) {
      return json(400, { error: "Item, warehouse, quantity, and reason are required" });
    }
    const { data, error } = await admin
      .from("stock_adjustments")
      .update(values)
      .eq("id", id)
      .eq("org_id", orgId)
      .eq("is_deleted", false)
      .select("*")
      .single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { adjustment: data });
  }

  if (body.action === "delete") {
    const { data: existing } = await admin
      .from("stock_adjustments")
      .select("approval_date")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();
    if (existing?.approval_date) {
      return json(409, { error: "Posted stock adjustments cannot be deleted. Create a reversal instead." });
    }
    const { data, error } = await admin
      .from("stock_adjustments")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: actor.sub,
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
