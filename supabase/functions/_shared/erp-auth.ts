// deno-lint-ignore-file no-explicit-any
export type ErpActor = {
  authUid: string;
  id: string;
  orgId: string;
  role: string;
};

type JwtPayload = {
  sub: string;
  role?: string;
  appRole?: string;
  app_role?: string;
  orgId?: string;
  org_id?: string;
  exp?: number;
};

function b64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function bytesToB64Url(bytes: Uint8Array): string {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyLegacyHs256Token(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
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

export async function authenticateErpRequest(request: Request, admin: any): Promise<ErpActor | null> {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  // 1. Primary: Supabase Auth session token verification
  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const authUid = authData?.user?.id;
    if (!authError && authUid) {
      let { data: profile } = await admin
        .from("users")
        .select("id,org_id,role,is_active,locked_until")
        .eq("auth_uid", authUid)
        .maybeSingle();

      if (!profile) {
        const { data: fallbackProfile } = await admin
          .from("users")
          .select("id,org_id,role,is_active,locked_until")
          .eq("id", authUid)
          .maybeSingle();
        profile = fallbackProfile;
      }

      if (profile && profile.is_active !== false) {
        if (!profile.locked_until || new Date(profile.locked_until).getTime() <= Date.now()) {
          return {
            authUid,
            id: String(profile.id),
            orgId: String(profile.org_id || ""),
            role: String(profile.role || "").toUpperCase(),
          };
        }
      }
    }
  } catch {
    // Proceed to legacy fallback
  }

  // 2. Secondary fallback: Legacy AT_ERP_JWT_SECRET HS256 verification if configured
  const legacySecret = Deno.env.get("AT_ERP_JWT_SECRET");
  if (legacySecret) {
    const claims = await verifyLegacyHs256Token(token, legacySecret);
    if (claims?.sub) {
      let { data: profile } = await admin
        .from("users")
        .select("id,org_id,role,is_active,locked_until")
        .eq("id", claims.sub)
        .maybeSingle();

      if (!profile) {
        const { data: fallbackProfile } = await admin
          .from("users")
          .select("id,org_id,role,is_active,locked_until")
          .eq("auth_uid", claims.sub)
          .maybeSingle();
        profile = fallbackProfile;
      }

      if (profile) {
        if (profile.is_active === false) return null;
        if (profile.locked_until && new Date(profile.locked_until).getTime() > Date.now()) return null;
        return {
          authUid: claims.sub,
          id: String(profile.id),
          orgId: String(profile.org_id || ""),
          role: String(profile.role || "").toUpperCase(),
        };
      }

      // Mock/test fallback with claims in token
      return {
        authUid: claims.sub,
        id: claims.sub,
        orgId: String(claims.orgId || claims.org_id || ""),
        role: String(claims.role || claims.appRole || claims.app_role || "").toUpperCase(),
      };
    }
  }

  return null;
}
