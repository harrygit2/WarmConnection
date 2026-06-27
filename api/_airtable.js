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
  curatedPersonFields: [
    process.env.AIRTABLE_CURATED_1_PERSON_FIELD || "Curated_1_Person",
    process.env.AIRTABLE_CURATED_2_PERSON_FIELD || "Curated_2_Person",
    process.env.AIRTABLE_CURATED_3_PERSON_FIELD || "Curated_3_Person"
  ],
  curatedMetaFields: [
    process.env.AIRTABLE_CURATED_1_META_FIELD || "Curated_1_Meta",
    process.env.AIRTABLE_CURATED_2_META_FIELD || "Curated_2_Meta",
    process.env.AIRTABLE_CURATED_3_META_FIELD || "Curated_3_Meta"
  ],
  curatedTagsFields: [
    process.env.AIRTABLE_CURATED_1_TAGS_FIELD || "Curated_1_Tags",
    process.env.AIRTABLE_CURATED_2_TAGS_FIELD || "Curated_2_Tags",
    process.env.AIRTABLE_CURATED_3_TAGS_FIELD || "Curated_3_Tags"
  ],
  curatedDetailFields: [
    process.env.AIRTABLE_CURATED_1_DETAIL_FIELD || "Curated_1_Detail",
    process.env.AIRTABLE_CURATED_2_DETAIL_FIELD || "Curated_2_Detail",
    process.env.AIRTABLE_CURATED_3_DETAIL_FIELD || "Curated_3_Detail"
  ],
  choiceField: process.env.AIRTABLE_CHOICE_FIELD || "Choice",
  choicePersonField: process.env.AIRTABLE_CHOICE_PERSON_FIELD || "ChoicePerson",
  choiceSubmittedAtField: process.env.AIRTABLE_CHOICE_SUBMITTED_AT_FIELD || "ChoiceSubmittedAt",
  matchStatusField: process.env.AIRTABLE_MATCH_STATUS_FIELD || "MatchStatus",
  matchedWithField: process.env.AIRTABLE_MATCHED_WITH_FIELD || "MatchedWith",
  matchedAtField: process.env.AIRTABLE_MATCHED_AT_FIELD || "MatchedAt",
  photo1Field: process.env.AIRTABLE_PHOTO_1_FIELD || "Photo 1 (정면)",
  photo2Field: process.env.AIRTABLE_PHOTO_2_FIELD || "Photo 2 (전신 or 상반신)",
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
      "AIRTABLE_CURATED_1_PERSON_FIELD",
      "AIRTABLE_CURATED_2_PERSON_FIELD",
      "AIRTABLE_CURATED_3_PERSON_FIELD",
      "AIRTABLE_CURATED_1_META_FIELD",
      "AIRTABLE_CURATED_2_META_FIELD",
      "AIRTABLE_CURATED_3_META_FIELD",
      "AIRTABLE_CURATED_1_TAGS_FIELD",
      "AIRTABLE_CURATED_2_TAGS_FIELD",
      "AIRTABLE_CURATED_3_TAGS_FIELD",
      "AIRTABLE_CURATED_1_DETAIL_FIELD",
      "AIRTABLE_CURATED_2_DETAIL_FIELD",
      "AIRTABLE_CURATED_3_DETAIL_FIELD",
      "AIRTABLE_CHOICE_FIELD",
      "AIRTABLE_CHOICE_PERSON_FIELD",
      "AIRTABLE_CHOICE_SUBMITTED_AT_FIELD",
      "AIRTABLE_APPLICANT_NAME_FIELD",
      "AIRTABLE_MATCH_STATUS_FIELD",
      "AIRTABLE_MATCHED_WITH_FIELD",
      "AIRTABLE_MATCHED_AT_FIELD",
      "AIRTABLE_PHOTO_1_FIELD",
      "AIRTABLE_PHOTO_2_FIELD",
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
      fields,
      typecast: true
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

export async function buildProfilesFromFields(fields) {
  const profiles = await Promise.all(
    RESULT_CONFIG.curatedFields.map(async (fieldName, index) => {
      const rawValue = fields[fieldName];
      const label = normalizeAirtableValue(rawValue);
      const personRecordId = firstLinkedRecordId(fields[RESULT_CONFIG.curatedPersonFields[index]]);

      if (!label && !personRecordId) {
        return null;
      }

      const candidateFields = personRecordId
        ? await getLinkedApplicantFields(personRecordId)
        : {};
      const displayLabel = label || `추천 ${index + 1}`;
      const photoUrl = getAttachmentUrl(candidateFields[RESULT_CONFIG.photo1Field]);
      const secondaryPhotoUrl = getAttachmentUrl(candidateFields[RESULT_CONFIG.photo2Field]);

      return {
        id: personRecordId || `${fieldName}:${displayLabel}`,
        choiceValue: personRecordId || displayLabel,
        choiceLabel: displayLabel,
        personRecordId,
        slot: index + 1,
        initials: String.fromCharCode(65 + index),
        displayName: displayLabel,
        nameLine: displayLabel,
        meta: normalizeAirtableValue(fields[RESULT_CONFIG.curatedMetaFields[index]]) || "공개 정보 준비 중",
        tags: parseTags(fields[RESULT_CONFIG.curatedTagsFields[index]]),
        detail: normalizeAirtableValue(fields[RESULT_CONFIG.curatedDetailFields[index]]),
        photoUrl,
        secondaryPhotoUrl
      };
    })
  );

  return profiles.filter(Boolean);
}

export async function getAllowedChoiceProfiles(fields) {
  return buildProfilesFromFields(fields);
}

export function getExistingChoiceValue(fields) {
  return firstLinkedRecordId(fields[RESULT_CONFIG.choicePersonField]) ||
    normalizeAirtableValue(fields[RESULT_CONFIG.choiceField]) ||
    null;
}

export function getLinkedRecordIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((recordId) => typeof recordId === "string" && recordId.startsWith("rec"));
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

function firstLinkedRecordId(value) {
  return getLinkedRecordIds(value)[0] || "";
}

async function getLinkedApplicantFields(recordId) {
  try {
    const record = await getRecord(RESULT_CONFIG.applicantsTable, recordId);
    return record.fields || {};
  } catch (error) {
    console.error("linked applicant lookup failed:", error);
    return {};
  }
}

function parseTags(value) {
  return normalizeAirtableValue(value)
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getAttachmentUrl(value) {
  if (!Array.isArray(value) || !value.length) return "";

  const attachment = value[0];
  return attachment?.thumbnails?.large?.url ||
    attachment?.thumbnails?.full?.url ||
    attachment?.url ||
    "";
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
