/* Global state and configuration */

const STEPS_STATE = {
    currentModel: "mxl",
    currency: "INR",
    includeOpportunityCost: true,
    lastOutputs: null,
    charts: {
        uptake: null,
        bcr: null,
        epi: null
    },
    advanced: {
        horizonYears: 5,
        inrPerUsd: 83,
        gradsShare: {
            frontline: 0.9,
            intermediate: 0.9,
            advanced: 0.95
        },
        outbreaksPerCohortPerYear: {
            frontline: 0.3,
            intermediate: 0.5,
            advanced: 0.8
        },
        valuePerGraduate: {
            frontline: 800000,
            intermediate: 900000,
            advanced: 1000000
        },
        valuePerOutbreak: {
            frontline: 30000000,
            intermediate: 30000000,
            advanced: 30000000
        }
    }
};

/* Mixed logit and latent class parameter sets (illustrative) */

const PREF_MODELS = {
    mxl: {
        label: "Average mixed logit",
        ascA: 0.168,
        ascOptOut: -0.601,
        intermediate: 0.220,
        advanced: 0.487,
        uniQual: 0.017,
        govCareer: -0.122,
        mentorMedium: 0.453,
        mentorHigh: 0.640,
        inPerson: -0.232,
        online: -1.073,
        resp15: 0.546,
        resp7: 0.610,
        cost: -0.005
    },
    lc2: {
        label: "Supportive latent class",
        ascA: 0.098,
        ascOptOut: -2.543,
        intermediate: 0.150,
        advanced: 0.422,
        uniQual: 0.050,
        govCareer: 0.120,
        mentorMedium: 0.342,
        mentorHigh: 0.486,
        inPerson: -0.150,
        online: -0.900,
        resp15: 0.317,
        resp7: 0.504,
        cost: -0.0014
    }
};

/* Cost templates (illustrative, scaled via slider and cohort inputs) */

const COST_TEMPLATES = {
    frontline: [
        {
            id: "frontline_who",
            label: "Frontline - WHO template",
            durationMonths: 3,
            oppShare: 0.2,
            components: [
                { name: "Training and materials", share: 0.45 },
                { name: "Travel and per diem", share: 0.25 },
                { name: "Mentorship and supervision", share: 0.20 },
                { name: "Management and overhead", share: 0.10 }
            ]
        }
    ],
    intermediate: [
        {
            id: "intermediate_who",
            label: "Intermediate - WHO template",
            durationMonths: 12,
            oppShare: 0.25,
            components: [
                { name: "Training and materials", share: 0.40 },
                { name: "Field projects and supervision", share: 0.30 },
                { name: "Travel and per diem", share: 0.15 },
                { name: "Management and overhead", share: 0.15 }
            ]
        },
        {
            id: "intermediate_nie",
            label: "Intermediate - NIE template",
            durationMonths: 12,
            oppShare: 0.30,
            components: [
                { name: "Training and materials", share: 0.35 },
                { name: "Field projects and supervision", share: 0.35 },
                { name: "Travel and per diem", share: 0.15 },
                { name: "Management and overhead", share: 0.15 }
            ]
        },
        {
            id: "intermediate_ncdc",
            label: "Intermediate - NCDC template",
            durationMonths: 12,
            oppShare: 0.25,
            components: [
                { name: "Training and materials", share: 0.38 },
                { name: "Field projects and supervision", share: 0.32 },
                { name: "Travel and per diem", share: 0.15 },
                { name: "Management and overhead", share: 0.15 }
            ]
        }
    ],
    advanced: [
        {
            id: "advanced_nie",
            label: "Advanced - NIE template",
            durationMonths: 24,
            oppShare: 0.30,
            components: [
                { name: "Training and materials", share: 0.30 },
                { name: "Field investigations and supervision", share: 0.40 },
                { name: "Travel and per diem", share: 0.15 },
                { name: "Management and overhead", share: 0.15 }
            ]
        },
        {
            id: "advanced_ncdc",
            label: "Advanced - NCDC template",
            durationMonths: 24,
            oppShare: 0.30,
            components: [
                { name: "Training and materials", share: 0.32 },
                { name: "Field investigations and supervision", share: 0.38 },
                { name: "Travel and per diem", share: 0.15 },
                { name: "Management and overhead", share: 0.15 }
            ]
        }
    ]
};

function getDefaultTemplateForTier(tier) {
    const list = COST_TEMPLATES[tier] || [];
    return list.length ? list[0] : null;
}

/* Helpers */

function formatNumber(num, decimals = 1) {
    if (num === null || num === undefined || isNaN(num)) return "-";
    const fixed = num.toFixed(decimals);
    return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatCurrencyINR(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return "-";
    const rounded = Math.round(amount);
    return "INR " + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatCurrency(amountInINR) {
    if (STEPS_STATE.currency === "INR") {
        return formatCurrencyINR(amountInINR);
    }
    const usd = amountInINR / (STEPS_STATE.advanced.inrPerUsd || 1);
    const rounded = Math.round(usd);
    return "USD " + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function logistic(x) {
    if (x > 40) return 1;
    if (x < -40) return 0;
    return 1 / (1 + Math.exp(-x));
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3800);
}

/* Read configuration from UI */

function getConfigFromUI() {
    const tier = document.getElementById("program-tier").value;
    const career = document.getElementById("career-track").value;
    const mentorship = document.getElementById("mentorship").value;
    const delivery = document.getElementById("delivery").value;
    const response = document.getElementById("response").value;
    const cost = parseFloat(document.getElementById("cost-slider").value) || 0;
    const trainees = parseInt(document.getElementById("trainees").value, 10) || 0;
    const cohorts = parseInt(document.getElementById("cohorts").value, 10) || 0;
    const scenarioName = document.getElementById("scenario-name").value.trim();
    const notes = document.getElementById("scenario-notes").value.trim();
    const tierTemplates = COST_TEMPLATES[tier] || [];
    const costSourceSelect = document.getElementById("cost-source");
    let template = null;
    if (costSourceSelect && costSourceSelect.value) {
        const allTemplates = [...tierTemplates];
        template = allTemplates.find(t => t.id === costSourceSelect.value) || getDefaultTemplateForTier(tier);
    } else {
        template = getDefaultTemplateForTier(tier);
    }

    return {
        tier,
        career,
        mentorship,
        delivery,
        response,
        costPerTraineeMonth: cost,
        trainees,
        cohorts,
        scenarioName,
        notes,
        template,
        modelKey: STEPS_STATE.currentModel,
        currency: STEPS_STATE.currency,
        includeOpportunityCost: STEPS_STATE.includeOpportunityCost
    };
}

/* Utility and outcome calculations */

function getDurationMonths(tier, template) {
    if (template && template.durationMonths) return template.durationMonths;
    if (tier === "frontline") return 3;
    if (tier === "intermediate") return 12;
    if (tier === "advanced") return 24;
    return 12;
}

function computeEndorsement(config) {
    const model = PREF_MODELS[config.modelKey] || PREF_MODELS.mxl;

    let deltaV = 0;

    // Opt out and general preference for training
    deltaV += -model.ascOptOut;
    deltaV += model.ascA;

    // Programme tier
    if (config.tier === "intermediate") {
        deltaV += model.intermediate;
    } else if (config.tier === "advanced") {
        deltaV += model.advanced;
    }

    // Career incentive
    if (config.career === "uniqual") {
        deltaV += model.uniQual;
    } else if (config.career === "career_path") {
        deltaV += model.govCareer;
    }

    // Mentorship
    if (config.mentorship === "medium") {
        deltaV += model.mentorMedium;
    } else if (config.mentorship === "high") {
        deltaV += model.mentorHigh;
    }

    // Delivery
    if (config.delivery === "inperson") {
        deltaV += model.inPerson;
    } else if (config.delivery === "online") {
        deltaV += model.online;
    }

    // Response time
    if (config.response === "15") {
        deltaV += model.resp15;
    } else if (config.response === "7") {
        deltaV += model.resp7;
    }

    // Cost (in thousand INR per trainee per month)
    const costThousand = config.costPerTraineeMonth / 1000;
    deltaV += model.cost * costThousand;

    const endorse = logistic(deltaV);
    return {
        endorse,
        optout: 1 - endorse,
        deltaV
    };
}

function computeCostsAndBenefits(config, endorseObj) {
    const { endorse } = endorseObj;
    const durationMonths = getDurationMonths(config.tier, config.template);
    const baseProgrammeCost = config.costPerTraineeMonth * config.trainees * durationMonths;

    const oppShare = config.template ? config.template.oppShare : 0.25;
    const oppMultiplier = config.includeOpportunityCost ? (1 + oppShare) : 1;
    const economicCostPerCohort = baseProgrammeCost * oppMultiplier;

    const adv = STEPS_STATE.advanced;
    const gradsShare = adv.gradsShare[config.tier] || 0.9;
    const outbreaksPerCohortPerYear = adv.outbreaksPerCohortPerYear[config.tier] || 0.5;
    const valuePerGrad = adv.valuePerGraduate[config.tier] || 800000;
    const valuePerOutbreak = adv.valuePerOutbreak[config.tier] || 30000000;
    const horizonYears = adv.horizonYears || 5;

    const gradsPerCohort = config.trainees * gradsShare * endorse;
    const outbreaksPerYearPerCohort = outbreaksPerCohortPerYear * endorse;
    const totalOutbreaksOverHorizon = outbreaksPerYearPerCohort * horizonYears;

    const benefitGraduates = gradsPerCohort * valuePerGrad;
    const benefitOutbreaks = totalOutbreaksOverHorizon * valuePerOutbreak;
    const benefitPerCohort = benefitGraduates + benefitOutbreaks;

    const netBenefitPerCohort = benefitPerCohort - economicCostPerCohort;
    const bcr = economicCostPerCohort > 0 ? (benefitPerCohort / economicCostPerCohort) : null;

    const cohorts = config.cohorts || 0;
    const natTotalCost = economicCostPerCohort * cohorts;
    const natTotalBenefit = benefitPerCohort * cohorts;
    const natNetBenefit = natTotalBenefit - natTotalCost;
    const natBcr = natTotalCost > 0 ? (natTotalBenefit / natTotalCost) : null;

    const natGraduates = gradsPerCohort * cohorts;
    const natOutbreaksPerYear = outbreaksPerYearPerCohort * cohorts;

    return {
        economicCostPerCohort,
        benefitPerCohort,
        netBenefitPerCohort,
        bcr,
        gradsPerCohort,
        outbreaksPerYearPerCohort,
        benefitGraduates,
        benefitOutbreaks,
        natTotalCost,
        natTotalBenefit,
        natNetBenefit,
        natBcr,
        natGraduates,
        natOutbreaksPerYear
    };
}

/* UI updates */

function renderConfigSummary(config, endorseObj, econ) {
    const container = document.getElementById("config-summary");
    if (!container) return;

    const tierLabel = {
        frontline: "Frontline (3 months)",
        intermediate: "Intermediate (12 months)",
        advanced: "Advanced (24 months)"
    }[config.tier] || "Not specified";

    const careerLabel = {
        certificate: "Government and partner certificate",
        uniqual: "University qualification",
        career_path: "Government career pathway"
    }[config.career] || "Not specified";

    const mentorshipLabel = {
        low: "Low mentorship (about 5 or more trainees per mentor)",
        medium: "Medium mentorship (3 to 4 trainees per mentor)",
        high: "High mentorship (maximum 2 trainees per mentor)"
    }[config.mentorship] || "Not specified";

    const deliveryLabel = {
        blended: "Blended delivery (mix of online, in person and field work)",
        inperson: "Fully in person",
        online: "Fully online"
    }[config.delivery] || "Not specified";

    const responseLabel = {
        "30": "Detect and respond within 30 days",
        "15": "Detect and respond within 15 days",
        "7": "Detect and respond within 7 days"
    }[config.response] || "Not specified";

    const modelLabel = PREF_MODELS[config.modelKey]?.label || "Average mixed logit";
    const templateLabel = config.template ? config.template.label : "Not specified";
    const oppLabel = config.includeOpportunityCost ? "Yes" : "No";

    container.innerHTML = `
        <dl>
            <dt>Programme tier</dt>
            <dd><strong>${tierLabel}</strong></dd>
            <dt>Career incentive</dt>
            <dd><strong>${careerLabel}</strong></dd>
            <dt>Mentorship intensity</dt>
            <dd><strong>${mentorshipLabel}</strong></dd>
            <dt>Delivery mode</dt>
            <dd>${deliveryLabel}</dd>
            <dt>Expected response time</dt>
            <dd>${responseLabel}</dd>
            <dt>Preference model</dt>
            <dd>${modelLabel}</dd>
            <dt>Cost per trainee per month</dt>
            <dd>${formatCurrency(config.costPerTraineeMonth)}</dd>
            <dt>Trainees per cohort</dt>
            <dd>${config.trainees}</dd>
            <dt>Number of cohorts</dt>
            <dd>${config.cohorts}</dd>
            <dt>Cost template</dt>
            <dd>${templateLabel}</dd>
            <dt>Opportunity cost included</dt>
            <dd>${oppLabel}</dd>
        </dl>
    `;

    const endorsementSpan = document.getElementById("config-endorsement-value");
    if (endorsementSpan) {
        endorsementSpan.textContent = `${(endorseObj.endorse * 100).toFixed(1)} %`;
    }

    const headline = document.getElementById("headline-recommendation");
    if (headline) {
        const e = endorseObj.endorse;
        const bcr = econ.bcr || 0;
        let text;
        if (e >= 0.8 && bcr >= 1.2) {
            text = "This configuration is highly attractive. It combines strong endorsement with a benefit cost ratio clearly above one. It is a strong candidate for priority scale up, subject to budget and implementation feasibility.";
        } else if (e >= 0.6 && bcr >= 1.0) {
            text = "This configuration performs well on both endorsement and value for money. It is suitable for further discussion as a scale up option, especially if complementary system investments are planned.";
        } else if (e >= 0.5 && bcr >= 0.9) {
            text = "This configuration has moderate endorsement and a benefit cost ratio close to one. It may be suitable in specific contexts, but design refinements or cost reductions would strengthen the case for large scale investment.";
        } else {
            text = "At current design and cost, endorsement and economic returns are modest. Consider improving mentorship intensity, adjusting incentives or reducing costs before treating this configuration as a leading option for national scale up.";
        }
        headline.textContent = text;
    }
}

function updateResultsTab(endorseObj, econ) {
    const endorsementRate = document.getElementById("endorsement-rate");
    const optoutRate = document.getElementById("optout-rate");
    const totalCost = document.getElementById("total-cost");
    const netBenefit = document.getElementById("net-benefit");
    const bcrSpan = document.getElementById("bcr");
    const epiGrads = document.getElementById("epi-graduates");
    const epiOutbreaks = document.getElementById("epi-outbreaks");
    const epiBenefit = document.getElementById("epi-benefit");

    if (endorsementRate) {
        endorsementRate.textContent = `${(endorseObj.endorse * 100).toFixed(1)} %`;
    }
    if (optoutRate) {
        optoutRate.textContent = `${(endorseObj.optout * 100).toFixed(1)} %`;
    }
    if (totalCost) {
        totalCost.textContent = formatCurrency(econ.economicCostPerCohort);
    }
    if (netBenefit) {
        netBenefit.textContent = formatCurrency(econ.netBenefitPerCohort);
    }
    if (bcrSpan) {
        bcrSpan.textContent = econ.bcr != null ? econ.bcr.toFixed(2) : "-";
    }
    if (epiGrads) {
        epiGrads.textContent = formatNumber(econ.gradsPerCohort, 1);
    }
    if (epiOutbreaks) {
        epiOutbreaks.textContent = formatNumber(econ.outbreaksPerYearPerCohort, 1);
    }
    if (epiBenefit) {
        epiBenefit.textContent = formatCurrency(econ.benefitPerCohort);
    }
}

function updateNationalSimulationTab(econ) {
    const natCost = document.getElementById("nat-total-cost");
    const natBenefit = document.getElementById("nat-total-benefit");
    const natNet = document.getElementById("nat-net-benefit");
    const natBcr = document.getElementById("nat-bcr");
    const natGrads = document.getElementById("nat-graduates");
    const natOutbreaks = document.getElementById("nat-outbreaks");

    if (natCost) natCost.textContent = formatCurrency(econ.natTotalCost);
    if (natBenefit) natBenefit.textContent = formatCurrency(econ.natTotalBenefit);
    if (natNet) natNet.textContent = formatCurrency(econ.natNetBenefit);
    if (natBcr) natBcr.textContent = econ.natBcr != null ? econ.natBcr.toFixed(2) : "-";
    if (natGrads) natGrads.textContent = formatNumber(econ.natGraduates, 1);
    if (natOutbreaks) natOutbreaks.textContent = formatNumber(econ.natOutbreaksPerYear, 1);
}

function updateCostingTab(config, econ) {
    const summary = document.getElementById("cost-breakdown-summary");
    const list = document.getElementById("cost-components-list");
    if (!summary || !list) return;

    const templateLabel = config.template ? config.template.label : "Not specified";
    const oppLabel = config.includeOpportunityCost ? "included" : "excluded";
    summary.innerHTML = `
        <div>Template: <strong>${templateLabel}</strong></div>
        <div>Total economic cost per cohort: <strong>${formatCurrency(econ.economicCostPerCohort)}</strong> (opportunity cost ${oppLabel}).</div>
    `;

    list.innerHTML = "";
    if (config.template && config.template.components) {
        const ul = document.createElement("ul");
        ul.className = "plain-list";
        config.template.components.forEach(c => {
            const li = document.createElement("li");
            const componentCost = econ.economicCostPerCohort * c.share;
            li.textContent = `${c.name}: about ${formatCurrency(componentCost)} (${(c.share * 100).toFixed(0)} percent of total economic cost).`;
            ul.appendChild(li);
        });
        list.appendChild(ul);
    }
}

function updateCharts(endorseObj, econ) {
    const ctxUptake = document.getElementById("chart-uptake");
    const ctxBcr = document.getElementById("chart-bcr");
    const ctxEpi = document.getElementById("chart-epi");

    if (ctxUptake) {
        if (STEPS_STATE.charts.uptake) STEPS_STATE.charts.uptake.destroy();
        STEPS_STATE.charts.uptake = new Chart(ctxUptake, {
            type: "doughnut",
            data: {
                labels: ["Endorse FETP", "Opt out"],
                datasets: [{
                    data: [endorseObj.endorse * 100, endorseObj.optout * 100],
                    backgroundColor: ["#1d4f91", "#d1d5db"]
                }]
            },
            options: {
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        });
    }

    if (ctxBcr) {
        if (STEPS_STATE.charts.bcr) STEPS_STATE.charts.bcr.destroy();
        STEPS_STATE.charts.bcr = new Chart(ctxBcr, {
            type: "bar",
            data: {
                labels: ["Cost per cohort", "Benefit per cohort"],
                datasets: [{
                    data: [econ.economicCostPerCohort, econ.benefitPerCohort],
                    backgroundColor: ["#1d4f91", "#0f766e"]
                }]
            },
            options: {
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function () { return ""; }
                        }
                    }
                }
            }
        });
    }

    if (ctxEpi) {
        if (STEPS_STATE.charts.epi) STEPS_STATE.charts.epi.destroy();
        STEPS_STATE.charts.epi = new Chart(ctxEpi, {
            type: "bar",
            data: {
                labels: ["Graduates per cohort", "Outbreak responses per year"],
                datasets: [{
                    data: [econ.gradsPerCohort, econ.outbreaksPerYearPerCohort],
                    backgroundColor: ["#1d4f91", "#7c3aed"]
                }]
            },
            options: {
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function () { return ""; }
                        }
                    }
                }
            }
        });
    }
}

function updateBriefingText(config, endorseObj, econ) {
    const textarea = document.getElementById("briefing-text");
    if (!textarea) return;

    const tierLabel = {
        frontline: "Frontline (3 months)",
        intermediate: "Intermediate (12 months)",
        advanced: "Advanced (24 months)"
    }[config.tier] || "not specified";

    const careerLabel = {
        certificate: "a government and partner certificate",
        uniqual: "a university qualification",
        career_path: "a government career pathway"
    }[config.career] || "a basic recognition certificate";

    const mentorshipLabel = {
        low: "low mentorship",
        medium: "medium mentorship",
        high: "high mentorship"
    }[config.mentorship] || "standard mentorship";

    const deliveryLabel = {
        blended: "a blended delivery model",
        inperson: "a fully in person model",
        online: "a fully online model"
    }[config.delivery] || "a mixed delivery model";

    const responseLabel = {
        "30": "detect and respond within 30 days",
        "15": "detect and respond within 15 days",
        "7": "detect and respond within 7 days"
    }[config.response] || "detect and respond in a timely way";

    const modelLabel = PREF_MODELS[config.modelKey]?.label || "Average mixed logit";
    const endorsementPercent = (endorseObj.endorse * 100).toFixed(1);
    const optoutPercent = (endorseObj.optout * 100).toFixed(1);
    const bcrStr = econ.bcr != null ? econ.bcr.toFixed(2) : "not defined";
    const costStr = formatCurrency(econ.economicCostPerCohort);
    const netStr = formatCurrency(econ.netBenefitPerCohort);

    const text = [
        `Under the current configuration, the programme is set to ${tierLabel} with ${careerLabel} as the main career incentive, ${mentorshipLabel}, ${deliveryLabel} and an expected ability to ${responseLabel}.`,
        `Using the ${modelLabel} preference model, the predicted endorsement rate is about ${endorsementPercent} percent, with about ${optoutPercent} percent preferring not to fund any FETP option in this scenario.`,
        `The total economic cost per cohort is approximately ${costStr}. Indicative benefits per cohort, based on willingness to pay and simple epidemiological multipliers, yield a net benefit of about ${netStr} and a benefit cost ratio of roughly ${bcrStr}.`,
        `These figures should be interpreted as decision support inputs. They are intended to highlight which combinations of tier, incentives, mentorship and cost appear most promising for national scale up, rather than to replace detailed programme budgeting or transmission modelling.`
    ].join(" ");

    textarea.value = text;
}

/* Modal snapshot */

function openSnapshotModal(config, endorseObj, econ) {
    const modal = document.getElementById("results-modal");
    const body = document.getElementById("modal-body");
    if (!modal || !body) return;

    const modelLabel = PREF_MODELS[config.modelKey]?.label || "Average mixed logit";
    const templateLabel = config.template ? config.template.label : "Not specified";

    body.innerHTML = `
        <p><strong>Scenario name:</strong> ${config.scenarioName || "Not named"}</p>
        <p><strong>Programme tier:</strong> ${
            {frontline: "Frontline (3 months)", intermediate: "Intermediate (12 months)", advanced: "Advanced (24 months)"}[config.tier]
            || "Not specified"
        }</p>
        <p><strong>Career incentive:</strong> ${
            {certificate: "Government and partner certificate", uniqual: "University qualification", career_path: "Government career pathway"}[config.career]
            || "Not specified"
        }</p>
        <p><strong>Mentorship intensity:</strong> ${
            {low: "Low mentorship", medium: "Medium mentorship", high: "High mentorship"}[config.mentorship]
            || "Not specified"
        }</p>
        <p><strong>Delivery mode:</strong> ${
            {blended: "Blended", inperson: "Fully in person", online: "Fully online"}[config.delivery]
            || "Not specified"
        }</p>
        <p><strong>Expected response time:</strong> ${
            {"30": "Detect and respond within 30 days", "15": "Detect and respond within 15 days", "7": "Detect and respond within 7 days"}[config.response]
            || "Not specified"
        }</p>
        <p><strong>Preference model:</strong> ${modelLabel}</p>
        <p><strong>Cost template:</strong> ${templateLabel}; opportunity cost ${config.includeOpportunityCost ? "included" : "excluded"}.</p>
        <p><strong>Cohorts and trainees:</strong> ${config.cohorts} cohorts with ${config.trainees} trainees per cohort.</p>
        <p><strong>Endorsement and opt out:</strong> Endorsement about ${(endorseObj.endorse * 100).toFixed(1)} percent; opt out about ${(endorseObj.optout * 100).toFixed(1)} percent.</p>
        <p><strong>Economic results (per cohort):</strong> Cost ${formatCurrency(econ.economicCostPerCohort)}, net benefit ${formatCurrency(econ.netBenefitPerCohort)}, benefit cost ratio ${
            econ.bcr != null ? econ.bcr.toFixed(2) : "-"
        }.</p>
        <p><strong>Epidemiological picture (per cohort):</strong> Approximately ${formatNumber(econ.gradsPerCohort, 1)} graduates and ${formatNumber(econ.outbreaksPerYearPerCohort, 1)} outbreak responses per year under the current multipliers.</p>
        <p><strong>Notes:</strong> ${config.notes || "No additional notes recorded for this scenario."}</p>
    `;

    modal.classList.remove("hidden");
}

/* Saved scenarios */

function addScenarioToTable(config, endorseObj, econ) {
    const tableBody = document.querySelector("#scenario-table tbody");
    if (!tableBody) return;

    const row = document.createElement("tr");

    const tierLabel = {
        frontline: "Frontline (3 months)",
        intermediate: "Intermediate (12 months)",
        advanced: "Advanced (24 months)"
    }[config.tier] || "Not specified";

    const careerLabel = {
        certificate: "Government and partner certificate",
        uniqual: "University qualification",
        career_path: "Government career pathway"
    }[config.career] || "Not specified";

    const mentorshipLabel = {
        low: "Low",
        medium: "Medium",
        high: "High"
    }[config.mentorship] || "Not specified";

    const deliveryLabel = {
        blended: "Blended",
        inperson: "In person",
        online: "Online"
    }[config.delivery] || "Not specified";

    const responseLabel = {
        "30": "Within 30 days",
        "15": "Within 15 days",
        "7": "Within 7 days"
    }[config.response] || "Not specified";

    const modelLabel = PREF_MODELS[config.modelKey]?.label || "Average mixed logit";
    const templateLabel = config.template ? config.template.label : "Not specified";

    const cells = [
        config.scenarioName || "Scenario",
        tierLabel,
        careerLabel,
        mentorshipLabel,
        deliveryLabel,
        responseLabel,
        String(config.cohorts),
        String(config.trainees),
        formatCurrency(config.costPerTraineeMonth),
        templateLabel,
        modelLabel,
        config.includeOpportunityCost ? "Yes" : "No",
        `${(endorseObj.endorse * 100).toFixed(1)} %`,
        econ.bcr != null ? econ.bcr.toFixed(2) : "-",
        formatCurrency(econ.netBenefitPerCohort)
    ];

    cells.forEach(text => {
        const td = document.createElement("td");
        td.textContent = text;
        row.appendChild(td);
    });

    tableBody.appendChild(row);
}

/* Export helpers */

function exportScenariosToExcel() {
    const table = document.getElementById("scenario-table");
    if (!table) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Scenarios");
    XLSX.writeFile(wb, "STEPS_FETP_scenarios.xlsx");
}

function exportScenariosToPdf() {
    const table = document.getElementById("scenario-table");
    if (!table) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(12);
    doc.text("STEPS - FETP India scale up scenarios", 10, 12);
    doc.setFontSize(9);

    const rows = [];
    const headers = [];
    table.querySelectorAll("thead th").forEach(th => headers.push(th.textContent));

    table.querySelectorAll("tbody tr").forEach(tr => {
        const row = [];
        tr.querySelectorAll("td").forEach(td => row.push(td.textContent));
        rows.push(row);
    });

    const colWidth = 260 / headers.length;
    let y = 20;

    doc.setFont(undefined, "bold");
    headers.forEach((h, idx) => {
        doc.text(h, 10 + idx * colWidth, y);
    });
    doc.setFont(undefined, "normal");
    y += 4;

    rows.forEach(row => {
        row.forEach((cell, idx) => {
            doc.text(String(cell), 10 + idx * colWidth, y);
        });
        y += 4;
        if (y > 190) {
            doc.addPage();
            y = 20;
        }
    });

    doc.save("STEPS_FETP_scenarios.pdf");
}

/* Advanced settings form */

function readAdvancedSettingsFromForm() {
    const getNumber = (id, fallback) => {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const val = parseFloat(el.value);
        return isNaN(val) ? fallback : val;
    };

    STEPS_STATE.advanced.horizonYears = getNumber("adv-horizon-years", 5);
    STEPS_STATE.advanced.inrPerUsd = getNumber("adv-inr-per-usd", 83);

    STEPS_STATE.advanced.gradsShare.frontline = getNumber("adv-frontline-grads", 0.9);
    STEPS_STATE.advanced.outbreaksPerCohortPerYear.frontline = getNumber("adv-frontline-outbreaks", 0.3);
    STEPS_STATE.advanced.valuePerGraduate.frontline = getNumber("adv-frontline-vgrad", 800000);
    STEPS_STATE.advanced.valuePerOutbreak.frontline = getNumber("adv-frontline-voutbreak", 30000000);

    STEPS_STATE.advanced.gradsShare.intermediate = getNumber("adv-intermediate-grads", 0.9);
    STEPS_STATE.advanced.outbreaksPerCohortPerYear.intermediate = getNumber("adv-intermediate-outbreaks", 0.5);
    STEPS_STATE.advanced.valuePerGraduate.intermediate = getNumber("adv-intermediate-vgrad", 850000);
    STEPS_STATE.advanced.valuePerOutbreak.intermediate = getNumber("adv-intermediate-voutbreak", 30000000);

    STEPS_STATE.advanced.gradsShare.advanced = getNumber("adv-advanced-grads", 0.95);
    STEPS_STATE.advanced.outbreaksPerCohortPerYear.advanced = getNumber("adv-advanced-outbreaks", 0.8);
    STEPS_STATE.advanced.valuePerGraduate.advanced = getNumber("adv-advanced-vgrad", 900000);
    STEPS_STATE.advanced.valuePerOutbreak.advanced = getNumber("adv-advanced-voutbreak", 30000000);
}

function writeAdvancedSettingsToForm() {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal("adv-horizon-years", STEPS_STATE.advanced.horizonYears);
    setVal("adv-inr-per-usd", STEPS_STATE.advanced.inrPerUsd);

    setVal("adv-frontline-grads", STEPS_STATE.advanced.gradsShare.frontline);
    setVal("adv-frontline-outbreaks", STEPS_STATE.advanced.outbreaksPerCohortPerYear.frontline);
    setVal("adv-frontline-vgrad", STEPS_STATE.advanced.valuePerGraduate.frontline);
    setVal("adv-frontline-voutbreak", STEPS_STATE.advanced.valuePerOutbreak.frontline);

    setVal("adv-intermediate-grads", STEPS_STATE.advanced.gradsShare.intermediate);
    setVal("adv-intermediate-outbreaks", STEPS_STATE.advanced.outbreaksPerCohortPerYear.intermediate);
    setVal("adv-intermediate-vgrad", STEPS_STATE.advanced.valuePerGraduate.intermediate);
    setVal("adv-intermediate-voutbreak", STEPS_STATE.advanced.valuePerOutbreak.intermediate);

    setVal("adv-advanced-grads", STEPS_STATE.advanced.gradsShare.advanced);
    setVal("adv-advanced-outbreaks", STEPS_STATE.advanced.outbreaksPerCohortPerYear.advanced);
    setVal("adv-advanced-vgrad", STEPS_STATE.advanced.valuePerGraduate.advanced);
    setVal("adv-advanced-voutbreak", STEPS_STATE.advanced.valuePerOutbreak.advanced);
}

/* Tab navigation */

function setupTabs() {
    const links = document.querySelectorAll(".tab-link");
    const panels = document.querySelectorAll(".tab-panel");

    links.forEach(link => {
        link.addEventListener("click", () => {
            const tab = link.dataset.tab;
            links.forEach(l => l.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));

            link.classList.add("active");
            const panel = document.getElementById(`tab-${tab}`);
            if (panel) panel.classList.add("active");
        });
    });
}

/* Cost source select */

function populateCostSourceSelectForTier(tier) {
    const select = document.getElementById("cost-source");
    if (!select) return;
    const templates = COST_TEMPLATES[tier] || [];
    const previousValue = select.value;

    select.innerHTML = "";
    templates.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.label;
        select.appendChild(opt);
    });

    if (previousValue && templates.some(t => t.id === previousValue)) {
        select.value = previousValue;
    }
}

/* Apply configuration */

function applyConfiguration(showToastFlag = false) {
    const config = getConfigFromUI();
    const endorseObj = computeEndorsement(config);
    const econ = computeCostsAndBenefits(config, endorseObj);

    STEPS_STATE.lastOutputs = { config, endorseObj, econ };

    renderConfigSummary(config, endorseObj, econ);
    updateResultsTab(endorseObj, econ);
    updateNationalSimulationTab(econ);
    updateCostingTab(config, econ);
    updateCharts(endorseObj, econ);
    updateBriefingText(config, endorseObj, econ);

    if (showToastFlag) {
        showToast("Configuration applied. Results updated across all tabs.");
    }
}

/* Technical appendix window */

function openTechnicalAppendixWindow() {
    const template = document.getElementById("technical-appendix-template");
    if (!template) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(template.textContent);
    win.document.close();
}

/* Quick tour */

function showTourIfFirstTime() {
    const seen = localStorage.getItem("stepsTourSeen");
    const modal = document.getElementById("tour-modal");
    if (modal && !seen) {
        modal.classList.remove("hidden");
    }
}

function closeTourAndMarkSeen() {
    const modal = document.getElementById("tour-modal");
    if (modal) modal.classList.add("hidden");
    localStorage.setItem("stepsTourSeen", "1");
}

/* Currency and model toggles */

function setupModelAndCurrencyToggles() {
    document.querySelectorAll(".pill-toggle[data-model]").forEach(btn => {
        btn.addEventListener("click", () => {
            const key = btn.getAttribute("data-model");
            STEPS_STATE.currentModel = key;
            document.querySelectorAll(".pill-toggle[data-model]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyConfiguration(false);
        });
    });

    document.querySelectorAll(".pill-toggle[data-currency]").forEach(btn => {
        btn.addEventListener("click", () => {
            const cur = btn.getAttribute("data-currency");
            STEPS_STATE.currency = cur;
            document.querySelectorAll(".pill-toggle[data-currency]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const label = document.getElementById("currency-label");
            if (label) label.textContent = cur;
            applyConfiguration(false);
        });
    });
}

/* Event setup */

document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupModelAndCurrencyToggles();

    // Cost slider label
    const costSlider = document.getElementById("cost-slider");
    const costDisplay = document.getElementById("cost-display");
    if (costSlider && costDisplay) {
        costSlider.addEventListener("input", () => {
            costDisplay.textContent = formatCurrencyINR(parseFloat(costSlider.value) || 0);
        });
        costDisplay.textContent = formatCurrencyINR(parseFloat(costSlider.value) || 250000);
    }

    // Opportunity cost toggle
    const oppToggle = document.getElementById("opp-toggle");
    if (oppToggle) {
        oppToggle.addEventListener("click", () => {
            STEPS_STATE.includeOpportunityCost = !STEPS_STATE.includeOpportunityCost;
            oppToggle.classList.toggle("on", STEPS_STATE.includeOpportunityCost);
            const label = oppToggle.querySelector(".switch-label");
            if (label) {
                label.textContent = STEPS_STATE.includeOpportunityCost
                    ? "Opportunity cost included"
                    : "Opportunity cost excluded";
            }
            applyConfiguration(false);
        });
    }

    // Populate cost source based on tier
    const tierSelect = document.getElementById("program-tier");
    if (tierSelect) {
        tierSelect.addEventListener("change", () => {
            populateCostSourceSelectForTier(tierSelect.value);
            applyConfiguration(false);
        });
        populateCostSourceSelectForTier(tierSelect.value);
    }

    // Main buttons
    const updateBtn = document.getElementById("update-results");
    if (updateBtn) {
        updateBtn.addEventListener("click", () => {
            applyConfiguration(true);
        });
    }

    const snapshotBtn = document.getElementById("open-snapshot");
    if (snapshotBtn) {
        snapshotBtn.addEventListener("click", () => {
            if (!STEPS_STATE.lastOutputs) {
                applyConfiguration(false);
            }
            if (STEPS_STATE.lastOutputs) {
                const { config, endorseObj, econ } = STEPS_STATE.lastOutputs;
                openSnapshotModal(config, endorseObj, econ);
                showToast("Scenario summary opened. Use it for quick briefing text.");
            }
        });
    }

    const saveBtn = document.getElementById("save-scenario");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            if (!STEPS_STATE.lastOutputs) {
                applyConfiguration(false);
            }
            if (STEPS_STATE.lastOutputs) {
                const { config, endorseObj, econ } = STEPS_STATE.lastOutputs;
                addScenarioToTable(config, endorseObj, econ);
                showToast("Scenario saved to the comparison table.");
            }
        });
    }

    // Modal close buttons
    const modal = document.getElementById("results-modal");
    const closeModal = document.getElementById("close-modal");
    if (closeModal && modal) {
        closeModal.addEventListener("click", () => modal.classList.add("hidden"));
    }
    if (modal) {
        modal.addEventListener("click", e => {
            if (e.target === modal) modal.classList.add("hidden");
        });
    }

    // Tour modal
    const tourModal = document.getElementById("tour-modal");
    const tourClose = document.getElementById("tour-close");
    const tourStart = document.getElementById("tour-start");
    if (tourClose) {
        tourClose.addEventListener("click", closeTourAndMarkSeen);
    }
    if (tourStart) {
        tourStart.addEventListener("click", closeTourAndMarkSeen);
    }
    if (tourModal) {
        tourModal.addEventListener("click", e => {
            if (e.target === tourModal) closeTourAndMarkSeen();
        });
    }

    // Advanced settings
    writeAdvancedSettingsToForm();
    const advApply = document.getElementById("advanced-apply");
    const advReset = document.getElementById("advanced-reset");
    if (advApply) {
        advApply.addEventListener("click", () => {
            readAdvancedSettingsFromForm();
            applyConfiguration(true);
        });
    }
    if (advReset) {
        advReset.addEventListener("click", () => {
            STEPS_STATE.advanced = {
                horizonYears: 5,
                inrPerUsd: 83,
                gradsShare: {
                    frontline: 0.9,
                    intermediate: 0.9,
                    advanced: 0.95
                },
                outbreaksPerCohortPerYear: {
                    frontline: 0.3,
                    intermediate: 0.5,
                    advanced: 0.8
                },
                valuePerGraduate: {
                    frontline: 800000,
                    intermediate: 900000,
                    advanced: 1000000
                },
                valuePerOutbreak: {
                    frontline: 30000000,
                    intermediate: 30000000,
                    advanced: 30000000
                }
            };
            writeAdvancedSettingsToForm();
            applyConfiguration(true);
        });
    }

    // Technical appendix
    const techBtn = document.getElementById("open-technical-window");
    if (techBtn) {
        techBtn.addEventListener("click", openTechnicalAppendixWindow);
    }

    const techPreview = document.getElementById("technical-preview");
    if (techPreview) {
        techPreview.textContent = "The technical appendix covers model specification, parameter estimates, willingness to pay calculations, epidemiological multipliers and worked examples. Open it in a separate window for detailed review.";
    }

    // Exports
    const excelBtn = document.getElementById("export-excel");
    if (excelBtn) {
        excelBtn.addEventListener("click", exportScenariosToExcel);
    }
    const pdfBtn = document.getElementById("export-pdf");
    if (pdfBtn) {
        pdfBtn.addEventListener("click", exportScenariosToPdf);
    }

    // Initial computation and tour
    applyConfiguration(false);
    showTourIfFirstTime();
});
