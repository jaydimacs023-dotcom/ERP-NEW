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
const AT_ERP_JWT_SECRET =
  Deno.env.get("AT_ERP_JWT_SECRET") ??
  (SUPABASE_URL.startsWith("http://127.0.0.1:") || SUPABASE_URL.startsWith("http://localhost:")
    ? "AT-ERP-JWT-SECRET-KEY-2024-CHANGE-IN-PRODUCTION"
    : "");

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

function b64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyHs256Jwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
    if (bytesToB64Url(signature) !== sigB64) return null;

    const payloadJson = new TextDecoder().decode(b64UrlToBytes(payloadB64));
    const payload = JSON.parse(payloadJson) as JwtPayload;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function getActorRole(payload: JwtPayload): string {
  return String(payload.appRole || payload.app_role || payload.role || "").toUpperCase();
}

function getActorOrgId(payload: JwtPayload): string {
  return String(payload.orgId || payload.org_id || "");
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

function pickTicketInsert(ticket: any, payload: JwtPayload) {
  const role = getActorRole(payload);
  const isSystemAdmin = role === "SYSTEM_ADMIN";
  const actorOrgId = getActorOrgId(payload);
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
    created_by: payload.sub,
    created_by_name: ticket.createdByName || ticket.created_by_name || "User",
    created_by_role: role,
  };
}

function pickTicketUpdate(updates: any, payload: JwtPayload) {
  return {
    status: updates.status,
    admin_notes: updates.adminNotes ?? updates.admin_notes,
    assigned_to: payload.sub,
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

  if (!AT_ERP_JWT_SECRET) {
    return json(500, { error: "AT_ERP_JWT_SECRET is not configured for feedback-tickets" });
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const payload = token ? await verifyHs256Jwt(token, AT_ERP_JWT_SECRET) : null;
  if (!payload) {
    return json(401, { error: "Invalid or expired application token" });
  }

  const role = getActorRole(payload);
  const isSystemAdmin = role === "SYSTEM_ADMIN";
  const actorOrgId = getActorOrgId(payload);
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
        query = query.eq("org_id", actorOrgId).eq("created_by", payload.sub);
      }

      const { data, error } = await query;
      if (error) return json(500, { error: error.message });
      return json(200, { result: snakeToCamel(data || []) });
    }

    if (body.action === "create") {
      const insert = pickTicketInsert(body.ticket || {}, payload);
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

      const update = camelToSnake(pickTicketUpdate(body.updates || {}, payload));
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
