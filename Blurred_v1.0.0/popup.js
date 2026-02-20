const DEFAULT_SETTINGS = {
  enabled: true,
  blurAll: false,
  targetPerson: "",
  keywords: "",
  blurIntensity: 4,
  concealMode: "blur"
};

const enabledInput = document.getElementById("enabled");
const blurAllInput = document.getElementById("blurAll");
const targetPersonInput = document.getElementById("targetPerson");
const keywordsInput = document.getElementById("keywords");
const blurIntensityInput = document.getElementById("blurIntensity");
const concealModeInput = document.getElementById("concealMode");
const intensityValue = document.getElementById("intensityValue");
const saveBtn = document.getElementById("saveBtn");
const statusText = document.getElementById("status");

function setStatus(text) {
  statusText.textContent = text;
}

function toKeywordString(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return (value || "").trim();
}

function loadSettings() {
  chrome.storage.sync.get(
    {
      ...DEFAULT_SETTINGS,
      targetNames: [],
      blurAmount: DEFAULT_SETTINGS.blurIntensity
    },
    (settings) => {
      const legacyTarget = (settings.targetNames || [])[0] || "";
      const effectiveTargetPerson = settings.targetPerson || legacyTarget;
      const effectiveIntensity =
        Number(settings.blurIntensity) || Number(settings.blurAmount) || DEFAULT_SETTINGS.blurIntensity;

      enabledInput.checked = Boolean(settings.enabled);
      blurAllInput.checked = Boolean(settings.blurAll);
      targetPersonInput.value = effectiveTargetPerson;
      keywordsInput.value = toKeywordString(settings.keywords);
      blurIntensityInput.value = String(effectiveIntensity);
      concealModeInput.value = settings.concealMode === "opaque" ? "opaque" : "blur";
      intensityValue.textContent = `${effectiveIntensity}px`;
    }
  );
}

function saveSettings() {
  const blurIntensity = Number(blurIntensityInput.value);
  const safeIntensity = Number.isFinite(blurIntensity) && blurIntensity > 0 ? blurIntensity : DEFAULT_SETTINGS.blurIntensity;
  const targetPerson = targetPersonInput.value.trim();

  const payload = {
    enabled: enabledInput.checked,
    blurAll: blurAllInput.checked,
    targetPerson,
    keywords: keywordsInput.value.trim(),
    blurIntensity: safeIntensity,
    concealMode: concealModeInput.value === "opaque" ? "opaque" : "blur",
    targetNames: targetPerson ? [targetPerson] : [],
    blurAmount: safeIntensity
  };

  chrome.storage.sync.set(payload, () => {
    if (chrome.runtime.lastError) {
      setStatus("Save failed. Try again.");
      return;
    }

    setStatus("Settings saved");
    setTimeout(() => setStatus(""), 1300);
  });
}

blurIntensityInput.addEventListener("input", () => {
  intensityValue.textContent = `${blurIntensityInput.value}px`;
});

saveBtn.addEventListener("click", saveSettings);
loadSettings();
