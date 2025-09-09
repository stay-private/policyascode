import { html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import hljs from "https://cdn.jsdelivr.net/npm/highlight.js@11/+esm";

export function memoryCard(m) {
  const isCode = m.type === "code";
  const opts = { language: "javascript" };
  const bodyHtml = isCode
    ? html`<pre class="hljs"><code class="language-javascript">${hljs.highlight(m.body || "", opts).value}</code></pre>`
    : html`<div class="text-body">${m.body}</div>`;

  return html`
    <details class="mb-3 card">
      <summary class="card-header d-flex justify-content-between align-items-start">
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

export function learningCard(l, memoryLookup) {
  return l.file ? learningFileCard(l) : learningEditCard(l, memoryLookup);
}

function learningFileCard(l) {
  const accordionId = `accordion-${l.file.replace(/[^a-zA-Z0-9]/g, "-")}`;

  return html`
    <details class="mb-3 card">
      <summary class="card-header d-flex justify-content-between align-items-start">
        <strong>${l.file}</strong>
        <span class="badge text-bg-info ms-auto">${l.memories?.length || 0}</span>
      </summary>
      <div class="card-body">
        <div class="accordion" id="${accordionId}">
          ${(l.memories || []).map((memory, index) => {
            const collapseId = `${accordionId}-collapse-${index}`;
            const headingId = `${accordionId}-heading-${index}`;

            return html`
              <div class="accordion-item">
                <h2 class="accordion-header" id="${headingId}">
                  <button
                    class="accordion-button collapsed"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#${collapseId}"
                    aria-expanded="false"
                    aria-controls="${collapseId}"
                  >
                    <strong>${memory.title}</strong>
                  </button>
                </h2>
                <div
                  id="${collapseId}"
                  class="accordion-collapse collapse"
                  aria-labelledby="${headingId}"
                  data-bs-parent="#${accordionId}"
                >
                  <div class="accordion-body">
                    <div class="mb-2">
                      <strong>Rule:</strong>
                      <div class="mt-1">${memory.body}</div>
                    </div>
                    <div class="mb-2">
                      <strong>Priority:</strong>
                      <span class="badge priority-${memory.priority} text-uppercase">${memory.priority}</span>
                    </div>
                    <div class="mb-0">
                      <strong>Rationale:</strong>
                      <div class="mt-1">${memory.rationale || "No rationale provided"}</div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    </details>
  `;
}

function learningEditCard(l, memoryLookup) {
  const accordionId = `accordion-edits-${Date.now()}`;

  return html`
    <details class="mb-3 card">
      <summary class="card-header d-flex justify-content-between align-items-start">
        <strong>Consolidate Edits</strong>
        <span class="badge text-bg-warning ms-auto">${l.edits?.length || 0}</span>
      </summary>
      <div class="card-body">
        <div class="accordion" id="${accordionId}">
          ${(l.edits || []).map((edit, index) => {
            const collapseId = `${accordionId}-collapse-${index}`;
            const headingId = `${accordionId}-heading-${index}`;

            return html`
              <div class="accordion-item">
                <h2 class="accordion-header" id="${headingId}">
                  <button
                    class="accordion-button collapsed edit-${edit.edit}"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#${collapseId}"
                    aria-expanded="false"
                    aria-controls="${collapseId}"
                  >
                    ${(edit.edit ?? "").toUpperCase()} ${edit.ids?.length ?? 0} items
                  </button>
                </h2>
                <div
                  id="${collapseId}"
                  class="accordion-collapse collapse"
                  aria-labelledby="${headingId}"
                  data-bs-parent="#${accordionId}"
                >
                  <div class="accordion-body">
                    <ol>
                      ${(edit.ids ?? []).map((id) =>
                        memoryLookup[id] ? html`<li>${memoryLookup[id].title}</li>` : html`<li>Unknown (${id})</li>`,
                      )}
                    </ol>
                    <div class="mb-2">${edit.reason}</div>
                    ${edit.edit === "merge"
                      ? html`
                          <hr />
                          <div class="mb-2">
                            <strong>New Rule:</strong>
                            <div class="mt-1">${edit.body}</div>
                          </div>
                          <div class="mb-2">
                            <strong>Priority:</strong>
                            <span class="badge priority-${edit.priority} text-uppercase">${edit.priority}</span>
                          </div>
                        `
                      : ""}
                    <div class="mb-0">
                      <strong>Rationale:</strong>
                      <div class="mt-1">${edit.rationale || "No rationale provided"}</div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    </details>
  `;
}
