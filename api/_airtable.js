import crypto from "node:crypto";

const TODO_PREFIX = "TODO_";

export const RESULT_CONFIG = {
  token: process.env.AIRTABLE_TOKEN,
  baseId: process.env.AIRTABLE_BASE_ID || "appfxdcwmVcUd6uGm",
  applicantsTable: process.env.AIRTABLE_APPLICANTS_TABLE || "Applicants",
  emailField: process.env.AIRTABLE_EMAIL_FIELD || "Email",
  passwordField: process.env.AIRTABLE_PASSWORD_FIELD || "비밀번호",
  applicantNameField: process.env.AIRTABLE_APPLICANT_NAME_FIELD || "Name",
  curatedPersonFields: [
    process.env.AIRTABLE_CURATED_1_FIELD || "Curated_1",
    process.env.AIRTABLE_CURATED_2_FIELD || "Curated_2",
    process.env.AIRTABLE_CURATED_3_FIELD || "Curated_3"
  ],
  curatedOverviewFields: [
    process.env.AIRTABLE_CURATED_1_OVERVIEW_FIELD || "Curated_1_Overview",
    process.env.AIRTABLE_CURATED_2_OVERVIEW_FIELD || "Curated_2_Overview",
    process.env.AIRTABLE_CURATED_3_OVERVIEW_FIELD || "Curated_3_Overview"
  ],
  choiceField: process.env.AIRTABLE_CHOICE_FIELD || "Choice",
  choiceSubmittedAtField: process.env.AIRTABLE_CHOICE_SUBMITTED_AT_FIELD || "ChoiceSubmittedAt",
  matchStatusField: process.env.AIRTABLE_MATCH_STATUS_FIELD || "MatchStatus",
  matchedWithField: process.env.AIRTABLE_MATCHED_WITH_FIELD || "MatchedWith",
  matchedAtField: process.env.AIRTABLE_MATCHED_AT_FIELD || "MatchedAt",
  photoFields: [
    process.env.AIRTABLE_PHOTO_1_FIELD || "Photo 1 (정면)",
    process.env.AIRTABLE_PHOTO_2_FIELD || "Photo 2 (전신 or 상반신)",
    process.env.AIRTABLE_PHOTO_3_FIELD || "Photo 3 (취미)",
    process.env.AIRTABLE_PHOTO_4_FIELD || "Photo 4 (추가)"
  ],
  ageField: process.env.AIRTABLE_AGE_FIELD || "Age",
  locationField: process.env.AIRTABLE_LOCATION_FIELD || "Location",
  industryField: process.env.AIRTABLE_INDUSTRY_FIELD || "Industry",
  mbtiField: process.env.AIRTABLE_MBTI_FIELD || "MBTI",
  introduceField: process.env.AIRTABLE_INTRODUCE_FIELD || "Introduce",
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
      "AIRTABLE_CURATED_1_OVERVIEW_FIELD",
      "AIRTABLE_CURATED_2_OVERVIEW_FIELD",
      "AIRTABLE_CURATED_3_OVERVIEW_FIELD",
      "AIRTABLE_CHOICE_FIELD",
      "AIRTABLE_CHOICE_SUBMITTED_AT_FIELD",
      "AIRTABLE_APPLICANT_NAME_FIELD",
      "AIRTABLE_MATCH_STATUS_FIELD",
      "AIRTABLE_MATCHED_WITH_FIELD",
      "AIRTABLE_MATCHED_AT_FIELD",
      "AIRTABLE_PHOTO_1_FIELD",
      "AIRTABLE_PHOTO_2_FIELD",
      "AIRTABLE_PHOTO_3_FIELD",
      "AIRTABLE_PHOTO_4_FIELD",
      "AIRTABLE_AGE_FIELD",
      "AIRTABLE_LOCATION_FIELD",
      "AIRTABLE_INDUSTRY_FIELD",
      "AIRTABLE_MBTI_FIELD",
      "AIRTABLE_INTRODUCE_FIELD",
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

export async function listAllRecords(tableName, params = {}) {
  const records = [];
  let offset = "";

  do {
    const page = await airtableRequest(tableName, {
      method: "GET",
      params: {
        ...params,
        pageSize: "100",
        offset
      },
      includeOffset: true
    });

    records.push(...page.records);
    offset = page.offset || "";
  } while (offset);

  return records;
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

export async function updateRecords(tableName, updates) {
  const updatedRecords = [];

  for (let index = 0; index < updates.length; index += 10) {
    const batch = updates.slice(index, index + 10);
    const records = await airtableRequest(tableName, {
      method: "PATCH",
      body: {
        records: batch.map(({ recordId, fields }) => ({
          id: recordId,
          fields
        })),
        typecast: true
      }
    });

    updatedRecords.push(...records);
  }

  return updatedRecords;
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
    RESULT_CONFIG.curatedPersonFields.map(async (fieldName, index) => {
      const personRecordId = firstLinkedRecordId(fields[fieldName]);

      if (!personRecordId) {
        return null;
      }

      const candidateFields = await getLinkedApplicantFields(personRecordId);
      const displayName = normalizeAirtableValue(candidateFields[RESULT_CONFIG.applicantNameField]) ||
        `추천 ${index + 1}`;
      const photoUrls = RESULT_CONFIG.photoFields
        .map((photoField) => getAttachmentUrl(candidateFields[photoField]))
        .filter(Boolean);

      return {
        id: personRecordId,
        choiceValue: personRecordId,
        personRecordId,
        slot: index + 1,
        initials: String.fromCharCode(65 + index),
        displayName,
        nameLine: displayName,
        overview: normalizeAirtableValue(fields[RESULT_CONFIG.curatedOverviewFields[index]]) || "공개 정보 준비 중",
        tags: buildCandidateTags(candidateFields),
        detail: normalizeAirtableValue(candidateFields[RESULT_CONFIG.introduceField]),
        photoUrl: photoUrls[0] || "",
        photoUrls
      };
    })
  );

  return profiles.filter(Boolean);
}

export async function getAllowedChoiceProfiles(fields) {
  return buildProfilesFromFields(fields);
}

export function getExistingChoiceValue(fields) {
  return firstLinkedRecordId(fields[RESULT_CONFIG.choiceField]) || null;
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
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(`${key}[]`, item));
    } else if (value !== undefined && value !== null && value !== "") {
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

  if (options.includeOffset) {
    return {
      records: data.records || [],
      offset: data.offset || ""
    };
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
  if (Array.isArray(value)) {
    return value.map(normalizeAirtableValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return normalizeAirtableValue(value.name ?? value.value ?? "");
  }
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

function buildCandidateTags(fields) {
  const age = normalizeAirtableValue(fields[RESULT_CONFIG.ageField]);
  const formattedAge = /^\d+(?:\.0+)?$/.test(age)
    ? `${Number.parseInt(age, 10)}세`
    : age;

  return [...new Set([
    formattedAge,
    normalizeAirtableValue(fields[RESULT_CONFIG.locationField]),
    normalizeAirtableValue(fields[RESULT_CONFIG.industryField]),
    normalizeAirtableValue(fields[RESULT_CONFIG.mbtiField])
  ].filter(Boolean))];
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
