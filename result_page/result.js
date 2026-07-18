const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";

const demoResult = {
  sessionToken: "demo-session-token",
  applicant: {
    name: "해리"
  },
  profiles: [
    {
      id: "demo-a",
      choiceValue: "A",
      slot: 1,
      initials: "A",
      nameLine: "A · 30세 · LA",
      overview: "제품 디자이너 · Google",
      tags: ["차분한", "운동", "독서"],
      detail: "대화의 속도가 차분하고, 주말에는 운동과 독서로 에너지를 회복하는 타입입니다.",
      photoUrl: ""
    },
    {
      id: "demo-b",
      choiceValue: "B",
      slot: 2,
      initials: "B",
      nameLine: "B · 28세 · LA",
      overview: "변호사 · Latham & Watkins",
      tags: ["유머러스", "와인", "여행"],
      detail: "일과 삶의 균형을 중요하게 생각하고, 좋은 음식과 여행 이야기를 좋아합니다.",
      photoUrl: ""
    },
    {
      id: "demo-c",
      choiceValue: "C",
      slot: 3,
      initials: "C",
      nameLine: "C · 31세 · SF",
      overview: "엔지니어 · Stripe",
      tags: ["스타트업", "요리", "하이킹"],
      detail: "호기심이 많고 직접 만들어보는 일을 좋아합니다. 자연 속에서 보내는 시간을 아낍니다.",
      photoUrl: ""
    }
  ]
};

const state = {
  sessionToken: null,
  applicant: null,
  profiles: [],
  selectedChoice: null,
  isSubmittingChoice: false
};

const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const authMessage = document.getElementById("auth-message");
const authView = document.getElementById("auth-view");
const resultView = document.getElementById("result-view");
const resultTitle = document.getElementById("result-title");
const resultSubtitle = document.getElementById("result-subtitle");
const profilesEl = document.getElementById("profiles");
const detailDialog = document.getElementById("detail-dialog");
const detailTitle = document.getElementById("detail-title");
const detailBody = document.getElementById("detail-body");
const detailClose = document.getElementById("detail-close");

function setMessage(message, type = "") {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", type === "error");
  authMessage.classList.toggle("is-success", type === "success");
}

function setLoginLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.textContent = isLoading ? "확인 중..." : "결과 확인하기";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "요청을 처리하지 못했습니다.");
    error.code = data.code;
    throw error;
  }

  return data;
}

function validateAuth(email, password) {
  if (!email || !email.includes("@")) {
    return "신청 시 입력한 이메일을 정확히 입력해 주세요.";
  }

  if (!/^\d{4}$/.test(password)) {
    return "4자리 숫자 비밀번호를 입력해 주세요.";
  }

  return "";
}

async function requestLogin(email, password) {
  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return demoResult;
  }

  return postJson("/api/result-login", {
    email,
    password
  });
}

async function submitChoice(choiceValue) {
  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      ok: true,
      choice: choiceValue,
      submittedAt: new Date().toISOString()
    };
  }

  return postJson("/api/result-choice", {
    sessionToken: state.sessionToken,
    choice: choiceValue
  });
}

function switchToResults() {
  authView.classList.remove("is-active");
  authView.hidden = true;
  resultView.hidden = false;
  resultView.classList.add("is-active");
}

function buildInitials(profile, index) {
  if (profile.initials) return profile.initials;
  const fallback = profile.displayName || profile.nameLine || String.fromCharCode(65 + index);
  return fallback.trim().charAt(0).toUpperCase();
}

function renderProfiles() {
  profilesEl.innerHTML = "";

  if (!state.profiles.length) {
    profilesEl.innerHTML = '<div class="profile-card"><p class="profile-meta">아직 표시할 큐레이션 정보가 없습니다.</p></div>';
    return;
  }

  state.profiles.forEach((profile, index) => {
    const isSelected = state.selectedChoice === profile.choiceValue;
    const card = document.createElement("article");
    card.className = "profile-card";

    const tags = Array.isArray(profile.tags) ? profile.tags : [];
    const tagMarkup = tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    const choiceButtonText = isSelected ? "선택 완료" : "호감 표시";
    const mediaMarkup = profile.photoUrl
      ? `<img class="profile-photo" src="${escapeHtml(profile.photoUrl)}" alt="" loading="lazy">`
      : `<div class="avatar" aria-hidden="true">${escapeHtml(buildInitials(profile, index))}</div>`;

    card.innerHTML = `
      <div class="profile-media">${mediaMarkup}</div>
      <div class="profile-main">
        <h2 class="profile-name">${escapeHtml(profile.nameLine || profile.displayName || `추천 ${index + 1}`)}</h2>
        <p class="profile-meta">${escapeHtml(profile.overview || "공개 정보 준비 중")}</p>
        <div class="profile-tags">${tagMarkup}</div>
      </div>
      <div class="profile-actions">
        <button class="secondary-button" type="button" data-detail="${escapeHtml(profile.id)}">자세히 보기</button>
        <button class="choice-button${isSelected ? " is-selected" : ""}" type="button" data-choice="${escapeHtml(profile.choiceValue)}" ${state.selectedChoice ? "disabled" : ""}>${choiceButtonText}</button>
      </div>
    `;

    profilesEl.appendChild(card);
  });
}

function renderResult(data) {
  state.sessionToken = data.sessionToken;
  state.applicant = data.applicant || {};
  state.profiles = Array.isArray(data.profiles) ? data.profiles : [];
  state.selectedChoice = data.existingChoice || null;

  const name = state.applicant.name || "당신";
  resultTitle.textContent = `${name} 님을 위한 세 분`;
  resultSubtitle.textContent = DEMO_MODE
    ? "데모 데이터로 결과 페이지 흐름을 확인하고 있습니다."
    : "결이 닿는 분들을 직접 큐레이팅했습니다.";

  renderProfiles();
  switchToResults();
}

function openDetail(profileId) {
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile) return;

  detailTitle.textContent = profile.nameLine || profile.displayName || "자세히 보기";
  const detailPhotos = [profile.photoUrl, profile.secondaryPhotoUrl].filter(Boolean);
  const photoMarkup = detailPhotos.length
    ? `<div class="detail-photo-grid">${detailPhotos.map((url) => `<img class="detail-photo" src="${escapeHtml(url)}" alt="" loading="lazy">`).join("")}</div>`
    : "";
  const detailText = profile.detail || "자세한 공개 정보는 추후 연결될 예정입니다.";
  detailBody.innerHTML = `${photoMarkup}<p class="detail-text">${escapeHtml(detailText)}</p>`;

  if (typeof detailDialog.showModal === "function") {
    detailDialog.showModal();
  } else {
    window.alert(detailBody.textContent);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value.trim();
  const validationError = validateAuth(email, password);

  if (validationError) {
    setMessage(validationError, "error");
    return;
  }

  setMessage("");
  setLoginLoading(true);

  try {
    const data = await requestLogin(email, password);
    renderResult(data);
  } catch (error) {
    if (error.code === "CONFIG_PENDING") {
      setMessage("Airtable 환경변수 또는 필드 설정이 아직 연결되지 않았습니다. demo=1 주소로 화면 흐름을 확인할 수 있습니다.", "error");
    } else {
      setMessage(error.message || "인증에 실패했습니다. 입력한 정보를 다시 확인해 주세요.", "error");
    }
  } finally {
    setLoginLoading(false);
  }
});

profilesEl.addEventListener("click", async (event) => {
  const detailButton = event.target.closest("[data-detail]");
  const choiceButton = event.target.closest("[data-choice]");

  if (detailButton) {
    openDetail(detailButton.dataset.detail);
    return;
  }

  if (!choiceButton || state.isSubmittingChoice || state.selectedChoice) {
    return;
  }

  const choiceValue = choiceButton.dataset.choice;
  state.isSubmittingChoice = true;
  choiceButton.disabled = true;
  choiceButton.textContent = "저장 중...";

  try {
    const result = await submitChoice(choiceValue);
    state.selectedChoice = result.choice || choiceValue;
    renderProfiles();
  } catch (error) {
    choiceButton.disabled = false;
    choiceButton.textContent = "호감 표시";
    window.alert(error.message || "선택을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    state.isSubmittingChoice = false;
  }
});

detailClose.addEventListener("click", () => {
  detailDialog.close();
});

if (DEMO_MODE) {
  setMessage("데모 모드입니다. 아무 이메일과 4자리 숫자로 화면 흐름을 확인할 수 있습니다.", "success");
}
