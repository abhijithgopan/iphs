"use strict";
/* ==============================================================
   IPHS Assessment Tool — PWA port of iphs_analysis_app_v6_11.py
   All calculation logic mirrors the original Python app exactly:
   domain scoring, compliance bands, sum-vs-granular aggregation,
   and the iGPT standard-variable rules.
   ============================================================== */

// ---------------- constants (mirrors MINISTRY_WEIGHTS etc.) ----------------
const MINISTRY_WEIGHTS = {
  "Diagnostic": 20, "Drugs": 20, "Human Resource": 20,
  "Infrastructure": 10, "Governance": 10, "Services": 20,
};
const DOMAIN_CODES = {
  "Diagnostic": "DIAGNOSTIC", "Drugs": "DRUGS", "Human Resource": "HR",
  "Infrastructure": "INFRASTRUCTURE", "Governance": "GOVERNANCE", "Services": "SERVICES",
};
const DOMAIN_ORDER = Object.keys(MINISTRY_WEIGHTS);
const ANY_FACILITY_TOKENS = new Set(["all", "any", "*"]);
const COMPLIANT_MIN = 80.0;
const PROGRESSIVE_MIN = 50.0;
const COMPLIANCE_CATEGORIES = ["Compliant", "Progressive", "Aspirant"];
const CATEGORY_COLORS = { Compliant: "#8FD98F", Progressive: "#FFE066", Aspirant: "#FF9999" };
const SUMMARY_CACHE_MAX = 100;

// Embedded original iGPT calculation rules: "indicator|raw_variable|domain" -> standard_variable
const IGPT_STANDARD_VARIABLES = {"Medical Suprintendent|select_hr_ms|Human Resource":"std_hr_ms","Hospital Manager|select_hr_hm|Human Resource":"std_hr_hm","Assistant Store Manager|select_hr_asm|Human Resource":"std_hr_asm","Nursing Superintendent (Administrative cum clinical staff)|select_hr_nurse_sup|Human Resource":"std_hr_nurse_sup","Deputy Nursing Superintendent/ Supervisor (Administrative cum clinical staff)|select_hr_dns|Human Resource":"std_hr_dns","Bio-medical Engineer|select_hr_bioeng|Human Resource":"std_hr_bioeng","Medical Records Officer|select_hr_record|Human Resource":"std_hr_record","Health Information Management Professional/ Medical Record Analyst/ Medical Record Assistant|select_hr_himp|Human Resource":"std_hr_himp","Accounts/ Finance|select_hr_acc|Human Resource":"std_hr_acc","Data Entry Operators|select_hr_deo|Human Resource":"std_hr_deo","CSSD & Laundry Supervisor|select_hr_cssd|Human Resource":"std_hr_cssd","Sanitary Inspector|select_hr_sanitary|Human Resource":"std_hr_sanitary","Designated officer for fire safety|select_hr_fire|Human Resource":"std_hr_fire","Nursing In charge (Administrative cum clinical staff)|select_hr_nur_ic|Human Resource":"std_hr_nur_ic","Registration Clerk|select_hr_registration|Human Resource":"std_hr_registration","PRO/Receptionist|select_hr_receptionist|Human Resource":"std_hr_receptionist","GR Help Desk Facilitator|select_hr_gr_helpdesk|Human Resource":"std_hr_gr_helpdesk","Polyclinic Specialist|select_hr_sp_polyclinic|Human Resource":"std_hr_sp_polyclinic","Medicine Specialist|select_hr_meds|Human Resource":"std_hr_meds","Physician/Family Medicine Specialist|select_hr_fm|Human Resource":"std_hr_fm","Surgeon|select_hr_sur|Human Resource":"std_hr_sur","Paediatrician|select_hr_ped|Human Resource":"std_hr_ped","Gynaecologist|select_hr_gyn|Human Resource":"std_hr_gyn","Anesthesiologist|select_hr_ane|Human Resource":"std_hr_ane","Ophthalmologist|select_hr_oph|Human Resource":"std_hr_oph","Orthopedician|select_hr_ort|Human Resource":"std_hr_ort","Radiologist|select_hr_rad|Human Resource":"std_hr_rad","ENT Specialist|select_hr_ent|Human Resource":"std_hr_ent","Dentist|select_hr_den|Human Resource":"std_hr_den","MO Dental|select_hr_den_mo|Human Resource":"std_hr_den_mo","Dermatologist|select_hr_der|Human Resource":"std_hr_der","Psychiatrist|select_hr_psy|Human Resource":"std_hr_psy","Neonatologist|select_hr_neo|Human Resource":"std_hr_neo","Specialist Emergency Medicine|select_hr_emr|Human Resource":"std_hr_emr","Forensic Specialist|select_hr_for|Human Resource":"std_hr_for","Microbiologist / Pathologist / Biochemist|select_hr_pmb_tot|Human Resource":"std_hr_pmb_tot","Medical Officer|select_hr_mo|Human Resource":"std_hr_mo","Staff Nurse|select_hr_staff_nurse|Human Resource":"std_hr_staff_nurse","Community Health Officer (CHO)|select_hr_cho|Human Resource":"std_hr_cho","Medical Social Worker/Community based rehabilitation worker/ Social Worker/Clinical Social worker|select_hr_msw|Human Resource":"std_hr_msw","Clinical Psychologist|select_hr_cp|Human Resource":"std_hr_cp","Psychiatrist Nurse (NMHP)|select_hr_nmhp|Human Resource":"std_hr_nmhp","Community Nurse (NMHP)|select_hr_cn_nmhp|Human Resource":"std_hr_cn_nmhp","Medical lab technologists/ Laboratory Technician|select_hr_mtlt|Human Resource":"std_hr_mtlt","ECG Technologists/ECG Technician|select_hr_ecg_tech|Human Resource":"std_hr_ecg_tech","Laundry Technician|select_hr_laun_tech|Human Resource":"std_hr_laun_tech","Laundry Assistant|select_hr_laun_asst|Human Resource":"std_hr_laun_asst","CSSD Technician|select_hr_cssd_tech|Human Resource":"std_hr_cssd_tech","CSSD Assistant|select_hr_cssd_asst|Human Resource":"std_hr_cssd_asst","Dental Technician|select_hr_dent_tech|Human Resource":"std_hr_dent_tech","Dental Assistant|select_hr_dent_asst|Human Resource":"std_hr_dent_asst","Dental Hygienist|select_hr_dent_hygi|Human Resource":"std_hr_dent_hygi","Dermatology Technician|select_hr_derm_tech|Human Resource":"std_hr_derm_tech","Dialysis Therapy Technologists/ Dialysis technician|select_hr_dial_tech|Human Resource":"std_hr_dial_tech","Cytotechnologist/ Cyto-Technician|select_hr_cyto_tech|Human Resource":"std_hr_cyto_tech","PFT Technician|select_hr_pft_tech|Human Resource":"std_hr_pft_tech","OT Technologist/ OT Technician|select_hr_ot_tech|Human Resource":"std_hr_ot_tech","TSSU Assistant|select_hr_tssu_asst|Human Resource":"std_hr_tssu_asst","Blood Bank technician/ Hemato Technologist|select_hr_hema_tech|Human Resource":"std_hr_hema_tech","Optometrist/ Ophthalmic Assistant/ Vision Technician|select_hr_opht_asst|Human Resource":"std_hr_opht_asst","Radiology and Imaging Technologists/Radiology Technician|select_hr_radi_tech|Human Resource":"std_hr_radi_tech","Pharmacist|select_hr_pharma|Human Resource":"std_hr_pharma","Storekeeper/Store In charge|select_hr_store|Human Resource":"std_hr_store","Dietician|select_hr_diet|Human Resource":"std_hr_diet","Assistant Dietician|select_hr_diet_asst|Human Resource":"std_hr_diet_asst","Physiotherapist|select_hr_physio|Human Resource":"std_hr_physio","Counsellor / Health Educator|select_hr_counsellor|Human Resource":"std_hr_counsellor","Audiologist|select_hr_audio|Human Resource":"std_hr_audio","Dresser|select_hr_dresser|Human Resource":"std_hr_dresser","Health Worker (Female)/ ANM|select_hr_anm|Human Resource":"std_hr_anm","Health Worker/Health Assistant (Male)|select_hr_hwam|Human Resource":"std_hr_hwam","Health Assistant (Female)/ Lady Health Visitor|select_hr_hwaf|Human Resource":"std_hr_hwaf","Cold chain/Vaccine logistic Assistant|select_hr_logi_asst|Human Resource":"std_hr_logi_asst","Public Health Manager|select_hr_phm|Human Resource":"std_hr_phm","MPW (Male)/2nd ANM|select_hr_mpw|Human Resource":"std_hr_mpw"};

// ---------------- data helpers (mirrors num/get/is_applicable/etc.) ----------------

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const v = parseFloat(value);
  return Number.isNaN(v) ? null : v;
}
const numericValue = num;

function get(row, idx, name) {
  const j = idx[name];
  if (j === undefined || j === null || j >= row.length) return null;
  const v = row[j];
  return v === undefined ? null : v;
}

function splitFacilityTypes(value) {
  if (value === null || value === undefined || value === "") return new Set();
  return new Set(String(value).split(",").map(s => s.trim()).filter(Boolean));
}

function isApplicable(m, ft, fst) {
  const types = splitFacilityTypes(m.applicable_facility_types);
  if (types.size === 0 || [...types].some(t => ANY_FACILITY_TOKENS.has(t))) return true;
  return types.has(ft) || types.has(fst);
}

function domainScore(row, idx, domain) {
  const code = DOMAIN_CODES[domain];
  return {
    obtained: num(get(row, idx, `FINAL_MARKS_OBT_${code}`)),
    maximum: num(get(row, idx, `FINAL_MARKS_MAX_${code}`)),
    percentage: num(get(row, idx, `FINAL_MARKS_PER_${code}`)),
    weight: MINISTRY_WEIGHTS[domain],
  };
}

function overallScore(row, idx) {
  let total = 0;
  for (const domain of DOMAIN_ORDER) {
    const d = domainScore(row, idx, domain);
    if (d.percentage === null) return null;
    total += Math.round(d.percentage * d.weight / 100 * 100) / 100;
  }
  return Math.round(total * 100) / 100;
}

function complianceCategory(score) {
  if (score === null || score === undefined) return null;
  if (score >= COMPLIANT_MIN) return "Compliant";
  if (score >= PROGRESSIVE_MIN) return "Progressive";
  return "Aspirant";
}

function isPresent(value) {
  if (value === null || value === undefined || value === "") return false;
  const v = parseFloat(value);
  if (!Number.isNaN(v)) return v === 1.0;
  return ["yes", "y", "true", "present", "available", "pass"].includes(String(value).trim().toLowerCase());
}

function missingColor(missingPct, applicable) {
  if (applicable === null || applicable === undefined || applicable === 0 || missingPct === null || missingPct === undefined) {
    return "#FFFFFF";
  }
  if (missingPct <= 0) return "#BFE6BF";
  const t = Math.min(Math.max(missingPct, 0), 100) / 100.0;
  const g = Math.round(230 - t * 170);
  const b = Math.round(230 - t * 190);
  const hx = n => n.toString(16).toUpperCase().padStart(2, "0");
  return `#FF${hx(g)}${hx(b)}`;
}

function formatPct(value) {
  return (value === null || value === undefined) ? "" : `${value.toFixed(2)}%`;
}

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || "#FFFFFF";
}

// mirrors aggregate_indicator()
function aggregateIndicator(members, m, idx, granular) {
  const rawVar = m.raw_variable || "";
  const stdVar = m.standard_variable || "";

  if (!members.length) return { required: 0, present: 0, missing: 0, missingPct: null };

  if (granular) {
    const [f] = members[0];
    const raw = get(f.row, idx, rawVar);
    if (stdVar) {
      let req = numericValue(get(f.row, idx, stdVar));
      let obs = numericValue(raw);
      req = req === null ? 0 : req;
      obs = obs === null ? 0 : obs;
      const missing = Math.max(req - obs, 0);
      return { required: req, present: obs, missing, missingPct: req === 0 ? null : (missing / req) * 100 };
    }
    const obs = isPresent(raw) ? 1 : 0;
    return { required: 1, present: obs, missing: 1 - obs, missingPct: obs ? 0.0 : 100.0 };
  }

  if (stdVar) {
    let required = 0;
    for (const [f] of members) {
      const v = numericValue(get(f.row, idx, stdVar));
      if (v !== null) required += v;
    }
    let present = 0;
    for (const [f] of members) {
      const v = numericValue(get(f.row, idx, rawVar));
      if (v !== null && v > 0) present += v;
    }
    if (required === 0) return { required: 0, present, missing: 0, missingPct: null };
    const missing = Math.max(required - present, 0);
    return { required, present, missing, missingPct: (missing / required) * 100 };
  }

  const required = members.length;
  let present = 0;
  for (const [f] of members) {
    if (isPresent(get(f.row, idx, rawVar))) present++;
  }
  const missing = required - present;
  return { required, present, missing, missingPct: required === 0 ? null : (missing / required) * 100 };
}

// ---------------- FastEngine (mirrors the Python class) ----------------

class FastEngine {
  constructor(mapping, idx) {
    this.mapping = mapping;
    this.idx = idx;
    this._poolCache = new Map();
    this._summaryCache = new Map(); // insertion-order = LRU order
    this._complianceCache = new Map();
    this._applicableCache = new Map();

    for (const m of mapping) {
      m._types = splitFacilityTypes(m.applicable_facility_types);
      const rawVar = m.raw_variable || "";
      const stdVar = m.standard_variable || "";
      m._rawCol = idx[rawVar] !== undefined ? idx[rawVar] : null;
      m._stdCol = stdVar && idx[stdVar] !== undefined ? idx[stdVar] : null;
    }
  }

  prepareFacilities(facilities) {
    this.facilities = facilities;
    this._poolCache.clear();
    this._summaryCache.clear();
    this._complianceCache.clear();

    this.byDistrict = new Map();
    this.byFt = new Map();
    this.byFst = new Map();
    this.byFacility = new Map();
    this.byDistrictFt = new Map();
    this.byDistrictFst = new Map();
    this.byFtFst = new Map();

    const push = (map, key, f) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    };
    const K = (...parts) => parts.join("\u0001");

    facilities.forEach((f, i) => {
      f._id = i;
      push(this.byDistrict, f.District, f);
      push(this.byFt, f.FT, f);
      push(this.byFst, f.FST, f);
      push(this.byFacility, f.Facility, f);
      push(this.byDistrictFt, K(f.District, f.FT), f);
      push(this.byDistrictFst, K(f.District, f.FST), f);
      push(this.byFtFst, K(f.FT, f.FST), f);
    });
  }

  compliance(f) {
    if (!this._complianceCache.has(f._id)) {
      this._complianceCache.set(f._id, complianceCategory(overallScore(f.row, this.idx)));
    }
    return this._complianceCache.get(f._id);
  }

  _isApplicableFast(m, ft, fst) {
    const key = `${m.indicator_id}\u0001${ft}\u0001${fst}`;
    if (this._applicableCache.has(key)) return this._applicableCache.get(key);
    const types = m._types;
    let result;
    if (types.size === 0 || [...types].some(t => ANY_FACILITY_TOKENS.has(t))) result = true;
    else result = types.has(ft) || types.has(fst);
    this._applicableCache.set(key, result);
    return result;
  }

  filteredPool(compliance = "All", district = "All", ft = "All", fst = "All", facility = "All") {
    const key = JSON.stringify(["pool", compliance, district, ft, fst, facility]);
    if (this._poolCache.has(key)) return this._poolCache.get(key);

    const K = (...parts) => parts.join("\u0001");
    let pool;
    if (district !== "All") {
      if (ft !== "All") {
        pool = (this.byDistrictFt.get(K(district, ft)) || []).slice();
        if (fst !== "All") pool = pool.filter(f => f.FST === fst);
      } else if (fst !== "All") {
        pool = (this.byDistrictFst.get(K(district, fst)) || []).slice();
      } else {
        pool = (this.byDistrict.get(district) || []).slice();
      }
    } else if (ft !== "All") {
      if (fst !== "All") pool = (this.byFtFst.get(K(ft, fst)) || []).slice();
      else pool = (this.byFt.get(ft) || []).slice();
    } else if (fst !== "All") {
      pool = (this.byFst.get(fst) || []).slice();
    } else if (facility !== "All") {
      pool = (this.byFacility.get(facility) || []).slice();
    } else {
      pool = this.facilities.slice();
    }

    if (facility !== "All") pool = pool.filter(f => f.Facility === facility);
    if (compliance !== "All") pool = pool.filter(f => this.compliance(f) === compliance);

    this._poolCache.set(key, pool);
    return pool;
  }

  getPoolSummary(filterKey, pool, granular) {
    const cacheKey = JSON.stringify(["summary", filterKey, granular]);
    if (this._summaryCache.has(cacheKey)) {
      const v = this._summaryCache.get(cacheKey);
      this._summaryCache.delete(cacheKey);
      this._summaryCache.set(cacheKey, v); // move to end (most-recently-used)
      return v;
    }

    const summary = new Map();
    for (const m of this.mapping) {
      const rawCol = m._rawCol, stdCol = m._stdCol;
      let members;

      if (stdCol !== null && stdCol !== undefined) {
        members = [];
        let required = 0;
        for (const f of pool) {
          const row = f.row;
          const rawVal = (rawCol !== null && rawCol < row.length) ? row[rawCol] : null;
          members.push([f, rawVal]);
          const stdVal = stdCol < row.length ? row[stdCol] : null;
          const nv = numericValue(stdVal);
          if (nv !== null) required += nv;
        }
        if (required <= 0) continue;
      } else {
        members = [];
        for (const f of pool) {
          if (this._isApplicableFast(m, f.FT, f.FST)) {
            const rawVal = (rawCol !== null && rawCol < f.row.length) ? f.row[rawCol] : null;
            members.push([f, rawVal]);
          }
        }
        if (!members.length) continue;
      }

      const agg = aggregateIndicator(members, m, this.idx, granular);
      summary.set(m.indicator_id, { meta: m, members, agg });
    }

    this._summaryCache.set(cacheKey, summary);
    if (this._summaryCache.size > SUMMARY_CACHE_MAX) {
      const oldestKey = this._summaryCache.keys().next().value;
      this._summaryCache.delete(oldestKey);
    }
    return summary;
  }
}

// ---------------- global app state ----------------

let headers = [], idxMap = {}, records = [], mapping = [], facilityRows = [], engine = null;
let currentSummary = new Map();
let currentPool = [];
let mappingFile = null, sourceFile = null;

const sortState = { summary: {}, };

// ---------------- file pickers ----------------

document.getElementById("mappingInput").addEventListener("change", (e) => {
  mappingFile = e.target.files[0] || null;
  document.getElementById("mappingName").textContent = mappingFile ? mappingFile.name : "Choose file…";
  updateLoadBtn();
});
document.getElementById("sourceInput").addEventListener("change", (e) => {
  sourceFile = e.target.files[0] || null;
  document.getElementById("sourceName").textContent = sourceFile ? sourceFile.name : "Choose file…";
  updateLoadBtn();
});
function updateLoadBtn() {
  document.getElementById("loadBtn").disabled = !(mappingFile && sourceFile);
}

// ---------------- tabs ----------------

function showTab(name) {
  document.getElementById("tab-summary").classList.toggle("hidden", name !== "summary");
  document.getElementById("tab-analysis").classList.toggle("hidden", name !== "analysis");
  document.getElementById("tabbtn-summary").classList.toggle("active", name === "summary");
  document.getElementById("tabbtn-analysis").classList.toggle("active", name === "analysis");
}

// ---------------- status / progress ----------------

function setStatus(msg) { document.getElementById("statusLine").textContent = msg; }
function setProgress(on) { document.getElementById("progressBar").classList.toggle("on", on); }

// ---------------- loading pipeline ----------------

async function loadData() {
  if (!mappingFile || !sourceFile) return;
  document.getElementById("loadBtn").disabled = true;
  setProgress(true);
  try {
    setStatus("Reading IPHS mapping…");
    const mappingText = await mappingFile.text();
    const parsed = Papa.parse(mappingText, { header: true, skipEmptyLines: true });
    mapping = parsed.data;

    setStatus("Applying original iGPT calculation rules…");
    for (const m of mapping) {
      const key = [
        (m.indicator || "").trim(),
        (m.raw_variable || "").trim(),
        (m.domain || "").trim(),
      ].join("|");
      const stdVar = IGPT_STANDARD_VARIABLES[key] || "";
      m.standard_variable = stdVar;
      m.igpt_calculation_class = stdVar ? "RAW_PLUS_STANDARD" : "RAW_ONLY";
    }

    setStatus("Reading ODK workbook (this can take a while for large files)…");
    await new Promise(r => setTimeout(r, 30)); // let the status paint before the heavy parse
    const buf = await sourceFile.arrayBuffer();
    if (typeof XLSX === "undefined") {
      throw new Error("The spreadsheet engine failed to load from the CDN. Check your internet connection and try again.");
    }
    const wb = XLSX.read(buf, { type: "array", dense: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: true });

    if (rows.length < 3) {
      throw new Error("The ODK file does not contain the expected two header rows.");
    }
    headers = rows[1];
    records = rows.slice(2);
    idxMap = {};
    headers.forEach((h, i) => { if (h !== null && h !== undefined && h !== "") idxMap[h] = i; });

    setStatus("Building facility index…");
    await new Promise(r => setTimeout(r, 10));
    facilityRows = [];
    for (const row of records) {
      const facility = get(row, idxMap, "Facility");
      if (facility === null || facility === undefined || facility === "") continue;
      facilityRows.push({
        Facility: String(facility),
        State: get(row, idxMap, "STATE_NAME") || "",
        District: get(row, idxMap, "DISTRICT_NAME") || "",
        Block: get(row, idxMap, "BLOCK_NAME") || "",
        FT: get(row, idxMap, "FT") || "",
        FST: get(row, idxMap, "FST") || "",
        row,
      });
    }
    if (!facilityRows.length) {
      throw new Error("The ODK file was read successfully, but no facility rows were found.");
    }

    setStatus("Building calculation cache…");
    await new Promise(r => setTimeout(r, 10));
    engine = new FastEngine(mapping, idxMap);
    engine.prepareFacilities(facilityRows);

    setStatus(`Loaded ${facilityRows.length.toLocaleString()} facilities and ${mapping.length.toLocaleString()} indicators.`);
    refreshAll();
  } catch (err) {
    console.error(err);
    setStatus("Loading failed — see the error message.");
    alert("Could not load the files.\n\nDetails: " + (err && err.message ? err.message : err));
  } finally {
    setProgress(false);
    document.getElementById("loadBtn").disabled = false;
  }
}

function refreshAll() {
  if (!facilityRows.length) return;
  refreshSummaryTab();
  populateAnalysisFilterOptions();
  refreshAnalysisTab();
}

// ---------------- Summary tab ----------------

function refreshSummaryTab() {
  if (!facilityRows.length) return;

  const total = facilityRows.length;
  const districts = new Set(facilityRows.map(f => f.District));
  const ftCounts = {};
  for (const f of facilityRows) ftCounts[f.FT] = (ftCounts[f.FT] || 0) + 1;

  const catCounts = {};
  for (const f of facilityRows) {
    const cat = complianceCategory(overallScore(f.row, idxMap));
    if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;
  }

  document.getElementById("kpiFacilities").textContent = total;
  document.getElementById("kpiDistricts").textContent = districts.size;
  document.getElementById("kpiDH").textContent = ftCounts["DH"] || 0;
  document.getElementById("kpiCHC").textContent = ftCounts["CHC"] || 0;
  document.getElementById("kpiSDH").textContent = ftCounts["SDH"] || 0;
  document.getElementById("kpiPHC").textContent = ftCounts["PHC"] || 0;
  document.getElementById("kpiSHC").textContent = ftCounts["SHC"] || 0;
  document.getElementById("kpiCompliant").textContent = catCounts["Compliant"] || 0;
  document.getElementById("kpiProgressive").textContent = catCounts["Progressive"] || 0;
  document.getElementById("kpiAspirant").textContent = catCounts["Aspirant"] || 0;

  const groupBy = document.getElementById("summaryGroupBy").value;
  const headingText = {
    "District": "District", "Facility Type": "Facility Type",
    "Facility Sub-Type": "Facility Sub-Type", "Specific Facility": "Facility",
  }[groupBy];

  let keyFn;
  if (groupBy === "District") keyFn = f => f.District;
  else if (groupBy === "Facility Type") keyFn = f => f.FT;
  else if (groupBy === "Facility Sub-Type") keyFn = f => f.FST;
  else keyFn = f => f.Facility;

  const groups = new Map();
  for (const f of facilityRows) {
    const k = keyFn(f);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }

  const rows = [];
  for (const [name, members] of [...groups.entries()].sort((a, b) =>
      String(a[0]).toLowerCase().localeCompare(String(b[0]).toLowerCase()))) {
    if (!name) continue;
    const domainAvgs = [];
    for (const domain of DOMAIN_ORDER) {
      const vals = members.map(m => domainScore(m.row, idxMap, domain).percentage).filter(v => v !== null);
      domainAvgs.push(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
    }
    const overallVals = members.map(m => overallScore(m.row, idxMap)).filter(v => v !== null);
    const overallAvg = overallVals.length ? overallVals.reduce((a, b) => a + b, 0) / overallVals.length : null;
    rows.push({
      name,
      cells: [...domainAvgs.map(formatPct), formatPct(overallAvg)],
      color: categoryColor(complianceCategory(overallAvg)),
    });
  }

  renderSummaryTable(headingText, rows);
}

let summaryRowsCache = { heading: "District", rows: [] };

function renderSummaryTable(headingText, rows) {
  summaryRowsCache = { heading: headingText, rows };
  const head = document.getElementById("summaryHead");
  const columns = [headingText, ...DOMAIN_ORDER, "Overall Score"];
  head.innerHTML = columns.map((c, i) =>
    `<th onclick="sortSummaryTable(${i})">${c} <span class="arrow" id="sumArrow${i}"></span></th>`
  ).join("");
  drawSummaryBody(rows);
}

function drawSummaryBody(rows) {
  const body = document.getElementById("summaryBody");
  if (!rows.length) {
    body.innerHTML = `<tr><td class="empty" colspan="8">No matching rows.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(r =>
    `<tr style="background:${r.color}"><td>${escapeHtml(r.name)}</td>${r.cells.map(c => `<td>${c}</td>`).join("")}</tr>`
  ).join("");
}

function sortSummaryTable(colIndex) {
  const key = colIndex === 0 ? "name" : colIndex - 1;
  const asc = !sortState.summary[colIndex];
  sortState.summary = {}; // only one active arrow at a time, like the Python app
  sortState.summary[colIndex] = asc;

  const rows = summaryRowsCache.rows.slice();
  rows.sort((a, b) => {
    const va = colIndex === 0 ? a.name : a.cells[colIndex - 1];
    const vb = colIndex === 0 ? b.name : b.cells[colIndex - 1];
    const na = parseFloat(String(va).replace("%", ""));
    const nb = parseFloat(String(vb).replace("%", ""));
    let cmp;
    if (!Number.isNaN(na) && !Number.isNaN(nb) && va !== "" && vb !== "") cmp = na - nb;
    else cmp = String(va).toLowerCase().localeCompare(String(vb).toLowerCase());
    return asc ? cmp : -cmp;
  });
  drawSummaryBody(rows);
  document.querySelectorAll('[id^="sumArrow"]').forEach(el => el.textContent = "");
  document.getElementById(`sumArrow${colIndex}`).textContent = asc ? "▲" : "▼";
}

function exportSummary() {
  const { heading, rows } = summaryRowsCache;
  if (!rows.length) { alert("There is no data currently shown to export."); return; }
  const header = [heading, ...DOMAIN_ORDER, "Overall Score"];
  const csvRows = rows.map(r => [r.name, ...r.cells]);
  downloadCsv(header, csvRows, "IPHS_Summary");
}

// ---------------- Analysis tab ----------------

function fillSelect(id, values, current) {
  const el = document.getElementById(id);
  const vals = ["All", ...[...new Set(values.map(v => String(v)).filter(v => v.trim()))].sort((a, b) => a.localeCompare(b))];
  const prev = current !== undefined ? current : el.value;
  el.innerHTML = vals.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
  el.value = vals.includes(prev) ? prev : "All";
}

function populateAnalysisFilterOptions() {
  fillSelect("anCompliance", COMPLIANCE_CATEGORIES, document.getElementById("anCompliance").value || "All");
}

function refreshAnalysisTab() {
  if (!facilityRows.length || !engine) return;

  const compliance = document.getElementById("anCompliance").value || "All";
  const district = document.getElementById("anDistrict").value || "All";
  const ft = document.getElementById("anFT").value || "All";
  const fst = document.getElementById("anFST").value || "All";
  const facility = document.getElementById("anFacility").value || "All";

  const base = engine.filteredPool(compliance, "All", "All", "All", "All");
  fillSelect("anDistrict", base.map(f => f.District), district);

  const districtPool = district !== "All" ? engine.filteredPool(compliance, district) : base;
  fillSelect("anFT", districtPool.map(f => f.FT), ft);

  const ftPool = ft !== "All" ? engine.filteredPool(compliance, district, ft) : districtPool;
  fillSelect("anFST", ftPool.map(f => f.FST), fst);

  const fstPool = fst !== "All" ? engine.filteredPool(compliance, district, ft, fst) : ftPool;
  fillSelect("anFacility", fstPool.map(f => f.Facility), facility);

  const pool = engine.filteredPool(compliance, district, ft, fst, facility);
  currentPool = pool;
  const granular = (pool.length === 1 && facility !== "All");
  const filterKey = [compliance, district, ft, fst, facility];
  rebuildSummaryForPool(filterKey, granular);
  refreshAnalysisTable();
}

function rebuildSummaryForPool(filterKey, granular) {
  const pool = currentPool;
  if (!pool.length) {
    currentSummary = new Map();
    document.getElementById("anModeNote").textContent = "No facilities match the current filters.";
    return;
  }
  currentSummary = engine.getPoolSummary(filterKey, pool, granular);

  const facility = document.getElementById("anFacility").value || "All";
  if (pool.length === 1 && facility !== "All") {
    document.getElementById("anModeNote").textContent =
      `Granular view — showing ${pool[0].Facility}'s own recorded answers (1 = present, 0 = missing).`;
  } else {
    document.getElementById("anModeNote").textContent =
      `Aggregate (sum) view across ${pool.length.toLocaleString()} facilities. Tap an indicator to see contributing facilities.`;
  }

  const domains = new Set();
  for (const entry of currentSummary.values()) domains.add(entry.meta.domain);
  fillSelect("anDomain", [...domains], document.getElementById("anDomain").value || "All");
}

let analysisEntriesCache = [];

function refreshAnalysisTable() {
  const domainFilter = document.getElementById("anDomain").value || "All";
  const search = (document.getElementById("anSearch").value || "").trim().toLowerCase();

  const entries = [];
  for (const entry of currentSummary.values()) {
    const meta = entry.meta;
    if (domainFilter !== "All" && meta.domain !== domainFilter) continue;
    if (search) {
      const haystack = [meta.indicator, meta.indicator_id, meta.raw_variable].join(" ").toLowerCase();
      if (!haystack.includes(search)) continue;
    }
    const { required, present, missing, missingPct } = entry.agg;
    entries.push({
      domain: meta.domain || "", subDomain: meta.sub_domain || "",
      questionGroup: meta.question_group || "", indicatorId: meta.indicator_id || "",
      indicator: meta.indicator || "", meta, applicable: required, present, missing, missingPct,
      members: entry.members,
    });
  }
  entries.sort((a, b) => {
    const ka = `${a.domain}|${a.subDomain}|${a.indicator}`.toLowerCase();
    const kb = `${b.domain}|${b.subDomain}|${b.indicator}`.toLowerCase();
    return ka.localeCompare(kb);
  });

  analysisEntriesCache = entries;
  drawIndicatorList(entries);
}

function drawIndicatorList(entries) {
  const container = document.getElementById("indicatorList");
  if (!entries.length) {
    container.innerHTML = `<div class="empty">No indicators match the current filters.</div>`;
    return;
  }
  container.innerHTML = entries.map((e, i) => {
    const color = missingColor(e.missingPct, e.applicable);
    return `
    <div class="indrow" style="background:${color}" onclick="toggleIndicator(${i})">
      <div class="top">
        <div>
          <div class="name">${escapeHtml(e.indicator)}</div>
          <div class="meta">${escapeHtml(e.domain)} ${e.subDomain ? "› " + escapeHtml(e.subDomain) : ""}${e.questionGroup ? " › " + escapeHtml(e.questionGroup) : ""}</div>
        </div>
        <div class="chev" id="chev${i}">▶</div>
      </div>
      <div class="stats">
        <span>Required: <b>${fmtNum(e.applicable)}</b></span>
        <span>Present: <b>${fmtNum(e.present)}</b></span>
        <span>Missing: <b>${fmtNum(e.missing)}</b></span>
        <span>Missing %: <b>${formatPct(e.missingPct)}</b></span>
      </div>
      <div class="children" id="children${i}"></div>
    </div>`;
  }).join("");
}

function fmtNum(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  if (typeof v === "number") return v.toFixed(2).replace(/\.00$/, "");
  return String(v);
}

// mirrors IndicatorTree._on_double_click
function toggleIndicator(i) {
  const e = analysisEntriesCache[i];
  if (!e) return;
  const childrenEl = document.getElementById(`children${i}`);
  const chev = document.getElementById(`chev${i}`);
  const isOpen = childrenEl.classList.contains("open");

  if (isOpen) {
    childrenEl.classList.remove("open");
    chev.textContent = "▶";
    return;
  }

  if (!e.members || e.members.length === 0) return;

  if (!childrenEl.dataset.built) {
    const stdVar = (e.meta.standard_variable || "").trim();
    let contributors = e.members;
    if (stdVar) {
      contributors = e.members.filter(([facility]) =>
        (numericValue(get(facility.row, idxMap, stdVar)) || 0) > 0
      );
    }
    contributors = contributors.slice().sort((a, b) =>
      a[0].Facility.toLowerCase().localeCompare(b[0].Facility.toLowerCase()));

    const rowsHtml = contributors.map(([facility, rawValue]) => {
      let requiredForColor, displayRequired, displayObserved, displayMissing, missingPct;
      if (stdVar) {
        let requiredV = numericValue(get(facility.row, idxMap, stdVar));
        let observedV = numericValue(rawValue);
        requiredV = requiredV === null ? 0 : requiredV;
        observedV = observedV === null ? 0 : observedV;
        const missingV = Math.max(requiredV - observedV, 0);
        missingPct = requiredV === 0 ? null : (missingV / requiredV) * 100;
        requiredForColor = requiredV;
        displayRequired = fmtNum(requiredV);
        displayObserved = fmtNum(observedV);
        displayMissing = fmtNum(missingV);
      } else {
        const observedFlag = isPresent(rawValue) ? 1 : 0;
        requiredForColor = 1;
        displayRequired = "1"; displayObserved = String(observedFlag); displayMissing = String(1 - observedFlag);
        missingPct = observedFlag ? 0.0 : 100.0;
      }
      const color = missingColor(missingPct, requiredForColor);
      return `<div class="childrow" style="background:${color}">
        <span class="fname">↳ ${escapeHtml(facility.Facility)} (${escapeHtml(facility.District)})</span>
        <span>R:${displayRequired} P:${displayObserved} M:${displayMissing} ${formatPct(missingPct)}</span>
      </div>`;
    }).join("");

    childrenEl.innerHTML = rowsHtml || `<div class="small-muted">No contributing facilities.</div>`;
    childrenEl.dataset.built = "1";
  }

  childrenEl.classList.add("open");
  chev.textContent = "▼";
}

function exportAnalysis() {
  if (!analysisEntriesCache.length) { alert("There is no data currently shown to export."); return; }
  const header = ["Indicator", "Domain", "Sub-Domain", "Question Group", "Indicator ID", "Required", "Present", "Missing", "Missing %"];
  const rows = analysisEntriesCache.map(e => [
    e.indicator, e.domain, e.subDomain, e.questionGroup, e.indicatorId,
    fmtNum(e.applicable), fmtNum(e.present), fmtNum(e.missing), formatPct(e.missingPct),
  ]);
  downloadCsv(header, rows, "IPHS_Analysis");
}

// ---------------- csv export / escaping helpers ----------------

function downloadCsv(header, rows, filename) {
  const escape = v => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map(r => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
