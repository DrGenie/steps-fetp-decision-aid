/* ===============================
   STEPS – FETP India Decision Aid
   Production script – premium UI
   =============================== */

/* ---------- Global State ---------- */
const state = {
  currency: "INR",
  inrPerUSD: 83,
  model: "mxl",
  includeOppCost: true,
  tier: "frontline",
  career: "certificate",
  mentorship: "low",
  delivery: "blended",
  response: "30",
  costPerMonth: 250000,
  trainees: 20,
  cohorts: 10,
  costTemplateSource: null, // set after config load
  config: null,             // loaded from epi_config.json
  charts: {},
  scenarios: JSON.parse(localStorage.getItem("steps_scenarios") || "[]"),
  tourSeen: localStorage.getItem("steps_tour_seen") === "1"
};

/* ---------- Preference Models ---------- */
/* All monetary coefficients use cost in thousands of INR per trainee per month */
const MXL_COEFS = {
  ascProgram: 0.168,       // newly added ASC for the offered programme
  ascOptOut: -0.601,
  tier: { frontline: 0, intermediate: 0.220, advanced: 0.487 },
  career: { certificate: 0, uniqual: 0.017, career_path: -0.122 },
  mentorship: { low: 0, medium: 0.453, high: 0.640 },
  delivery: { blended: 0, inperson: -0.232, online: -1.073 },
  response: { "30": 0, "15": 0.546, "7": 0.610 },
  costPerThousand: -0.005 // back-transformed mean
};

const LC2_COEFS = {
  ascProgram: 0.098,       // newly added ASC for the offered programme
  ascOptOut: -2.543,
  tier: { frontline: 0, intermediate: 0.000, advanced: 0.422 },
  career: { certificate: 0, uniqual: 0.000, career_path: 0.000 },
  mentorship: { low: 0, medium: 0.342, high: 0.486 },
  delivery: { blended: 0, inperson: 0.000, online: 0.000 },
  response: { "30": 0, "15": 0.317, "7": 0.504 },
  costPerThousand: -0.001 // supportive class, cost sensitive but flatter
};

/* ---------- Utilities ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function formatINR(x){
  if (Number.isNaN(+x)) return "-";
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(x);
}
function formatUSD(x){
  if (Number.isNaN(+x)) return "-";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(x);
}
function fmtMoney(x){
  return state.currency === "INR" ? formatINR(x) : formatUSD(x/state.inrPerUSD);
}
function fmtPct(x){ return `${(x*100).toFixed(1)} %`; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function showToast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(()=>t.classList.add("hidden"), 2400);
}

function openModal(html){
  $("#modal-body").innerHTML = html;
  $("#results-modal").classList.remove("hidden");
}
function closeModal(){ $("#results-modal").classList.add("hidden"); }

/* ---------- Tooltips (click or hover) ---------- */
(function initTooltips(){
  const tooltip = $("#tooltip");
  function show(e, text){
    tooltip.textContent = text;
    tooltip.classList.remove("hidden");
    const rect = e.target.getBoundingClientRect();
    const bodyW = document.body.clientWidth;
    const ttW = Math.min(320, bodyW - 24);
    tooltip.style.maxWidth = ttW + "px";
    const top = window.scrollY + rect.top - tooltip.offsetHeight - 8;
    const left = Math.min(window.scrollX + rect.left, window.scrollX + bodyW - ttW - 12);
    tooltip.style.top = (top < 0 ? window.scrollY + rect.bottom + 8 : top) + "px";
    tooltip.style.left = left + "px";
  }
  function hide(){ tooltip.classList.add("hidden"); }

  document.addEventListener("mouseover", (e)=>{
    const btn = e.target.closest(".info-icon");
    if (!btn) return;
    show(e, btn.getAttribute("data-info") || btn.getAttribute("title") || "Info");
  });
  document.addEventListener("focusin", (e)=>{
    const btn = e.target.closest(".info-icon");
    if (!btn) return;
    show(e, btn.getAttribute("data-info") || btn.getAttribute("title") || "Info");
  });
  document.addEventListener("mouseout", (e)=>{
    if (e.target.closest(".info-icon")) hide();
  });
  document.addEventListener("focusout", (e)=>{
    if (e.target.closest(".info-icon")) hide();
  });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") hide(); });
})();

/* ---------- Tabs ---------- */
(function initTabs(){
  $$(".tab-link").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$(".tab-link").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id = btn.dataset.tab;
      $$(".tab-panel").forEach(p=>p.classList.remove("active"));
      $("#tab-"+id).classList.add("active");
      $("#tab-"+id).focus({preventScroll:false});
    });
  });
})();

/* ---------- Load configuration (epi_config.json) ---------- */
async function loadConfig(){
  try{
    const res = await fetch("epi_config.json",{cache:"no-store"});
    state.config = await res.json();
  }catch(e){
    // Fallback defaults if the JSON is missing
    state.config = {
      display:{inrPerUSD:83},
      tiers:{
        frontline:{durationMonths:3,gradRate:0.9,outbreaksPerCohortPerYear:0.3,valuePerGraduate:300000,valuePerOutbreak:20000000},
        intermediate:{durationMonths:12,gradRate:0.92,outbreaksPerCohortPerYear:0.5,valuePerGraduate:500000,valuePerOutbreak:25000000},
        advanced:{durationMonths:24,gradRate:0.95,outbreaksPerCohortPerYear:0.8,valuePerGraduate:800000,valuePerOutbreak:30000000}
      },
      costTemplates:{
        frontline:{WHO:{opportunityCostShare:0.2,components:{"Staff and trainers":0.45,"Travel and per diem":0.15,"Training materials":0.1,"Supervision and mentorship":0.15,"Management and overheads":0.1,"Other":0.05}}},
        intermediate:{
          WHO:{opportunityCostShare:0.2,components:{"Staff and trainers":0.4,"Travel and per diem":0.18,"Training materials":0.08,"Supervision and mentorship":0.18,"Management and overheads":0.11,"Other":0.05}},
          NIE:{opportunityCostShare:0.18,components:{"Staff and trainers":0.42,"Travel and per diem":0.14,"Training materials":0.09,"Supervision and mentorship":0.2,"Management and overheads":0.1,"Other":0.05}},
          NCDC:{opportunityCostShare:0.22,components:{"Staff and trainers":0.38,"Travel and per diem":0.2,"Training materials":0.08,"Supervision and mentorship":0.19,"Management and overheads":0.1,"Other":0.05}}
        },
        advanced:{
          NIE:{opportunityCostShare:0.22,components:{"Staff and trainers":0.44,"Travel and per diem":0.16,"Training materials":0.07,"Supervision and mentorship":0.18,"Management and overheads":0.1,"Other":0.05}},
          NCDC:{opportunityCostShare:0.25,components:{"Staff and trainers":0.42,"Travel and per diem":0.17,"Training materials":0.08,"Supervision and mentorship":0.18,"Management and overheads":0.1,"Other":0.05}}
        }
      }
    };
  }
  // Set display rate
  state.inrPerUSD = state.config.display?.inrPerUSD ?? 83;
  // Populate cost template selector
  populateCostTemplateSelector();
  // Set defaults
  if(!state.costTemplateSource){
    const options = getTemplatesForTier(state.tier);
    state.costTemplateSource = options[0];
    $("#cost-source").value = state.costTemplateSource;
  }
  // Set advanced defaults
  setAdvancedDefaultsToForm();
  // Initial summaries
  updateCurrencyLabels();
  updateConfigSummary();
}

/* ---------- Cost template selector ---------- */
function getTemplatesForTier(tier){
  const obj = state.config.costTemplates?.[tier] || {};
  return Object.keys(obj);
}
function populateCostTemplateSelector(){
  const sel = $("#cost-source");
  sel.innerHTML = "";
  const opts = getTemplatesForTier(state.tier);
  for (const k of opts){
    const o = document.createElement("option");
    o.value = k; o.textContent = k;
    sel.appendChild(o);
  }
  if (opts.length>0){
    sel.value = state.costTemplateSource || opts[0];
    state.costTemplateSource = sel.value;
  }
}

/* ---------- Advanced defaults ---------- */
function setAdvancedDefaultsToForm(){
  const t = state.config.tiers;
  $("#adv-inr-per-usd").value = state.inrPerUSD;

  $("#adv-frontline-grads").value = t.frontline.gradRate;
  $("#adv-frontline-outbreaks").value = t.frontline.outbreaksPerCohortPerYear;
  $("#adv-frontline-vgrad").value = t.frontline.valuePerGraduate;
  $("#adv-frontline-voutbreak").value = t.frontline.valuePerOutbreak;

  $("#adv-intermediate-grads").value = t.intermediate.gradRate;
  $("#adv-intermediate-outbreaks").value = t.intermediate.outbreaksPerCohortPerYear;
  $("#adv-intermediate-vgrad").value = t.intermediate.valuePerGraduate;
  $("#adv-intermediate-voutbreak").value = t.intermediate.valuePerOutbreak;

  $("#adv-advanced-grads").value = t.advanced.gradRate;
  $("#adv-advanced-outbreaks").value = t.advanced.outbreaksPerCohortPerYear;
  $("#adv-advanced-vgrad").value = t.advanced.valuePerGraduate;
  $("#adv-advanced-voutbreak").value = t.advanced.valuePerOutbreak;

  buildAssumptionLog();
}

function readAdvancedFormIntoState(){
  state.inrPerUSD = +$("#adv-inr-per-usd").value || state.inrPerUSD;
  const t = state.config.tiers;
  t.frontline.gradRate = +$("#adv-frontline-grads").value || t.frontline.gradRate;
  t.frontline.outbreaksPerCohortPerYear = +$("#adv-frontline-outbreaks").value || t.frontline.outbreaksPerCohortPerYear;
  t.frontline.valuePerGraduate = +$("#adv-frontline-vgrad").value || t.frontline.valuePerGraduate;
  t.frontline.valuePerOutbreak = +$("#adv-frontline-voutbreak").value || t.frontline.valuePerOutbreak;

  t.intermediate.gradRate = +$("#adv-intermediate-grads").value || t.intermediate.gradRate;
  t.intermediate.outbreaksPerCohortPerYear = +$("#adv-intermediate-outbreaks").value || t.intermediate.outbreaksPerCohortPerYear;
  t.intermediate.valuePerGraduate = +$("#adv-intermediate-vgrad").value || t.intermediate.valuePerGraduate;
  t.intermediate.valuePerOutbreak = +$("#adv-intermediate-voutbreak").value || t.intermediate.valuePerOutbreak;

  t.advanced.gradRate = +$("#adv-advanced-grads").value || t.advanced.gradRate;
  t.advanced.outbreaksPerCohortPerYear = +$("#adv-advanced-outbreaks").value || t.advanced.outbreaksPerCohortPerYear;
  t.advanced.valuePerGraduate = +$("#adv-advanced-vgrad").value || t.advanced.valuePerGraduate;
  t.advanced.valuePerOutbreak = +$("#adv-advanced-voutbreak").value || t.advanced.valuePerOutbreak;

  updateCurrencyLabels();
  buildAssumptionLog();
}

/* ---------- Assumption log ---------- */
function buildAssumptionLog(){
  const t = state.config.tiers;
  const stamp = new Date().toISOString();
  const txt =
`STEPS assumption log – ${stamp}

Exchange rate (INR per USD): ${state.inrPerUSD}
Currency display mode:       ${state.currency}

Planning horizon (years): Not time discounted in this tool
Graduates per cohort (share):
  Frontline:     ${t.frontline.gradRate.toFixed(2)}
  Intermediate:  ${t.intermediate.gradRate.toFixed(2)}
  Advanced:      ${t.advanced.gradRate.toFixed(2)}

Outbreak responses per cohort per year:
  Frontline:     ${t.frontline.outbreaksPerCohortPerYear}
  Intermediate:  ${t.intermediate.outbreaksPerCohortPerYear}
  Advanced:      ${t.advanced.outbreaksPerCohortPerYear}

Value per graduate (INR):
  Frontline:     ${t.frontline.valuePerGraduate.toLocaleString('en-IN')}
  Intermediate:  ${t.intermediate.valuePerGraduate.toLocaleString('en-IN')}
  Advanced:      ${t.advanced.valuePerGraduate.toLocaleString('en-IN')}

Value per outbreak response (INR):
  Frontline:     ${t.frontline.valuePerOutbreak.toLocaleString('en-IN')}
  Intermediate:  ${t.intermediate.valuePerOutbreak.toLocaleString('en-IN')}
  Advanced:      ${t.advanced.valuePerOutbreak.toLocaleString('en-IN')}

Current configuration snapshot:
  Programme tier:            ${labelTier(state.tier)}
  Career incentive:          ${labelCareer(state.career)}
  Mentorship intensity:      ${labelMentor(state.mentorship)}
  Delivery mode:             ${labelDelivery(state.delivery)}
  Expected response time:    ${labelResponse(state.response)}
  Preference model:          ${state.model === 'mxl' ? 'Average mixed logit' : 'Supportive latent class'}
  Trainees per cohort:       ${state.trainees}
  Number of cohorts:         ${state.cohorts}
  Cost per trainee per month:${formatINR(state.costPerMonth)}
  Include opportunity cost:  ${state.includeOppCost ? 'Yes' : 'No'}
  Cost template:             ${state.costTemplateSource || '-'}
`;
  $("#assumption-log").textContent = txt;
}

/* ---------- Labels ---------- */
function labelTier(v){
  return v==="frontline" ? "Frontline (3 months)" : v==="intermediate" ? "Intermediate (12 months)" : "Advanced (24 months)";
}
function labelCareer(v){
  return v==="certificate" ? "Government and partner certificate" : v==="uniqual" ? "University qualification" : "Government career pathway";
}
function labelMentor(v){
  return v==="low" ? "Low" : v==="medium" ? "Medium" : "High";
}
function labelDelivery(v){
  return v==="blended" ? "Blended" : v==="inperson" ? "Fully in person" : "Fully online";
}
function labelResponse(v){
  return v==="30" ? "Within 30 days" : v==="15" ? "Within 15 days" : "Within 7 days";
}

/* ---------- Preference utilities ---------- */
function getCoefs(){
  return state.model === "mxl" ? MXL_COEFS : LC2_COEFS;
}

function computeNonCostUtility(cfg, coefs){
  const uAsc = coefs.ascProgram || 0; // ASC_A = 1 for any programme configuration
  const uTier = coefs.tier[cfg.tier] || 0;
  const uCareer = coefs.career[cfg.career] || 0;
  const uMentor = coefs.mentorship[cfg.mentorship] || 0;
  const uDelivery = coefs.delivery[cfg.delivery] || 0;
  const uResponse = coefs.response[cfg.response] || 0;
  return uAsc + uTier + uCareer + uMentor + uDelivery + uResponse;
}

function predictEndorsement(){
  const coefs = getCoefs();
  const cfg = {
    tier: state.tier, career: state.career, mentorship: state.mentorship,
    delivery: state.delivery, response: state.response
  };
  const nonCost = computeNonCostUtility(cfg, coefs);
  const costTerm = coefs.costPerThousand * (state.costPerMonth / 1000);
  const deltaV = - (coefs.ascOptOut || 0) + nonCost + costTerm;
  const pEndorse = 1/(1+Math.exp(-deltaV));
  return clamp(pEndorse, 0.0001, 0.9999);
}

/* ---------- Costs and benefits ---------- */
function getTierObj(){
  return state.config.tiers[state.tier];
}

function programmeCostPerCohort(){
  const t = getTierObj();
  return state.costPerMonth * state.trainees * t.durationMonths;
}

function opportunityCostShare(){
  const tpl = state.config.costTemplates[state.tier]?.[state.costTemplateSource] || null;
  return tpl ? (+tpl.opportunityCostShare || 0) : 0;
}

function economicCostPerCohort(){
  const prog = programmeCostPerCohort();
  if (!state.includeOppCost) return prog;
  return prog * (1 + opportunityCostShare());
}

function epiGraduatesAllCohorts(pEndorse){
  const t = getTierObj();
  return Math.round(state.trainees * t.gradRate * pEndorse * state.cohorts);
}

function epiOutbreaksPerYearAllCohorts(pEndorse){
  const t = getTierObj();
  return +(t.outbreaksPerCohortPerYear * pEndorse * state.cohorts).toFixed(1);
}

function indicativeBenefitPerCohort(pEndorse){
  const t = getTierObj();
  const grads = state.trainees * t.gradRate * pEndorse;
  const outbreaks = t.outbreaksPerCohortPerYear * pEndorse;
  return grads * t.valuePerGraduate + outbreaks * t.valuePerOutbreak;
}

/* ---------- Cost components table ---------- */
function rebuildCostComponentsTable(){
  const tbody = $("#cost-components-table tbody");
  tbody.innerHTML = "";
  const progCost = programmeCostPerCohort();
  const oppShare = opportunityCostShare();
  const tpl = state.config.costTemplates[state.tier]?.[state.costTemplateSource];
  const comps = tpl?.components || {};
  const perTraineeMonth = state.costPerMonth;

  Object.entries(comps).forEach(([name, share])=>{
    const amount = progCost * share;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${(share*100).toFixed(1)} %</td>
      <td>${fmtMoney(amount)}</td>
      <td>${fmtMoney(perTraineeMonth * share)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Totals
  $("#cc-programme-total").textContent = fmtMoney(progCost);
  const opp = state.includeOppCost ? progCost * oppShare : 0;
  $("#cc-opp-total").textContent = fmtMoney(opp);
  $("#cc-economic-total").textContent = fmtMoney(progCost + opp);

  // Right side summary and donut
  const summary = $("#cost-breakdown-summary");
  summary.innerHTML = `
    <div class="row"><span>Template</span><strong>${state.costTemplateSource || "-"}</strong></div>
    <div class="row"><span>Programme cost per cohort</span><strong>${fmtMoney(progCost)}</strong></div>
    <div class="row"><span>Opportunity cost share</span><strong>${(oppShare*100).toFixed(0)} %</strong></div>
    <div class="row"><span>Total economic cost per cohort</span><strong>${fmtMoney(progCost + opp)}</strong></div>
  `;

  const labels = Object.keys(comps);
  const data = Object.values(comps).map(s=>+(s*100).toFixed(1));
  updateChart("chart-cost-parts", {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data }]
    },
    options: {
      plugins:{legend:{position:"bottom"}},
      cutout: "55%"
    }
  });
}

/* ---------- WTP table ---------- */
function rebuildWTPTable(){
  const coefs = getCoefs();
  const costB = Math.abs(coefs.costPerThousand) > 0 ? coefs.costPerThousand : null;
  const tbody = $("#wtp-table tbody");
  tbody.innerHTML = "";

  function addRow(attr, level, beta){
    if (costB === null) return;
    const wtp = -beta / costB * 1000; // convert thousand to INR
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${attr}</td><td>${level}</td><td>${fmtMoney(wtp)}</td>`;
    tbody.appendChild(tr);
  }

  // Tier
  addRow("Programme tier","Intermediate", coefs.tier.intermediate);
  addRow("Programme tier","Advanced", coefs.tier.advanced);
  // Career
  addRow("Career incentive","University qualification", coefs.career.uniqual);
  addRow("Career incentive","Government career pathway", coefs.career.career_path);
  // Mentorship
  addRow("Mentorship intensity","Medium", coefs.mentorship.medium);
  addRow("Mentorship intensity","High", coefs.mentorship.high);
  // Delivery
  addRow("Delivery mode","Fully in person", coefs.delivery.inperson);
  addRow("Delivery mode","Fully online", coefs.delivery.online);
  // Response
  addRow("Expected response time","Within 15 days", coefs.response["15"]);
  addRow("Expected response time","Within 7 days", coefs.response["7"]);
}

/* ---------- Results & Summary ---------- */
function updateAll(){
  // Endorsement
  const p = predictEndorsement();
  $("#endorsement-rate").textContent = fmtPct(p);
  $("#optout-rate").textContent = fmtPct(1-p);

  // Costs and benefits
  const costEco = economicCostPerCohort();
  const benefit = indicativeBenefitPerCohort(p);
  const net = benefit - costEco;
  const bcr = costEco > 0 ? (benefit / costEco) : 0;

  $("#total-cost").textContent = fmtMoney(costEco);
  $("#net-benefit").textContent = fmtMoney(net);
  $("#bcr").textContent = bcr.toFixed(2);

  // Epi
  $("#epi-graduates").textContent = epiGraduatesAllCohorts(p).toLocaleString("en-IN");
  $("#epi-outbreaks").textContent = epiOutbreaksPerYearAllCohorts(p).toLocaleString("en-IN");
  $("#epi-benefit").textContent = fmtMoney(benefit);

  // Charts
  updateChart("chart-uptake", {
    type:"doughnut",
    data:{labels:["Endorse","Opt out"], datasets:[{data:[+(p*100).toFixed(1), +((1-p)*100).toFixed(1)]}]},
    options:{plugins:{legend:{position:"bottom"}}, cutout:"55%"}
  });
  updateChart("chart-bcr",{
    type:"bar",
    data:{labels:["Benefit","Cost","Net"], datasets:[{data:[benefit, costEco, net]}]},
    options:{
      scales:{y:{beginAtZero:true}},
      plugins:{legend:{display:false}}
    }
  });
  updateChart("chart-epi",{
    type:"bar",
    data:{labels:["Graduates (all cohorts)","Outbreak responses per year"], datasets:[{data:[epiGraduatesAllCohorts(p), epiOutbreaksPerYearAllCohorts(p)]}]},
    options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });

  // National
  $("#nat-total-cost").textContent = fmtMoney(costEco * state.cohorts);
  $("#nat-total-benefit").textContent = fmtMoney(benefit * state.cohorts);
  $("#nat-net-benefit").textContent = fmtMoney((benefit - costEco) * state.cohorts);
  $("#nat-bcr").textContent = bcr.toFixed(2);
  $("#nat-graduates").textContent = (epiGraduatesAllCohorts(p)).toLocaleString("en-IN");
  $("#nat-outbreaks").textContent = (epiOutbreaksPerYearAllCohorts(p)).toLocaleString("en-IN");

  updateChart("chart-nat-cost-benefit",{
    type:"bar",
    data:{labels:["Total benefit","Total cost","Net"], datasets:[{data:[benefit*state.cohorts, costEco*state.cohorts, (benefit-costEco)*state.cohorts]}]},
    options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });
  updateChart("chart-nat-epi",{
    type:"bar",
    data:{labels:["Total graduates","Outbreak responses per year"], datasets:[{data:[epiGraduatesAllCohorts(p), epiOutbreaksPerYearAllCohorts(p)]}]},
    options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });

  // Sidebar summary and headline
  $("#config-endorsement-value").textContent = fmtPct(p);
  updateConfigSummary();
  $("#headline-recommendation").textContent = buildHeadline(bcr, p);

  // Costing table
  rebuildCostComponentsTable();

  // WTP table
  rebuildWTPTable();

  // Assumption log timestamp update
  buildAssumptionLog();
}

function buildHeadline(bcr, p){
  if (bcr >= 1.2 && p >= 0.6) return "This configuration looks attractive, with strong endorsement and a benefit cost ratio above one. It is a strong candidate for priority scale up, subject to budget and implementation feasibility.";
  if (bcr >= 1.0 && p >= 0.45) return "This configuration is promising. Endorsement is moderate and value for money is at least break-even. Consider improving mentorship or reducing costs to strengthen the case.";
  return "At current design and cost, endorsement or value for money is modest. Consider adjusting mentorship intensity, response time or monthly cost, or test a higher tier with efficiencies.";
}

function updateConfigSummary(){
  const rows = [
    ["Programme tier", `<strong>${labelTier(state.tier)}</strong>`],
    ["Career incentive", `<strong>${labelCareer(state.career)}</strong>`],
    ["Mentorship intensity", `<strong>${labelMentor(state.mentorship)}</strong>`],
    ["Delivery mode", `${labelDelivery(state.delivery)}`],
    ["Expected response time for events", `${labelResponse(state.response)}`],
    ["Preference model", `${state.model==="mxl"?"Average mixed logit":"Supportive latent class"}`],
    ["Trainees per cohort", `${state.trainees}`],
    ["Number of cohorts", `${state.cohorts}`],
    ["Cost per trainee per month", `${fmtMoney(state.costPerMonth)}`],
    ["Cost template", `${state.costTemplateSource || "-"}`]
  ];
  $("#config-summary").innerHTML = rows.map(([k,v])=>`<div class="row"><span>${k}</span><span>${v}</span></div>`).join("");
}

/* ---------- Charts helper ---------- */
function updateChart(id, cfg){
  const ctx = $("#"+id);
  if (!ctx) return;
  if (state.charts[id]){
    // Update data
    state.charts[id].data = cfg.data;
    state.charts[id].options = cfg.options || {};
    state.charts[id].update();
  } else {
    state.charts[id] = new Chart(ctx, cfg);
  }
}

/* ---------- Modal snapshot ---------- */
function buildSnapshotHTML(){
  const p = predictEndorsement();
  const costEco = economicCostPerCohort();
  const benefit = indicativeBenefitPerCohort(p);
  const net = benefit - costEco;
  const bcr = costEco > 0 ? (benefit / costEco) : 0;

  const status = bcr >= 1.2 && p >= 0.6 ? `<span class="badge-primary">High impact, good value</span>` :
                 bcr >= 1.0 && p >= 0.45 ? `<span class="badge-outline">Moderate impact, marginal value</span>` :
                 `<span class="badge-outline" style="border-color:var(--amber);color:var(--amber)">Weak option</span>`;

  return `
    <div class="grid-two">
      <div>
        <h3>Configuration</h3>
        <ul class="plain-list">
          <li><strong>Programme tier:</strong> ${labelTier(state.tier)}</li>
          <li><strong>Career incentive:</strong> ${labelCareer(state.career)}</li>
          <li><strong>Mentorship:</strong> ${labelMentor(state.mentorship)}</li>
          <li><strong>Delivery:</strong> ${labelDelivery(state.delivery)}</li>
          <li><strong>Response time:</strong> ${labelResponse(state.response)}</li>
          <li><strong>Preference model:</strong> ${state.model==="mxl"?"Average mixed logit":"Supportive latent class"}</li>
          <li><strong>Trainees per cohort:</strong> ${state.trainees}; <strong>Cohorts:</strong> ${state.cohorts}</li>
          <li><strong>Cost / trainee / month:</strong> ${fmtMoney(state.costPerMonth)}</li>
          <li><strong>Cost template:</strong> ${state.costTemplateSource || "-"}</li>
        </ul>
        <p>${status}</p>
      </div>
      <div>
        <h3>Key results</h3>
        <ul class="plain-list">
          <li><strong>Estimated endorsement:</strong> ${fmtPct(p)} of stakeholders would endorse this option.</li>
          <li><strong>Total economic cost per cohort:</strong> ${fmtMoney(costEco)}</li>
          <li><strong>Indicative benefit per cohort:</strong> ${fmtMoney(benefit)}</li>
          <li><strong>Net benefit per cohort:</strong> ${fmtMoney(net)}</li>
          <li><strong>Benefit cost ratio:</strong> ${bcr.toFixed(2)}</li>
          <li><strong>Graduates (all cohorts):</strong> ${epiGraduatesAllCohorts(p).toLocaleString("en-IN")}</li>
          <li><strong>Outbreak responses per year:</strong> ${epiOutbreaksPerYearAllCohorts(p).toLocaleString("en-IN")}</li>
        </ul>
      </div>
    </div>
  `;
}

/* ---------- Save scenario ---------- */
function scenarioTags(bcr, p){
  const tags = [];
  if (bcr >= 1.2) tags.push("Good value");
  if (p >= 0.6) tags.push("High endorsement");
  if (state.tier==="advanced") tags.push("Advanced");
  if (state.mentorship==="high") tags.push("High mentorship");
  return tags.join(", ");
}

function saveScenario(){
  const p = predictEndorsement();
  const costEco = economicCostPerCohort();
  const benefit = indicativeBenefitPerCohort(p);
  const net = benefit - costEco;
  const bcr = costEco > 0 ? (benefit / costEco) : 0;

  const sc = {
    id: "SC"+Date.now(),
    shortlist: false,
    name: $("#scenario-name").value?.trim() || `${labelTier(state.tier)} – ${labelMentor(state.mentorship)}`,
    tags: scenarioTags(bcr,p),
    tier: labelTier(state.tier),
    career: labelCareer(state.career),
    mentorship: labelMentor(state.mentorship),
    delivery: labelDelivery(state.delivery),
    response: labelResponse(state.response),
    cohorts: state.cohorts,
    trainees: state.trainees,
    costPerMonth: state.costPerMonth,
    model: state.model==="mxl" ? "Average mixed logit" : "Supportive latent class",
    endorsement: p,
    bcr,
    totalCost: costEco * state.cohorts,
    totalBenefit: indicativeBenefitPerCohort(p) * state.cohorts,
    notes: $("#scenario-notes").value || ""
  };
  state.scenarios.push(sc);
  localStorage.setItem("steps_scenarios", JSON.stringify(state.scenarios));
  rebuildScenarioTable();
  showToast("Scenario saved.");
}

/* ---------- Scenarios Table ---------- */
function rebuildScenarioTable(){
  const tbody = $("#scenario-table tbody");
  tbody.innerHTML = "";
  state.scenarios.forEach((s, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" ${s.shortlist?"checked":""} data-idx="${idx}" class="shortlist"></td>
      <td>${s.name}</td>
      <td>${s.tags}</td>
      <td>${s.tier}</td>
      <td>${s.career}</td>
      <td>${s.mentorship}</td>
      <td>${s.delivery}</td>
      <td>${s.response}</td>
      <td style="text-align:right">${s.cohorts}</td>
      <td style="text-align:right">${s.trainees}</td>
      <td style="text-align:right">${formatINR(s.costPerMonth)}</td>
      <td>${s.model}</td>
      <td style="text-align:right">${fmtPct(s.endorsement)}</td>
      <td style="text-align:right">${s.bcr.toFixed(2)}</td>
      <td style="text-align:right">${formatINR(s.totalCost)}</td>
      <td style="text-align:right">${formatINR(s.totalBenefit)}</td>
      <td>${s.notes || ""}</td>
    `;
    tbody.appendChild(tr);
  });
  // listeners for shortlist
  $$("#scenario-table .shortlist").forEach(chk=>{
    chk.addEventListener("change", (e)=>{
      const i = +e.target.getAttribute("data-idx");
      state.scenarios[i].shortlist = e.target.checked;
      localStorage.setItem("steps_scenarios", JSON.stringify(state.scenarios));
    });
  });
}

/* ---------- Exports ---------- */
async function exportExcel(){
  const rows = state.scenarios.map(s=>({
    id:s.id, name:s.name, tags:s.tags, programme_tier:s.tier, career_incentive:s.career,
    mentorship:s.mentorship, delivery:s.delivery, response_time:s.response,
    cohorts:s.cohorts, trainees:s.trainees, cost_per_trainee_per_month:s.costPerMonth,
    preference_model:s.model, endorsement_pct:(s.endorsement*100).toFixed(1),
    bcr:s.bcr.toFixed(2), total_cost:s.totalCost, total_benefit:s.totalBenefit, notes:s.notes
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "STEPS Scenarios");
  XLSX.writeFile(wb, "STEPS_FETP_scenarios.xlsx");
}

async function exportPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const margin = 36;
  let y = margin;

  doc.setFont("helvetica","bold"); doc.setFontSize(14);
  doc.text("STEPS – FETP India Policy Brief", margin, y);
  y += 18;
  doc.setFont("helvetica",""); doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 16;

  // Current scenario snapshot
  const p = predictEndorsement();
  const costEco = economicCostPerCohort();
  const benefit = indicativeBenefitPerCohort(p);
  const net = benefit - costEco;
  const bcr = costEco>0 ? (benefit/costEco) : 0;

  const lines = [
    "Current configuration:",
    `- Programme tier: ${labelTier(state.tier)}`,
    `- Career incentive: ${labelCareer(state.career)}`,
    `- Mentorship: ${labelMentor(state.mentorship)}`,
    `- Delivery: ${labelDelivery(state.delivery)}`,
    `- Response time: ${labelResponse(state.response)}`,
    `- Preference model: ${state.model==="mxl"?"Average mixed logit":"Supportive latent class"}`,
    `- Trainees per cohort: ${state.trainees}; Cohorts: ${state.cohorts}`,
    `- Cost per trainee per month: ${formatINR(state.costPerMonth)}`,
    "",
    "Key results:",
    `- Estimated endorsement: ${(p*100).toFixed(1)} %`,
    `- Economic cost per cohort: ${formatINR(costEco)}`,
    `- Indicative benefit per cohort: ${formatINR(benefit)}`,
    `- Net benefit per cohort: ${formatINR(net)}`,
    `- Benefit cost ratio: ${bcr.toFixed(2)}`,
    `- Graduates (all cohorts): ${epiGraduatesAllCohorts(p).toLocaleString("en-IN")}`,
    `- Outbreak responses per year: ${epiOutbreaksPerYearAllCohorts(p).toLocaleString("en-IN")}`
  ];
  lines.forEach(txt=>{ doc.text(txt, margin, y); y+=14; });

  y += 8;
  doc.setFont("helvetica","bold"); doc.text("Saved scenarios (summary):", margin, y); y+=16;
  doc.setFont("helvetica","");

  const head = ["Name","Tier","Mentorship","Cohorts","Trainees","Endorse %","BCR","Total cost","Total benefit"];
  const colX = [margin, margin+140, margin+320, margin+430, margin+500, margin+570, margin+630, margin+680, margin+780];
  doc.setFontSize(9);
  head.forEach((h,i)=>doc.text(h, colX[i], y));
  y+=12;
  doc.setLineWidth(.5); doc.line(margin, y, 560+margin, y); y+=8;

  const rows = state.scenarios.slice(0, 18); // keep it concise for one page
  rows.forEach(s=>{
    const row = [
      s.name, s.tier, s.mentorship, String(s.cohorts), String(s.trainees),
      (s.endorsement*100).toFixed(1), s.bcr.toFixed(2), formatINR(s.totalCost), formatINR(s.totalBenefit)
    ];
    row.forEach((v,i)=>doc.text(String(v), colX[i], y));
    y+=12;
  });

  y+=16;
  doc.setFont("helvetica","bold"); doc.text("Assumptions and notes:", margin, y); y+=14;
  doc.setFont("helvetica",""); doc.setFontSize(9);
  doc.text("See the Technical Appendix for full methods and parameter explanations.", margin, y);

  doc.save("STEPS_FETP_policy_brief.pdf");
}

/* ---------- Currency labels ---------- */
function updateCurrencyLabels(){
  $("#currency-label").textContent = state.currency;
}

/* ---------- Event bindings ---------- */
function bindEvents(){
  $("#cost-slider").addEventListener("input",(e)=>{
    state.costPerMonth = +e.target.value;
    $("#cost-display").textContent = formatINR(state.costPerMonth);
  });

  $("#program-tier").addEventListener("change",(e)=>{
    state.tier = e.target.value;
    populateCostTemplateSelector();
    updateConfigSummary();
  });
  $("#career-track").addEventListener("change",(e)=>{ state.career = e.target.value; updateConfigSummary(); });
  $("#mentorship").addEventListener("change",(e)=>{ state.mentorship = e.target.value; updateConfigSummary(); });
  $("#delivery").addEventListener("change",(e)=>{ state.delivery = e.target.value; updateConfigSummary(); });
  $("#response").addEventListener("change",(e)=>{ state.response = e.target.value; updateConfigSummary(); });
  $("#trainees").addEventListener("input",(e)=>{ state.trainees = +e.target.value||state.trainees; });
  $("#cohorts").addEventListener("input",(e)=>{ state.cohorts = +e.target.value||state.cohorts; });

  $("#model-mxl").addEventListener("click", ()=>{
    $$("#config .pill-toggle").forEach(b=>b.classList.remove("active"));
    $("#model-mxl").classList.add("active");
    state.model = "mxl";
  });
  $("#model-lc2").addEventListener("click", ()=>{
    $$("#config .pill-toggle").forEach(b=>b.classList.remove("active"));
    $("#model-lc2").classList.add("active");
    state.model = "lc2";
  });

  $("#cur-inr").addEventListener("click", ()=>{
    $("#cur-inr").classList.add("active"); $("#cur-usd").classList.remove("active");
    state.currency = "INR"; updateCurrencyLabels(); updateAll();
  });
  $("#cur-usd").addEventListener("click", ()=>{
    $("#cur-usd").classList.add("active"); $("#cur-inr").classList.remove("active");
    state.currency = "USD"; updateCurrencyLabels(); updateAll();
  });

  $("#opp-toggle").addEventListener("click", (e)=>{
    state.includeOppCost = !state.includeOppCost;
    e.currentTarget.classList.toggle("on", state.includeOppCost);
    e.currentTarget.setAttribute("aria-pressed", String(state.includeOppCost));
  });

  $("#cost-source").addEventListener("change",(e)=>{
    state.costTemplateSource = e.target.value;
  });

  $("#update-results").addEventListener("click", ()=>{
    updateAll();
    showToast("Configuration applied.");
  });
  $("#open-snapshot").addEventListener("click", ()=>{
    updateAll();
    openModal(buildSnapshotHTML());
    showToast("Results summary opened.");
  });
  $("#close-modal").addEventListener("click", closeModal);
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeModal(); });

  $("#save-scenario").addEventListener("click", saveScenario);
  $("#export-excel").addEventListener("click", exportExcel);
  $("#export-pdf").addEventListener("click", exportPDF);

  $("#advanced-apply").addEventListener("click", ()=>{ readAdvancedFormIntoState(); updateAll(); showToast("Advanced settings applied."); });
  $("#advanced-reset").addEventListener("click", ()=>{ setAdvancedDefaultsToForm(); updateAll(); showToast("Advanced settings reset."); });

  // Quick tour
  $("#start-tour").addEventListener("click", startTour);
}

/* ---------- Guided Tour (lightweight) ---------- */
function startTour(){
  const steps = [
    { sel:'[data-tour="intro-what"]', title:'Welcome', body:'This is STEPS. Use it to configure programmes and see endorsement, costs and benefits.' },
    { sel:'#tabbtn-config', title:'Configuration tab', body:'Open Configuration to set programme tier, career incentives, mentorship, delivery, response time and costs.' },
    { sel:'[data-tour="config-panel"]', title:'Set parameters', body:'Adjust cost per trainee per month, cohort size and number of cohorts. Choose the preference model and currency display.' },
    { sel:'[data-tour="config-actions"]', title:'Apply and review', body:'Click Apply configuration to update all results. View results summary opens a snapshot card.' },
    { sel:'#tabbtn-results', title:'Results', body:'Endorsement, costs, benefits and WTP update instantly after you apply a configuration.' },
    { sel:'#tabbtn-costing', title:'Costing details', body:'Inspect cost components from WHO, NIE or NCDC templates. Opportunity cost adds to economic cost.' },
    { sel:'#tabbtn-natsim', title:'National simulation', body:'See totals across all cohorts for your configuration and review headline metrics and charts.' },
    { sel:'#tabbtn-technical', title:'Advanced & methods', body:'Change multipliers and values for workshops. Open the Technical Appendix for a detailed explanation.' }
  ];

  const overlay = document.createElement("div");
  overlay.style.position="fixed"; overlay.style.inset="0"; overlay.style.background="rgba(0,0,0,0.25)";
  overlay.style.zIndex="2000"; document.body.appendChild(overlay);

  const box = document.createElement("div");
  box.style.position="fixed"; box.style.maxWidth="360px"; box.style.background="#fff";
  box.style.border="1px solid var(--border)"; box.style.borderRadius="12px"; box.style.boxShadow="var(--shadow)";
  box.style.padding="14px"; box.style.zIndex="2001";
  document.body.appendChild(box);

  let i = 0;
  function place(){
    const st = steps[i];
    const el = document.querySelector(st.sel);
    if (!el){ next(); return; }
    const r = el.getBoundingClientRect();
    box.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">${st.title}</div>
      <div style="color:var(--text-2);margin-bottom:10px">${st.body}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="tour-prev" class="btn-ghost">Back</button>
        <button id="tour-next" class="btn-primary">${i===steps.length-1?"Finish":"Next"}</button>
        <button id="tour-skip" class="btn-secondary">Skip</button>
      </div>
    `;
    const top = Math.max(12, window.scrollY + r.top - box.offsetHeight - 10);
    const left = Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - box.offsetWidth - 12);
    box.style.top = `${top<0?window.scrollY + r.bottom + 10:top}px`;
    box.style.left = `${left}px`;

    $("#tour-prev").onclick = ()=>{ i = Math.max(0, i-1); place(); };
    $("#tour-next").onclick = ()=>{ if(i===steps.length-1) end(); else { i++; place(); } };
    $("#tour-skip").onclick = end;
  }
  function next(){ i++; if(i>=steps.length) end(); else place(); }
  function end(){
    overlay.remove(); box.remove();
    state.tourSeen = true; localStorage.setItem("steps_tour_seen","1");
  }
  place();
}

/* ---------- Init ---------- */
async function init(){
  bindEvents();
  await loadConfig();
  rebuildScenarioTable();
  if (!state.tourSeen) startTour();
  // First calculation
  updateAll();
}
document.addEventListener("DOMContentLoaded", init);
