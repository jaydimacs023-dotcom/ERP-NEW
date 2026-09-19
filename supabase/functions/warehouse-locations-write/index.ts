// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateErpRequest, type ErpActor } from "../_shared/erp-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

function requestedOrgId(actor: ErpActor, body: any): string {
  if (actor.role !== "SYSTEM_ADMIN") return actor.orgId;
  return String(body.orgId || body.org_id || actor.orgId || "");
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

  const actor = await authenticateErpRequest(request, admin);
  if (!actor) return json(401, { error: "Invalid, expired, or unlinked Supabase session" });

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
        deleted_by: actor.id,
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
