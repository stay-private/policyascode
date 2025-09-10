import { html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";

export function ruleCard(m) {
  return html`
    <details class="mb-3 card">
      <summary class="card-header d-flex justify-content-between align-items-start">
        <strong>${m.title}</strong>
        <div class="d-flex align-items-center gap-1">
          <span class="badge priority-${m.priority} me-2 text-uppercase">${m.priority}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary p-1 edit-rule-btn"
            data-rule-id="${m.id}"
            title="Edit rule"
            data-bs-toggle="tooltip"
          >
            <i class="bi bi-pencil-square" style="font-size: 0.75rem;"></i>
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger p-1 delete-rule-btn"
            data-rule-id="${m.id}"
            title="Delete rule"
            data-bs-toggle="tooltip"
          >
            <i class="bi bi-trash" style="font-size: 0.75rem;"></i>
          </button>
        </div>
      </summary>
      <div class="card-body">
        <div class="mb-2"><div class="text-body">${m.body}</div></div>
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

export function learningCard(l, ruleLookup) {
  return l.file ? learningFileCard(l) : learningEditCard(l, ruleLookup);
}

function learningFileCard(l) {
  const accordionId = `accordion-${l.file.replace(/[^a-zA-Z0-9]/g, "-")}`;

  return html`
    <details class="mb-3 card">
      <summary class="card-header d-flex justify-content-between align-items-start">
        <strong>${l.file}</strong>
        <span class="badge text-bg-info ms-auto">${l.rules?.length || 0}</span>
      </summary>
      <div class="card-body">
        <div class="accordion" id="${accordionId}">
          ${(l.rules || []).map((rule, index) => {
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
                    <strong>${rule.title}</strong>
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
                      <div class="mt-1">${rule.body}</div>
                    </div>
                    <div class="mb-2">
                      <strong>Priority:</strong>
                      <span class="badge priority-${rule.priority} text-uppercase">${rule.priority}</span>
                    </div>
                    <div class="mb-0">
                      <strong>Rationale:</strong>
                      <div class="mt-1">${rule.rationale || "No rationale provided"}</div>
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

function learningEditCard(l, ruleLookup) {
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
                    class="accordion-button collapsed text-uppercase edit-${edit.edit}"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#${collapseId}"
                    aria-expanded="false"
                    aria-controls="${collapseId}"
                  >
                    ${edit.edit ?? ""} ${edit.ids?.length ?? 0} items
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
                        ruleLookup[id] ? html`<li>${ruleLookup[id].title}</li>` : html`<li>Unknown (${id})</li>`,
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

export function demoCards(demos) {
  return html`
    <div class="row g-3 justify-content-center mb-4">
      ${demos.map(
        (demo, index) => html`
          <div class="col-md-4 col-lg-3">
            <div
              class="card demo-card h-100"
              data-demo-index="${index}"
              style="cursor: pointer; transition: transform 0.2s ease;"
            >
              <div class="card-body text-center d-flex flex-column">
                <div class="mb-3">
                  <i class="${demo.icon}" style="font-size: 2.5rem; color: var(--bs-primary);"></i>
                </div>
                <h6 class="card-title h5 mb-2">${demo.title}</h6>
                <p class="card-text text-muted mb-3">${demo.description}</p>
                ${(demo.policies && demo.policies.length > 0) || (demo.validate && demo.validate.length > 0)
                  ? html`
                      <div class="accordion w-100 text-start mt-auto" id="demo-acc-${index}">
                        ${demo.policies && demo.policies.length > 0
                          ? html`
                              <div class="accordion-item">
                                <h2 class="accordion-header" id="demo-acc-${index}-heading-policies">
                                  <button
                                    class="accordion-button collapsed"
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target="#demo-acc-${index}-policies"
                                    aria-expanded="false"
                                    aria-controls="demo-acc-${index}-policies"
                                    onclick="event.stopPropagation();"
                                  >
                                    Policies (source of rules)
                                  </button>
                                </h2>
                                <div
                                  id="demo-acc-${index}-policies"
                                  class="accordion-collapse collapse"
                                  aria-labelledby="demo-acc-${index}-heading-policies"
                                  data-bs-parent="#demo-acc-${index}"
                                >
                                  <div class="accordion-body p-0">
                                    <div class="list-group small">
                                      ${demo.policies.map((url) => {
                                        const filename = url.split("/").pop() || url;
                                        return html`
                                          <a
                                            href="${url}"
                                            target="_blank"
                                            class="list-group-item text-start"
                                            onclick="event.stopPropagation();"
                                            title="Open ${filename} in new tab"
                                          >
                                            <i class="bi bi-file-earmark-text me-1"></i>${filename}
                                          </a>`;
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            `
                          : ""}

                        ${demo.validate && demo.validate.length > 0
                          ? html`
                              <div class="accordion-item">
                                <h2 class="accordion-header" id="demo-acc-${index}-heading-validate">
                                  <button
                                    class="accordion-button collapsed"
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target="#demo-acc-${index}-validate"
                                    aria-expanded="false"
                                    aria-controls="demo-acc-${index}-validate"
                                    onclick="event.stopPropagation();"
                                  >
                                    Documents (to validate)
                                  </button>
                                </h2>
                                <div
                                  id="demo-acc-${index}-validate"
                                  class="accordion-collapse collapse"
                                  aria-labelledby="demo-acc-${index}-heading-validate"
                                  data-bs-parent="#demo-acc-${index}"
                                >
                                  <div class="accordion-body p-0">
                                    <div class="list-group small">
                                      ${demo.validate.map((url) => {
                                        const filename = url.split("/").pop() || url;
                                        return html`
                                          <a
                                            href="${url}"
                                            target="_blank"
                                            class="list-group-item text-start"
                                            onclick="event.stopPropagation();"
                                            title="Open ${filename} in new tab"
                                          >
                                            <i class="bi bi-file-earmark-text me-1"></i>${filename}
                                          </a>`;
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            `
                          : ""}
                      </div>
                    `
                  : ""}
              </div>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

export function editRuleModal(rule) {
  return html`
    <div class="modal fade" id="editRuleModal" tabindex="-1" aria-labelledby="editRuleModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-5" id="editRuleModalLabel">Edit Rule</h1>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="editRuleForm">
              <div class="mb-3">
                <label for="editRuleTitle" class="form-label">Title</label>
                <input type="text" class="form-control" id="editRuleTitle" value="${rule?.title || ""}" required />
              </div>
              <div class="mb-3">
                <label for="editRuleBody" class="form-label">Body</label>
                <textarea class="form-control" id="editRuleBody" rows="4" required>${rule?.body || ""}</textarea>
              </div>
              <div class="mb-3">
                <label for="editRuleRationale" class="form-label">Rationale</label>
                <textarea class="form-control" id="editRuleRationale" rows="3">${rule?.rationale || ""}</textarea>
              </div>
              <div class="mb-3">
                <label for="editRulePriority" class="form-label">Priority</label>
                <select class="form-select" id="editRulePriority" required>
                  <option value="low" ?selected=${rule?.priority === "low"}>Low</option>
                  <option value="medium" ?selected=${rule?.priority === "medium"}>Medium</option>
                  <option value="high" ?selected=${rule?.priority === "high"}>High</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="saveRuleBtn">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function validationTable(files, state, validationLookup) {
  return html`
    <div class="card">
      <div class="card-header">
        <h5 class="mb-0">Validation Results</h5>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead class="table-light">
              <tr>
                <th class="text-start" style="min-width: 200px;">Rule</th>
                ${files.map((file) => html`<th class="text-center">${file}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${state.rules.map(
                (rule) => html`
                  <tr>
                    <td class="fw-bold text-start align-top">${rule.title}</td>
                    ${files.map((file) => {
                      const validation = validationLookup[rule.id]?.[file];
                      if (!validation) return html`<td class="text-center">—</td>`;

                      const bgClass =
                        validation.result === "pass"
                          ? "table-success"
                          : validation.result === "fail"
                            ? "table-danger"
                            : validation.result === "n/a"
                              ? "table-secondary"
                              : "table-warning";

                      return html`
                        <td class="${bgClass} text-center align-top" style="max-width: 200px;">
                          <div class="fw-bold text-uppercase">${validation.result}</div>
                          <div class="small text-wrap">${validation.reason}</div>
                        </td>
                      `;
                    })}
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
