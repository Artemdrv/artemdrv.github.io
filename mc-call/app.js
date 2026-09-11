(() => {
  "use strict";
  const STORAGE_FORCE = "mc-call-force-number-v1";
  const DISPLAY_KEY = "mc-call-last-display-v1";
  const FORCE_TAP_COUNT = 5;
  const FORCE_TAP_WINDOW_MS = 1650;
  const SEARCH_SINGLE_DELAY_MS = 460;
  const state = { raw: "", activeView: "dialerView", searchTapTimes: [], searchTimer: null, callStartedAt: null, callTimer: null };
  const $ = (id) => document.getElementById(id);
  const views = ["dialerView", "callsView", "contactsView", "searchView", "callView"];
  const numberDisplay = $("numberDisplay");
  const suggestions = $("suggestions");
  const suggestionNumber = $("suggestionNumber");
  const deleteButton = $("deleteButton");
  const addContactButton = $("addContactButton");
  const searchTab = $("searchTab");
  const tabBar = $("tabBar");
  const settingsSheet = $("settingsSheet");
  const settingsBackdrop = $("settingsBackdrop");
  const forceNumberInput = $("forceNumberInput");
  const toast = $("toast");

  function digitsOnly(value) { return String(value || "").replace(/\D/g, ""); }
  function formatBelarus(raw) {
    const hasPlus = raw.startsWith("+");
    const digits = digitsOnly(raw);
    if (!digits) return "";
    if (digits.startsWith("375")) {
      const rest = digits.slice(3, 12);
      let out = "+375";
      if (rest.length > 0) out += " (" + rest.slice(0, 2);
      if (rest.length >= 2) out += ")";
      if (rest.length > 2) out += " " + rest.slice(2, 5);
      if (rest.length > 5) out += "-" + rest.slice(5, 7);
      if (rest.length > 7) out += "-" + rest.slice(7, 9);
      return out;
    }
    const prefix = hasPlus ? "+" : "";
    const parts = [];
    let remaining = digits;
    if (remaining.length > 11) { parts.push(remaining.slice(0, remaining.length - 10)); remaining = remaining.slice(-10); }
    while (remaining.length > 4) { parts.push(remaining.slice(0, 3)); remaining = remaining.slice(3); }
    if (remaining) parts.push(remaining);
    return prefix + parts.join(" ");
  }

  function renderNumber() {
    const formatted = formatBelarus(state.raw);
    numberDisplay.textContent = formatted;
    numberDisplay.classList.remove("size-medium", "size-small");
    if (formatted.length > 18) numberDisplay.classList.add("size-small");
    else if (formatted.length > 13) numberDisplay.classList.add("size-medium");
    const d = digitsOnly(state.raw).length;
    const hasNumber = d > 0 || state.raw.includes("+");
    deleteButton.classList.toggle("is-hidden", !hasNumber);
    const showSuggestions = d >= 4 && d <= 7;
    suggestions.classList.toggle("is-hidden", !showSuggestions);
    suggestions.setAttribute("aria-hidden", String(!showSuggestions));
    if (showSuggestions) suggestionNumber.textContent = formatted;
    addContactButton.classList.toggle("is-hidden", d < 10);
    try { localStorage.setItem(DISPLAY_KEY, state.raw); } catch (_) {}
  }
  function appendKey(key) { if (state.raw.length >= 20) return; if (key === "+" && state.raw.length > 0) return; state.raw += key; renderNumber(); }
  function deleteKey() { if (!state.raw) return; state.raw = state.raw.slice(0, -1); renderNumber(); }
  function clearNumber() { state.raw = ""; renderNumber(); }
  function pressVisual(button) { button.classList.add("is-pressed"); window.setTimeout(() => button.classList.remove("is-pressed"), 95); }

  function showView(id) {
    views.forEach((viewId) => { const el = $(viewId); if (el) el.classList.toggle("view--active", viewId === id); });
    state.activeView = id;
    tabBar.style.display = id === "callView" ? "none" : "flex";
    document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.toggle("tab-button--selected", btn.dataset.view === id));
    searchTab.classList.toggle("is-selected", id === "searchView");
  }

  function readForceNumber() { try { return localStorage.getItem(STORAGE_FORCE) || ""; } catch (_) { return ""; } }
  function openSettings() {
    window.clearTimeout(state.searchTimer); state.searchTimer = null; state.searchTapTimes = [];
    forceNumberInput.value = readForceNumber();
    settingsBackdrop.classList.add("is-open"); settingsSheet.classList.add("is-open");
    settingsBackdrop.setAttribute("aria-hidden", "false"); settingsSheet.setAttribute("aria-hidden", "false");
    window.setTimeout(() => forceNumberInput.focus(), 220);
  }
  function closeSettings() {
    forceNumberInput.blur(); settingsBackdrop.classList.remove("is-open"); settingsSheet.classList.remove("is-open");
    settingsBackdrop.setAttribute("aria-hidden", "true"); settingsSheet.setAttribute("aria-hidden", "true");
  }
  function saveForceNumber() {
    const value = forceNumberInput.value.trim();
    try { localStorage.setItem(STORAGE_FORCE, value); } catch (_) {}
    closeSettings(); showToast("Готово");
  }
  function showToast(message) { toast.textContent = message; toast.classList.add("show"); window.setTimeout(() => toast.classList.remove("show"), 1100); }

  function handleSearchTap() {
    const now = Date.now();
    state.searchTapTimes = state.searchTapTimes.filter((t) => now - t <= FORCE_TAP_WINDOW_MS);
    state.searchTapTimes.push(now);
    if (state.searchTapTimes.length >= FORCE_TAP_COUNT) { openSettings(); return; }
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => { state.searchTapTimes = []; showView("searchView"); }, SEARCH_SINGLE_DELAY_MS);
  }

  function formattedForCall() { return formatBelarus(state.raw) || state.raw || "Неизвестный"; }
  async function requestBackendCall(displayNumber, forceNumber) {
    const endpoint = String(window.MC_CALL_ENDPOINT || "").trim();
    if (!endpoint) return { mode: "demo", ok: true };
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayNumber, forceNumber }), credentials: "omit" });
    if (!response.ok) throw new Error(`Call endpoint returned ${response.status}`);
    return { mode: "backend", ok: true };
  }
  async function startCall() {
    if (!digitsOnly(state.raw)) return;
    const displayNumber = formattedForCall();
    const forceNumber = readForceNumber();
    $("activeCallNumber").textContent = displayNumber;
    $("activeCallStatus").textContent = "вызов...";
    showView("callView"); state.callStartedAt = Date.now();
    try { await requestBackendCall(displayNumber, forceNumber); } catch (error) { console.error(error); }
  }
  function endCall() { if (state.callTimer) window.clearInterval(state.callTimer); state.callTimer = null; state.callStartedAt = null; clearNumber(); showView("dialerView"); }

  document.querySelectorAll(".dial-key").forEach((button) => {
    let longTimer = null; let longPressed = false; const key = button.dataset.key;
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); pressVisual(button); if (key === "0") { longPressed = false; longTimer = window.setTimeout(() => { longPressed = true; appendKey("+"); }, 520); } });
    button.addEventListener("pointerup", (event) => { event.preventDefault(); if (longTimer) window.clearTimeout(longTimer); if (!(key === "0" && longPressed)) appendKey(key); longTimer = null; longPressed = false; });
    button.addEventListener("pointercancel", () => { if (longTimer) window.clearTimeout(longTimer); longTimer = null; longPressed = false; });
  });

  deleteButton.addEventListener("click", deleteKey);
  deleteButton.addEventListener("pointerdown", () => {
    const started = Date.now();
    const repeater = window.setInterval(() => { if (Date.now() - started > 420) deleteKey(); }, 90);
    const stop = () => { window.clearInterval(repeater); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
    window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
  });
  $("callButton").addEventListener("click", startCall);
  $("hangupButton").addEventListener("click", endCall);
  searchTab.addEventListener("click", handleSearchTap);
  document.querySelectorAll(".tab-button").forEach((btn) => btn.addEventListener("click", () => { window.clearTimeout(state.searchTimer); state.searchTapTimes = []; showView(btn.dataset.view); }));
  $("closeSettings").addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", closeSettings);
  $("applySettings").addEventListener("click", saveForceNumber);
  $("clearForceNumber").addEventListener("click", () => { forceNumberInput.value = ""; forceNumberInput.focus(); });
  forceNumberInput.addEventListener("keydown", (event) => { if (event.key === "Enter") saveForceNumber(); });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  renderNumber(); showView("dialerView");
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {}));
})();
