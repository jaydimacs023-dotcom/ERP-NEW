// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JwtPayload = { sub: string; exp?: number };

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
  bytes.forEach((byte) => value += String.fromCharCode(byte));
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

function safeFileName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "transcript"}.pdf`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AT_ERP_JWT_SECRET) {
    return json(500, { error: "Transcript function is not fully configured" });
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const actor = token ? await verifyToken(token) : null;
  if (!actor) return json(401, { error: "Invalid or expired application token" });

  const { data: currentUser, error: userError } = await admin.from("users")
    .select("id, org_id, role, is_active").eq("id", actor.sub).maybeSingle();
  if (userError || !currentUser || currentUser.is_active === false) {
    return json(403, { error: "The logged-in user is unavailable or inactive" });
  }
  if (!["SYSTEM_ADMIN", "ADMIN", "REGISTRAR"].includes(String(currentUser.role || "").toUpperCase())) {
    return json(403, { error: "Registrar access is required" });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";
  const requestedOrgId = url.searchParams.get("orgId") || "";
  const isSystemAdmin = currentUser.role === "SYSTEM_ADMIN";
  const orgId = isSystemAdmin ? requestedOrgId : String(currentUser.org_id || "");
  if (!orgId || (!isSystemAdmin && requestedOrgId && requestedOrgId !== orgId)) {
    return json(403, { error: "Invalid organization scope" });
  }

  if (action === "list") {
    const { data, error } = await admin.from("transcript_records").select("*")
      .eq("org_id", orgId).order("uploaded_at", { ascending: false });
    if (error) return json(400, { error: error.message, code: error.code });
    const { data: batchRecords, error: batchError } = await admin.from("batch_transcript_records").select("*")
      .eq("org_id", orgId).order("uploaded_at", { ascending: false });
    if (batchError && !["PGRST205", "42P01"].includes(batchError.code || "")) {
      return json(400, { error: batchError.message, code: batchError.code });
    }
    return json(200, { records: data || [], batchRecords: batchRecords || [] });
  }

  if (action === "upload-batch") {
    const batchId = url.searchParams.get("batchId") || "";
    const fileName = safeFileName(url.searchParams.get("fileName") || "batch-transcripts.pdf");
    const { data: batch } = await admin.from("batches").select("id,status")
      .eq("id", batchId).eq("org_id", orgId).eq("status", "COMPLETED").maybeSingle();
    if (!batch) return json(403, { error: "The training batch must be completed before uploading its consolidated TOR" });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 15 * 1024 * 1024) return json(400, { error: "Select a PDF file no larger than 15 MB" });
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return json(400, { error: "The selected file is not a valid PDF" });

    const objectPath = `${orgId}/${batchId}/batch/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await admin.storage.from("transcripts").upload(objectPath, bytes, {
      contentType: "application/pdf", upsert: false,
    });
    if (uploadError) return json(400, { error: uploadError.message });
    const now = new Date().toISOString();
    const { data: record, error } = await admin.from("batch_transcript_records").upsert({
      org_id: orgId, batch_id: batchId, object_path: objectPath, file_name: fileName,
      file_size: bytes.length, mime_type: "application/pdf", uploaded_by: currentUser.id,
      uploaded_at: now, updated_at: now,
    }, { onConflict: "org_id,batch_id" }).select("*").single();
    if (error) {
      await admin.storage.from("transcripts").remove([objectPath]);
      return json(400, { error: error.message, code: error.code });
    }
    return json(200, { record });
  }

  if (action === "upload") {
    const enrollmentId = url.searchParams.get("enrollmentId") || "";
    const studentId = url.searchParams.get("studentId") || "";
    const batchId = url.searchParams.get("batchId") || "";
    const fileName = safeFileName(url.searchParams.get("fileName") || "transcript.pdf");
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (!studentId || !batchId) return json(400, { error: "Graduate record details are required" });
    if (contentLength > 15 * 1024 * 1024) return json(413, { error: "The transcript PDF must not exceed 15 MB" });

    let enrollment: { id: string; enrollment_status: string } | null = null;
    if (enrollmentId) {
      const result = await admin.from("enrollments")
        .select("id,enrollment_status").eq("id", enrollmentId).eq("org_id", orgId)
        .eq("student_id", studentId).eq("batch_id", batchId)
        .eq("is_deleted", false).maybeSingle();
      enrollment = result.data;
    }
    const { data: batch } = await admin.from("batches")
      .select("id,status,student_ids").eq("id", batchId).eq("org_id", orgId).maybeSingle();
    const isBatchMember = !!enrollment || (Array.isArray(batch?.student_ids) && batch.student_ids.includes(studentId));
    const isEligible = enrollment?.enrollment_status === "COMPLETED"
      || (batch?.status === "COMPLETED" && isBatchMember);
    if (!isEligible) {
      return json(403, { error: "TOR files may only be uploaded for completed learners or members of a completed batch" });
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 15 * 1024 * 1024) {
      return json(400, { error: "Select a PDF file no larger than 15 MB" });
    }
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return json(400, { error: "The selected file is not a valid PDF" });
    }

    const objectPath = `${orgId}/${batchId}/${studentId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await admin.storage.from("transcripts").upload(objectPath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) return json(400, { error: uploadError.message });

    const now = new Date().toISOString();
    const { data: record, error: recordError } = await admin.from("transcript_records").upsert({
      org_id: orgId,
      enrollment_id: enrollment?.id || null,
      student_id: studentId,
      batch_id: batchId,
      object_path: objectPath,
      file_name: fileName,
      file_size: bytes.length,
      mime_type: "application/pdf",
      uploaded_by: currentUser.id,
      uploaded_at: now,
      updated_at: now,
    }, { onConflict: "org_id,batch_id,student_id" }).select("*").single();
    if (recordError) {
      await admin.storage.from("transcripts").remove([objectPath]);
      return json(400, { error: recordError.message, code: recordError.code });
    }
    return json(200, { record });
  }

  if (action === "download") {
    const body = await request.json().catch(() => ({}));
    const objectPath = String(body.objectPath || "");
    const table = body.recordType === "batch" ? "batch_transcript_records" : "transcript_records";
    const { data: record } = await admin.from(table)
      .select("object_path,file_name").eq("org_id", orgId).eq("object_path", objectPath).maybeSingle();
    if (!record) return json(404, { error: "Transcript record not found" });

    const { data, error } = await admin.storage.from("transcripts").download(record.object_path);
    if (error || !data) return json(404, { error: error?.message || "Transcript file not found" });
    return new Response(data, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName(record.file_name)}"`,
      },
    });
  }

  return json(400, { error: "Unknown transcript action" });
});
