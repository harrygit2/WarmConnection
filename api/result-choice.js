import {
  RESULT_CONFIG,
  getAllowedChoiceValues,
  getRecord,
  isResultConfigReady,
  normalizeAirtableValue,
  updateRecord,
  verifySessionToken
} from "./_airtable.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  if (!isResultConfigReady()) {
    return res.status(501).json({
      code: "CONFIG_PENDING",
      error: "Airtable 환경변수 또는 필드 설정이 아직 필요합니다."
    });
  }

  try {
    const body = parseBody(req);
    const session = verifySessionToken(body.sessionToken);
    const choice = String(body.choice || "").trim();

    if (!choice) {
      return res.status(400).json({ error: "선택한 사람이 없습니다." });
    }

    const applicant = await getRecord(RESULT_CONFIG.applicantsTable, session.recordId);
    const fields = applicant.fields || {};
    const allowedChoices = getAllowedChoiceValues(fields);
    const existingChoice = normalizeAirtableValue(fields[RESULT_CONFIG.choiceField]);

    if (!allowedChoices.includes(choice)) {
      return res.status(400).json({ error: "큐레이팅된 후보 중에서만 선택할 수 있습니다." });
    }

    if (existingChoice && process.env.ALLOW_CHOICE_OVERWRITE !== "true") {
      return res.status(409).json({ error: "이미 선택이 완료되었습니다." });
    }

    const submittedAt = new Date().toISOString();

    await updateRecord(RESULT_CONFIG.applicantsTable, session.recordId, {
      [RESULT_CONFIG.choiceField]: choice,
      [RESULT_CONFIG.choiceSubmittedAtField]: submittedAt
    });

    return res.status(200).json({
      ok: true,
      choice,
      submittedAt
    });
  } catch (error) {
    if (error.message === "INVALID_SESSION" || error.message === "EXPIRED_SESSION") {
      return res.status(401).json({ error: "인증 시간이 만료되었습니다. 다시 로그인해 주세요." });
    }

    console.error("result-choice error:", error);
    return res.status(500).json({ error: "선택 정보를 저장하지 못했습니다." });
  }
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body;
}
