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

function getActorRole(payload: JwtPayload | null): string | undefined {
  return payload?.appRole || payload?.app_role || payload?.role;
}

function getActorOrgId(payload: JwtPayload | null): string | undefined {
  return payload?.orgId || payload?.org_id;
}

const ROLE_CANONICAL_MAP: Record<string, string> = {
  system_admin: "SYSTEM_ADMIN",
  admin: "ADMIN",
  president: "PRESIDENT",
  finance_manager: "FINANCE_MANAGER",
  accountant: "ACCOUNTANT",
  ar_specialist: "AR_SPECIALIST",
  ap_specialist: "AP_SPECIALIST",
  ap_clerk: "AP_CLERK",
  ap_supervisor: "AP_SUPERVISOR",
  treasury: "TREASURY",
  auditor: "AUDITOR",
  registrar: "REGISTRAR",
  trainer: "TRAINER",
  student: "STUDENT",
};

const ALLOWED_USER_ROLES = new Set(Object.values(ROLE_CANONICAL_MAP));

function normalizeUserRole(role: string | undefined): string | undefined {
  if (!role || typeof role !== "string") return undefined;
  return ROLE_CANONICAL_MAP[role.trim().toLowerCase()];
}

async function canManageOrgUsers(payload: JwtPayload | null, orgId: string, userRole: string): Promise<boolean> {
  if (!payload?.sub) return false;

  const actorRole = getActorRole(payload)?.toLowerCase();
  const actorOrgId = getActorOrgId(payload);

  // SYSTEM_ADMIN can manage any org
  if (actorRole === "system_admin") return true;

  // ADMIN can manage their own org
  if (actorRole === "admin") {
    return Boolean(actorOrgId && actorOrgId === orgId);
  }

  // Allow creating the first user or ADMIN users if no users exist in the org
  if (userRole === "ADMIN") {
    try {
      const { count } = await admin
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);

      return count === 0; // Allow if no users exist
    } catch (error) {
      console.error("[users-write] Error checking existing users:", error);
      return false;
    }
  }

  return false;
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

  if (!AT_ERP_JWT_SECRET) {
    return json(500, { error: "AT_ERP_JWT_SECRET is not configured for users-write" });
  }

  if (body.action === "create_user") {
    const user = body.user || {};
    const userOrgId = user.org_id || user.orgId;
    const userRole = normalizeUserRole(user.role);

    if (!userOrgId) {
      return json(400, { error: "Missing user.org_id" });
    }

    if (!user.email || !user.name || !userRole) {
      return json(400, { error: "Missing required user fields" });
    }

    if (!ALLOWED_USER_ROLES.has(userRole)) {
      return json(400, { error: `Invalid user.role: ${String(user.role)}` });
    }

    if (!await canManageOrgUsers(actor, userOrgId, userRole)) {
      return json(403, { error: "ADMIN for this organization or SYSTEM_ADMIN role required" });
    }

    const insertPayload = {
      ...user,
      role: userRole,
      org_id: userOrgId,
      created_at: user.created_at ?? new Date().toISOString(),
      updated_at: user.updated_at ?? new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("users")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("[users-write] Create error:", error);
      return json(400, {
        error: `Failed to create user: ${error.message}`,
        code: error.code,
        details: error.details,
      });
    }

    return json(200, { user: data });
  }

  return json(400, { error: `Unsupported action: ${body.action}` });
});
