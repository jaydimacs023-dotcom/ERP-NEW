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

const READ_ROLES = new Set(["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "AR_SPECIALIST", "AP_SPECIALIST", "AP_SUPERVISOR", "AUDITOR"]);
const WRITE_ROLES = new Set(["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "AR_SPECIALIST"]);

function adjustmentValues(input: any, actorId: string) {
  const type = ["PHYSICAL_COUNT", "DAMAGE", "DAMAGED", "LOST", "EXPIRED", "SHRINKAGE", "WRITEOFF", "ADJUSTMENT", "CORRECTION"].includes(input.adjustmentType)
    ? input.adjustmentType
    : "ADJUSTMENT";
  const quantity = Math.abs(Number(input.quantity ?? input.quantityChange ?? 0));
  const quantityChange = ["DAMAGE", "DAMAGED", "LOST", "EXPIRED", "SHRINKAGE", "WRITEOFF"].includes(type) ? -quantity : quantity;
  return {
    stock_item_id: String(input.stockItemId || input.stock_item_id || ""),
    warehouse_location_id: String(input.warehouseLocationId || input.warehouse_location_id || ""),
    adjustment_type: type,
    quantity_change: quantityChange,
    reason: String(input.reason || "").trim(),
    notes: String(input.notes || "").trim() || null,
    approved_by: actorId,
    approval_date: new Date().toISOString(),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const actor = await authenticateErpRequest(request, admin);
  if (!actor) return json(401, { error: "Invalid, expired, or unlinked Supabase session" });

  const body = await request.json().catch(() => ({}));
  const orgId = requestedOrgId(actor, body);
  if (!orgId) return json(403, { error: "Missing organization scope" });
  const role = actor.role;
  if (!READ_ROLES.has(role)) return json(403, { error: "Inventory access is not permitted" });
  if (!["list", "list_levels"].includes(String(body.action || "")) && !WRITE_ROLES.has(role)) {
    return json(403, { error: "Inventory adjustment posting is not permitted for this role" });
  }

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
      .from("inventory_ledger")
      .select("id,org_id,stock_item_id,warehouse_location_id,running_quantity,posting_date,created_at")
      .eq("org_id", orgId)
      .order("id", { ascending: false });
    if (error) return json(400, { error: error.message, code: error.code });
    const latest = new Map<string, any>();
    for (const row of data || []) {
      const key = `${row.stock_item_id}:${row.warehouse_location_id}`;
      if (!latest.has(key)) {
        const quantity = Number(row.running_quantity || 0);
        latest.set(key, {
          id: `ledger-${row.id}`,
          org_id: row.org_id,
          stock_item_id: row.stock_item_id,
          warehouse_location_id: row.warehouse_location_id,
          quantity_on_hand: quantity,
          quantity_reserved: 0,
          quantity_available: quantity,
          last_counted: row.posting_date,
          updated_at: row.created_at,
          is_deleted: false,
        });
      }
    }
    return json(200, { levels: [...latest.values()] });
  }

  if (body.action === "create") {
    const values = adjustmentValues(body.adjustment || {}, actor.id);
    const source = body.adjustment || {};
    const countedQuantity = Number(source.countedQuantity ?? source.counted_quantity ?? source.quantity);
    const hasValidQuantity = values.adjustment_type === "PHYSICAL_COUNT"
      ? Number.isFinite(countedQuantity) && countedQuantity >= 0
      : Boolean(values.quantity_change);
    if (!values.stock_item_id || !values.warehouse_location_id || !hasValidQuantity || !values.reason) {
      return json(400, { error: "Item, warehouse, quantity, and reason are required" });
    }
    const requestId = String(source.requestId || source.request_id || crypto.randomUUID());
    const rpcName = values.adjustment_type === "PHYSICAL_COUNT"
      ? "post_inventory_count_idempotent"
      : "post_stock_adjustment_idempotent";
    const rpcArguments = values.adjustment_type === "PHYSICAL_COUNT"
      ? {
          p_org_id: orgId,
          p_stock_item_id: values.stock_item_id,
          p_warehouse_location_id: values.warehouse_location_id,
          p_expected_quantity: Number(source.expectedQuantity ?? source.expected_quantity ?? 0),
          p_counted_quantity: Number(source.countedQuantity ?? source.counted_quantity ?? source.quantity ?? 0),
          p_posting_date: source.postingDate || source.posting_date || new Date().toISOString().slice(0, 10),
          p_reason: values.reason,
          p_notes: values.notes,
          p_actor_id: actor.id,
          p_request_id: requestId,
        }
      : {
          p_org_id: orgId,
          p_stock_item_id: values.stock_item_id,
          p_warehouse_location_id: values.warehouse_location_id,
          p_adjustment_type: values.adjustment_type,
          p_quantity: Math.abs(values.quantity_change),
          p_unit_cost: Number(source.unitCost || source.unit_cost || 0),
          p_posting_date: source.postingDate || source.posting_date || new Date().toISOString().slice(0, 10),
          p_reason: values.reason,
          p_notes: values.notes,
          p_actor_id: actor.id,
          p_request_id: requestId,
        };
    const { data: posting, error: postingError } = await admin.rpc(rpcName, rpcArguments);
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

  if (body.action === "reverse") {
    const reason = String(body.reason || "").trim();
    const reversalDate = String(body.reversalDate || body.reversal_date || "");
    if (!reason || !reversalDate) {
      return json(400, { error: "Reversal date and reason are required" });
    }
    const { data: posting, error } = await admin.rpc("reverse_inventory_adjustment", {
      p_org_id: orgId,
      p_adjustment_id: id,
      p_reversal_date: reversalDate,
      p_reason: reason,
      p_actor_id: actor.id,
    });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { reversal: posting });
  }

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
    const values = adjustmentValues(body.updates || {}, actor.id);
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
        deleted_by: actor.id,
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
