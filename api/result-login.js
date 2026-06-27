import {
  RESULT_CONFIG,
  buildProfilesFromFields,
  configSummary,
  createSessionToken,
  fieldRef,
  formulaString,
  isResultConfigReady,
  listRecords,
  normalizeEmail,
  normalizeAirtableValue,
  normalizePassword
} from "./_airtable.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  if (!isResultConfigReady()) {
    return res.status(501).json({
      code: "CONFIG_PENDING",
      error: "Airtable 환경변수 또는 필드 설정이 아직 필요합니다.",
      config: configSummary()
    });
  }

  try {
    const body = parseBody(req);
    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);

    if (!email || !password) {
      return res.status(400).json({ error: "이메일과 비밀번호를 입력해 주세요." });
    }

    if (!/^\d{4}$/.test(password)) {
      return res.status(400).json({ error: "4자리 숫자 비밀번호를 입력해 주세요." });
    }

    const records = await listRecords(RESULT_CONFIG.applicantsTable, {
      maxRecords: "1",
      filterByFormula: `LOWER(${fieldRef(RESULT_CONFIG.emailField)}) = ${formulaString(email)}`
    });

    const applicant = records[0];

    if (!applicant) {
      return res.status(401).json({ error: "이메일 또는 비밀번호가 일치하지 않습니다." });
    }

    const fields = applicant.fields || {};
    const expectedPassword = normalizePassword(fields[RESULT_CONFIG.passwordField]);

    if (expectedPassword !== password) {
      return res.status(401).json({ error: "이메일 또는 비밀번호가 일치하지 않습니다." });
    }

    const sessionToken = createSessionToken({
      recordId: applicant.id,
      email
    });

    return res.status(200).json({
      sessionToken,
      applicant: {
        name: fields[RESULT_CONFIG.applicantNameField] || "신청자"
      },
      profiles: buildProfilesFromFields(fields),
      existingChoice: normalizeAirtableValue(fields[RESULT_CONFIG.choiceField]) || null
    });
  } catch (error) {
    console.error("result-login error:", error);
    return res.status(500).json({ error: "결과 정보를 불러오지 못했습니다." });
  }
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body;
}
