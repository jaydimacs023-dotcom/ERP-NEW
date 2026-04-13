// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JwtPayload = {
  sub: string;
  role?: string;
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
    const expected = bytesToB64Url(signature);
    if (expected !== sigB64) return null;

    const payloadJson = new TextDecoder().decode(b64UrlToBytes(payloadB64));
    const payload = JSON.parse(payloadJson) as JwtPayload;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
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

function requireSystemAdmin(payload: JwtPayload | null): Response | null {
  if (!payload?.sub) {
    return json(401, { error: "Authentication required" });
  }

  if (payload.role !== "SYSTEM_ADMIN") {
    return json(403, { error: "SYSTEM_ADMIN role required" });
  }

  return null;
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

  const auth = req.headers.get("Authorization") || "";
  let actor: JwtPayload | null = null;
  if (auth.startsWith("Bearer ") && AT_ERP_JWT_SECRET) {
    actor = await verifyHs256Jwt(auth.slice(7), AT_ERP_JWT_SECRET);
  }

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
    const authError = requireSystemAdmin(actor);
    if (authError) return authError;

    const id = body.id;
    if (!id) return json(400, { error: "Missing organization id" });

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
