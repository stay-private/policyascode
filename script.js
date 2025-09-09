import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { parse } from "https://cdn.jsdelivr.net/npm/partial-json@0.1/+esm";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { memoryCard, learningCard } from "./components.js";

const $ = (s, el = document) => el.querySelector(s);

const BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

// State
const state = {
  memIndex: 0,
  memories: [], // { id, type, title, body, priority, rationale, sources: [{quote, file}] }
  learnings: [], // { file, memories: [...] } or { edits: [...] }
};

// Global memory lookup for efficient access by ID
let memoryLookup = {};

// Update memoryLookup when state.memories changes. Retain all memories for merge/delete reference.
function updateMemoryLookup() {
  state.memories.forEach((memory) => (memoryLookup[memory.id] = memory));
}

// Fetch configuration
const { schemas } = await fetch("./config.json").then((r) => r.json());

// Save state to localStorage
function saveState() {
  try {
    localStorage.setItem("memlearn", JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save state to localStorage:", e);
    bootstrapAlert({ title: "Could not save state", body: e, color: "warning" });
  }
}

// Load state from localStorage
function loadState() {
  try {
    const saved = localStorage.getItem("memlearn");
    if (saved) {
      const parsedState = JSON.parse(saved);
      Object.assign(state, parsedState);
      updateMemoryLookup();
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
  state.memIndex = 0;
  state.memories = [];
  state.learnings = [];
  memoryLookup = {};
  localStorage.removeItem("memlearn");
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
      instructions: $("#memlearn-extraction").value,
      input: [{ role: "user", content: [content] }],
      text: { format: { type: "json_schema", strict: true, name: "memories", schema: schemas.memories } },
      stream: true,
    };

    let memories;
    for await (const { content } of streamOpenAI(body)) {
      memories = parse(content)?.memories ?? [];
      memories.forEach((memory, i) => {
        memory.id = `mem-${state.memIndex + i}`;
        for (const source of memory.sources ?? []) source.file = file.name;
      });
      redraw({ memories, file: file.name });
    }
    state.memories.push(...memories);
    updateMemoryLookup(); // Update the global lookup
    state.learnings.push({ file: file.name, memories });
    state.memIndex += memories.length;
    saveState(); // Persist state changes
  }
});

buttonClick($("#btn-consolidate"), consolidate);

async function consolidate() {
  const body = {
    model: $("#model").value,
    instructions: $("#memlearn-consolidation").value,
    input: [{ role: "user", content: JSON.stringify(state.memories) }],
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

    // Remove memories that are being deleted or merged
    state.memories = state.memories.filter((memory) => !deletes.has(memory.id));

    // Add new merged memories
    edits.forEach((edit) => {
      if (edit.edit === "merge") {
        // Concatenate sources from all memories being merged
        const mergedSources = [];
        edit.ids.forEach((id) => {
          if (memoryLookup[id] && memoryLookup[id].sources) mergedSources.push(...memoryLookup[id].sources);
        });

        const newMemory = {
          id: `mem-${state.memIndex++}`,
          type: edit.type,
          title: edit.title,
          body: edit.body,
          priority: edit.priority,
          rationale: edit.rationale,
          sources: mergedSources,
        };
        state.memories.push(newMemory);
      }
    });

    updateMemoryLookup();
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

function redraw({ memories, edits, file }) {
  const mem = [...state.memories, ...(memories || [])].reverse();
  render(mem.map(memoryCard), $("#memory-list"));
  $("#memory-count").textContent = mem.length;

  const learnings = [...state.learnings];
  if (file) learnings.push({ file, memories });
  if (edits) learnings.push({ edits });
  render(
    learnings.reverse().map((l) => learningCard(l, memoryLookup)),
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

// Clear memories button
$("#clear-storage-btn").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all memories? This action cannot be undone.")) {
    clearState();
  }
});

// Persist inputs
saveform("#memlearn-settings", { exclude: '[type="file"]' });

// Load saved state on initialization
loadState();
