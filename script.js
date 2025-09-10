import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { parse } from "https://cdn.jsdelivr.net/npm/partial-json@0.1/+esm";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { ruleCard, learningCard, editRuleModal, demoCards, validationTable } from "./components.js";

const $ = (s, el = document) => el.querySelector(s);
function on(el, event, selector, handler) {
  el.addEventListener(event, (e) => {
    if (e.target.closest(selector)) handler(e);
  });
}

// Error wrapping helper
function safe(title, fn) {
  return function () {
    try {
      return fn.apply(this, arguments);
    } catch (e) {
      console.error(title, e);
      bootstrapAlert({ title, body: e, color: "error" });
    }
  };
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
  validations: [], // { file, id, result, reason }
  fileOrder: [], // stable column order for validations table
};

// Global rule lookup for efficient access by ID
let ruleLookup = {};

// Global validation lookup for efficient access: rule_id -> file -> validation
let validationLookup = {};

// Track files currently being processed for validation
let processingFiles = new Set();

// Update ruleLookup when state.rules changes. Retain all rules for merge/delete reference.
function updateRuleLookup() {
  state.rules.forEach((rule) => (ruleLookup[rule.id] = rule));
}

// Update validationLookup when state.validations changes
function updateValidationLookup() {
  validationLookup = {};
  state.validations.forEach((v) => {
    if (!validationLookup[v.id]) validationLookup[v.id] = {};
    validationLookup[v.id][v.file] = v;
  });
}

// Fetch configuration
const { schemas, demos } = await fetch("./config.json").then((r) => r.json());

// Save state to localStorage
const saveState = safe("Could not save state", () => {
  localStorage.setItem("policyascode", JSON.stringify(state));
});

// Load state from localStorage (migrate from older MemLearn if present)
const loadState = safe("Could not load state", () => {
  const saved = localStorage.getItem("policyascode");
  if (saved) {
    const parsedState = JSON.parse(saved);
    Object.assign(state, parsedState);
    updateRuleLookup();
    updateValidationLookup();
    redraw({});
  }
});

// Clear state and localStorage
function clearState() {
  state.ruleIndex = 0;
  state.rules = [];
  state.learnings = [];
  state.validations = [];
  state.fileOrder = [];
  ruleLookup = {};
  validationLookup = {};
  processingFiles.clear();
  localStorage.removeItem("policyascode");
  redraw({});
  redrawValidations();
}

buttonClick($("#btn-ingest"), async () => {
  // Process files first
  for (let file of $("#file-input").files) await processSource(file, file.name);

  // Process URLs
  const urls = $("#url-input")
    .value.split("\n")
    .map((url) => url.trim())
    .filter((url) => url);
  for (let url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const contentType = response.headers.get("content-type") || "";
      const basename = url.split("/").pop() || url;

      if (contentType.startsWith("application/pdf")) {
        // Handle PDF
        const blob = await response.blob();
        await processSource(blob, basename, true);
      } else if (contentType.startsWith("text/")) {
        // Handle text
        const text = await response.text();
        const mockFile = { text: async () => text, name: basename };
        await processSource(mockFile, basename);
      } else {
        bootstrapAlert({
          title: "Unsupported file type",
          body: `${basename}: ${contentType || "Unknown MIME type"}. Only text/* and PDF files are supported.`,
          color: "warning",
        });
      }
    } catch (error) {
      bootstrapAlert({
        title: "URL fetch failed",
        body: `${url}: ${error.message}`,
        color: "danger",
      });
    }
  }
});

async function processSource(source, name, isPdfBlob = false) {
  let content;
  if (isPdfBlob || source.type === "application/pdf") {
    content = { type: "input_file", filename: name, file_data: await blobToDataURL(source) };
  } else {
    content = { type: "input_text", text: `# ${name}\n\n${await source.text()}` };
  }

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
      for (const source of rule.sources ?? []) source.file = name;
    });
    redraw({ rules, file: name });
  }
  state.rules.push(...rules);
  updateRuleLookup();
  state.learnings.push({ file: name, rules });
  state.ruleIndex += rules.length;
  saveState();
}

buttonClick($("#btn-consolidate"), consolidate);

buttonClick($("#btn-validate"), async () => {
  if (state.rules.length === 0) {
    bootstrapAlert({
      title: "No rules to validate against",
      body: "Please ingest policy documents first to extract rules before validating.",
      color: "warning",
    });
    return;
  }

  // Process validation files first
  for (let file of $("#validate-file-input").files) {
    await processValidation(file, file.name);
  }

  // Process validation URLs
  const urls = $("#validate-url-input")
    .value.split("\n")
    .map((url) => url.trim())
    .filter((url) => url);
  for (let url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const contentType = response.headers.get("content-type") || "";
      const basename = url.split("/").pop() || url;

      if (contentType.startsWith("application/pdf")) {
        const blob = await response.blob();
        await processValidation(blob, basename, true);
      } else if (contentType.startsWith("text/")) {
        const text = await response.text();
        const mockFile = { text: async () => text, name: basename };
        await processValidation(mockFile, basename);
      } else {
        bootstrapAlert({
          title: "Unsupported file type",
          body: `${basename}: ${contentType || "Unknown MIME type"}. Only text/* and PDF files are supported.`,
          color: "warning",
        });
      }
    } catch (error) {
      bootstrapAlert({
        title: "URL fetch failed",
        body: `${url}: ${error.message}`,
        color: "danger",
      });
    }
  }
});

async function processValidation(source, name, isPdfBlob = false) {
  // Add file to processing set and render immediately to show column
  processingFiles.add(name);
  redrawValidations();

  try {
    let content;
    if (isPdfBlob || source.type === "application/pdf") {
      content = { type: "input_file", filename: name, file_data: await blobToDataURL(source) };
    } else {
      content = { type: "input_text", text: `# ${name}\n\n${await source.text()}` };
    }

    const body = {
      model: $("#model").value,
      instructions:
        $("#policyascode-validation").value + "\n\nRules to validate against:\n" + JSON.stringify(state.rules),
      input: [{ role: "user", content: [content] }],
      text: { format: { type: "json_schema", strict: true, name: "validation", schema: schemas.validation } },
      stream: true,
    };

    let validations;
    for await (const { content } of streamOpenAI(body)) {
      validations = parse(content)?.validations ?? [];
      validations.forEach((validation) => (validation.file = name));

      // Update streaming validations in global lookup
      validations.forEach((v) => {
        if (!validationLookup[v.id]) validationLookup[v.id] = {};
        validationLookup[v.id][v.file] = v;
      });

      redrawValidations();
    }

    // Remove existing validations for this file and add new ones
    state.validations = state.validations.filter((v) => v.file !== name);
    state.validations.push(...validations);
    updateValidationLookup();
    saveState();
  } finally {
    // Remove from processing set when done
    processingFiles.delete(name);
    redrawValidations();
  }
}

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

function blobToDataURL(f) {
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

function redrawValidations() {
  // Get unique validation files from state and any files currently being processed
  const existingFiles = [...new Set(state.validations.map((v) => v.file))];
  const processing = Array.from(processingFiles);
  const presentSet = new Set([...existingFiles, ...processing]);

  // Maintain a stable column order across redraws
  let changed = false;
  if (state.fileOrder.length === 0 && existingFiles.length) {
    state.fileOrder = [...existingFiles];
    changed = true;
  }
  for (const f of existingFiles)
    if (!state.fileOrder.includes(f)) {
      state.fileOrder.push(f);
      changed = true;
    }
  for (const f of processing)
    if (!state.fileOrder.includes(f)) {
      state.fileOrder.push(f);
      changed = true;
    }

  // Only show files currently present (validated or in-progress), preserving first-seen order
  const files = state.fileOrder.filter((f) => presentSet.has(f));
  if (changed) saveState();

  if (state.rules.length === 0 && files.length === 0) {
    render(html``, $("#validations-table"));
    return;
  }

  render(validationTable(files, state, validationLookup), $("#validations-table"));
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
  if (confirm("Are you sure you want to clear all rules? This action cannot be undone.")) clearState();
});

// Persist inputs
saveform("#policyascode-settings", { exclude: '[type="file"], #url-input, #validate-url-input' });

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
on(document, "click", "#saveRuleBtn", () => {
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

// Render demo cards
render(demoCards(demos), $("#demo-cards"));

// Handle demo card clicks
on(document, "click", ".demo-card", (e) => {
  const demoIndex = e.target.closest(".demo-card").dataset.demoIndex;
  const demo = demos[demoIndex];

  if (demo) {
    // Update prompts
    $("#policyascode-extraction").value = demo.extractionPrompt;
    $("#policyascode-consolidation").value = demo.consolidationPrompt;
    $("#policyascode-validation").value = demo.validationPrompt || $("#policyascode-validation").value;

    // Clear file inputs and load policies into textarea
    $("#file-input").value = "";
    $("#url-input").value = (demo.policies || []).join("\n");

    // Clear validation inputs and load validate URLs if they exist
    $("#validate-file-input").value = "";
    $("#validate-url-input").value = (demo.validate || []).join("\n");

    bootstrapAlert({
      title: "Demo loaded",
      body: `${demo.title} prompts and URLs have been loaded. <strong>Click "Ingest" to proceed.</strong>`,
      color: "info",
    });
  }
});

// Load saved state on initialization
loadState();
redrawValidations();
