/* Hospitalist Toolkit - POCKET MODE (iPhone home-screen app, no Cerner connection).
   Opened as index.html?pocket=1 (the home-screen icon starts here; see pocket.webmanifest).
   It saves a pretend sign-in record for a blank, local-only patient ("pdfpt-pocket") with a server address that does not exist
   (offline.invalid), so pdf-overlay.js answers every chart request locally with nothing and no request can ever reach Cerner.
   The tabs then run unchanged: reference sections, calculators and anything you type work; chart-reading parts show as empty.
   shell.js hides the tabs that only read the chart (POCKET_HIDE) and the Import PDF button.
   pocket-sw.js keeps a copy of every page so the app opens with no signal. Nothing about patients is stored. */
(function () {
  const q = new URLSearchParams(location.search);
  if (q.get("pocket") !== "1") return;
  const PID = "pdfpt-pocket", KEY = "pocket-mode";
  try {
    ["toolkit-target", "pdfpt-return", "toolkit-test"].forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.setItem("SMART_KEY", JSON.stringify(KEY));
    sessionStorage.setItem(KEY, JSON.stringify({
      key: KEY,
      serverUrl: "https://offline.invalid/fhir", // not a real address: nothing can be sent to Cerner from pocket mode
      clientId: "pocket-mode",
      tokenResponse: { patient: PID }
    }));
    sessionStorage.setItem("pdfimport:" + PID, JSON.stringify({
      items: [], files: [],
      patient: { resourceType: "Patient", id: PID, name: [{ text: "No patient · pocket mode (not connected to Cerner)" }] }
    }));
    sessionStorage.setItem("toolkit-pocket", "1");
  } catch (e) { /* private browsing may block storage; shell.js shows the error */ }
  window.TK_POCKET = true;
  document.documentElement.classList.add("pocket");
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("pocket-sw.js").catch(() => {}));
  }
})();
