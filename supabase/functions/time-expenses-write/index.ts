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

async function verifyToken(token: string): Promise<JwtPayload | null> {
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

function expenseValues(input: any) {
  const quantity = Number(input.quantity);
  const unitCost = Number(input.unitCost ?? input.unit_cost);
  return {
    rfq_code: String(input.rfqCode ?? input.rfq_code ?? "").trim(),
    transaction_date: String(input.transactionDate ?? input.transaction_date ?? ""),
    description: String(input.description ?? "").trim(),
    quantity,
    unit_cost: unitCost,
    amount: Math.round(quantity * unitCost * 100) / 100,
    expense_account_id: String(input.expenseAccountId ?? input.expense_account_id ?? ""),
    qualification_id: String(input.qualificationId ?? input.qualification_id ?? ""),
    tax_category_id: String(input.taxCategoryId ?? input.tax_category_id ?? ""),
    supplier_name: String(input.supplierName ?? input.supplier_name ?? "").trim(),
    claimed_by: String(input.claimedBy ?? input.claimed_by ?? "").trim(),
    employee_id: String(input.employeeId ?? input.employee_id ?? "").trim(),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AT_ERP_JWT_SECRET) {
    return json(500, { error: "Time expense function is not fully configured" });
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const actor = token ? await verifyToken(token) : null;
  if (!actor) return json(401, { error: "Invalid or expired application token" });

  const body = await request.json().catch(() => ({}));
  const { data: currentUser, error: userError } = await admin.from("users")
    .select("id, org_id, role, is_active").eq("id", actor.sub).maybeSingle();
  if (userError || !currentUser || currentUser.is_active === false) {
    return json(403, { error: "The logged-in user is unavailable or inactive" });
  }

  const isSystemAdmin = String(currentUser.role || "").toUpperCase() === "SYSTEM_ADMIN";
  let orgId = isSystemAdmin
    ? String(body.orgId || body.org_id || "")
    : String(currentUser.org_id || "");
  if (!orgId && isSystemAdmin && body.id) {
    const { data: existing } = await admin.from("time_expenses").select("org_id")
      .eq("id", String(body.id)).maybeSingle();
    orgId = String(existing?.org_id || "");
  }
  if (!orgId) return json(403, { error: "Missing organization scope" });

  if (body.action === "list") {
    const { data, error } = await admin.from("time_expenses").select("*")
      .eq("org_id", orgId).order("created_at", { ascending: false });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { expenses: data || [] });
  }

  if (body.action === "create") {
    const values = expenseValues(body.expense || {});
    if (!values.rfq_code || !values.transaction_date || !values.description || !values.supplier_name || !values.claimed_by || !values.employee_id || !values.expense_account_id || !values.qualification_id || !values.tax_category_id) {
      return json(400, { error: "RFQ code, date, description, supplier, claimed by, expense account, class, and tax category are required" });
    }
    if (!(values.quantity > 0) || !(values.unit_cost > 0)) {
      return json(400, { error: "Quantity and unit cost must be greater than zero" });
    }
    const { data: expenseAccount } = await admin.from("chart_of_accounts")
      .select("id").eq("id", values.expense_account_id).eq("org_id", orgId)
      .eq("class", "EXPENSE").eq("is_header", false).maybeSingle();
    if (!expenseAccount) return json(403, { error: "Expense account is outside this organization or is not a posting expense account" });
    const { data: qualification } = await admin.from("qualifications").select("id")
      .eq("id", values.qualification_id).eq("org_id", orgId).maybeSingle();
    if (!qualification) return json(403, { error: "Class is outside this organization or inactive" });
    const { data: taxCategory } = await admin.from("tax_categories").select("id")
      .eq("id", values.tax_category_id).eq("org_id", orgId).maybeSingle();
    if (!taxCategory) return json(403, { error: "Tax category is outside this organization" });
    const { data: employee } = await admin.from("users").select("id")
      .eq("id", values.employee_id).eq("org_id", orgId).neq("role", "SYSTEM_ADMIN")
      .eq("is_active", true).maybeSingle();
    if (!employee) return json(403, { error: "Claimed by employee is outside this organization or inactive" });

    const { data, error } = await admin.from("time_expenses").insert({
      ...values,
      org_id: orgId,
      status: "open",
      created_by: actor.sub,
    }).select("*").single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { expense: data });
  }

  const id = String(body.id || "");
  if (!id) return json(400, { error: "Expense id is required" });

  if (body.action === "update") {
    const isReleaseUpdate = body.updates?.status === "released";
    let allowed: Record<string, unknown>;
    if (isReleaseUpdate) {
      allowed = {
        status: "released",
        payable_id: body.updates?.payableId || body.updates?.payable_id || null,
        updated_at: new Date().toISOString(),
      };
    } else {
      const values = expenseValues(body.updates || {});
      if (!values.rfq_code || !values.transaction_date || !values.description || !values.supplier_name || !values.claimed_by || !values.employee_id || !values.expense_account_id || !values.qualification_id || !values.tax_category_id) {
        return json(400, { error: "RFQ code, date, description, supplier, claimed by, expense account, class, and tax category are required" });
      }
      if (!(values.quantity > 0) || !(values.unit_cost > 0)) {
        return json(400, { error: "Quantity and unit cost must be greater than zero" });
      }
      const { data: expenseAccount } = await admin.from("chart_of_accounts")
        .select("id").eq("id", values.expense_account_id).eq("org_id", orgId)
        .eq("class", "EXPENSE").eq("is_header", false).maybeSingle();
      if (!expenseAccount) return json(403, { error: "Expense account is outside this organization or is not a posting expense account" });
      const { data: qualification } = await admin.from("qualifications").select("id")
        .eq("id", values.qualification_id).eq("org_id", orgId).maybeSingle();
      if (!qualification) return json(403, { error: "Class is outside this organization or inactive" });
      const { data: taxCategory } = await admin.from("tax_categories").select("id")
        .eq("id", values.tax_category_id).eq("org_id", orgId).maybeSingle();
      if (!taxCategory) return json(403, { error: "Tax category is outside this organization" });
      const { data: employee } = await admin.from("users").select("id")
        .eq("id", values.employee_id).eq("org_id", orgId).neq("role", "SYSTEM_ADMIN")
        .eq("is_active", true).maybeSingle();
      if (!employee) return json(403, { error: "Claimed by employee is outside this organization or inactive" });
      allowed = { ...values, updated_at: new Date().toISOString() };
    }
    const { data, error } = await admin.from("time_expenses").update(allowed)
      .eq("id", id).eq("org_id", orgId).eq("status", "open").select("*").single();
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { expense: data });
  }

  if (body.action === "delete") {
    const { error } = await admin.from("time_expenses").delete()
      .eq("id", id).eq("org_id", orgId).eq("status", "open");
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { success: true });
  }

  return json(400, { error: "Unsupported action" });
});
