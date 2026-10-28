// Critical Labs → MRP (Teams)
// Reads the launched patient's recent labs, flags critical results, and on the
// clinician's click sends them to a Power Automate flow that finds the MRP and
// posts a Teams chat message. Nothing is sent automatically.
(function () {
  "use strict";
  var C = window.CRIT_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var state = { patient: null, location: "", user: "", critical: [], all: [] };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function banner(cls, html) {
    var d = document.createElement("div");
    d.className = "banner " + cls;
    d.innerHTML = html;
    $("banners").appendChild(d);
  }
  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function storeGet() {
    try { return JSON.parse(localStorage.getItem("critlabs_sent") || "{}"); } catch (e) { return {}; }
  }
  function storeSet(obj) {
    try { localStorage.setItem("critlabs_sent", JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }

  function patientName(p) {
    var n = (p.name || []).find(function (x) { return x.use === "official"; }) || (p.name || [])[0] || {};
    var family = n.family || "";
    var given = (n.given || []).join(" ");
    return { family: family, given: given, display: n.text || (family + (given ? ", " + given : "")) };
  }
  function patientMrn(p) {
    var id = (p.identifier || []).find(function (i) {
      return ((i.type && i.type.coding) || []).some(function (c) { return c.code === "MR"; });
    });
    return id ? id.value : "";
  }

  // ---------- critical logic ----------
  var CRIT_CODES = ["HH", "LL", "AA"];

  function obsName(o) {
    return (o.code && (o.code.text || ((o.code.coding || [])[0] || {}).display)) || "Lab";
  }
  function obsLoincs(o) {
    return ((o.code && o.code.coding) || []).map(function (c) { return c.code; });
  }
  function obsValue(o) {
    if (o.valueQuantity) {
      return { num: o.valueQuantity.value, unit: o.valueQuantity.unit || o.valueQuantity.code || "",
               text: o.valueQuantity.value + " " + (o.valueQuantity.unit || "") };
    }
    if (o.valueString) return { num: null, unit: "", text: o.valueString };
    if (o.valueCodeableConcept) return { num: null, unit: "", text: o.valueCodeableConcept.text || "" };
    return { num: null, unit: "", text: "" };
  }

  function checkCritical(o) {
    // 1. Lab's own flag
    var interps = o.interpretation || [];
    for (var i = 0; i < interps.length; i++) {
      var codes = (interps[i].coding || []).map(function (c) { return (c.code || "").toUpperCase(); });
      var hit = codes.find(function (c) { return CRIT_CODES.indexOf(c) >= 0; });
      if (hit) return { critical: true, flag: hit, reason: "Flagged critical by lab (" + hit + ")" };
      if (/critical|panic/i.test(interps[i].text || "")) return { critical: true, flag: "CRIT", reason: "Flagged critical by lab" };
    }
    // 2. App thresholds (backup)
    var v = obsValue(o);
    if (typeof v.num !== "number") return { critical: false };
    var codesHere = obsLoincs(o);
    var rule = C.thresholds.find(function (t) {
      return t.loinc.some(function (l) { return codesHere.indexOf(l) >= 0; });
    });
    if (!rule) return { critical: false };
    var unitOk = rule.units.some(function (u) { return u.toLowerCase() === (v.unit || "").toLowerCase(); });
    if (!unitOk) return { critical: false, unitSkipped: true };
    if (rule.low != null && v.num < rule.low) return { critical: true, flag: "LL", reason: "Below app threshold (< " + rule.low + ")" };
    if (rule.high != null && v.num > rule.high) return { critical: true, flag: "HH", reason: "Above app threshold (> " + rule.high + ")" };
    return { critical: false };
  }

  // ---------- render ----------
  function render() {
    var sent = storeGet();
    var box = $("results");
    box.innerHTML = "";
    if (!state.critical.length) {
      banner("ok", "No critical results in the last " + C.lookbackHours + " hours.");
    } else {
      banner("crit", state.critical.length + " critical result" + (state.critical.length > 1 ? "s" : "") +
        " in the last " + C.lookbackHours + " hours");
      state.critical.forEach(function (r) {
        var wasSent = sent[r.id];
        var card = document.createElement("label");
        card.className = "card" + (wasSent ? " sent" : "");
        card.innerHTML =
          '<input type="checkbox" data-id="' + esc(r.id) + '"' + (wasSent ? "" : " checked") + ">" +
          "<div><div class=\"lab\">" + esc(r.name) + "</div>" +
          '<div class="val">' + esc(r.value) + " <small>" + esc(r.flag) + "</small></div>" +
          '<div class="meta">' + esc(fmtTime(r.time)) + " · " + esc(r.reason) +
          (wasSent ? " · <b>Sent " + esc(fmtTime(wasSent)) + "</b>" : "") + "</div></div>";
        box.appendChild(card);
      });
      $("sendBox").hidden = false;
    }
    $("allSummary").textContent = "All labs checked (" + state.all.length + ")";
    $("allLabs").innerHTML = "<table><tr><th>Time</th><th>Lab</th><th>Value</th><th>Flag</th></tr>" +
      state.all.map(function (r) {
        return "<tr><td>" + esc(fmtTime(r.time)) + "</td><td>" + esc(r.name) + "</td><td>" + esc(r.value) +
          "</td><td>" + esc(r.flagText) + "</td></tr>";
      }).join("") + "</table>";
  }

  // ---------- send ----------
  function buildMessage(selected, note) {
    var p = state.patient;
    var lines = selected.map(function (r) {
      return "<li><b>" + esc(r.name) + ": " + esc(r.value) + "</b> (" + esc(r.flag) + ") at " + esc(fmtTime(r.time)) + "</li>";
    }).join("");
    return "<p>🔴 <b>Critical lab result" + (selected.length > 1 ? "s" : "") + "</b></p>" +
      "<p><b>" + esc(p.name.display) + "</b> · MRN " + esc(p.mrn || "—") + (state.location ? " · " + esc(state.location) : "") + "</p>" +
      "<ul>" + lines + "</ul>" +
      (note ? "<p>Note: " + esc(note) + "</p>" : "") +
      "<p><i>Sent by " + esc(state.user || "clinician") + " via Critical Labs app. Please acknowledge.</i></p>";
  }

  function send() {
    var status = $("status");
    var ids = Array.prototype.map.call(document.querySelectorAll("#results input:checked"), function (el) { return el.dataset.id; });
    var selected = state.critical.filter(function (r) { return ids.indexOf(r.id) >= 0; });
    if (!selected.length) { status.textContent = "Select at least one result."; return; }
    if (!C.flowUrl) { status.innerHTML = "<b>No flow URL set.</b> Paste the Power Automate HTTP URL into config.js (flowUrl)."; return; }

    var p = state.patient;
    var payload = {
      patientName: p.name.display,
      patientFamily: p.name.family,
      patientGiven: p.name.given,
      mrn: p.mrn,
      fhirPatientId: p.id,
      location: state.location,
      sentBy: state.user,
      note: $("note").value.trim(),
      labs: selected.map(function (r) { return { name: r.name, value: r.value, flag: r.flag, time: r.time }; }),
      messageHtml: buildMessage(selected, $("note").value.trim())
    };

    $("sendBtn").disabled = true;
    status.textContent = "Sending…";
    fetch(C.flowUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (res) {
        return res.text().then(function (t) {
          var body = {};
          try { body = JSON.parse(t); } catch (e) { /* not JSON */ }
          return { ok: res.ok, code: res.status, body: body };
        });
      })
      .then(function (r) {
        if (r.ok && r.body.status === "sent") {
          var sent = storeGet(), now = new Date().toISOString();
          selected.forEach(function (x) { sent[x.id] = now; });
          storeSet(sent);
          $("banners").innerHTML = "";
          banner("ok", "Sent to <b>" + esc(r.body.mrpName || "MRP") + "</b> in Teams.");
          render();
        } else if (r.code === 404 || r.body.status === "mrp_not_found") {
          status.innerHTML = "<b>MRP not found</b> for this patient in the SharePoint list. Nothing was sent — please call the MRP / page the intake hospitalist.";
        } else {
          status.innerHTML = "<b>Send failed</b> (HTTP " + r.code + "). Nothing confirmed — please call the MRP.";
        }
      })
      .catch(function (e) {
        status.innerHTML = "<b>Send failed</b> (" + esc(e.message) + "). Please call the MRP.";
      })
      .finally(function () { $("sendBtn").disabled = false; });
  }

  // ---------- load ----------
  function process(observations) {
    state.all = []; state.critical = [];
    observations
      .filter(function (o) { return o && o.resourceType === "Observation" && o.status !== "entered-in-error"; })
      .forEach(function (o) {
        var v = obsValue(o);
        var chk = checkCritical(o);
        var time = o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued;
        var flagText = ((o.interpretation || [])[0] && ((o.interpretation[0].coding || [])[0] || {}).code) || "";
        var row = { id: o.id, name: obsName(o), value: v.text, time: time, flagText: flagText };
        state.all.push(row);
        if (chk.critical) state.critical.push(Object.assign({ flag: chk.flag, reason: chk.reason }, row));
      });
    var byTime = function (a, b) { return new Date(b.time) - new Date(a.time); };
    state.all.sort(byTime); state.critical.sort(byTime);
  }

  function showPatient() {
    var p = state.patient;
    $("patient").textContent = p.name.display + " · MRN " + (p.mrn || "—") + (state.location ? " · " + state.location : "");
  }

  function loadFromFhir(client) {
    var since = new Date(Date.now() - C.lookbackHours * 3600 * 1000).toISOString();
    var pid = client.patient.id;

    var pPatient = client.patient.read().then(function (p) {
      state.patient = { id: p.id, name: patientName(p), mrn: patientMrn(p) };
    });
    var pEnc = client.request("Encounter?patient=" + pid + "&status=in-progress&_count=5", { flat: true })
      .then(function (encs) {
        var e = (encs || []).find(function (x) { return x.resourceType === "Encounter"; });
        if (e && e.location && e.location.length) {
          state.location = e.location.map(function (l) { return l.location && l.location.display; }).filter(Boolean).join(" / ");
        }
      }).catch(function () { /* location is optional */ });
    var pUser = (client.user && client.user.fhirUser ? client.user.read() : Promise.resolve(null))
      .then(function (u) {
        if (u && u.name && u.name[0]) state.user = u.name[0].text || [ (u.name[0].given || []).join(" "), u.name[0].family ].join(" ");
      }).catch(function () { /* optional */ });
    var pObs = client.request(
      "Observation?patient=" + pid + "&category=laboratory&date=ge" + encodeURIComponent(since) + "&_count=100",
      { pageLimit: 10, flat: true }
    );

    return Promise.all([pPatient, pEnc, pUser, pObs]).then(function (res) {
      process(res[3] || []);
      showPatient();
      render();
    });
  }

  function loadDemo() {
    banner("warn", "<b>DEMO MODE</b> — made-up patient and results, no chart connection. For testing the Teams flow only.");
    var now = Date.now();
    state.patient = { id: "demo-1", name: { display: "TEST, Demo", family: "TEST", given: "Demo" }, mrn: "000000" };
    state.location = "VGH 6N Bed 12";
    state.user = "Demo User";
    var mk = function (id, loinc, name, val, unit, code, minsAgo) {
      return { resourceType: "Observation", id: id, status: "final",
        code: { text: name, coding: [{ system: "http://loinc.org", code: loinc }] },
        valueQuantity: { value: val, unit: unit },
        interpretation: code ? [{ coding: [{ code: code }] }] : [],
        effectiveDateTime: new Date(now - minsAgo * 60000).toISOString() };
    };
    process([
      mk("d1", "2823-3", "Potassium", 6.9, "mmol/L", "HH", 25),
      mk("d2", "718-7", "Hemoglobin", 62, "g/L", "", 90),
      mk("d3", "2951-2", "Sodium", 138, "mmol/L", "", 90),
      mk("d4", "2160-0", "Creatinine", 210, "umol/L", "H", 90)
    ]);
    showPatient();
    render();
  }

  // ---------- start ----------
  $("sendBtn").addEventListener("click", send);
  $("selectAll").addEventListener("click", function () {
    document.querySelectorAll("#results input").forEach(function (el) { el.checked = true; });
  });

  if (new URLSearchParams(location.search).get("demo") === "1") {
    loadDemo();
  } else {
    FHIR.oauth2.ready()
      .then(loadFromFhir)
      .catch(function (e) {
        $("patient").textContent = "";
        banner("crit", "Could not load chart data: " + esc(e.message || e) +
          "<br>Open launch.html from the chart (or standalone), or use index.html?demo=1 to test.");
      });
  }
})();
