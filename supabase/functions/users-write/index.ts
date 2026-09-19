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

async function linkedRecordExists(
  table: "trainers" | "students",
  id: string,
  orgId: string,
): Promise<boolean> {
  try {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) {
      console.error(`[users-write] Error checking ${table} record:`, error);
      return false;
    }

    return (count ?? 0) > 0;
  } catch (error) {
    console.error(`[users-write] Unexpected error checking ${table} record:`, error);
    return false;
  }
}

async function canManageOrgUsers(actor: ErpActor | null, orgId: string, userRole: string): Promise<boolean> {
  if (!actor?.id) return false;

  const actorRole = actor.role.toLowerCase();
  const actorOrgId = actor.orgId;

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

  const actor = await authenticateErpRequest(req, admin);
  if (!actor) return json(401, { error: "Invalid, expired, or unlinked Supabase session" });

  if (body.action === "create_user") {
    const user = body.user || {};
    const userOrgId = user.org_id || user.orgId;
    const userRole = normalizeUserRole(user.role);
    const trainerId = user.trainer_id || user.trainerId;
    const studentId = user.student_id || user.studentId;

    if (!userOrgId) {
      return json(400, { error: "Missing user.org_id" });
    }

    if (!user.email || !user.name || !userRole) {
      return json(400, { error: "Missing required user fields" });
    }

    if (!ALLOWED_USER_ROLES.has(userRole)) {
      return json(400, { error: `Invalid user.role: ${String(user.role)}` });
    }

    if (userRole === "TRAINER") {
      if (!trainerId) {
        return json(400, { error: "TRAINER users require user.trainer_id" });
      }

      const trainerExists = await linkedRecordExists("trainers", trainerId, userOrgId);
      if (!trainerExists) {
        return json(400, {
          error: `Selected trainer record was not found for this organization: ${trainerId}`,
        });
      }
    }

    if (userRole === "STUDENT") {
      if (!studentId) {
        return json(400, { error: "STUDENT users require user.student_id" });
      }

      const studentExists = await linkedRecordExists("students", studentId, userOrgId);
      if (!studentExists) {
        return json(400, {
          error: `Selected student record was not found for this organization: ${studentId}`,
        });
      }
    }

    if (!await canManageOrgUsers(actor, userOrgId, userRole)) {
      return json(403, { error: "ADMIN for this organization or SYSTEM_ADMIN role required" });
    }

    const password = String(body.password || "");
    if (password.length < 8) {
      return json(400, { error: "A password of at least 8 characters is required" });
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: String(user.email).trim(),
      password,
      email_confirm: true,
      app_metadata: { erp_managed: true },
    });
    if (authError || !authData.user) {
      return json(400, { error: authError?.message || "Failed to create Supabase Auth user" });
    }

    const insertPayload = {
      ...user,
      role: userRole,
      org_id: userOrgId,
      auth_uid: authData.user.id,
      created_at: user.created_at ?? new Date().toISOString(),
      updated_at: user.updated_at ?? new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("users")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
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
