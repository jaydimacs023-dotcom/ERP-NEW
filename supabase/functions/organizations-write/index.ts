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

function camelToSnakeKeys(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => camelToSnakeKeys(item));
  if (value instanceof Date) return value;

  const result: Record<string, any> = {};
  for (const key of Object.keys(value)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = camelToSnakeKeys(value[key]);
  }
  return result;
}

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

function requireSystemAdmin(actor: ErpActor | null): Response | null {
  if (!actor?.id) {
    return json(401, { error: "Authentication required" });
  }

  if (actor.role !== "SYSTEM_ADMIN") {
    return json(403, { error: "SYSTEM_ADMIN role required" });
  }

  return null;
}

function requireOrgAdminOrSystemAdmin(actor: ErpActor | null, orgId: string): Response | null {
  if (!actor?.id) {
    return json(401, { error: "Authentication required" });
  }

  if (actor.role === "SYSTEM_ADMIN") {
    return null;
  }

  if (actor.role === "ADMIN") {
    if (!actor.orgId) {
      return json(403, { error: "ADMIN role requires org context" });
    }
    if (actor.orgId !== orgId) {
      return json(403, { error: "ADMIN may only modify their own organization" });
    }
    return null;
  }

  return json(403, { error: "ADMIN or SYSTEM_ADMIN role required" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const body = await req.json().catch(() => null);
  if (!body?.action) return json(400, { error: "Missing action" });

  const actor = await authenticateErpRequest(req, admin);

  if (body.action === "create_organization") {
    const authError = requireSystemAdmin(actor);
    if (authError) return authError;

    const organization = camelToSnakeKeys(body.organization || {});
    if (!organization.name || !organization.currency || !organization.subscription_status || !organization.plan_type) {
      return json(400, { error: "Missing required organization fields" });
    }

    const insertPayload = {
      ...organization,
      created_at: organization.created_at ?? new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("organizations")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("[organizations-write] Create error:", error);
      return json(400, {
        error: `Failed to create organization: ${error.message}`,
        code: error.code,
        details: error.details,
      });
    }

    return json(200, { organization: data });
  }

  if (body.action === "update_organization") {
    const id = body.id;
    if (!id) return json(400, { error: "Missing organization id" });
    const authError = requireOrgAdminOrSystemAdmin(actor, id);
    if (authError) return authError;

    const updates = camelToSnakeKeys(body.updates || {});
    delete updates.id;

    const { data, error } = await admin
      .from("organizations")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[organizations-write] Update error:", error);
      return json(400, {
        error: `Failed to update organization: ${error.message}`,
        code: error.code,
        details: error.details,
      });
    }

    return json(200, { organization: data });
  }

  if (body.action === "delete_organization") {
    const authError = requireSystemAdmin(actor);
    if (authError) return authError;

    const id = body.id;
    if (!id) return json(400, { error: "Missing organization id" });

    const { error } = await admin
      .from("organizations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[organizations-write] Delete error:", error);
      return json(400, {
        error: `Failed to delete organization: ${error.message}`,
        code: error.code,
        details: error.details,
      });
    }

    return json(200, { success: true });
  }

  return json(400, { error: "Unsupported action" });
});
