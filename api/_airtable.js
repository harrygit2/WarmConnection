import crypto from "node:crypto";

const TODO_PREFIX = "TODO_";

export const RESULT_CONFIG = {
  token: process.env.AIRTABLE_TOKEN,
  baseId: process.env.AIRTABLE_BASE_ID || "appfxdcwmVcUd6uGm",
  applicantsTable: process.env.AIRTABLE_APPLICANTS_TABLE || "Applicants",
  emailField: process.env.AIRTABLE_EMAIL_FIELD || "Email",
  passwordField: process.env.AIRTABLE_PASSWORD_FIELD || "비밀번호",
  applicantNameField: process.env.AIRTABLE_APPLICANT_NAME_FIELD || "Name",
  curatedFields: [
    process.env.AIRTABLE_CURATED_1_FIELD || "Curated_1",
    process.env.AIRTABLE_CURATED_2_FIELD || "Curated_2",
    process.env.AIRTABLE_CURATED_3_FIELD || "Curated_3"
  ],
  choiceField: process.env.AIRTABLE_CHOICE_FIELD || "Choice",
  choiceSubmittedAtField: process.env.AIRTABLE_CHOICE_SUBMITTED_AT_FIELD || "ChoiceSubmittedAt",
  sessionSecret: process.env.RESULT_SESSION_SECRET || process.env.AIRTABLE_TOKEN,
  sessionTtlMs: 1000 * 60 * 60 * 2
};

export function isResultConfigReady() {
  return Boolean(
    RESULT_CONFIG.token &&
    RESULT_CONFIG.baseId &&
    !isTodo(RESULT_CONFIG.applicantsTable) &&
    !isTodo(RESULT_CONFIG.emailField) &&
    !isTodo(RESULT_CONFIG.passwordField)
  );
}

export function configSummary() {
  return {
    needs: [
      "AIRTABLE_TOKEN"
    ],
    optional: [
      "AIRTABLE_BASE_ID",
      "AIRTABLE_APPLICANTS_TABLE",
      "AIRTABLE_EMAIL_FIELD",
      "AIRTABLE_PASSWORD_FIELD",
      "AIRTABLE_CURATED_1_FIELD",
      "AIRTABLE_CURATED_2_FIELD",
      "AIRTABLE_CURATED_3_FIELD",
      "AIRTABLE_CHOICE_FIELD",
      "AIRTABLE_CHOICE_SUBMITTED_AT_FIELD",
      "AIRTABLE_APPLICANT_NAME_FIELD",
      "RESULT_SESSION_SECRET"
    ]
  };
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizePassword(password) {
  const normalized = String(password ?? "").trim();

  if (/^\d{1,4}$/.test(normalized)) {
    return normalized.padStart(4, "0");
  }

  return normalized;
}

export function fieldRef(fieldName) {
  return `{${fieldName}}`;
}

export function formulaString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export async function listRecords(tableName, params = {}) {
  return airtableRequest(tableName, {
    method: "GET",
    params
  });
}

export async function getRecord(tableName, recordId) {
  return airtableRequest(`${tableName}/${recordId}`, {
    method: "GET"
  });
}

export async function updateRecord(tableName, recordId, fields) {
  return airtableRequest(`${tableName}/${recordId}`, {
    method: "PATCH",
    body: {
      fields
    }
  });
}

export function createSessionToken(payload) {
  const body = {
    ...payload,
    exp: Date.now() + RESULT_CONFIG.sessionTtlMs
  };
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encodedBody);

  return `${encodedBody}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    throw new Error("INVALID_SESSION");
  }

  const [encodedBody, signature] = token.split(".");
  const expectedSignature = sign(encodedBody);
  const signatureBuffer = Buffer.from(signature || "");
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error("INVALID_SESSION");
  }

  let payload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedBody));
  } catch (error) {
    throw new Error("INVALID_SESSION");
  }

  if (!payload.exp || payload.exp < Date.now()) {
    throw new Error("EXPIRED_SESSION");
  }

  return payload;
}

export function buildProfilesFromFields(fields) {
  return RESULT_CONFIG.curatedFields
    .map((fieldName, index) => {
      const rawValue = fields[fieldName];
      const label = normalizeAirtableValue(rawValue);

      if (!label) {
        return null;
      }

      return {
        id: `${fieldName}:${label}`,
        choiceValue: label,
        slot: index + 1,
        initials: String.fromCharCode(65 + index),
        displayName: label,
        nameLine: label,
        meta: "공개 정보 준비 중",
        tags: [],
        detail: ""
      };
    })
    .filter(Boolean);
}

export function getAllowedChoiceValues(fields) {
  return buildProfilesFromFields(fields).map((profile) => profile.choiceValue);
}

function isTodo(value) {
  return !value || String(value).startsWith(TODO_PREFIX);
}

async function airtableRequest(tablePath, options = {}) {
  if (!RESULT_CONFIG.token) {
    throw new Error("AIRTABLE_TOKEN is missing");
  }

  const url = new URL(
    `https://api.airtable.com/v0/${encodeURIComponent(RESULT_CONFIG.baseId)}/${encodePath(tablePath)}`
  );

  Object.entries(options.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${RESULT_CONFIG.token}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error?.message || data.error || "Airtable request failed";
    throw new Error(message);
  }

  return data.records || data;
}

function encodePath(tablePath) {
  return String(tablePath)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function normalizeAirtableValue(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value).trim();
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function sign(value) {
  if (!RESULT_CONFIG.sessionSecret) {
    throw new Error("RESULT_SESSION_SECRET is missing");
  }

  return crypto
    .createHmac("sha256", RESULT_CONFIG.sessionSecret)
    .update(value)
    .digest("base64url");
}
