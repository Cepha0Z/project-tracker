const APP_URL = "https://nebulous-project--tracker.web.app";
const ALLOWED_ORIGINS = new Set([
  APP_URL,
  "https://nebulous-project--tracker.firebaseapp.com",
  "http://127.0.0.1:5173",
  "http://localhost:5173"
]);
const INVALID_TOKEN_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT"]);

let cachedGoogleToken;
let cachedFirebaseKeys;

function base64url(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function decodeJsonPart(input) {
  return JSON.parse(new TextDecoder().decode(decodeBase64url(input)));
}

function pemToArrayBuffer(pem) {
  const clean = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  return decodeBase64url(clean.replace(/\+/g, "-").replace(/\//g, "_")).buffer;
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin"
      }
    : {};
}

function jsonResponse(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(request),
      ...extraHeaders
    }
  });
}

async function createGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken?.expiresAt > now + 60) return cachedGoogleToken.value;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: [
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/firebase.messaging"
    ].join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const signingInput = `${header}.${payload}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  const assertion = `${signingInput}.${base64url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await response.json();
  if (!response.ok || typeof data.access_token !== "string") {
    throw new Error(`Google OAuth failed (${response.status}).`);
  }
  cachedGoogleToken = {
    value: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600)
  };
  return cachedGoogleToken.value;
}

async function firebasePublicKeys() {
  if (cachedFirebaseKeys?.expiresAt > Date.now()) return cachedFirebaseKeys.keys;
  const response = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  );
  if (!response.ok) throw new Error("Unable to load Firebase signing keys.");
  const data = await response.json();
  const maxAge = Number(response.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] || 3600);
  cachedFirebaseKeys = {
    keys: Array.isArray(data.keys) ? data.keys : [],
    expiresAt: Date.now() + maxAge * 1000
  };
  return cachedFirebaseKeys.keys;
}

async function verifyFirebaseIdToken(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 8192) return null;

  try {
    const header = decodeJsonPart(parts[0]);
    const claims = decodeJsonPart(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    if (
      header.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      claims.aud !== env.FIREBASE_PROJECT_ID ||
      claims.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` ||
      typeof claims.sub !== "string" ||
      !claims.sub ||
      claims.exp <= now ||
      claims.iat > now + 60
    ) return null;

    const jwk = (await firebasePublicKeys()).find(key => key.kid === header.kid);
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      decodeBase64url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    return valid ? claims : null;
  } catch {
    return null;
  }
}

function decodeValue(value) {
  if (!value || "nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

function documentId(document) {
  return document.name.split("/").pop();
}

function firestoreBase(env) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
}

async function getDocument(env, accessToken, collection, id) {
  const response = await fetch(
    `${firestoreBase(env)}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}).`);
  const document = await response.json();
  return { id: documentId(document), ...decodeFields(document.fields) };
}

async function queryDocuments(env, accessToken, collection, field, value) {
  const response = await fetch(`${firestoreBase(env)}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: "EQUAL",
            value: { stringValue: value }
          }
        }
      }
    })
  });
  if (!response.ok) throw new Error(`Firestore query failed (${response.status}).`);
  const results = await response.json();
  return results
    .filter(result => result.document)
    .map(result => ({ id: documentId(result.document), ...decodeFields(result.document.fields) }));
}

async function createDeliveryMarker(env, accessToken, id, fields) {
  const response = await fetch(
    `${firestoreBase(env)}/notificationDeliveries?documentId=${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    }
  );
  if (response.status === 409) return false;
  if (!response.ok) throw new Error(`Delivery marker failed (${response.status}).`);
  return true;
}

async function updateDocumentFields(env, accessToken, collection, id, fields) {
  const fieldPaths = Object.keys(fields).map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&");
  const response = await fetch(
    `${firestoreBase(env)}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?${fieldPaths}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    }
  );
  if (!response.ok) throw new Error(`Firestore update failed (${response.status}).`);
}

const stringField = value => ({ stringValue: String(value) });
const integerField = value => ({ integerValue: String(value) });
const timestampField = () => ({ timestampValue: new Date().toISOString() });

function userIdsForProjectPrincipals(project) {
  return [...new Set([
    project.principalId,
    ...(Array.isArray(project.principalIds) ? project.principalIds : [])
  ].filter(Boolean))];
}

function workItemAssignees(item) {
  return Array.isArray(item.assigneeIds) && item.assigneeIds.length
    ? item.assigneeIds
    : [item.assigneeId].filter(Boolean);
}

function fcmErrorCode(result) {
  return result?.error?.details?.find(
    detail => detail?.["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError"
  )?.errorCode;
}

async function disableDevice(env, accessToken, deviceId) {
  await updateDocumentFields(env, accessToken, "notificationDevices", deviceId, {
    enabled: { booleanValue: false },
    disabledAt: timestampField()
  });
}

async function sendToUsers(env, accessToken, userIds, content) {
  const snapshots = await Promise.all(
    [...new Set(userIds.filter(Boolean))].map(userId =>
      queryDocuments(env, accessToken, "notificationDevices", "userId", userId)
    )
  );
  const devices = snapshots.flat().filter(
    device => device.enabled === true && typeof device.token === "string"
  );
  const unique = [...new Map(devices.map(device => [device.token, device])).values()];

  const results = await Promise.all(unique.map(async device => {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title: content.title, body: content.body },
            data: {
              title: content.title,
              body: content.body,
              url: content.url,
              tag: content.tag,
              icon: "/project-tracker-icon-192.png",
              badge: "/project-tracker-icon-192.png"
            },
            webpush: {
              headers: { Urgency: "high" },
              notification: {
                title: content.title,
                body: content.body,
                icon: "/project-tracker-icon-192.png",
                badge: "/project-tracker-icon-192.png",
                tag: content.tag,
                data: { url: content.url }
              },
              fcm_options: { link: content.url }
            }
          }
        })
      }
    );
    const result = await response.json().catch(() => ({}));
    const errorCode = fcmErrorCode(result);
    if (!response.ok && INVALID_TOKEN_CODES.has(errorCode)) {
      await disableDevice(env, accessToken, device.id).catch(() => undefined);
    }
    return response.ok;
  }));

  return {
    attempted: results.length,
    delivered: results.filter(Boolean).length,
    failed: results.filter(success => !success).length
  };
}

function shortMessage(value) {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return normalized.length > 180 ? `${normalized.slice(0, 177)}…` : normalized;
}

async function notificationContext(env, accessToken, requestId) {
  const helpRequest = await getDocument(env, accessToken, "helpRequests", requestId);
  if (!helpRequest) return null;
  const [project, item, requester] = await Promise.all([
    getDocument(env, accessToken, "projects", helpRequest.projectId),
    getDocument(env, accessToken, "workItems", helpRequest.workItemId),
    getDocument(env, accessToken, "users", helpRequest.raisedBy)
  ]);
  if (!project || !item || !requester) return null;
  return { helpRequest, project, item, requester };
}

async function sendHelpNotification(request, env) {
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("Origin") || "";
    if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { success: false, error: "Method not allowed." }, 405, { Allow: "POST" });
  }
  const origin = request.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(request, { success: false, error: "Origin not allowed." }, 403);
  }

  const claims = await verifyFirebaseIdToken(request, env);
  if (!claims) return jsonResponse(request, { success: false, error: "Unauthorized." }, 401);

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(request, { success: false, error: "Invalid request." }, 400);
  }
  const requestId = typeof input?.requestId === "string" ? input.requestId : "";
  const event = input?.event;
  if (!requestId || !["help_escalated", "help_resolved"].includes(event)) {
    return jsonResponse(request, { success: false, error: "Invalid request." }, 400);
  }

  try {
    const accessToken = await createGoogleAccessToken(env);
    const profile = await getDocument(env, accessToken, "authProfiles", claims.sub);
    if (!profile || profile.active !== true || typeof profile.userId !== "string") {
      return jsonResponse(request, { success: false, error: "Forbidden." }, 403);
    }
    const context = await notificationContext(env, accessToken, requestId);
    if (!context) return jsonResponse(request, { success: false, error: "Request not found." }, 404);
    const { helpRequest, project, item, requester } = context;
    if (helpRequest.projectId !== project.id || item.projectId !== project.id) {
      return jsonResponse(request, { success: false, error: "Invalid help request." }, 409);
    }

    let recipients;
    let content;
    if (event === "help_escalated") {
      const principals = userIdsForProjectPrincipals(project);
      const valid =
        helpRequest.level === "principal" &&
        helpRequest.status === "Escalated" &&
        (profile.userId === project.leadId || workItemAssignees(item).includes(profile.userId)) &&
        helpRequest.escalatedBy === profile.userId &&
        principals.includes(helpRequest.assignedTo);
      if (!valid) return jsonResponse(request, { success: false, error: "Forbidden." }, 403);

      recipients = principals;
      const escalator = await getDocument(env, accessToken, "users", profile.userId);
      const note = shortMessage(helpRequest.reason);
      content = {
        title: "Studio Projects",
        body: [
          "Help request escalated",
          `${project.name} — ${item.name}`,
          `${escalator?.name || "A team member"} needs your attention`,
          shortMessage(helpRequest.escalationNote || helpRequest.reason)
        ].filter(Boolean).join("\n"),
        url: `${APP_URL}/?project=${encodeURIComponent(project.id)}&workItem=${encodeURIComponent(item.id)}&help=${encodeURIComponent(requestId)}`,
        tag: `escalation-${requestId}`
      };
    } else {
      const principals = userIdsForProjectPrincipals(project);
      const valid = helpRequest.status === "Resolved" && helpRequest.resolvedBy === profile.userId &&
        (profile.access === "admin" || principals.includes(profile.userId)) &&
        typeof helpRequest.resolutionNote === "string" && helpRequest.resolutionNote.trim().length > 0;
      if (!valid) return jsonResponse(request, { success: false, error: "Forbidden." }, 403);
      const resolver = await getDocument(env, accessToken, "users", profile.userId);
      recipients = [helpRequest.raisedBy];
      content = {
        title: "Studio Projects",
        body: ["Your help request was resolved", `${project.name} — ${item.name}`, `${resolver?.name || "Principal"}: ${shortMessage(helpRequest.resolutionNote)}`].join("\n"),
        url: `${APP_URL}/?project=${encodeURIComponent(project.id)}&workItem=${encodeURIComponent(item.id)}&help=${encodeURIComponent(requestId)}`,
        tag: `resolution-${requestId}`
      };
    }

    const markerId = `${requestId}_${event}`;
    const created = await createDeliveryMarker(env, accessToken, markerId, {
      requestId: stringField(requestId),
      event: stringField(event),
      actorId: stringField(profile.userId),
      status: stringField("sending"),
      createdAt: timestampField()
    });
    if (!created) return jsonResponse(request, { success: true, duplicate: true });

    try {
      const result = await sendToUsers(env, accessToken, recipients, content);
      await updateDocumentFields(env, accessToken, "notificationDeliveries", markerId, {
        status: stringField(result.failed ? "partial" : result.attempted ? "sent" : "no_devices"),
        attempted: integerField(result.attempted),
        delivered: integerField(result.delivered),
        failed: integerField(result.failed),
        completedAt: timestampField()
      });
      return jsonResponse(request, { success: true, ...result });
    } catch {
      await updateDocumentFields(env, accessToken, "notificationDeliveries", markerId, {
        status: stringField("failed"),
        completedAt: timestampField()
      }).catch(() => undefined);
      return jsonResponse(request, { success: false, error: "Notification delivery failed." }, 502);
    }
  } catch {
    return jsonResponse(request, { success: false, error: "Notification service unavailable." }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/notifications/help") return sendHelpNotification(request, env);
    return new Response(url.pathname === "/" ? "Worker is running." : "Not found.", {
      status: url.pathname === "/" ? 200 : 404,
      headers: { "Cache-Control": "no-store" }
    });
  }
};
