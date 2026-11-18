/* NEXURA V2 — Advanced Reporting Steps 1 + 2 */
(() => {
  "use strict";

  const app = document.getElementById("app");
  if (!app) return;

  const installed = new WeakSet();

  const css = document.createElement("style");
  css.textContent = `
    .nx-ar {
      background:#f8fbff;
      border:1px solid #d9e3ef;
      border-radius:10px;
      padding:12px;
      margin:12px 0;
      color:#173b67;
    }
    .nx-ar-row {
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
      margin:8px 0;
    }
    .nx-ar input:not([type=checkbox]),
    .nx-ar select {
      padding:7px;
      border:1px solid #bdcbdc;
      border-radius:6px;
      max-width:220px;
    }
    .nx-ar button {
      padding:7px 11px;
      border:1px solid #bdcbdc;
      border-radius:6px;
      background:white;
      color:#173b67;
      cursor:pointer;
    }
    .nx-ar button:disabled {
      opacity:.45;
      cursor:not-allowed;
    }
    .nx-ar summary {
      cursor:pointer;
      font-weight:600;
      margin:10px 0;
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
    .nx-ar-group {
      background:#e9f1fb;
      font-weight:700;
    }
    .nx-ar-total {
      background:#f1f6fa;
      font-weight:700;
    }
  `;
  document.head.appendChild(css);

  const make = (tag, text = "") => {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  };

  const button = (text, callback) => {
    const node = make("button", text);
    node.type = "button";
    node.onclick = callback;
    return node;
  };

  const select = items => {
    const node = make("select");
    items.forEach(([value, label]) => {
      const option = make("option", label);
      option.value = value;
      node.appendChild(option);
    });
    return node;
  };

  const cellText = cell =>
    (cell?.textContent || "").trim();

  const compare = (a, b) =>
    String(a).localeCompare(String(b), undefined, {
      numeric:true,
      sensitivity:"base"
    });

  const escapeHtml = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[char]));

  function printedOn() {
    const date = new Date();

    return new Intl.DateTimeFormat("en-GB", {
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    }).format(date) + " | " +
    new Intl.DateTimeFormat("en-US", {
      hour:"2-digit",
      minute:"2-digit",
      hour12:true
    }).format(date);
  }

  function enhance(table) {
    if (installed.has(table)) return;
    if (!table.tHead || !table.tBodies.length) return;

    const headers = Array.from(
      table.tHead.rows[0]?.cells || []
    ).map((cell, i) =>
      cellText(cell) || `Column ${i + 1}`
    );

    if (!headers.length) return;

    const host = table.closest(".scroll") || table;
    if (!host.parentNode) return;

    installed.add(table);

    const tbody = table.tBodies[0];

    const originalRows = Array.from(tbody.rows)
      .filter(row => row.cells.length === headers.length);

    const panel = make("section");
    panel.className = "nx-ar";

    const searchRow = make("div");
    searchRow.className = "nx-ar-row";

    const searchField = select([
      ["all", "All Columns"],
      ...headers.map((h, i) => [String(i), h])
    ]);

    const search = make("input");
    search.type = "search";
    search.placeholder = "Advanced Live Search";

    const count = make("span");

    const details = make("details");
    details.appendChild(
      make("summary",
        "Actions: Filters / Columns / Sort / Group / Aggregate"
      )
    );

    const filters = make("div");

    const columns = make("div");
    columns.className = "nx-ar-columns";

    headers.forEach((h, i) => {
      const label = make("label");
      const checkbox = make("input");

      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.onchange = apply;

      label.append(
        checkbox,
        document.createTextNode(h)
      );

      columns.appendChild(label);
    });

    const sortRow = make("div");
    sortRow.className = "nx-ar-row";

    const sortField = select([
      ["none", "Original Order"],
      ...headers.map((h, i) => [String(i), h])
    ]);

    const sortDirection = select([
      ["asc", "Ascending"],
      ["desc", "Descending"]
    ]);

    const secondSort = select([
      ["none", "No Second Sort"],
      ...headers.map((h, i) => [String(i), h])
    ]);

    const secondDirection = select([
      ["asc", "Ascending"],
      ["desc", "Descending"]
    ]);

    [
      sortField,
      sortDirection,
      secondSort,
      secondDirection
    ].forEach(control => control.onchange = apply);

    sortRow.append(
      make("strong", "Sort"),
      sortField,
      sortDirection,
      secondSort,
      secondDirection
    );

    const groupRow = make("div");
    groupRow.className = "nx-ar-row";

    const groupField = select([
      ["none", "No Grouping"],
      ...headers.map((h, i) => [String(i), h])
    ]);

    const aggregateField = select([
      ["none", "No Aggregate"],
      ...headers.map((h, i) => [String(i), h])
    ]);

    const aggregateType = select([
      ["sum", "Sum"],
      ["avg", "Average"],
      ["min", "Minimum"],
      ["max", "Maximum"],
      ["count", "Count"]
    ]);

    [
      groupField,
      aggregateField,
      aggregateType
    ].forEach(control => control.onchange = apply);

    groupRow.append(
      make("strong", "Group By"),
      groupField,
      make("strong", "Aggregate"),
      aggregateField,
      aggregateType
    );

    const paging = make("div");
    paging.className = "nx-ar-row";

    const pageSize = select([
      ["10", "10 Rows"],
      ["25", "25 Rows"],
      ["50", "50 Rows"],
      ["100", "100 Rows"],
      ["all", "All Rows"]
    ]);

    pageSize.value = "25";

    let page = 1;
    let matchingRows = [];

    const pageLabel = make("span");

    const previous = button("Previous", () => {
      page = Math.max(1, page - 1);
      apply();
    });

    const next = button("Next", () => {
      page++;
      apply();
    });

    pageSize.onchange = () => {
      page = 1;
      apply();
    };

    paging.append(
      make("strong", "Rows Per Page"),
      pageSize,
      previous,
      pageLabel,
      next
    );

    function addFilter() {
      const row = make("div");
      row.className = "nx-ar-row";

      const join = select([
        ["AND", "AND"],
        ["OR", "OR"]
      ]);

      const field = select(
        headers.map((h, i) => [String(i), h])
      );

      const operator = select([
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
        page = 1;
        apply();
      });

      row.append(join, field, operator, term, remove);
      filters.appendChild(row);

      [join, field, operator].forEach(
        control => control.onchange = apply
      );

      term.oninput = apply;
      apply();
    }

    function filterMatch(tr, row) {
      const [join, field, operator, term] = row.children;

      const text = cellText(
        tr.cells[Number(field.value)]
      ).toLowerCase();

      const target = term.value.trim().toLowerCase();

      let result = false;

      switch (operator.value) {
        case "contains":
          result = text.includes(target);
          break;
        case "equals":
          result = text === target;
          break;
        case "not":
          result = !text.includes(target);
          break;
        case "starts":
          result = text.startsWith(target);
          break;
        case "empty":
          result = text === "";
          break;
        case "notempty":
          result = text !== "";
          break;
        case "gt":
          result = compare(text, target) > 0;
          break;
        case "lt":
          result = compare(text, target) < 0;
          break;
      }

      return { join:join.value, result };
    }

    function aggregate(rows) {
      if (aggregateField.value === "none") return "";

      if (aggregateType.value === "count") {
        return String(rows.length);
      }

      const index = Number(aggregateField.value);

      const numbers = rows.map(row => {
        const raw = cellText(row.cells[index])
          .replace(/,/g, "")
          .replace(/^(Rs\.?|PKR|\$)\s*/i, "");

        return /^[-+]?\d+(\.\d+)?$/.test(raw)
          ? Number(raw)
          : NaN;
      }).filter(Number.isFinite);

      if (!numbers.length) return "—";

      let result;

      switch (aggregateType.value) {
        case "sum":
          result = numbers.reduce((a, b) => a + b, 0);
          break;
        case "avg":
          result = numbers.reduce((a, b) => a + b, 0)
            / numbers.length;
          break;
        case "min":
          result = Math.min(...numbers);
          break;
        case "max":
          result = Math.max(...numbers);
          break;
      }

      return new Intl.NumberFormat("en-PK", {
        maximumFractionDigits:2
      }).format(result);
    }

    function makeGroups(rows) {
      if (groupField.value === "none") {
        return [{ name:null, rows }];
      }

      const index = Number(groupField.value);
      const groups = new Map();

      rows.forEach(row => {
        const name = cellText(row.cells[index]) || "(Blank)";

        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(row);
      });

      return Array.from(groups, ([name, rows]) => ({
        name, rows
      }));
    }

    function addSummary(text, className, visibleCount) {
      const row = make("tr");
      row.dataset.nxGenerated = "1";
      row.className = className;

      const cell = make("td", text);
      cell.colSpan = visibleCount;

      row.appendChild(cell);
      tbody.appendChild(row);
    }

    function apply() {
      if (!table.isConnected) return;

      const query = search.value.trim().toLowerCase();
      const filterRows = Array.from(filters.children);

      const visible = Array.from(
        columns.querySelectorAll("input")
      ).map(input => input.checked);

      if (!visible.some(Boolean)) {
        visible[0] = true;
        columns.querySelector("input").checked = true;
      }

      matchingRows = originalRows.filter(tr => {
        const text = searchField.value === "all"
          ? Array.from(tr.cells).map(cellText).join(" ")
          : cellText(tr.cells[Number(searchField.value)]);

        if (!text.toLowerCase().includes(query)) return false;
        if (!filterRows.length) return true;

        let result = filterMatch(tr, filterRows[0]).result;

        for (let i = 1; i < filterRows.length; i++) {
          const next = filterMatch(tr, filterRows[i]);

          result = next.join === "OR"
            ? result || next.result
            : result && next.result;
        }

        return result;
      });

      const sortCompare = (a, b, field, direction) => {
        if (field === "none") return 0;

        const result = compare(
          cellText(a.cells[Number(field)]),
          cellText(b.cells[Number(field)])
        );

        return direction === "desc" ? -result : result;
      };

      matchingRows.sort((a, b) =>
        sortCompare(a, b, sortField.value, sortDirection.value)
        ||
        sortCompare(a, b, secondSort.value, secondDirection.value)
      );

      const totalPages = pageSize.value === "all"
        ? 1
        : Math.max(
            1,
            Math.ceil(matchingRows.length / Number(pageSize.value))
          );

      page = Math.max(1, Math.min(page, totalPages));

      const start = pageSize.value === "all"
        ? 0
        : (page - 1) * Number(pageSize.value);

      const end = pageSize.value === "all"
        ? matchingRows.length
        : start + Number(pageSize.value);

      const currentPage = new Set(
        matchingRows.slice(start, end)
      );

      tbody.querySelectorAll(
        '[data-nx-generated="1"]'
      ).forEach(row => row.remove());

      originalRows.forEach(row => {
        row.hidden = true;

        Array.from(row.cells).forEach((cell, i) => {
          cell.style.display = visible[i] ? "" : "none";
        });

        tbody.appendChild(row);
      });

      Array.from(table.tHead.rows).forEach(row => {
        Array.from(row.cells).forEach((cell, i) => {
          cell.style.display = visible[i] ? "" : "none";
        });
      });

      const groups = makeGroups(matchingRows);

      groups.forEach(group => {
        const shown = group.rows.filter(
          row => currentPage.has(row)
        );

        if (!shown.length) return;

        if (group.name !== null) {
          addSummary(
            `${headers[Number(groupField.value)]}: ${group.name} (${group.rows.length} records)`,
            "nx-ar-group",
            visible.filter(Boolean).length
          );
        }

        shown.forEach(row => {
          row.hidden = false;
          tbody.appendChild(row);
        });

        if (aggregateField.value !== "none") {
          addSummary(
            `${group.name === null ? "Total" : "Group Total"} — ${aggregateType.value.toUpperCase()} ${headers[Number(aggregateField.value)]}: ${aggregate(group.rows)}`,
            "nx-ar-total",
            visible.filter(Boolean).length
          );
        }
      });

      if (!matchingRows.length) {
        addSummary(
          "No matching records",
          "nx-ar-total",
          visible.filter(Boolean).length
        );
      }

      count.textContent =
        `${matchingRows.length} / ${originalRows.length} records`;

      pageLabel.textContent = `Page ${page} of ${totalPages}`;

      previous.disabled = page <= 1;
      next.disabled = page >= totalPages;
    }

    function exportData() {
      const indexes = Array.from(
        columns.querySelectorAll("input")
      ).map((input, i) => input.checked ? i : -1)
       .filter(i => i >= 0);

      return {
        headers:indexes.map(i => headers[i]),
        rows:matchingRows.map(row =>
          indexes.map(i => cellText(row.cells[i]))
        )
      };
    }

    function exportCsv() {
      const data = exportData();

      const quote = value =>
        '"' + String(value ?? "").replace(/"/g, '""') + '"';

      const content = "\ufeff" +
        [data.headers, ...data.rows]
          .map(row => row.map(quote).join(","))
          .join("\r\n");

      const url = URL.createObjectURL(
        new Blob([content], {
          type:"text/csv;charset=utf-8"
        })
      );

      const link = make("a");
      link.href = url;
      link.download = "nexura-advanced-report.csv";

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function exportPdf() {
      const data = exportData();

      const win = window.open("", "_blank");

      if (!win) {
        alert("Please allow pop-ups for printing.");
        return;
      }

      const head = data.headers.map(
        h => `<th>${escapeHtml(h)}</th>`
      ).join("");

      const rows = data.rows.map(row =>
        `<tr>${row.map(
          cell => `<td>${escapeHtml(cell)}</td>`
        ).join("")}</tr>`
      ).join("");

      win.document.write(`
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>NEXURA Advanced Report</title>
          <style>
            body {
              font:12px Arial,sans-serif;
              color:#172a43;
              margin:20px;
            }
            table {
              width:100%;
              border-collapse:collapse;
            }
            th,td {
              border:1px solid #aaa;
              padding:6px;
              text-align:left;
              overflow-wrap:anywhere;
            }
            th { background:#e9f1fb; }
            @page {
              size:A4 landscape;
              margin:12mm;
            }
          </style>
        </head>
        <body>
          <h2>NEXURA Version 2.0 — Advanced Report</h2>
          <p><b>Printed On:</b> ${escapeHtml(printedOn())}</p>
          <p><b>Matching Records:</b> ${data.rows.length}</p>
          <table>
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>
      `);

      win.document.close();

      setTimeout(() => {
        win.focus();
        win.print();
      }, 400);
    }

    function reset() {
      search.value = "";
      searchField.value = "all";
      filters.replaceChildren();

      sortField.value = "none";
      sortDirection.value = "asc";
      secondSort.value = "none";
      secondDirection.value = "asc";

      groupField.value = "none";
      aggregateField.value = "none";
      aggregateType.value = "sum";

      pageSize.value = "25";
      page = 1;

      columns.querySelectorAll("input").forEach(
        input => input.checked = true
      );

      apply();
    }

    search.oninput = () => {
      page = 1;
      apply();
    };

    searchField.onchange = () => {
      page = 1;
      apply();
    };

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
      filters,
      filterActions,
      make("h4", "Columns"),
      columns,
      sortRow,
      groupRow
    );

    const exports = make("div");
    exports.className = "nx-ar-row";

    exports.append(
      button("Export Filtered CSV", exportCsv),
      button("PDF / Print Filtered", exportPdf)
    );

    panel.append(
      make("strong", "Advanced Reporting"),
      searchRow,
      details,
      paging,
      exports
    );

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
    childList:true,
    subtree:true
  });

  scan();
})();
/* NEXURA V2 — Advanced Reporting Step 3
   Pivot, Charts, Saved Views, Compute, Highlight
   Works alongside Steps 1 + 2.
*/
(() => {
  "use strict";

  const app = document.getElementById("app");
  if (!app) return;

  const installed = new WeakSet();
  const STORE = "nexura_v2_report_views_step3";

  const css = document.createElement("style");
  css.textContent = `
    .nx-r3 {
      margin:10px 0 18px;
      padding:12px;
      border:1px solid #cbd9e8;
      border-radius:10px;
      background:#fff;
      color:#173b67;
    }
    .nx-r3-row {
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:8px;
      margin:9px 0;
    }
    .nx-r3 input,
    .nx-r3 select,
    .nx-r3 button {
      padding:7px;
      border:1px solid #b9c9da;
      border-radius:6px;
      max-width:220px;
    }
    .nx-r3 button {
      background:#f2f6fc;
      color:#173b67;
      cursor:pointer;
    }
    .nx-r3 button:disabled {
      opacity:.5;
      cursor:not-allowed;
    }
    .nx-r3 details {
      margin-top:9px;
    }
    .nx-r3 summary {
      font-weight:650;
      cursor:pointer;
      padding:5px 0;
    }
    .nx-r3-result {
      overflow:auto;
      max-height:480px;
      margin-top:10px;
    }
    .nx-r3-result table {
      border-collapse:collapse;
      width:100%;
    }
    .nx-r3-result th,
    .nx-r3-result td {
      border:1px solid #ccd5e0;
      padding:7px;
      text-align:left;
    }
    .nx-r3-chart {
      width:100%;
      max-width:850px;
      height:330px;
      display:block;
      margin-top:12px;
    }
    .nx-r3-note {
      font-size:12px;
      color:#64748b;
    }
    .nx-r3-highlight {
      background:#fff0c2 !important;
      color:#573c00 !important;
    }
  `;
  document.head.appendChild(css);

  function el(tag, text = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  function btn(text, fn) {
    const node = el("button", text);
    node.type = "button";
    node.addEventListener("click", fn);
    return node;
  }

  function select(options) {
    const node = el("select");

    options.forEach(([value, label]) => {
      const option = el("option", label);
      option.value = value;
      node.appendChild(option);
    });

    return node;
  }

  function fieldOptions(headers, blank = "None") {
    return [
      ["", blank],
      ...headers.map((h, i) => [String(i), h])
    ];
  }

  function text(cell) {
    return (cell?.textContent || "").trim();
  }

  function numeric(value) {
    const cleaned = String(value ?? "")
      .replace(/,/g, "")
      .replace(/^(Rs\.?|PKR|\$)\s*/i, "")
      .trim();

    if (!/^[-+]?\d+(\.\d+)?$/.test(cleaned)) {
      return null;
    }

    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }

  function numberFormat(value) {
    return new Intl.NumberFormat("en-PK", {
      maximumFractionDigits:2
    }).format(value);
  }

  function safeStoreRead() {
    try {
      const result = JSON.parse(
        localStorage.getItem(STORE) || "{}"
      );
      return result && typeof result === "object"
        ? result : {};
    } catch {
      return {};
    }
  }

  function safeStoreWrite(value) {
    try {
      localStorage.setItem(STORE, JSON.stringify(value));
      return true;
    } catch {
      alert("Report settings could not be saved in this browser.");
      return false;
    }
  }

  function calculate(values, method) {
    if (method === "count") return values.length;

    const numbers = values
      .map(numeric)
      .filter(value => value !== null);

    if (!numbers.length) return 0;

    switch (method) {
      case "sum":
        return numbers.reduce((a, b) => a + b, 0);
      case "average":
        return numbers.reduce((a, b) => a + b, 0)
          / numbers.length;
      case "minimum":
        return Math.min(...numbers);
      case "maximum":
        return Math.max(...numbers);
      default:
        return numbers.length;
    }
  }

  function enhance(table) {
    if (installed.has(table)) return;
    if (!table.tHead || !table.tBodies.length) return;

    const headers = Array.from(
      table.tHead.rows[0]?.cells || []
    ).map((cell, index) =>
      text(cell) || `Column ${index + 1}`
    );

    if (!headers.length) return;

    const parent = table.closest(".scroll") || table;
    const step2 = parent.previousElementSibling;

    if (!step2 || !step2.classList.contains("nx-ar")) {
      return;
    }

    installed.add(table);

    const panel = el("section");
    panel.className = "nx-r3";

    const title = el(
      "strong",
      "Advanced Reporting — Pivot / Charts / Saved Views"
    );

    const details = el("details");
    const summary = el("summary", "Advanced Actions");
    details.appendChild(summary);

    const rows = () =>
      Array.from(table.tBodies[0].rows).filter(
        row =>
          row.dataset.nxGenerated !== "1" &&
          row.cells.length === headers.length &&
          !row.hidden
      );

    const cellValue = (row, index) =>
      text(row.cells[Number(index)]);

    const reportKey = () => {
      const tile = Array.from(
        document.querySelectorAll("#nav button")
      ).find(button => button.classList.contains("active"));

      const tab = Array.from(
        document.querySelectorAll("[data-tab]")
      ).find(button => button.classList.contains("active"));

      return [
        tile?.textContent.trim() || "NEXURA",
        tab?.textContent.trim() || "Main",
        headers.join("|")
      ].join("::");
    };

    /* PIVOT */
    const pivotDetails = el("details");
    pivotDetails.appendChild(
      el("summary", "Pivot Table")
    );

    const pivotRow = el("div");
    pivotRow.className = "nx-r3-row";

    const pivotRows = select(fieldOptions(headers, "Row Field"));
    const pivotColumns = select(fieldOptions(headers, "Column Field"));
    const pivotValues = select(fieldOptions(headers, "Value Field"));

    const pivotMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"],
      ["minimum", "Minimum"],
      ["maximum", "Maximum"]
    ]);

    const pivotOutput = el("div");
    pivotOutput.className = "nx-r3-result";

    function renderPivot() {
      pivotOutput.replaceChildren();

      if (pivotRows.value === "" ||
          pivotColumns.value === "") {
        pivotOutput.textContent =
          "Select Row Field and Column Field.";
        return;
      }

      if (pivotMethod.value !== "count" &&
          pivotValues.value === "") {
        pivotOutput.textContent =
          "Select a numeric Value Field.";
        return;
      }

      const source = rows();
      const rowNames = [...new Set(
        source.map(row => cellValue(row, pivotRows.value))
      )].sort();

      const columnNames = [...new Set(
        source.map(row => cellValue(row, pivotColumns.value))
      )].sort();

      if (rowNames.length * columnNames.length > 1500) {
        pivotOutput.textContent =
          "Too many pivot cells. Apply filters first.";
        return;
      }

      const result = el("table");
      const thead = el("thead");
      const heading = el("tr");

      heading.appendChild(el("th", headers[Number(pivotRows.value)]));

      columnNames.forEach(name =>
        heading.appendChild(el("th", name || "(Blank)"))
      );

      heading.appendChild(el("th", "Grand Total"));
      thead.appendChild(heading);
      result.appendChild(thead);

      const tbody = el("tbody");

      function summarize(group) {
        return calculate(
          pivotMethod.value === "count"
            ? group.map(() => 1)
            : group.map(row => cellValue(row, pivotValues.value)),
          pivotMethod.value
        );
      }

      rowNames.forEach(rowName => {
        const tr = el("tr");
        tr.appendChild(el("th", rowName || "(Blank)"));

        const rowGroup = source.filter(
          row => cellValue(row, pivotRows.value) === rowName
        );

        columnNames.forEach(columnName => {
          const group = rowGroup.filter(
            row => cellValue(row, pivotColumns.value) === columnName
          );

          tr.appendChild(
            el("td", numberFormat(summarize(group)))
          );
        });

        tr.appendChild(
          el("th", numberFormat(summarize(rowGroup)))
        );

        tbody.appendChild(tr);
      });

      const total = el("tr");
      total.appendChild(el("th", "Grand Total"));

      columnNames.forEach(columnName => {
        const group = source.filter(
          row => cellValue(row, pivotColumns.value) === columnName
        );

        total.appendChild(
          el("th", numberFormat(summarize(group)))
        );
      });

      total.appendChild(
        el("th", numberFormat(summarize(source)))
      );

      tbody.appendChild(total);
      result.appendChild(tbody);
      pivotOutput.appendChild(result);
    }

    pivotRow.append(
      pivotRows,
      pivotColumns,
      pivotValues,
      pivotMethod,
      btn("Generate Pivot", renderPivot)
    );

    pivotDetails.append(
      pivotRow,
      pivotOutput
    );

    /* CHARTS */
    const chartDetails = el("details");
    chartDetails.appendChild(
      el("summary", "Charts")
    );

    const chartRow = el("div");
    chartRow.className = "nx-r3-row";

    const chartCategory = select(
      fieldOptions(headers, "Category")
    );

    const chartValue = select(
      fieldOptions(headers, "Numeric Value")
    );

    const chartMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"]
    ]);

    const chartType = select([
      ["bar", "Bar Chart"],
      ["line", "Line Chart"],
      ["pie", "Pie Chart"]
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = 850;
    canvas.height = 330;
    canvas.className = "nx-r3-chart";

    const chartMessage = el("div");
    chartMessage.className = "nx-r3-note";

    function drawChart() {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      chartMessage.textContent = "";

      if (chartCategory.value === "") {
        chartMessage.textContent = "Select a Category.";
        return;
      }

      if (chartMethod.value !== "count" &&
          chartValue.value === "") {
        chartMessage.textContent =
          "Select a Numeric Value.";
        return;
      }

      const grouped = new Map();

      rows().forEach(row => {
        const category =
          cellValue(row, chartCategory.value) || "(Blank)";

        if (!grouped.has(category)) {
          grouped.set(category, []);
        }

        grouped.get(category).push(
          chartMethod.value === "count"
            ? 1
            : cellValue(row, chartValue.value)
        );
      });

      const data = Array.from(grouped, ([name, values]) => ({
        name,
        value:calculate(values, chartMethod.value)
      })).slice(0, 15);

      if (!data.length) {
        chartMessage.textContent = "No matching records.";
        return;
      }

      const colors = [
        "#2563eb", "#0d9488", "#f59e0b",
        "#8b5cf6", "#e11d48", "#0891b2",
        "#65a30d", "#ea580c"
      ];

      ctx.font = "12px Arial";
      ctx.fillStyle = "#173b67";

      if (chartType.value === "pie") {
        const total = data.reduce(
          (sum, item) => sum + Math.max(0, item.value),
          0
        );

        if (!total) {
          chartMessage.textContent =
            "Pie chart requires positive values.";
          return;
        }

        let angle = -Math.PI / 2;

        data.forEach((item, index) => {
          const slice = Math.max(0, item.value) / total
            * Math.PI * 2;

          ctx.beginPath();
          ctx.moveTo(220, 155);
          ctx.arc(220, 155, 125, angle, angle + slice);
          ctx.closePath();

          ctx.fillStyle = colors[index % colors.length];
          ctx.fill();

          angle += slice;

          ctx.fillRect(430, 20 + index * 20, 12, 12);
          ctx.fillStyle = "#173b67";
          ctx.fillText(
            `${item.name.slice(0, 24)}: ${numberFormat(item.value)}`,
            450,
            31 + index * 20
          );
        });

        return;
      }

      const max = Math.max(
        1,
        ...data.map(item => Math.max(0, item.value))
      );

      const baseline = 275;
      const plotHeight = 225;
      const left = 55;
      const width = 760;
      const step = width / data.length;

      ctx.strokeStyle = "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(left, 25);
      ctx.lineTo(left, baseline);
      ctx.lineTo(830, baseline);
      ctx.stroke();

      const points = [];

      data.forEach((item, index) => {
        const x = left + step * (index + .5);
        const y = baseline -
          Math.max(0, item.value) / max * plotHeight;

        points.push([x, y]);

        if (chartType.value === "bar") {
          ctx.fillStyle = colors[index % colors.length];
          ctx.fillRect(
            x - Math.min(step * .3, 25),
            y,
            Math.min(step * .6, 50),
            baseline - y
          );
        }

        ctx.fillStyle = "#173b67";
        ctx.fillText(
          numberFormat(item.value),
          x - 15,
          Math.max(15, y - 8)
        );

        ctx.save();
        ctx.translate(x, 290);
        ctx.rotate(-Math.PI / 5);
        ctx.fillText(item.name.slice(0, 13), 0, 0);
        ctx.restore();
      });

      if (chartType.value === "line") {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 3;
        ctx.beginPath();

        points.forEach(([x, y], index) => {
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });

        ctx.stroke();

        points.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#2563eb";
          ctx.fill();
        });
      }

      if (data.some(item => item.value < 0)) {
        chartMessage.textContent =
          "Negative values are not plotted in this chart.";
      }
    }

    chartRow.append(
      chartCategory,
      chartValue,
      chartMethod,
      chartType,
      btn("Generate Chart", drawChart)
    );

    chartDetails.append(
      chartRow,
      canvas,
      chartMessage
    );

    /* COMPUTE */
    const computeDetails = el("details");
    computeDetails.appendChild(
      el("summary", "Advanced Compute")
    );

    const computeRow = el("div");
    computeRow.className = "nx-r3-row";

    const computeField = select(
      fieldOptions(headers, "Numeric Column")
    );

    const computeOperation = select([
      ["sum", "Sum"],
      ["average", "Average"],
      ["minimum", "Minimum"],
      ["maximum", "Maximum"],
      ["count", "Count"]
    ]);

    const computeResult = el("strong");

    function compute() {
      if (computeField.value === "") {
        computeResult.textContent =
          "Select a column.";
        return;
      }

      const values = rows().map(row =>
        cellValue(row, computeField.value)
      );

      computeResult.textContent =
        `${computeOperation.selectedOptions[0].text}: ` +
        numberFormat(calculate(
          values,
          computeOperation.value
        ));
    }

    computeRow.append(
      computeField,
      computeOperation,
      btn("Calculate", compute),
      computeResult
    );

    computeDetails.appendChild(computeRow);

    /* CONDITIONAL FORMATTING */
    const formatDetails = el("details");
    formatDetails.appendChild(
      el("summary", "Conditional Formatting")
    );

    const formatRow = el("div");
    formatRow.className = "nx-r3-row";

    const formatField = select(
      fieldOptions(headers, "Select Column")
    );

    const formatOperator = select([
      ["contains", "Contains"],
      ["equals", "Equals"],
      ["gt", "Greater Than"],
      ["lt", "Less Than"]
    ]);

    const formatValue = el("input");
    formatValue.placeholder = "Value";

    function clearFormatting() {
      table.querySelectorAll(".nx-r3-highlight")
        .forEach(cell =>
          cell.classList.remove("nx-r3-highlight")
        );
    }

    function applyFormatting() {
      clearFormatting();

      if (formatField.value === "") return;

      Array.from(table.tBodies[0].rows)
        .filter(row => row.dataset.nxGenerated !== "1")
        .forEach(row => {
          const cell = row.cells[Number(formatField.value)];
          if (!cell) return;

          const value = text(cell).toLowerCase();
          const target = formatValue.value.trim().toLowerCase();

          let matched = false;

          if (formatOperator.value === "contains") {
            matched = value.includes(target);
          } else if (formatOperator.value === "equals") {
            matched = value === target;
          } else if (formatOperator.value === "gt") {
            matched = numeric(value) !== null &&
              numeric(target) !== null &&
              numeric(value) > numeric(target);
          } else if (formatOperator.value === "lt") {
            matched = numeric(value) !== null &&
              numeric(target) !== null &&
              numeric(value) < numeric(target);
          }

          if (matched) {
            cell.classList.add("nx-r3-highlight");
          }
        });
    }

    formatRow.append(
      formatField,
      formatOperator,
      formatValue,
      btn("Apply Highlight", applyFormatting),
      btn("Clear Highlight", clearFormatting)
    );

    formatDetails.appendChild(formatRow);

    /* SAVED REPORT SETTINGS */
    const saveDetails = el("details");
    saveDetails.appendChild(
      el("summary", "Saved Report Views")
    );

    const saveRow = el("div");
    saveRow.className = "nx-r3-row";

    const viewName = el("input");
    viewName.placeholder = "Report View Name";

    const savedViews = select([
      ["", "Select Saved View"]
    ]);

    function getStep2() {
      return step2;
    }

    function captureSettings() {
      const report = getStep2();

      return {
        search:report.querySelector('input[type="search"]')?.value || "",
        selects:Array.from(
          report.querySelectorAll("select")
        ).map(node => node.value),
        columns:Array.from(
          report.querySelectorAll(
            ".nx-ar-columns input[type=checkbox]"
          )
        ).map(node => node.checked),
        filters:Array.from(
          report.querySelectorAll(".nx-ar-row")
        ).filter(row =>
          row.parentElement &&
          row.parentElement.tagName === "DIV" &&
          Array.from(row.children).some(
            child => child.placeholder === "Filter value"
          )
        ).map(row => ({
          selects:Array.from(
            row.querySelectorAll("select")
          ).map(node => node.value),
          value:row.querySelector("input")?.value || ""
        })),
        pivot:[
          pivotRows.value,
          pivotColumns.value,
          pivotValues.value,
          pivotMethod.value
        ],
        chart:[
          chartCategory.value,
          chartValue.value,
          chartMethod.value,
          chartType.value
        ],
        compute:[
          computeField.value,
          computeOperation.value
        ],
        format:[
          formatField.value,
          formatOperator.value,
          formatValue.value
        ]
      };
    }

    function refreshSavedViews() {
      savedViews.replaceChildren(
        new Option("Select Saved View", "")
      );

      const store = safeStoreRead();
      const views = store[reportKey()] || {};

      Object.keys(views).sort().forEach(name => {
        savedViews.appendChild(new Option(name, name));
      });
    }

    function saveView() {
      const name = viewName.value.trim();

      if (!name) {
        alert("Enter a report view name.");
        return;
      }

      if (name.length > 80) {
        alert("Use a shorter name.");
        return;
      }

      const store = safeStoreRead();
      const key = reportKey();

      if (!store[key]) store[key] = {};

      if (store[key][name] &&
          !confirm("Overwrite this saved view?")) {
        return;
      }

      store[key][name] = captureSettings();

      if (safeStoreWrite(store)) {
        refreshSavedViews();
        savedViews.value = name;
        alert("Report view saved in this browser.");
      }
    }

    function restoreSelect(node, value) {
      if (!node) return;

      const available = Array.from(node.options)
        .some(option => option.value === value);

      if (available) node.value = value;
    }

    function loadView() {
      const name = savedViews.value;
      if (!name) return;

      const store = safeStoreRead();
      const settings = store[reportKey()]?.[name];

      if (!settings) return;

      const report = getStep2();

      const search = report.querySelector(
        'input[type="search"]'
      );

      if (search) {
        search.value = settings.search || "";
        search.dispatchEvent(
          new Event("input", { bubbles:true })
        );
      }

      const selects = Array.from(
        report.querySelectorAll("select")
      );

      (settings.selects || []).forEach((value, index) => {
        restoreSelect(selects[index], value);
        selects[index]?.dispatchEvent(
          new Event("change", { bubbles:true })
        );
      });

      const checkboxes = Array.from(
        report.querySelectorAll(
          ".nx-ar-columns input[type=checkbox]"
        )
      );

      (settings.columns || []).forEach((checked, index) => {
        if (!checkboxes[index]) return;

        checkboxes[index].checked = checked;
        checkboxes[index].dispatchEvent(
          new Event("change", { bubbles:true })
        );
      });

      [
        [settings.pivot, [
          pivotRows, pivotColumns, pivotValues, pivotMethod
        ]],
        [settings.chart, [
          chartCategory, chartValue, chartMethod, chartType
        ]],
        [settings.compute, [
          computeField, computeOperation
        ]]
      ].forEach(([values, controls]) => {
        (values || []).forEach((value, index) =>
          restoreSelect(controls[index], value)
        );
      });

      if (settings.format) {
        restoreSelect(formatField, settings.format[0]);
        restoreSelect(formatOperator, settings.format[1]);
        formatValue.value = settings.format[2] || "";
      }

      viewName.value = name;

      alert(
        "Saved view loaded. Review filters before exporting."
      );
    }

    function deleteView() {
      const name = savedViews.value;
      if (!name) return;

      if (!confirm(`Delete saved view "${name}"?`)) return;

      const store = safeStoreRead();
      const key = reportKey();

      if (store[key]) {
        delete store[key][name];
        safeStoreWrite(store);
      }

      refreshSavedViews();
      viewName.value = "";
    }

    saveRow.append(
      viewName,
      btn("Save View", saveView),
      savedViews,
      btn("Load View", loadView),
      btn("Delete View", deleteView)
    );

    saveDetails.append(
      saveRow,
      el(
        "p",
        "Saved views are stored in this browser only, not in Cloudflare D1."
      )
    );

    details.append(
      pivotDetails,
      chartDetails,
      computeDetails,
      formatDetails,
      saveDetails
    );

    panel.append(title, details);

    step2.insertAdjacentElement("afterend", panel);

    refreshSavedViews();
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
    childList:true,
    subtree:true
  });

  scan();
})();
/* NEXURA V2 — Unified Reporting Actions Menu */
(() => {
  "use strict";

  const app = document.getElementById("app");
  if (!app) return;

  const style = document.createElement("style");
  style.textContent = `
    .nx-ar, .nx-r3 {
      border-radius: 10px;
    }

    .nx-ar details details {
      margin: 6px 0;
      padding: 8px 10px;
      border: 1px solid #dce5f0;
      border-radius: 7px;
      background: #fff;
    }

    .nx-ar details details > summary {
      cursor: pointer;
      font-weight: 600;
      padding: 5px 0;
    }

    .nx-ar details details:not([open]) > :not(summary) {
      display: none;
    }

    .nx-ar .nx-r3-integrated {
      margin-top: 10px;
    }
  `;
  document.head.appendChild(style);

  const processed = new WeakSet();

  function consolidate() {
    app.querySelectorAll(".nx-r3").forEach(step3 => {
      if (processed.has(step3)) return;

      const step2 = step3.previousElementSibling;

      if (!step2 ||
          !step2.classList.contains("nx-ar")) {
        return;
      }

      const actions = step2.querySelector("details");
      const advanced = step3.querySelector("details");

      if (!actions || !advanced) return;

      processed.add(step3);

      const summary = actions.querySelector("summary");
      if (summary) {
        summary.textContent = "Actions";
      }

      const advancedSummary = advanced.querySelector("summary");
      if (advancedSummary) {
        advancedSummary.textContent =
          "Charts, Pivot, Compute & Saved Reports";
      }

      advanced.classList.add("nx-r3-integrated");

      actions.appendChild(advanced);

      step3.remove();
    });
  }

  let scheduled = false;

  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;

    queueMicrotask(() => {
      scheduled = false;
      consolidate();
    });
  });

  observer.observe(app, {
    childList: true,
    subtree: true
  });

  consolidate();
})();