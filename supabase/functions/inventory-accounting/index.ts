// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Claims = {
  sub: string;
  role?: string;
  appRole?: string;
  app_role?: string;
  orgId?: string;
  org_id?: string;
  exp?: number;
};

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const appSecret = Deno.env.get("AT_ERP_JWT_SECRET") ?? "";
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function response(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function decodePart(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
}

function encodePart(value: Uint8Array): string {
  let binary = "";
  value.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function authenticate(request: Request): Promise<Claims | null> {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const [header, payload, signature, ...extra] = token.split(".");
    if (!header || !payload || !signature || extra.length || !appSecret) return null;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(appSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const signed = new Uint8Array(await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(`${header}.${payload}`),
    ));
    if (encodePart(signed) !== signature) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodePart(payload))) as Claims;
    if (!claims.sub || (claims.exp && claims.exp < Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

function actorOrg(claims: Claims): string {
  return String(claims.orgId || claims.org_id || "");
}

function requestedOrg(claims: Claims, body: any): string {
  const own = actorOrg(claims);
  const role = String(claims.appRole || claims.app_role || claims.role || "").toUpperCase();
  return role === "SYSTEM_ADMIN" ? String(body.orgId || own) : own;
}

function actorRole(claims: Claims): string {
  return String(claims.appRole || claims.app_role || claims.role || "").toUpperCase();
}

const READ_ROLES = new Set(["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "AR_SPECIALIST", "AP_SPECIALIST", "AP_SUPERVISOR", "AUDITOR"]);
const WRITE_ROLES = new Set(["SYSTEM_ADMIN", "ADMIN", "FINANCE_MANAGER", "AR_SPECIALIST"]);

function classValues(input: any) {
  return {
    code: String(input.code || "").trim().toUpperCase(),
    name: String(input.name || "").trim(),
    inventory_asset_account_id: input.inventoryAssetAccountId,
    cogs_account_id: input.cogsAccountId,
    adjustment_account_id: input.adjustmentAccountId,
    purchase_price_variance_account_id: input.purchasePriceVarianceAccountId || null,
    in_transit_account_id: input.inTransitAccountId || null,
    write_off_account_id: input.writeOffAccountId || null,
    opening_balance_equity_account_id: input.openingBalanceEquityAccountId || null,
    default_warehouse_id: input.defaultWarehouseId || null,
    valuation_method: input.valuationMethod || "FIFO",
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  };
}

async function validateClassReferences(orgId: string, values: any): Promise<string | null> {
  const accountIds = [
    values.inventory_asset_account_id, values.cogs_account_id, values.adjustment_account_id,
    values.purchase_price_variance_account_id, values.in_transit_account_id,
    values.write_off_account_id, values.opening_balance_equity_account_id,
  ].filter(Boolean);
  const uniqueIds = [...new Set(accountIds)];
  const { data: accounts, error } = await admin
    .from("chart_of_accounts").select("id,class,is_active,is_header,is_deleted").eq("org_id", orgId).in("id", uniqueIds);
  if (error || (accounts || []).length !== uniqueIds.length) return "One or more GL accounts are outside this organization";
  if ((accounts || []).some(account => !account.is_active || account.is_header || account.is_deleted)) {
    return "Inventory mappings require active posting accounts";
  }
  const accountClass = (id: string | null) => String((accounts || []).find(account => account.id === id)?.class || "").toUpperCase();
  if (accountClass(values.inventory_asset_account_id) !== "ASSET") return "Inventory Asset must use an Asset account";
  if (accountClass(values.cogs_account_id) !== "EXPENSE") return "Cost of Goods Sold must use an Expense account";
  if (accountClass(values.adjustment_account_id) !== "EXPENSE") return "Inventory Adjustment must use an Expense account";
  if (values.write_off_account_id && accountClass(values.write_off_account_id) !== "EXPENSE") return "Write-Off must use an Expense account";
  if (values.opening_balance_equity_account_id && accountClass(values.opening_balance_equity_account_id) !== "EQUITY") return "Opening Balance must use an Equity account";
  if (values.in_transit_account_id && accountClass(values.in_transit_account_id) !== "ASSET") return "Inventory In Transit must use an Asset account";
  if (values.default_warehouse_id) {
    const { data } = await admin.from("warehouse_locations").select("id")
      .eq("org_id", orgId).eq("id", values.default_warehouse_id).maybeSingle();
    if (!data) return "Default warehouse is outside this organization";
  }
  return null;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });
  const actor = await authenticate(request);
  if (!actor) return response(401, { error: "Invalid or expired application token" });
  const body = await request.json().catch(() => ({}));
  const orgId = requestedOrg(actor, body);
  if (!orgId) return response(403, { error: "Missing organization scope" });
  if (!READ_ROLES.has(actorRole(actor))) return response(403, { error: "Inventory accounting access is not permitted" });
  if (["save_class", "post_opening"].includes(String(body.action || "")) && !WRITE_ROLES.has(actorRole(actor))) {
    return response(403, { error: "Inventory accounting changes are not permitted for this role" });
  }

  if (body.action === "list_classes") {
    const { data, error } = await admin.from("inventory_classes").select("*")
      .eq("org_id", orgId).order("code");
    return error ? response(400, { error: error.message }) : response(200, { result: data || [] });
  }
  if (body.action === "save_class") {
    const values = classValues(body.inventoryClass || {});
    if (!values.code || !values.name || !values.inventory_asset_account_id ||
        !values.cogs_account_id || !values.adjustment_account_id) {
      return response(400, { error: "Code, name, Inventory Asset, COGS, and Adjustment accounts are required" });
    }
    const referenceError = await validateClassReferences(orgId, values);
    if (referenceError) return response(403, { error: referenceError });
    const id = body.inventoryClass?.id;
    const query = id
      ? admin.from("inventory_classes").update(values).eq("id", id).eq("org_id", orgId)
      : admin.from("inventory_classes").insert({ ...values, org_id: orgId });
    const { data, error } = await query.select("*").single();
    return error ? response(400, { error: error.message }) : response(200, { result: data });
  }
  if (body.action === "post_opening") {
    const document = body.document || {};
    const { data, error } = await admin.rpc("post_opening_inventory", {
      p_org_id: orgId,
      p_document_number: document.documentNumber,
      p_posting_date: document.postingDate,
      p_remarks: document.remarks || null,
      p_actor_id: actor.sub,
      p_lines: document.lines || [],
    });
    return error ? response(400, { error: error.message, code: error.code }) : response(200, { result: data });
  }
  if (body.action === "list_opening") {
    const { data, error } = await admin.from("opening_inventory_headers")
      .select("*,opening_inventory_lines(*)").eq("org_id", orgId).order("created_at", { ascending: false });
    return error ? response(400, { error: error.message }) : response(200, { result: data || [] });
  }
  if (body.action === "list_ledger") {
    const { data, error } = await admin.from("inventory_ledger").select("*")
      .eq("org_id", orgId).order("id", { ascending: false }).limit(2000);
    return error ? response(400, { error: error.message }) : response(200, { result: data || [] });
  }
  if (body.action === "list_transactions") {
    const [transactionsResult, ledgerResult] = await Promise.all([
      admin.from("inventory_transactions").select("*")
        .eq("org_id", orgId).eq("is_deleted", false)
        .order("created_at", { ascending: false }).limit(5000),
      admin.from("inventory_ledger").select("transaction_id,quantity_change")
        .eq("org_id", orgId).limit(5000),
    ]);
    if (transactionsResult.error) return response(400, { error: transactionsResult.error.message });
    if (ledgerResult.error) return response(400, { error: ledgerResult.error.message });
    const quantityByTransaction = new Map(
      (ledgerResult.data || []).map(row => [row.transaction_id, Number(row.quantity_change || 0)])
    );
    const result = (transactionsResult.data || []).map(transaction => ({
      ...transaction,
      quantity_change: quantityByTransaction.get(transaction.id),
    }));
    return response(200, { result });
  }
  return response(400, { error: "Unsupported action" });
});
