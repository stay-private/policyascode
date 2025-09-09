import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { parse } from "https://cdn.jsdelivr.net/npm/partial-json@0.1/+esm";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { ruleCard, learningCard, editRuleModal } from "./components.js";

const $ = (s, el = document) => el.querySelector(s);
function on(el, event, selector, handler) {
  el.addEventListener(event, (e) => {
    if (e.target.closest(selector)) handler(e);
  });
}

const BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

// State
const state = {
  ruleIndex: 0,
  rules: [], // { id, type, title, body, priority, rationale, sources: [{quote, file}] }
  learnings: [], // { file, rules: [...] } or { edits: [...] }
};

// Global rule lookup for efficient access by ID
let ruleLookup = {};

// Update ruleLookup when state.rules changes. Retain all rules for merge/delete reference.
function updateRuleLookup() {
  state.rules.forEach((rule) => (ruleLookup[rule.id] = rule));
}

// Fetch configuration
const { schemas } = await fetch("./config.json").then((r) => r.json());

// Save state to localStorage
function saveState() {
  try {
    localStorage.setItem("policyascode", JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save state to localStorage:", e);
    bootstrapAlert({ title: "Could not save state", body: e, color: "warning" });
  }
}

// Load state from localStorage (migrate from older MemLearn if present)
function loadState() {
  try {
    const saved = localStorage.getItem("policyascode");
    if (saved) {
      const parsedState = JSON.parse(saved);
      Object.assign(state, parsedState);
      updateRuleLookup();
      // Redraw with loaded state
      redraw({});
    }
  } catch (e) {
    console.warn("Failed to load state from localStorage:", e);
    bootstrapAlert({ title: "Could not load state", body: e, color: "warning" });
  }
}

// Clear state and localStorage
function clearState() {
  state.ruleIndex = 0;
  state.rules = [];
  state.learnings = [];
  ruleLookup = {};
  localStorage.removeItem("policyascode");
  redraw({});
}

buttonClick($("#btn-ingest"), async () => {
  for (let file of $("#file-input").files) {
    let content =
      file.type === "application/pdf"
        ? { type: "input_file", filename: file.name, file_data: await fileToDataURL(file) }
        : { type: "input_text", text: `# ${file.name}\n\n${await file.text()}` };
    const body = {
      model: $("#model").value,
      instructions: $("#policyascode-extraction").value,
      input: [{ role: "user", content: [content] }],
      text: { format: { type: "json_schema", strict: true, name: "rules", schema: schemas.rules } },
      stream: true,
    };

    let rules;
    for await (const { content } of streamOpenAI(body)) {
      rules = parse(content)?.rules ?? [];
      rules.forEach((rule, i) => {
        rule.id = `rule-${state.ruleIndex + i}`;
        for (const source of rule.sources ?? []) source.file = file.name;
      });
      redraw({ rules, file: file.name });
    }
    state.rules.push(...rules);
    updateRuleLookup(); // Update the global lookup
    state.learnings.push({ file: file.name, rules });
    state.ruleIndex += rules.length;
    saveState(); // Persist state changes
  }
});

buttonClick($("#btn-consolidate"), consolidate);

async function consolidate() {
  const body = {
    model: $("#model").value,
    instructions: $("#policyascode-consolidation").value,
    input: [{ role: "user", content: JSON.stringify(state.rules) }],
    text: { format: { type: "json_schema", strict: true, name: "edits", schema: schemas.edits } },
    stream: true,
  };

  let edits;
  for await (const { content } of streamOpenAI(body)) {
    edits = parse(content)?.edits ?? [];
    redraw({ edits });
  }

  // Apply the edits to the state
  if (edits && edits.length > 0) {
    // Collect all IDs to be deleted (from both delete and merge operations)
    const deletes = new Set();

    edits.forEach((edit) => {
      if (edit.edit === "delete" || edit.edit === "merge") edit.ids.forEach((id) => deletes.add(id));
    });

    // Remove rules that are being deleted or merged
    state.rules = state.rules.filter((rule) => !deletes.has(rule.id));

    // Add new merged rules
    edits.forEach((edit) => {
      if (edit.edit === "merge") {
        // Concatenate sources from all rules being merged
        const mergedSources = [];
        edit.ids.forEach((id) => {
          if (ruleLookup[id] && ruleLookup[id].sources) mergedSources.push(...ruleLookup[id].sources);
        });

        const newRule = {
          id: `rule-${state.ruleIndex++}`,
          title: edit.title,
          body: edit.body,
          priority: edit.priority,
          rationale: edit.rationale,
          sources: mergedSources,
        };
        state.rules.push(newRule);
      }
    });

    updateRuleLookup();
    redraw({ edits });
    saveState(); // Persist state changes
  }
  state.learnings.push(edits);
  saveState(); // Persist learning changes
}

async function* streamOpenAI(body) {
  const { baseUrl, apiKey } = await openaiConfig({ defaultBaseUrls: BASE_URLS });
  for await (const data of asyncLLM(`${baseUrl}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })) {
    if (data.error) {
      bootstrapAlert({ title: "LLM Error", body: data.error, color: "danger" });
      throw new Error(data.error);
    }
    yield data;
  }
}

function fileToDataURL(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function redraw({ rules, edits, file }) {
  const r = [...state.rules, ...(rules || [])].reverse();
  render(r.map(ruleCard), $("#rule-list"));
  $("#rule-count").textContent = r.length;

  const learnings = [...state.learnings];
  if (file) learnings.push({ file, rules });
  if (edits) learnings.push({ edits });
  render(
    learnings.reverse().map((l) => learningCard(l, ruleLookup)),
    $("#learning-list"),
  );
}

// When action buttons are clicked, disable, append a spinner, call handler, then re-enable and remove spinner
const loading = html`<div class="spinner-border spinner-border-sm mx-2" role="status"></div>`;
function buttonClick(btn, handler) {
  btn.addEventListener("click", async (e) => {
    btn.disabled = true;
    render(loading, btn);

    await handler(e);

    btn.disabled = false;
    render(null, btn);
  });
}

// Configure OpenAI
$("#openai-config-btn").addEventListener("click", () => openaiConfig({ defaultBaseUrls: BASE_URLS, show: true }));

// Clear rules button
$("#clear-storage-btn").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all rules? This action cannot be undone.")) {
    clearState();
  }
});

// Persist inputs
saveform("#policyascode-settings", { exclude: '[type="file"]' });

// Delete rule functionality
on(document, "click", ".delete-rule-btn", (e) => {
  const ruleId = e.target.closest(".delete-rule-btn").dataset.ruleId;
  const rule = ruleLookup[ruleId];

  if (rule && confirm(`Are you sure you want to delete the rule "${rule.title}"?`)) {
    state.rules = state.rules.filter((r) => r.id !== ruleId);
    delete ruleLookup[ruleId];
    redraw({});
    saveState();
    bootstrapAlert({ title: "Rule deleted", body: `"${rule.title}" has been removed.`, color: "success" });
  }
});

// Edit rule functionality
let currentEditingRuleId = null;

on(document, "click", ".edit-rule-btn", (e) => {
  const ruleId = e.target.closest(".edit-rule-btn").dataset.ruleId;
  const rule = ruleLookup[ruleId];

  if (rule) {
    currentEditingRuleId = ruleId;
    render(editRuleModal(rule), $("#modal-container"));
    new bootstrap.Modal($("#editRuleModal")).show();
  }
});

// Save edited rule
on(document, "click", "#saveRuleBtn", (e) => {
  const form = $("#editRuleForm");
  if (form.checkValidity() && currentEditingRuleId) {
    const rule = ruleLookup[currentEditingRuleId];

    // Update rule with form values
    rule.title = $("#editRuleTitle").value;
    rule.body = $("#editRuleBody").value;
    rule.rationale = $("#editRuleRationale").value;
    rule.priority = $("#editRulePriority").value;

    // Update the rule in state.rules
    const ruleIndex = state.rules.findIndex((r) => r.id === currentEditingRuleId);
    if (ruleIndex !== -1) state.rules[ruleIndex] = rule;

    // Close modal
    bootstrap.Modal.getInstance($("#editRuleModal")).hide();

    // Redraw and save
    redraw({});
    saveState();

    bootstrapAlert({ title: "Rule updated", body: `"${rule.title}" has been updated.`, color: "success" });
    currentEditingRuleId = null;
  } else {
    form.classList.add("was-validated");
  }
});

// Load saved state on initialization
loadState();
