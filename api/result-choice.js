import {
  RESULT_CONFIG,
  getAllowedChoiceProfiles,
  getExistingChoiceValue,
  getLinkedRecordIds,
  getRecord,
  isResultConfigReady,
  listAllRecords,
  updateRecord,
  updateRecords,
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
    const allowedChoiceProfiles = await getAllowedChoiceProfiles(fields);
    const selectedProfile = allowedChoiceProfiles.find((profile) => profile.choiceValue === choice);
    const existingChoice = getExistingChoiceValue(fields);

    if (!selectedProfile) {
      return res.status(400).json({ error: "큐레이팅된 후보 중에서만 선택할 수 있습니다." });
    }

    if (existingChoice && process.env.ALLOW_CHOICE_OVERWRITE !== "true") {
      return res.status(409).json({ error: "이미 선택이 완료되었습니다." });
    }

    const submittedAt = new Date().toISOString();
    const selectedRecordId = selectedProfile.personRecordId;

    await updateRecord(RESULT_CONFIG.applicantsTable, session.recordId, {
      [RESULT_CONFIG.choiceField]: [selectedRecordId],
      [RESULT_CONFIG.choiceSubmittedAtField]: submittedAt,
      [RESULT_CONFIG.matchStatusField]: "pending",
      [RESULT_CONFIG.matchedWithField]: [],
      [RESULT_CONFIG.matchedAtField]: null
    });

    const candidate = await getRecord(RESULT_CONFIG.applicantsTable, selectedRecordId);
    const candidateFields = candidate.fields || {};
    const candidateChoiceIds = getLinkedRecordIds(candidateFields[RESULT_CONFIG.choiceField]);
    const candidateHasSubmitted = Boolean(
      candidateFields[RESULT_CONFIG.choiceSubmittedAtField] || candidateChoiceIds.length
    );
    const isMutualMatch = candidateChoiceIds.includes(session.recordId);
    const matchStatus = isMutualMatch
      ? "matched"
      : candidateHasSubmitted
        ? "Failed"
        : "pending";
    const matchedWith = isMutualMatch ? selectedRecordId : null;

    if (isMutualMatch) {
      const matchedAt = candidateFields[RESULT_CONFIG.matchedAtField] || submittedAt;

      await Promise.all([
        updateRecord(RESULT_CONFIG.applicantsTable, session.recordId, {
          [RESULT_CONFIG.matchStatusField]: "matched",
          [RESULT_CONFIG.matchedWithField]: [selectedRecordId],
          [RESULT_CONFIG.matchedAtField]: matchedAt
        }),
        updateRecord(RESULT_CONFIG.applicantsTable, selectedRecordId, {
          [RESULT_CONFIG.matchStatusField]: "matched",
          [RESULT_CONFIG.matchedWithField]: [session.recordId],
          [RESULT_CONFIG.matchedAtField]: matchedAt
        })
      ]);
    } else if (matchStatus === "Failed") {
      await updateRecord(RESULT_CONFIG.applicantsTable, session.recordId, failedMatchFields());
    }

    await markNonMutualIncomingChoicesFailed(session.recordId, selectedRecordId);

    return res.status(200).json({
      ok: true,
      choice: selectedProfile.choiceValue,
      submittedAt,
      matchStatus,
      matchedWith
    });
  } catch (error) {
    if (error.message === "INVALID_SESSION" || error.message === "EXPIRED_SESSION") {
      return res.status(401).json({ error: "인증 시간이 만료되었습니다. 다시 로그인해 주세요." });
    }

    console.error("result-choice error:", error);
    return res.status(500).json({ error: "선택 정보를 저장하지 못했습니다." });
  }
}

async function markNonMutualIncomingChoicesFailed(applicantRecordId, selectedRecordId) {
  const applicants = await listAllRecords(RESULT_CONFIG.applicantsTable, {
    fields: [
      RESULT_CONFIG.choiceField,
      RESULT_CONFIG.choiceSubmittedAtField,
      RESULT_CONFIG.matchStatusField,
      RESULT_CONFIG.matchedWithField,
      RESULT_CONFIG.matchedAtField
    ]
  });
  const updates = applicants
    .filter((record) => {
      if (record.id === selectedRecordId) return false;
      const choiceIds = getLinkedRecordIds(record.fields?.[RESULT_CONFIG.choiceField]);
      return choiceIds.includes(applicantRecordId);
    })
    .map((record) => ({
      recordId: record.id,
      fields: failedMatchFields()
    }));

  await updateRecords(RESULT_CONFIG.applicantsTable, updates);
}

function failedMatchFields() {
  return {
    [RESULT_CONFIG.matchStatusField]: "Failed",
    [RESULT_CONFIG.matchedWithField]: [],
    [RESULT_CONFIG.matchedAtField]: null
  };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body;
}
