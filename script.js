import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { parse } from "https://cdn.jsdelivr.net/npm/partial-json@0.1/+esm";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import hljs from "https://cdn.jsdelivr.net/npm/highlight.js@11/+esm";

const $ = (s, el = document) => el.querySelector(s);

const BASE_URLS = [
  "https://api.openai.com/v1",
  "https://openrouter.ai/api/v1",
  "https://aipipe.org/openai/v1",
  "https://aipipe.org/openrouter/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
  "https://llmfoundry.straivedemo.com/openrouter/v1",
  "https://llmfoundry.straive.com/openrouter/v1",
];

// State
const state = {
  memIndex: 0,
  memories: [],
  learnings: [],
};

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
      redraw({ memories, edits: memories });
    }
    state.memories.push(...memories);
    state.learnings.push(...memories);
    state.memIndex += memories.length;
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

function redraw({ memories, edits }) {
  render([...state.memories, ...(memories || [])].reverse().map(memoryCard), $("#memory-list"));
  render([...state.learnings, ...(edits || [])].reverse().map(learningCard), $("#learning-list"));
}

function memoryCard(m) {
  const isCode = m.type === "code";
  const opts = { language: "javascript" };
  const bodyHtml = isCode
    ? html`<pre class="hljs"><code class="language-javascript">${hljs.highlight(m.body || "", opts).value}</code></pre>`
    : html`<div class="text-body">${m.body}</div>`;

  return html`
    <details class="mb-3 card">
      <summary class="card-header d-flex justify-content-between align-items-start" style="cursor: pointer;">
        <strong>${m.title}</strong>
        <span class="badge priority-${m.priority} me-2 text-uppercase">${m.priority}</span>
      </summary>
      <div class="card-body">
        <div class="mb-2">${bodyHtml}</div>
        <div class="mb-2"><strong>Type:</strong> ${m.type}</div>
        <div class="mb-2"><strong>Rationale:</strong> ${m.rationale || ""}</div>
        <div class="mb-2">
          <strong>Sources:</strong>
          <ul class="small m-0">
            ${(m.sources || []).map(
              (s) => html`<li>"${s.quote}" <span class="text-muted">— ${s.file || s.filename || ""}</span></li>`,
            )}
          </ul>
        </div>
      </div>
    </details>
  `;
}

function learningCard(m) {
  return m.type ? memoryCard(m) : JSON.stringify(m);
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

// Persist inputs
saveform("#memlearn-settings", { exclude: '[type="file"]' });

// Fetch configuration
const { schemas } = await fetch("./config.json").then((r) => r.json());
