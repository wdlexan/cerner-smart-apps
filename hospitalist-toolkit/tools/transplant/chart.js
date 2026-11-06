/* Chart reading for the kidney transplant tab. READ-ONLY: fetches FHIR resources; engine.js turns them into facts.
   Drug levels and labs are found by LOINC and NAME (unverified): a result not shown may still be in the chart. */
(function () {
  const DAY = 864e5;
  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages, optional) {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try {
        const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), timer])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome");
        tell(`Loaded ${name} (${r.length})…`); return r;
      } catch (e) { if (!optional) errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const since90 = iso(Date.now() - 90 * DAY), since14 = iso(Date.now() - 14 * DAY);
    const [patient, labs, medreqs, admins, conditions, diet, svc] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since90}&_count=100`, "lab results incl. drug levels (90 days)", 10),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 4),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${since14}&_count=100`, "medications given (14 days)", 4),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`NutritionOrder?patient=${pid}&_count=50`, "diet orders", 1, true),     // optional: many sites do not expose these
      get(`ServiceRequest?patient=${pid}&_count=100`, "orders", 1, true)]);
    return { raw: { patient, obs: labs, medreqs, admins, conditions, orders: diet.concat(svc) }, errors };
  }
  window.TxChart = { gather };
})();
