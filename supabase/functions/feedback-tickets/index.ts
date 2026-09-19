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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function camelToSnake(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = camelToSnake(value);
  }
  return result;
}

function snakeToCamel(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
    result[camelKey] = snakeToCamel(value);
  }
  return result;
}

function pickTicketInsert(ticket: any, actor: ErpActor) {
  const isSystemAdmin = actor.role === "SYSTEM_ADMIN";
  const actorOrgId = actor.orgId;
  const requestedOrgId = String(ticket?.orgId || ticket?.org_id || actorOrgId || "");
  const orgId = isSystemAdmin ? requestedOrgId : actorOrgId;

  if (!orgId) {
    throw new Error("Feedback tickets require an organization.");
  }

  return {
    id: ticket.id,
    org_id: orgId,
    title: String(ticket.title || "").trim(),
    description: String(ticket.description || "").trim(),
    screenshot_data_url: ticket.screenshotDataUrl || ticket.screenshot_data_url || null,
    screenshot_name: ticket.screenshotName || ticket.screenshot_name || null,
    status: "OPEN",
    priority: ticket.priority || "MEDIUM",
    created_by: actor.id,
    created_by_name: ticket.createdByName || ticket.created_by_name || "User",
    created_by_role: actor.role,
  };
}

function pickTicketUpdate(updates: any, actor: ErpActor) {
  return {
    status: updates.status,
    admin_notes: updates.adminNotes ?? updates.admin_notes,
    assigned_to: actor.id,
    resolved_at: updates.resolvedAt ?? updates.resolved_at ?? null,
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const actor = await authenticateErpRequest(req, admin);
  if (!actor) {
    return json(401, { error: "Invalid, expired, or unlinked Supabase session" });
  }

  const isSystemAdmin = actor.role === "SYSTEM_ADMIN";
  const actorOrgId = actor.orgId;
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === "list") {
      let query = admin
        .from("feedback_tickets")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (!isSystemAdmin) {
        if (!actorOrgId) return json(403, { error: "Missing organization scope" });
        query = query.eq("org_id", actorOrgId).eq("created_by", actor.id);
      }

      const { data, error } = await query;
      if (error) return json(500, { error: error.message });
      return json(200, { result: snakeToCamel(data || []) });
    }

    if (body.action === "create") {
      const insert = pickTicketInsert(body.ticket || {}, actor);
      if (!insert.title || !insert.description) {
        return json(400, { error: "Title and description are required" });
      }

      const { data, error } = await admin
        .from("feedback_tickets")
        .insert(insert)
        .select("*")
        .single();

      if (error) return json(500, { error: error.message });
      return json(200, { result: snakeToCamel(data) });
    }

    if (body.action === "update") {
      if (!isSystemAdmin) {
        return json(403, { error: "Only system administrators can update feedback tickets" });
      }

      const id = String(body.id || "");
      if (!id) return json(400, { error: "Ticket id is required" });

      const update = camelToSnake(pickTicketUpdate(body.updates || {}, actor));
      const { data, error } = await admin
        .from("feedback_tickets")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return json(500, { error: error.message });
      return json(200, { result: snakeToCamel(data) });
    }

    return json(400, { error: "Unknown action" });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : String(error) });
  }
});
