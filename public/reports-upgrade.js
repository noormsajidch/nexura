/* NEXURA V2 — Advanced Reporting, Step 1 */
(() => {
  "use strict";

  const app = document.getElementById("app");
  if (!app) return;

  const initialized = new WeakSet();

  const style = document.createElement("style");
  style.textContent = `
    .nx-advanced-report {
      background:#f8fbff;
      border:1px solid #d9e3ef;
      border-radius:10px;
      padding:12px;
      margin:12px 0;
    }
    .nx-ar-row {
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
      margin:8px 0;
    }
    .nx-advanced-report input,
    .nx-advanced-report select {
      padding:7px;
      border:1px solid #bdcbdc;
      border-radius:6px;
      max-width:220px;
    }
    .nx-advanced-report button {
      padding:7px 11px;
      border:1px solid #bdcbdc;
      border-radius:6px;
      background:white;
      color:#173b67;
      cursor:pointer;
    }
    .nx-ar-columns {
      display:flex;
      flex-wrap:wrap;
      gap:12px;
      margin:10px 0;
    }
    .nx-ar-columns label {
      display:flex;
      gap:5px;
      align-items:center;
    }
    .nx-advanced-report summary {
      cursor:pointer;
      font-weight:600;
      margin:10px 0;
    }
  `;
  document.head.appendChild(style);

  function make(tag, text = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  function optionSelect(items) {
    const select = make("select");
    items.forEach(([value, label]) => {
      const option = make("option", label);
      option.value = value;
      select.appendChild(option);
    });
    return select;
  }

  function button(text, action) {
    const btn = make("button", text);
    btn.type = "button";
    btn.onclick = action;
    return btn;
  }

  function cellText(cell) {
    return (cell?.textContent || "").trim();
  }

  function compare(a, b) {
    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function enhance(table) {
    if (initialized.has(table)) return;
    if (!table.tHead || !table.tBodies.length) return;

    const headers = Array.from(
      table.tHead.rows[0]?.cells || []
    ).map((cell, i) => cellText(cell) || `Column ${i + 1}`);

    if (!headers.length) return;

    const host = table.closest(".scroll") || table;
    if (!host.parentNode) return;

    initialized.add(table);

    const originalRows = Array.from(table.tBodies[0].rows);

    const panel = make("section");
    panel.className = "nx-advanced-report";

    const heading = make("strong", "Advanced Reporting");
    const searchRow = make("div");
    searchRow.className = "nx-ar-row";

    const searchField = optionSelect([
      ["all", "All Columns"],
      ...headers.map((h, i) => [String(i), h])
    ]);

    const search = make("input");
    search.type = "search";
    search.placeholder = "Advanced Live Search";

    const count = make("span", "");

    const details = make("details");
    const summary = make(
      "summary",
      "Actions: Filters / Columns / Sort"
    );
    details.appendChild(summary);

    const rules = make("div");

    const columnsTitle = make("h4", "Columns");
    const columns = make("div");
    columns.className = "nx-ar-columns";

    headers.forEach((h, i) => {
      const label = make("label");
      const checkbox = make("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.dataset.column = i;
      checkbox.onchange = apply;

      label.append(checkbox, document.createTextNode(h));
      columns.appendChild(label);
    });

    const sortRow = make("div");
    sortRow.className = "nx-ar-row";

    const sortField = optionSelect([
      ["none", "Original Order"],
      ...headers.map((h, i) => [String(i), h])
    ]);

    const direction = optionSelect([
      ["asc", "Ascending"],
      ["desc", "Descending"]
    ]);

    sortField.onchange = apply;
    direction.onchange = apply;

    sortRow.append(
      make("strong", "Sort By"),
      sortField,
      direction
    );

    function addFilter() {
      const row = make("div");
      row.className = "nx-ar-row";

      const join = optionSelect([
        ["AND", "AND"],
        ["OR", "OR"]
      ]);

      const field = optionSelect(
        headers.map((h, i) => [String(i), h])
      );

      const operator = optionSelect([
        ["contains", "Contains"],
        ["equals", "Equals"],
        ["not", "Does Not Contain"],
        ["starts", "Starts With"],
        ["empty", "Is Empty"],
        ["notempty", "Is Not Empty"],
        ["gt", "Greater Than"],
        ["lt", "Less Than"]
      ]);

      const term = make("input");
      term.placeholder = "Filter value";

      const remove = button("Remove", () => {
        row.remove();
        apply();
      });

      row.append(join, field, operator, term, remove);
      rules.appendChild(row);

      [join, field, operator].forEach(
        control => control.onchange = apply
      );
      term.oninput = apply;

      apply();
    }

    function matchesFilter(tr, row) {
      const [join, field, operator, term] = row.children;

      const text = cellText(
        tr.cells[Number(field.value)]
      ).toLowerCase();

      const value = term.value.trim().toLowerCase();

      let result = false;

      switch (operator.value) {
        case "contains":
          result = text.includes(value);
          break;
        case "equals":
          result = text === value;
          break;
        case "not":
          result = !text.includes(value);
          break;
        case "starts":
          result = text.startsWith(value);
          break;
        case "empty":
          result = text === "";
          break;
        case "notempty":
          result = text !== "";
          break;
        case "gt":
          result = compare(text, value) > 0;
          break;
        case "lt":
          result = compare(text, value) < 0;
          break;
      }

      return { join: join.value, result };
    }

    function apply() {
      if (!table.isConnected) return;

      const query = search.value.trim().toLowerCase();
      const selected = searchField.value;
      const filterRows = Array.from(rules.children);

      const visibleColumns = Array.from(
        columns.querySelectorAll("input")
      ).map(input => input.checked);

      if (!visibleColumns.some(Boolean)) {
        visibleColumns[0] = true;
        columns.querySelector("input").checked = true;
      }

      const matching = originalRows.filter(tr => {
        const text = selected === "all"
          ? Array.from(tr.cells).map(cellText).join(" ")
          : cellText(tr.cells[Number(selected)]);

        if (!text.toLowerCase().includes(query)) return false;

        if (!filterRows.length) return true;

        let result = matchesFilter(tr, filterRows[0]).result;

        for (let i = 1; i < filterRows.length; i++) {
          const next = matchesFilter(tr, filterRows[i]);

          result = next.join === "OR"
            ? result || next.result
            : result && next.result;
        }

        return result;
      });

      const matchingSet = new Set(matching);
      const sorted = originalRows.slice();

      if (sortField.value !== "none") {
        const index = Number(sortField.value);
        const factor = direction.value === "desc" ? -1 : 1;

        sorted.sort((a, b) => factor * compare(
          cellText(a.cells[index]),
          cellText(b.cells[index])
        ));
      }

      sorted.forEach(tr => {
        table.tBodies[0].appendChild(tr);
        tr.hidden = !matchingSet.has(tr);

        Array.from(tr.cells).forEach((cell, i) => {
          cell.style.display = visibleColumns[i] ? "" : "none";
        });
      });

      Array.from(table.tHead.rows).forEach(tr => {
        Array.from(tr.cells).forEach((cell, i) => {
          cell.style.display = visibleColumns[i] ? "" : "none";
        });
      });

      count.textContent =
        `${matching.length} / ${originalRows.length} records`;
    }

    function reset() {
      search.value = "";
      searchField.value = "all";
      rules.replaceChildren();
      sortField.value = "none";
      direction.value = "asc";

      columns.querySelectorAll("input").forEach(
        input => input.checked = true
      );

      apply();
    }

    search.oninput = apply;
    searchField.onchange = apply;

    searchRow.append(
      searchField,
      search,
      button("Go", apply),
      button("Reset", reset),
      count
    );

    const filterActions = make("div");
    filterActions.className = "nx-ar-row";
    filterActions.append(
      button("+ Add Filter", addFilter),
      button("Apply Filters", apply)
    );

    details.append(
      make("h4", "Advanced Filters (AND / OR)"),
      rules,
      filterActions,
      columnsTitle,
      columns,
      sortRow
    );

    panel.append(heading, searchRow, details);
    host.parentNode.insertBefore(panel, host);

    apply();
  }

  let scheduled = false;

  function scan() {
    scheduled = false;
    app.querySelectorAll("table").forEach(enhance);
  }

  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(scan);
  });

  observer.observe(app, {
    childList: true,
    subtree: true
  });

  scan();
})();