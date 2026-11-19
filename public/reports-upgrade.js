/* NEXURA V2.0 — Unified Interactive Reporting
   Single Actions Menu / Search / Filters / Group / Pivot
   Charts / Saved Views / CSV / HTML / Excel / PDF Print
*/
(() => {
  "use strict";

  const app = document.getElementById("app");
  if (!app) return;

  const installed = new WeakSet();
  const STORE = "nexura_v2_unified_reports";

  const style = document.createElement("style");
  style.textContent = `
    .nx-report {
      background:#fff;
      border:1px solid #dbe3ed;
      border-radius:10px;
      padding:12px;
      margin:12px 0;
      color:#18365d;
      font:inherit;
    }
    .nx-report * { box-sizing:border-box; }
    .nx-report-toolbar,
    .nx-report-row {
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:8px;
      margin:6px 0;
    }
    .nx-report input:not([type=checkbox]),
    .nx-report select,
    .nx-report button {
      border:1px solid #cbd5e1;
      border-radius:6px;
      padding:8px;
      background:#fff;
      color:#18365d;
      font:inherit;
      max-width:240px;
    }
    .nx-report button {
      cursor:pointer;
      background:#f1f5f9;
    }
    .nx-report button:disabled {
      opacity:.45;
      cursor:not-allowed;
    }
    .nx-report-search { flex:1; min-width:180px; }
    .nx-report-menu {
      position:relative;
      display:inline-block;
    }
    .nx-report-menu > summary {
      list-style:none;
      cursor:pointer;
      background:#173b67;
      color:white;
      border-radius:6px;
      padding:9px 15px;
    }
    .nx-report-menu > summary::-webkit-details-marker {
      display:none;
    }
    .nx-report-actions {
      position:absolute;
      top:calc(100% + 5px);
      right:0;
      width:min(360px,85vw);
      max-height:70vh;
      overflow:auto;
      background:white;
      border:1px solid #cbd5e1;
      box-shadow:0 8px 24px #0002;
      border-radius:9px;
      padding:8px;
      z-index:100;
    }
    .nx-report-actions details {
      border-bottom:1px solid #e2e8f0;
      padding:7px 3px;
    }
    .nx-report-actions summary {
      cursor:pointer;
      font-weight:600;
      padding:5px;
    }
    .nx-report-actions label {
      display:flex;
      gap:6px;
      align-items:center;
      margin:5px 0;
    }
    .nx-report-filters > div {
      display:flex;
      flex-wrap:wrap;
      gap:5px;
      margin:6px 0;
    }
    .nx-report-output {
      margin:10px 0;
      overflow:auto;
      max-height:400px;
    }
    .nx-report-output table {
      border-collapse:collapse;
      width:100%;
    }
    .nx-report-output td,
    .nx-report-output th {
      border:1px solid #cbd5e1;
      padding:7px;
    }
    .nx-report-group {
      background:#eaf2fb;
      font-weight:bold;
    }
    .nx-report-highlight {
      background:#fff1bb !important;
    }
    .nx-report canvas {
      max-width:100%;
      height:auto;
    }
    .nx-report-count {
      font-size:12px;
      color:#64748b;
    }
    .nx-report-status {
      font-size:12px;
      color:#475569;
    }
  `;
  document.head.appendChild(style);

  const node = (tag, value = "") => {
    const e = document.createElement(tag);
    e.textContent = value;
    return e;
  };

  const button = (label, callback) => {
    const e = node("button", label);
    e.type = "button";
    e.addEventListener("click", callback);
    return e;
  };

  const select = values => {
    const e = node("select");
    values.forEach(([value, label]) => {
      const option = node("option", label);
      option.value = value;
      e.append(option);
    });
    return e;
  };

  const txt = cell =>
    (cell?.textContent || "").trim();

  const num = value => {
    const raw = String(value ?? "")
      .replace(/,/g, "")
      .replace(/^(Rs\.?|PKR|\$)\s*/i, "")
      .trim();

    return /^[-+]?\d+(\.\d+)?$/.test(raw)
      ? Number(raw)
      : null;
  };

  const fmt = value =>
    new Intl.NumberFormat("en-PK", {
      maximumFractionDigits:2
    }).format(value);

  const compare = (a, b) =>
    String(a).localeCompare(String(b), undefined, {
      numeric:true,
      sensitivity:"base"
    });

  const stamp = () =>
    new Intl.DateTimeFormat("en-GB", {
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    }).format(new Date()) + " | " +
    new Intl.DateTimeFormat("en-US", {
      hour:"2-digit",
      minute:"2-digit",
      hour12:true
    }).format(new Date());

  const safeName = value =>
    String(value).replace(/[^\w-]+/g, "_").slice(0, 60);

  const escape = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c]));

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || "{}");
    } catch {
      return {};
    }
  }

  function saveStore(value) {
    try {
      localStorage.setItem(STORE, JSON.stringify(value));
      return true;
    } catch {
      alert("Browser storage unavailable.");
      return false;
    }
  }

  function enhance(table) {
    if (installed.has(table)) return;
    if (!table.tHead || !table.tBodies.length) return;

    const headers = Array.from(
      table.tHead.rows[0]?.cells || []
    ).map((cell, i) => txt(cell) || `Column ${i + 1}`);

    if (!headers.length) return;

    const wrapper = table.closest(".scroll") || table;
    if (!wrapper.parentNode) return;

    installed.add(table);

    const tbody = table.tBodies[0];
    const original = Array.from(tbody.rows).filter(
      row => row.cells.length === headers.length
    );

    const report = node("section");
    report.className = "nx-report";

    const toolbar = node("div");
    toolbar.className = "nx-report-toolbar";

    const fields = headers.map((h, i) => [String(i), h]);
    const fieldOptions = [
      ["", "Select Column"],
      ...fields
    ];

    const searchField = select([
      ["all", "All Columns"],
      ...fields
    ]);

    const search = node("input");
    search.type = "search";
    search.placeholder = "Search report...";
    search.className = "nx-report-search";

    const count = node("span");
    count.className = "nx-report-count";

    const menu = node("details");
    menu.className = "nx-report-menu";
    menu.append(node("summary", "Actions ▾"));

    const actions = node("div");
    actions.className = "nx-report-actions";
    menu.append(actions);

    const section = title => {
      const d = node("details");
      d.append(node("summary", title));
      actions.append(d);
      return d;
    };

    const columns = section("Columns");
    const checks = headers.map(h => {
      const label = node("label");
      const input = node("input");
      input.type = "checkbox";
      input.checked = true;
      label.append(input, document.createTextNode(h));
      columns.append(label);
      return input;
    });

    const filtersSection = section("Search & Filters");
    const filters = node("div");
    filters.className = "nx-report-filters";
    filtersSection.append(filters);

    const filterControls = [];

    const sorting = section("Data — Sort");
    const sort1 = select([["", "No Sorting"], ...fields]);
    const direction1 = select([
      ["asc", "Ascending"],
      ["desc", "Descending"]
    ]);
    const sort2 = select([["", "No Second Sort"], ...fields]);
    const direction2 = select([
      ["asc", "Ascending"],
      ["desc", "Descending"]
    ]);
    sorting.append(sort1, direction1, sort2, direction2);

    const grouping = section("Data — Group & Aggregate");
    const groupField = select(fieldOptions);
    const aggregateField = select(fieldOptions);
    const aggregateMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"],
      ["min", "Minimum"],
      ["max", "Maximum"]
    ]);

    grouping.append(
      node("p", "Group By"),
      groupField,
      node("p", "Aggregate Column"),
      aggregateField,
      aggregateMethod
    );

    const computeSection = section("Data — Compute");
    const computeField = select(fieldOptions);
    const computeMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"],
      ["min", "Minimum"],
      ["max", "Maximum"]
    ]);
    const computeResult = node("strong");

    computeSection.append(
      computeField,
      computeMethod,
      button("Calculate", () => {
        if (computeField.value === "") return;

        const values = filtered.map(row =>
          txt(row.cells[Number(computeField.value)])
        );

        computeResult.textContent =
          `${computeMethod.value}: ${fmt(
            aggregate(values, computeMethod.value)
          )}`;
      }),
      computeResult
    );

    const formatting = section("Format — Highlight");
    const highlightField = select(fieldOptions);
    const highlightOp = select([
      ["contains", "Contains"],
      ["equals", "Equals"],
      ["gt", "Greater Than"],
      ["lt", "Less Than"]
    ]);
    const highlightValue = node("input");
    highlightValue.placeholder = "Value";

    formatting.append(
      highlightField,
      highlightOp,
      highlightValue
    );

    const pivotSection = section("Pivot Table");
    const pivotRow = select(fieldOptions);
    const pivotColumn = select(fieldOptions);
    const pivotValue = select(fieldOptions);
    const pivotMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"]
    ]);
    const pivotOutput = node("div");
    pivotOutput.className = "nx-report-output";

    pivotSection.append(
      node("p", "Rows / Columns / Values"),
      pivotRow,
      pivotColumn,
      pivotValue,
      pivotMethod,
      button("Generate Pivot", renderPivot),
      pivotOutput
    );

    const chartSection = section("Chart");
    const chartField = select(fieldOptions);
    const chartValue = select(fieldOptions);
    const chartMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"]
    ]);
    const chartType = select([
      ["bar", "Bar"],
      ["line", "Line"],
      ["pie", "Pie"]
    ]);

    const canvas = node("canvas");
    canvas.width = 700;
    canvas.height = 320;

    chartSection.append(
      chartField,
      chartValue,
      chartMethod,
      chartType,
      button("Generate Chart", renderChart),
      canvas
    );

    const savedSection = section("Save / Load Report");
    const viewName = node("input");
    viewName.placeholder = "Report Name";
    const savedList = select([["", "Saved Reports"]]);

    savedSection.append(
      viewName,
      button("Save", saveView),
      savedList,
      button("Load", loadView),
      button("Delete", deleteView)
    );

    const downloadSection = section("Download / Print");
    const paper = select([
      ["A4", "A4"],
      ["A3", "A3"],
      ["letter", "Letter"],
      ["legal", "Legal"],
      ["tabloid", "Tabloid"]
    ]);
    const orientation = select([
      ["landscape", "Landscape"],
      ["portrait", "Portrait"]
    ]);

    downloadSection.append(
      node("p", "Page Size / Orientation"),
      paper,
      orientation,
      button("CSV", () => exportFile("csv")),
      button("HTML", () => exportFile("html")),
      button("Excel", () => exportFile("xls")),
      button("PDF / Print", printReport)
    );

    const paging = node("div");
    paging.className = "nx-report-row";

    const pageSize = select([
      ["10", "10 Rows"],
      ["25", "25 Rows"],
      ["50", "50 Rows"],
      ["100", "100 Rows"],
      ["all", "All Rows"]
    ]);
    pageSize.value = "25";

    let page = 1;
    let filtered = original.slice();

    const pageLabel = node("span");
    pageLabel.className = "nx-report-count";

    const previous = button("Previous", () => {
      page--;
      apply();
    });
    const next = button("Next", () => {
      page++;
      apply();
    });

    paging.append(
      node("span", "Rows Per Page"),
      pageSize,
      previous,
      pageLabel,
      next
    );

    const status = node("div");
    status.className = "nx-report-status";

    function aggregate(values, method) {
      if (method === "count") return values.length;

      const numbers = values.map(num).filter(
        value => value !== null
      );

      if (!numbers.length) return 0;

      if (method === "sum") {
        return numbers.reduce((a, b) => a + b, 0);
      }
      if (method === "average") {
        return numbers.reduce((a, b) => a + b, 0)
          / numbers.length;
      }
      if (method === "min") return Math.min(...numbers);
      if (method === "max") return Math.max(...numbers);
      return 0;
    }

    function addFilter(saved = null) {
      const row = node("div");
      const join = select([
        ["AND", "AND"],
        ["OR", "OR"]
      ]);
      const field = select(fields);
      const op = select([
        ["contains", "Contains"],
        ["equals", "Equals"],
        ["not", "Does Not Contain"],
        ["starts", "Starts With"],
        ["empty", "Is Empty"],
        ["notempty", "Is Not Empty"],
        ["gt", "Greater Than"],
        ["lt", "Less Than"]
      ]);
      const value = node("input");
      value.placeholder = "Filter Value";

      const entry = { row, join, field, op, value };
      filterControls.push(entry);

      row.append(
        join, field, op, value,
        button("×", () => {
          row.remove();
          filterControls.splice(
            filterControls.indexOf(entry), 1
          );
          apply();
        })
      );

      filters.append(row);

      if (saved) {
        join.value = saved.join;
        field.value = saved.field;
        op.value = saved.op;
        value.value = saved.value;
      }

      [join, field, op].forEach(e =>
        e.addEventListener("change", apply)
      );
      value.addEventListener("input", apply);
      apply();
    }

    filtersSection.append(
      button("+ Add Filter", () => addFilter())
    );

    function filterMatch(row, f) {
      const text = txt(
        row.cells[Number(f.field.value)]
      ).toLowerCase();
      const value = f.value.value.trim().toLowerCase();

      switch (f.op.value) {
        case "contains": return text.includes(value);
        case "equals": return text === value;
        case "not": return !text.includes(value);
        case "starts": return text.startsWith(value);
        case "empty": return !text;
        case "notempty": return !!text;
        case "gt":
          return num(text) !== null && num(value) !== null
            ? num(text) > num(value)
            : compare(text, value) > 0;
        case "lt":
          return num(text) !== null && num(value) !== null
            ? num(text) < num(value)
            : compare(text, value) < 0;
        default: return true;
      }
    }

    function visibleIndexes() {
      const result = checks.flatMap(
        (input, i) => input.checked ? [i] : []
      );
      return result.length ? result : [0];
    }

    function apply() {
      if (!table.isConnected) return;

      const q = search.value.trim().toLowerCase();

      filtered = original.filter(row => {
        const haystack = searchField.value === "all"
          ? Array.from(row.cells).map(txt).join(" ")
          : txt(row.cells[Number(searchField.value)]);

        if (!haystack.toLowerCase().includes(q)) {
          return false;
        }

        let pass = true;

        filterControls.forEach((f, i) => {
          const matched = filterMatch(row, f);

          if (i === 0) pass = matched;
          else if (f.join.value === "OR") {
            pass = pass || matched;
          } else {
            pass = pass && matched;
          }
        });

        return pass;
      });

      filtered.sort((a, b) => {
        const compareField = (field, direction) => {
          if (field === "") return 0;

          const result = compare(
            txt(a.cells[Number(field)]),
            txt(b.cells[Number(field)])
          );
          return direction === "desc" ? -result : result;
        };

        return compareField(sort1.value, direction1.value)
          || compareField(sort2.value, direction2.value);
      });

      const size = pageSize.value === "all"
        ? Math.max(1, filtered.length)
        : Number(pageSize.value);

      const pages = Math.max(
        1, Math.ceil(filtered.length / size)
      );

      page = Math.max(1, Math.min(page, pages));

      const shown = filtered.slice(
        (page - 1) * size,
        page * size
      );

      tbody.querySelectorAll(
        '[data-nx-report-generated="1"]'
      ).forEach(row => row.remove());

      original.forEach(row => {
        row.hidden = true;
        tbody.append(row);
      });

      const indexes = visibleIndexes();

      Array.from(table.tHead.rows).forEach(row => {
        Array.from(row.cells).forEach((cell, i) => {
          cell.style.display =
            indexes.includes(i) ? "" : "none";
        });
      });

      original.forEach(row => {
        Array.from(row.cells).forEach((cell, i) => {
          cell.style.display =
            indexes.includes(i) ? "" : "none";
          cell.classList.remove("nx-report-highlight");
        });
      });

      const groups = new Map();

      shown.forEach(row => {
        const key = groupField.value === ""
          ? "__all__"
          : txt(row.cells[Number(groupField.value)]) ||
            "(Blank)";

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });

      groups.forEach((rows, key) => {
        if (groupField.value !== "") {
          addSummary(
            `${headers[Number(groupField.value)]}: ${key}`,
            indexes.length
          );
        }

        rows.forEach(row => {
          row.hidden = false;
          tbody.append(row);

          if (highlightField.value !== "") {
            const cell = row.cells[
              Number(highlightField.value)
            ];

            const f = {
              field:{ value:highlightField.value },
              op:{ value:highlightOp.value },
              value:{ value:highlightValue.value }
            };

            if (filterMatch(row, f)) {
              cell?.classList.add("nx-report-highlight");
            }
          }
        });

        if (aggregateField.value !== "") {
          const values = rows.map(row =>
            txt(row.cells[Number(aggregateField.value)])
          );

          addSummary(
            `${aggregateMethod.value}: ${fmt(
              aggregate(values, aggregateMethod.value)
            )}`,
            indexes.length
          );
        }
      });

      count.textContent =
        `${filtered.length} / ${original.length} records`;

      pageLabel.textContent = `Page ${page} of ${pages}`;
      previous.disabled = page <= 1;
      next.disabled = page >= pages;
    }

    function addSummary(value, colspan) {
      const tr = node("tr");
      tr.dataset.nxReportGenerated = "1";
      tr.className = "nx-report-group";

      const td = node("td", value);
      td.colSpan = colspan;

      tr.append(td);
      tbody.append(tr);
    }

    function data() {
      const indexes = visibleIndexes();

      return {
        headers:indexes.map(i => headers[i]),
        rows:filtered.map(row =>
          indexes.map(i => txt(row.cells[i]))
        )
      };
    }

    function htmlTable() {
      const d = data();

      return `<table><thead><tr>${
        d.headers.map(h =>
          `<th>${escape(h)}</th>`
        ).join("")
      }</tr></thead><tbody>${
        d.rows.map(row =>
          `<tr>${row.map(value =>
            `<td>${escape(value)}</td>`
          ).join("")}</tr>`
        ).join("")
      }</tbody></table>`;
    }

    function reportHtml() {
      return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>NEXURA Advanced Report</title>
<style>
body{font:12px Arial;margin:18px;color:#172a43}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #aaa;padding:6px;text-align:left}
th{background:#e9f1fb}
@page{size:${paper.value} ${orientation.value};margin:12mm}
</style>
</head>
<body>
<h2>NEXURA Version 2.0 — Advanced Report</h2>
<p>Printed On: ${escape(stamp())}</p>
<p>Matching Records: ${filtered.length}</p>
${htmlTable()}
</body>
</html>`;
    }

    function download(name, content, mime) {
      const blob = new Blob([content], { type:mime });
      const url = URL.createObjectURL(blob);
      const a = node("a");

      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function exportFile(type) {
      const d = data();

      if (type === "csv") {
        const quote = value =>
          '"' + String(value).replace(/"/g, '""') + '"';

        const content = "\ufeff" +
          [d.headers, ...d.rows]
            .map(row => row.map(quote).join(","))
            .join("\r\n");

        download(
          "nexura-report.csv",
          content,
          "text/csv;charset=utf-8"
        );
      } else if (type === "html") {
        download(
          "nexura-report.html",
          reportHtml(),
          "text/html;charset=utf-8"
        );
      } else {
        download(
          "nexura-report.xls",
          reportHtml(),
          "application/vnd.ms-excel"
        );
      }
    }

    function printReport() {
      const win = window.open("", "_blank");

      if (!win) {
        alert("Please allow pop-ups.");
        return;
      }

      win.document.open();
      win.document.write(reportHtml());
      win.document.close();

      setTimeout(() => {
        win.focus();
        win.print();
      }, 500);
    }

    function renderPivot() {
      pivotOutput.replaceChildren();

      if (pivotRow.value === "" ||
          pivotColumn.value === "") {
        pivotOutput.textContent =
          "Select Row and Column fields.";
        return;
      }

      if (pivotMethod.value !== "count" &&
          pivotValue.value === "") {
        pivotOutput.textContent =
          "Select a numeric Value field.";
        return;
      }

      const rowNames = [...new Set(filtered.map(row =>
        txt(row.cells[Number(pivotRow.value)])
      ))];

      const colNames = [...new Set(filtered.map(row =>
        txt(row.cells[Number(pivotColumn.value)])
      ))];

      if (rowNames.length * colNames.length > 1000) {
        pivotOutput.textContent =
          "Too many pivot cells. Apply filters.";
        return;
      }

      const t = node("table");
      const head = node("tr");

      head.append(node("th", "Row / Column"));
      colNames.forEach(name =>
        head.append(node("th", name || "(Blank)"))
      );
      head.append(node("th", "Total"));
      t.append(head);

      function result(rows) {
        const values = pivotMethod.value === "count"
          ? rows.map(() => 1)
          : rows.map(row =>
              txt(row.cells[Number(pivotValue.value)])
            );

        return fmt(aggregate(values, pivotMethod.value));
      }

      rowNames.forEach(name => {
        const tr = node("tr");
        tr.append(node("th", name || "(Blank)"));

        const rowData = filtered.filter(row =>
          txt(row.cells[Number(pivotRow.value)]) === name
        );

        colNames.forEach(col => {
          tr.append(node("td", result(
            rowData.filter(row =>
              txt(row.cells[Number(pivotColumn.value)]) === col
            )
          )));
        });

        tr.append(node("th", result(rowData)));
        t.append(tr);
      });

      const grand = node("tr");
      grand.append(node("th", "Grand Total"));

      colNames.forEach(col => {
        grand.append(node("th", result(
          filtered.filter(row =>
            txt(row.cells[Number(pivotColumn.value)]) === col
          )
        )));
      });

      grand.append(node("th", result(filtered)));
      t.append(grand);
      pivotOutput.append(t);
    }

    function renderChart() {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (chartField.value === "") return;
      if (chartMethod.value !== "count" &&
          chartValue.value === "") return;

      const groups = new Map();

      filtered.forEach(row => {
        const key = txt(
          row.cells[Number(chartField.value)]
        ) || "(Blank)";

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });

      const values = Array.from(groups, ([name, rows]) => ({
        name,
        value:aggregate(
          chartMethod.value === "count"
            ? rows.map(() => 1)
            : rows.map(row =>
                txt(row.cells[Number(chartValue.value)])
              ),
          chartMethod.value
        )
      })).slice(0, 12);

      if (!values.length) return;

      const colors = [
        "#2563eb", "#0d9488", "#f59e0b",
        "#8b5cf6", "#e11d48", "#0891b2"
      ];

      ctx.font = "12px Arial";

      if (chartType.value === "pie") {
        const total = values.reduce(
          (sum, item) => sum + Math.max(0, item.value),
          0
        );
        if (!total) return;

        let angle = -Math.PI / 2;

        values.forEach((item, i) => {
          const slice =
            Math.max(0, item.value) / total * Math.PI * 2;

          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.moveTo(180, 155);
          ctx.arc(180, 155, 120, angle, angle + slice);
          ctx.closePath();
          ctx.fill();

          angle += slice;

          ctx.fillRect(360, 15 + i * 22, 12, 12);
          ctx.fillStyle = "#173b67";
          ctx.fillText(
            `${item.name.slice(0, 20)}: ${fmt(item.value)}`,
            380, 26 + i * 22
          );
        });

        return;
      }

      const max = Math.max(
        1, ...values.map(item => Math.max(0, item.value))
      );

      const baseline = 270;
      const step = 620 / values.length;
      const points = [];

      values.forEach((item, i) => {
        const x = 55 + step * (i + .5);
        const y = baseline -
          Math.max(0, item.value) / max * 210;

        points.push([x, y]);

        if (chartType.value === "bar") {
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(
            x - Math.min(25, step * .3),
            y,
            Math.min(50, step * .6),
            baseline - y
          );
        }

        ctx.fillStyle = "#173b67";
        ctx.fillText(fmt(item.value), x - 10, y - 7);
        ctx.fillText(item.name.slice(0, 10), x - 20, 290);
      });

      if (chartType.value === "line") {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 3;
        ctx.beginPath();

        points.forEach(([x, y], i) => {
          if (!i) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });

        ctx.stroke();
      }
    }

    function reportKey() {
      return [
        location.pathname,
        headers.join("|")
      ].join("::");
    }

    function refreshViews() {
      savedList.replaceChildren(
        new Option("Saved Reports", "")
      );

      const saved = readStore()[reportKey()] || {};

      Object.keys(saved).sort().forEach(name =>
        savedList.append(new Option(name, name))
      );
    }

    function settings() {
      return {
        search:search.value,
        searchField:searchField.value,
        checks:checks.map(input => input.checked),
        filters:filterControls.map(f => ({
          join:f.join.value,
          field:f.field.value,
          op:f.op.value,
          value:f.value.value
        })),
        sort1:sort1.value,
        direction1:direction1.value,
        sort2:sort2.value,
        direction2:direction2.value,
        group:groupField.value,
        aggregateField:aggregateField.value,
        aggregateMethod:aggregateMethod.value,
        pageSize:pageSize.value
      };
    }

    function saveView() {
      const name = viewName.value.trim();

      if (!name || name.length > 80) {
        alert("Enter a report name (up to 80 characters).");
        return;
      }

      const store = readStore();
      const key = reportKey();

      if (!store[key]) store[key] = {};

      if (store[key][name] &&
          !confirm("Overwrite saved report?")) return;

      store[key][name] = settings();

      if (saveStore(store)) {
        refreshViews();
        savedList.value = name;
        status.textContent = "Report settings saved locally.";
      }
    }

    function loadView() {
      const name = savedList.value;
      const saved = readStore()[reportKey()]?.[name];

      if (!saved) return;

      search.value = saved.search || "";
      searchField.value = saved.searchField || "all";

      checks.forEach((input, i) => {
        input.checked = saved.checks?.[i] !== false;
      });

      filterControls.splice(0);
      filters.replaceChildren();

      (saved.filters || []).forEach(f => addFilter(f));

      sort1.value = saved.sort1 || "";
      direction1.value = saved.direction1 || "asc";
      sort2.value = saved.sort2 || "";
      direction2.value = saved.direction2 || "asc";

      groupField.value = saved.group || "";
      aggregateField.value = saved.aggregateField || "";
      aggregateMethod.value = saved.aggregateMethod || "count";
      pageSize.value = saved.pageSize || "25";

      page = 1;
      apply();

      viewName.value = name;
      status.textContent = "Saved report loaded.";
    }

    function deleteView() {
      const name = savedList.value;
      if (!name) return;

      if (!confirm(`Delete "${name}"?`)) return;

      const store = readStore();
      delete store[reportKey()]?.[name];

      if (saveStore(store)) {
        refreshViews();
        viewName.value = "";
      }
    }

    function reset() {
      search.value = "";
      searchField.value = "all";

      filterControls.splice(0);
      filters.replaceChildren();

      checks.forEach(input => input.checked = true);

      sort1.value = "";
      sort2.value = "";
      direction1.value = "asc";
      direction2.value = "asc";

      groupField.value = "";
      aggregateField.value = "";
      pageSize.value = "25";

      page = 1;
      apply();
    }

    toolbar.append(
      searchField,
      search,
      button("Go", apply),
      menu,
      button("Reset", reset),
      count
    );

    report.append(toolbar, paging, status);

    wrapper.parentNode.insertBefore(report, wrapper);

    [
      searchField,
      sort1, direction1,
      sort2, direction2,
      groupField,
      aggregateField,
      aggregateMethod,
      pageSize,
      highlightField,
      highlightOp
    ].forEach(control =>
      control.addEventListener("change", () => {
        page = 1;
        apply();
      })
    );

    checks.forEach(input =>
      input.addEventListener("change", apply)
    );

    search.addEventListener("input", () => {
      page = 1;
      apply();
    });

    highlightValue.addEventListener("input", apply);

    refreshViews();
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
})();/* NEXURA V2.0 — Unified Interactive Reporting
   Single Actions Menu / Search / Filters / Group / Pivot
   Charts / Saved Views / CSV / HTML / Excel / PDF Print
*/
(() => {
  "use strict";

  const app = document.getElementById("app");
  if (!app) return;

  const installed = new WeakSet();
  const STORE = "nexura_v2_unified_reports";

  const style = document.createElement("style");
  style.textContent = `
    .nx-report {
      background:#fff;
      border:1px solid #dbe3ed;
      border-radius:10px;
      padding:12px;
      margin:12px 0;
      color:#18365d;
      font:inherit;
    }
    .nx-report * { box-sizing:border-box; }
    .nx-report-toolbar,
    .nx-report-row {
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:8px;
      margin:6px 0;
    }
    .nx-report input:not([type=checkbox]),
    .nx-report select,
    .nx-report button {
      border:1px solid #cbd5e1;
      border-radius:6px;
      padding:8px;
      background:#fff;
      color:#18365d;
      font:inherit;
      max-width:240px;
    }
    .nx-report button {
      cursor:pointer;
      background:#f1f5f9;
    }
    .nx-report button:disabled {
      opacity:.45;
      cursor:not-allowed;
    }
    .nx-report-search { flex:1; min-width:180px; }
    .nx-report-menu {
      position:relative;
      display:inline-block;
    }
    .nx-report-menu > summary {
      list-style:none;
      cursor:pointer;
      background:#173b67;
      color:white;
      border-radius:6px;
      padding:9px 15px;
    }
    .nx-report-menu > summary::-webkit-details-marker {
      display:none;
    }
    .nx-report-actions {
      position:absolute;
      top:calc(100% + 5px);
      right:0;
      width:min(360px,85vw);
      max-height:70vh;
      overflow:auto;
      background:white;
      border:1px solid #cbd5e1;
      box-shadow:0 8px 24px #0002;
      border-radius:9px;
      padding:8px;
      z-index:100;
    }
    .nx-report-actions details {
      border-bottom:1px solid #e2e8f0;
      padding:7px 3px;
    }
    .nx-report-actions summary {
      cursor:pointer;
      font-weight:600;
      padding:5px;
    }
    .nx-report-actions label {
      display:flex;
      gap:6px;
      align-items:center;
      margin:5px 0;
    }
    .nx-report-filters > div {
      display:flex;
      flex-wrap:wrap;
      gap:5px;
      margin:6px 0;
    }
    .nx-report-output {
      margin:10px 0;
      overflow:auto;
      max-height:400px;
    }
    .nx-report-output table {
      border-collapse:collapse;
      width:100%;
    }
    .nx-report-output td,
    .nx-report-output th {
      border:1px solid #cbd5e1;
      padding:7px;
    }
    .nx-report-group {
      background:#eaf2fb;
      font-weight:bold;
    }
    .nx-report-highlight {
      background:#fff1bb !important;
    }
    .nx-report canvas {
      max-width:100%;
      height:auto;
    }
    .nx-report-count {
      font-size:12px;
      color:#64748b;
    }
    .nx-report-status {
      font-size:12px;
      color:#475569;
    }
  `;
  document.head.appendChild(style);

  const node = (tag, value = "") => {
    const e = document.createElement(tag);
    e.textContent = value;
    return e;
  };

  const button = (label, callback) => {
    const e = node("button", label);
    e.type = "button";
    e.addEventListener("click", callback);
    return e;
  };

  const select = values => {
    const e = node("select");
    values.forEach(([value, label]) => {
      const option = node("option", label);
      option.value = value;
      e.append(option);
    });
    return e;
  };

  const txt = cell =>
    (cell?.textContent || "").trim();

  const num = value => {
    const raw = String(value ?? "")
      .replace(/,/g, "")
      .replace(/^(Rs\.?|PKR|\$)\s*/i, "")
      .trim();

    return /^[-+]?\d+(\.\d+)?$/.test(raw)
      ? Number(raw)
      : null;
  };

  const fmt = value =>
    new Intl.NumberFormat("en-PK", {
      maximumFractionDigits:2
    }).format(value);

  const compare = (a, b) =>
    String(a).localeCompare(String(b), undefined, {
      numeric:true,
      sensitivity:"base"
    });

  const stamp = () =>
    new Intl.DateTimeFormat("en-GB", {
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    }).format(new Date()) + " | " +
    new Intl.DateTimeFormat("en-US", {
      hour:"2-digit",
      minute:"2-digit",
      hour12:true
    }).format(new Date());

  const safeName = value =>
    String(value).replace(/[^\w-]+/g, "_").slice(0, 60);

  const escape = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c]));

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || "{}");
    } catch {
      return {};
    }
  }

  function saveStore(value) {
    try {
      localStorage.setItem(STORE, JSON.stringify(value));
      return true;
    } catch {
      alert("Browser storage unavailable.");
      return false;
    }
  }

  function enhance(table) {
    if (installed.has(table)) return;
    if (!table.tHead || !table.tBodies.length) return;

    const headers = Array.from(
      table.tHead.rows[0]?.cells || []
    ).map((cell, i) => txt(cell) || `Column ${i + 1}`);

    if (!headers.length) return;

    const wrapper = table.closest(".scroll") || table;
    if (!wrapper.parentNode) return;

    installed.add(table);

    const tbody = table.tBodies[0];
    const original = Array.from(tbody.rows).filter(
      row => row.cells.length === headers.length
    );

    const report = node("section");
    report.className = "nx-report";

    const toolbar = node("div");
    toolbar.className = "nx-report-toolbar";

    const fields = headers.map((h, i) => [String(i), h]);
    const fieldOptions = [
      ["", "Select Column"],
      ...fields
    ];

    const searchField = select([
      ["all", "All Columns"],
      ...fields
    ]);

    const search = node("input");
    search.type = "search";
    search.placeholder = "Search report...";
    search.className = "nx-report-search";

    const count = node("span");
    count.className = "nx-report-count";

    const menu = node("details");
    menu.className = "nx-report-menu";
    menu.append(node("summary", "Actions ▾"));

    const actions = node("div");
    actions.className = "nx-report-actions";
    menu.append(actions);

    const section = title => {
      const d = node("details");
      d.append(node("summary", title));
      actions.append(d);
      return d;
    };

    const columns = section("Columns");
    const checks = headers.map(h => {
      const label = node("label");
      const input = node("input");
      input.type = "checkbox";
      input.checked = true;
      label.append(input, document.createTextNode(h));
      columns.append(label);
      return input;
    });

    const filtersSection = section("Search & Filters");
    const filters = node("div");
    filters.className = "nx-report-filters";
    filtersSection.append(filters);

    const filterControls = [];

    const sorting = section("Data — Sort");
    const sort1 = select([["", "No Sorting"], ...fields]);
    const direction1 = select([
      ["asc", "Ascending"],
      ["desc", "Descending"]
    ]);
    const sort2 = select([["", "No Second Sort"], ...fields]);
    const direction2 = select([
      ["asc", "Ascending"],
      ["desc", "Descending"]
    ]);
    sorting.append(sort1, direction1, sort2, direction2);

    const grouping = section("Data — Group & Aggregate");
    const groupField = select(fieldOptions);
    const aggregateField = select(fieldOptions);
    const aggregateMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"],
      ["min", "Minimum"],
      ["max", "Maximum"]
    ]);

    grouping.append(
      node("p", "Group By"),
      groupField,
      node("p", "Aggregate Column"),
      aggregateField,
      aggregateMethod
    );

    const computeSection = section("Data — Compute");
    const computeField = select(fieldOptions);
    const computeMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"],
      ["min", "Minimum"],
      ["max", "Maximum"]
    ]);
    const computeResult = node("strong");

    computeSection.append(
      computeField,
      computeMethod,
      button("Calculate", () => {
        if (computeField.value === "") return;

        const values = filtered.map(row =>
          txt(row.cells[Number(computeField.value)])
        );

        computeResult.textContent =
          `${computeMethod.value}: ${fmt(
            aggregate(values, computeMethod.value)
          )}`;
      }),
      computeResult
    );

    const formatting = section("Format — Highlight");
    const highlightField = select(fieldOptions);
    const highlightOp = select([
      ["contains", "Contains"],
      ["equals", "Equals"],
      ["gt", "Greater Than"],
      ["lt", "Less Than"]
    ]);
    const highlightValue = node("input");
    highlightValue.placeholder = "Value";

    formatting.append(
      highlightField,
      highlightOp,
      highlightValue
    );

    const pivotSection = section("Pivot Table");
    const pivotRow = select(fieldOptions);
    const pivotColumn = select(fieldOptions);
    const pivotValue = select(fieldOptions);
    const pivotMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"]
    ]);
    const pivotOutput = node("div");
    pivotOutput.className = "nx-report-output";

    pivotSection.append(
      node("p", "Rows / Columns / Values"),
      pivotRow,
      pivotColumn,
      pivotValue,
      pivotMethod,
      button("Generate Pivot", renderPivot),
      pivotOutput
    );

    const chartSection = section("Chart");
    const chartField = select(fieldOptions);
    const chartValue = select(fieldOptions);
    const chartMethod = select([
      ["count", "Count"],
      ["sum", "Sum"],
      ["average", "Average"]
    ]);
    const chartType = select([
      ["bar", "Bar"],
      ["line", "Line"],
      ["pie", "Pie"]
    ]);

    const canvas = node("canvas");
    canvas.width = 700;
    canvas.height = 320;

    chartSection.append(
      chartField,
      chartValue,
      chartMethod,
      chartType,
      button("Generate Chart", renderChart),
      canvas
    );

    const savedSection = section("Save / Load Report");
    const viewName = node("input");
    viewName.placeholder = "Report Name";
    const savedList = select([["", "Saved Reports"]]);

    savedSection.append(
      viewName,
      button("Save", saveView),
      savedList,
      button("Load", loadView),
      button("Delete", deleteView)
    );

    const downloadSection = section("Download / Print");
    const paper = select([
      ["A4", "A4"],
      ["A3", "A3"],
      ["letter", "Letter"],
      ["legal", "Legal"],
      ["tabloid", "Tabloid"]
    ]);
    const orientation = select([
      ["landscape", "Landscape"],
      ["portrait", "Portrait"]
    ]);

    downloadSection.append(
      node("p", "Page Size / Orientation"),
      paper,
      orientation,
      button("CSV", () => exportFile("csv")),
      button("HTML", () => exportFile("html")),
      button("Excel", () => exportFile("xls")),
      button("PDF / Print", printReport)
    );

    const paging = node("div");
    paging.className = "nx-report-row";

    const pageSize = select([
      ["10", "10 Rows"],
      ["25", "25 Rows"],
      ["50", "50 Rows"],
      ["100", "100 Rows"],
      ["all", "All Rows"]
    ]);
    pageSize.value = "25";

    let page = 1;
    let filtered = original.slice();

    const pageLabel = node("span");
    pageLabel.className = "nx-report-count";

    const previous = button("Previous", () => {
      page--;
      apply();
    });
    const next = button("Next", () => {
      page++;
      apply();
    });

    paging.append(
      node("span", "Rows Per Page"),
      pageSize,
      previous,
      pageLabel,
      next
    );

    const status = node("div");
    status.className = "nx-report-status";

    function aggregate(values, method) {
      if (method === "count") return values.length;

      const numbers = values.map(num).filter(
        value => value !== null
      );

      if (!numbers.length) return 0;

      if (method === "sum") {
        return numbers.reduce((a, b) => a + b, 0);
      }
      if (method === "average") {
        return numbers.reduce((a, b) => a + b, 0)
          / numbers.length;
      }
      if (method === "min") return Math.min(...numbers);
      if (method === "max") return Math.max(...numbers);
      return 0;
    }

    function addFilter(saved = null) {
      const row = node("div");
      const join = select([
        ["AND", "AND"],
        ["OR", "OR"]
      ]);
      const field = select(fields);
      const op = select([
        ["contains", "Contains"],
        ["equals", "Equals"],
        ["not", "Does Not Contain"],
        ["starts", "Starts With"],
        ["empty", "Is Empty"],
        ["notempty", "Is Not Empty"],
        ["gt", "Greater Than"],
        ["lt", "Less Than"]
      ]);
      const value = node("input");
      value.placeholder = "Filter Value";

      const entry = { row, join, field, op, value };
      filterControls.push(entry);

      row.append(
        join, field, op, value,
        button("×", () => {
          row.remove();
          filterControls.splice(
            filterControls.indexOf(entry), 1
          );
          apply();
        })
      );

      filters.append(row);

      if (saved) {
        join.value = saved.join;
        field.value = saved.field;
        op.value = saved.op;
        value.value = saved.value;
      }

      [join, field, op].forEach(e =>
        e.addEventListener("change", apply)
      );
      value.addEventListener("input", apply);
      apply();
    }

    filtersSection.append(
      button("+ Add Filter", () => addFilter())
    );

    function filterMatch(row, f) {
      const text = txt(
        row.cells[Number(f.field.value)]
      ).toLowerCase();
      const value = f.value.value.trim().toLowerCase();

      switch (f.op.value) {
        case "contains": return text.includes(value);
        case "equals": return text === value;
        case "not": return !text.includes(value);
        case "starts": return text.startsWith(value);
        case "empty": return !text;
        case "notempty": return !!text;
        case "gt":
          return num(text) !== null && num(value) !== null
            ? num(text) > num(value)
            : compare(text, value) > 0;
        case "lt":
          return num(text) !== null && num(value) !== null
            ? num(text) < num(value)
            : compare(text, value) < 0;
        default: return true;
      }
    }

    function visibleIndexes() {
      const result = checks.flatMap(
        (input, i) => input.checked ? [i] : []
      );
      return result.length ? result : [0];
    }

    function apply() {
      if (!table.isConnected) return;

      const q = search.value.trim().toLowerCase();

      filtered = original.filter(row => {
        const haystack = searchField.value === "all"
          ? Array.from(row.cells).map(txt).join(" ")
          : txt(row.cells[Number(searchField.value)]);

        if (!haystack.toLowerCase().includes(q)) {
          return false;
        }

        let pass = true;

        filterControls.forEach((f, i) => {
          const matched = filterMatch(row, f);

          if (i === 0) pass = matched;
          else if (f.join.value === "OR") {
            pass = pass || matched;
          } else {
            pass = pass && matched;
          }
        });

        return pass;
      });

      filtered.sort((a, b) => {
        const compareField = (field, direction) => {
          if (field === "") return 0;

          const result = compare(
            txt(a.cells[Number(field)]),
            txt(b.cells[Number(field)])
          );
          return direction === "desc" ? -result : result;
        };

        return compareField(sort1.value, direction1.value)
          || compareField(sort2.value, direction2.value);
      });

      const size = pageSize.value === "all"
        ? Math.max(1, filtered.length)
        : Number(pageSize.value);

      const pages = Math.max(
        1, Math.ceil(filtered.length / size)
      );

      page = Math.max(1, Math.min(page, pages));

      const shown = filtered.slice(
        (page - 1) * size,
        page * size
      );

      tbody.querySelectorAll(
        '[data-nx-report-generated="1"]'
      ).forEach(row => row.remove());

      original.forEach(row => {
        row.hidden = true;
        tbody.append(row);
      });

      const indexes = visibleIndexes();

      Array.from(table.tHead.rows).forEach(row => {
        Array.from(row.cells).forEach((cell, i) => {
          cell.style.display =
            indexes.includes(i) ? "" : "none";
        });
      });

      original.forEach(row => {
        Array.from(row.cells).forEach((cell, i) => {
          cell.style.display =
            indexes.includes(i) ? "" : "none";
          cell.classList.remove("nx-report-highlight");
        });
      });

      const groups = new Map();

      shown.forEach(row => {
        const key = groupField.value === ""
          ? "__all__"
          : txt(row.cells[Number(groupField.value)]) ||
            "(Blank)";

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });

      groups.forEach((rows, key) => {
        if (groupField.value !== "") {
          addSummary(
            `${headers[Number(groupField.value)]}: ${key}`,
            indexes.length
          );
        }

        rows.forEach(row => {
          row.hidden = false;
          tbody.append(row);

          if (highlightField.value !== "") {
            const cell = row.cells[
              Number(highlightField.value)
            ];

            const f = {
              field:{ value:highlightField.value },
              op:{ value:highlightOp.value },
              value:{ value:highlightValue.value }
            };

            if (filterMatch(row, f)) {
              cell?.classList.add("nx-report-highlight");
            }
          }
        });

        if (aggregateField.value !== "") {
          const values = rows.map(row =>
            txt(row.cells[Number(aggregateField.value)])
          );

          addSummary(
            `${aggregateMethod.value}: ${fmt(
              aggregate(values, aggregateMethod.value)
            )}`,
            indexes.length
          );
        }
      });

      count.textContent =
        `${filtered.length} / ${original.length} records`;

      pageLabel.textContent = `Page ${page} of ${pages}`;
      previous.disabled = page <= 1;
      next.disabled = page >= pages;
    }

    function addSummary(value, colspan) {
      const tr = node("tr");
      tr.dataset.nxReportGenerated = "1";
      tr.className = "nx-report-group";

      const td = node("td", value);
      td.colSpan = colspan;

      tr.append(td);
      tbody.append(tr);
    }

    function data() {
      const indexes = visibleIndexes();

      return {
        headers:indexes.map(i => headers[i]),
        rows:filtered.map(row =>
          indexes.map(i => txt(row.cells[i]))
        )
      };
    }

    function htmlTable() {
      const d = data();

      return `<table><thead><tr>${
        d.headers.map(h =>
          `<th>${escape(h)}</th>`
        ).join("")
      }</tr></thead><tbody>${
        d.rows.map(row =>
          `<tr>${row.map(value =>
            `<td>${escape(value)}</td>`
          ).join("")}</tr>`
        ).join("")
      }</tbody></table>`;
    }

    function reportHtml() {
      return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>NEXURA Advanced Report</title>
<style>
body{font:12px Arial;margin:18px;color:#172a43}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #aaa;padding:6px;text-align:left}
th{background:#e9f1fb}
@page{size:${paper.value} ${orientation.value};margin:12mm}
</style>
</head>
<body>
<h2>NEXURA Version 2.0 — Advanced Report</h2>
<p>Printed On: ${escape(stamp())}</p>
<p>Matching Records: ${filtered.length}</p>
${htmlTable()}
</body>
</html>`;
    }

    function download(name, content, mime) {
      const blob = new Blob([content], { type:mime });
      const url = URL.createObjectURL(blob);
      const a = node("a");

      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function exportFile(type) {
      const d = data();

      if (type === "csv") {
        const quote = value =>
          '"' + String(value).replace(/"/g, '""') + '"';

        const content = "\ufeff" +
          [d.headers, ...d.rows]
            .map(row => row.map(quote).join(","))
            .join("\r\n");

        download(
          "nexura-report.csv",
          content,
          "text/csv;charset=utf-8"
        );
      } else if (type === "html") {
        download(
          "nexura-report.html",
          reportHtml(),
          "text/html;charset=utf-8"
        );
      } else {
        download(
          "nexura-report.xls",
          reportHtml(),
          "application/vnd.ms-excel"
        );
      }
    }

    function printReport() {
      const win = window.open("", "_blank");

      if (!win) {
        alert("Please allow pop-ups.");
        return;
      }

      win.document.open();
      win.document.write(reportHtml());
      win.document.close();

      setTimeout(() => {
        win.focus();
        win.print();
      }, 500);
    }

    function renderPivot() {
      pivotOutput.replaceChildren();

      if (pivotRow.value === "" ||
          pivotColumn.value === "") {
        pivotOutput.textContent =
          "Select Row and Column fields.";
        return;
      }

      if (pivotMethod.value !== "count" &&
          pivotValue.value === "") {
        pivotOutput.textContent =
          "Select a numeric Value field.";
        return;
      }

      const rowNames = [...new Set(filtered.map(row =>
        txt(row.cells[Number(pivotRow.value)])
      ))];

      const colNames = [...new Set(filtered.map(row =>
        txt(row.cells[Number(pivotColumn.value)])
      ))];

      if (rowNames.length * colNames.length > 1000) {
        pivotOutput.textContent =
          "Too many pivot cells. Apply filters.";
        return;
      }

      const t = node("table");
      const head = node("tr");

      head.append(node("th", "Row / Column"));
      colNames.forEach(name =>
        head.append(node("th", name || "(Blank)"))
      );
      head.append(node("th", "Total"));
      t.append(head);

      function result(rows) {
        const values = pivotMethod.value === "count"
          ? rows.map(() => 1)
          : rows.map(row =>
              txt(row.cells[Number(pivotValue.value)])
            );

        return fmt(aggregate(values, pivotMethod.value));
      }

      rowNames.forEach(name => {
        const tr = node("tr");
        tr.append(node("th", name || "(Blank)"));

        const rowData = filtered.filter(row =>
          txt(row.cells[Number(pivotRow.value)]) === name
        );

        colNames.forEach(col => {
          tr.append(node("td", result(
            rowData.filter(row =>
              txt(row.cells[Number(pivotColumn.value)]) === col
            )
          )));
        });

        tr.append(node("th", result(rowData)));
        t.append(tr);
      });

      const grand = node("tr");
      grand.append(node("th", "Grand Total"));

      colNames.forEach(col => {
        grand.append(node("th", result(
          filtered.filter(row =>
            txt(row.cells[Number(pivotColumn.value)]) === col
          )
        )));
      });

      grand.append(node("th", result(filtered)));
      t.append(grand);
      pivotOutput.append(t);
    }

    function renderChart() {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (chartField.value === "") return;
      if (chartMethod.value !== "count" &&
          chartValue.value === "") return;

      const groups = new Map();

      filtered.forEach(row => {
        const key = txt(
          row.cells[Number(chartField.value)]
        ) || "(Blank)";

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });

      const values = Array.from(groups, ([name, rows]) => ({
        name,
        value:aggregate(
          chartMethod.value === "count"
            ? rows.map(() => 1)
            : rows.map(row =>
                txt(row.cells[Number(chartValue.value)])
              ),
          chartMethod.value
        )
      })).slice(0, 12);

      if (!values.length) return;

      const colors = [
        "#2563eb", "#0d9488", "#f59e0b",
        "#8b5cf6", "#e11d48", "#0891b2"
      ];

      ctx.font = "12px Arial";

      if (chartType.value === "pie") {
        const total = values.reduce(
          (sum, item) => sum + Math.max(0, item.value),
          0
        );
        if (!total) return;

        let angle = -Math.PI / 2;

        values.forEach((item, i) => {
          const slice =
            Math.max(0, item.value) / total * Math.PI * 2;

          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.moveTo(180, 155);
          ctx.arc(180, 155, 120, angle, angle + slice);
          ctx.closePath();
          ctx.fill();

          angle += slice;

          ctx.fillRect(360, 15 + i * 22, 12, 12);
          ctx.fillStyle = "#173b67";
          ctx.fillText(
            `${item.name.slice(0, 20)}: ${fmt(item.value)}`,
            380, 26 + i * 22
          );
        });

        return;
      }

      const max = Math.max(
        1, ...values.map(item => Math.max(0, item.value))
      );

      const baseline = 270;
      const step = 620 / values.length;
      const points = [];

      values.forEach((item, i) => {
        const x = 55 + step * (i + .5);
        const y = baseline -
          Math.max(0, item.value) / max * 210;

        points.push([x, y]);

        if (chartType.value === "bar") {
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(
            x - Math.min(25, step * .3),
            y,
            Math.min(50, step * .6),
            baseline - y
          );
        }

        ctx.fillStyle = "#173b67";
        ctx.fillText(fmt(item.value), x - 10, y - 7);
        ctx.fillText(item.name.slice(0, 10), x - 20, 290);
      });

      if (chartType.value === "line") {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 3;
        ctx.beginPath();

        points.forEach(([x, y], i) => {
          if (!i) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });

        ctx.stroke();
      }
    }

    function reportKey() {
      return [
        location.pathname,
        headers.join("|")
      ].join("::");
    }

    function refreshViews() {
      savedList.replaceChildren(
        new Option("Saved Reports", "")
      );

      const saved = readStore()[reportKey()] || {};

      Object.keys(saved).sort().forEach(name =>
        savedList.append(new Option(name, name))
      );
    }

    function settings() {
      return {
        search:search.value,
        searchField:searchField.value,
        checks:checks.map(input => input.checked),
        filters:filterControls.map(f => ({
          join:f.join.value,
          field:f.field.value,
          op:f.op.value,
          value:f.value.value
        })),
        sort1:sort1.value,
        direction1:direction1.value,
        sort2:sort2.value,
        direction2:direction2.value,
        group:groupField.value,
        aggregateField:aggregateField.value,
        aggregateMethod:aggregateMethod.value,
        pageSize:pageSize.value
      };
    }

    function saveView() {
      const name = viewName.value.trim();

      if (!name || name.length > 80) {
        alert("Enter a report name (up to 80 characters).");
        return;
      }

      const store = readStore();
      const key = reportKey();

      if (!store[key]) store[key] = {};

      if (store[key][name] &&
          !confirm("Overwrite saved report?")) return;

      store[key][name] = settings();

      if (saveStore(store)) {
        refreshViews();
        savedList.value = name;
        status.textContent = "Report settings saved locally.";
      }
    }

    function loadView() {
      const name = savedList.value;
      const saved = readStore()[reportKey()]?.[name];

      if (!saved) return;

      search.value = saved.search || "";
      searchField.value = saved.searchField || "all";

      checks.forEach((input, i) => {
        input.checked = saved.checks?.[i] !== false;
      });

      filterControls.splice(0);
      filters.replaceChildren();

      (saved.filters || []).forEach(f => addFilter(f));

      sort1.value = saved.sort1 || "";
      direction1.value = saved.direction1 || "asc";
      sort2.value = saved.sort2 || "";
      direction2.value = saved.direction2 || "asc";

      groupField.value = saved.group || "";
      aggregateField.value = saved.aggregateField || "";
      aggregateMethod.value = saved.aggregateMethod || "count";
      pageSize.value = saved.pageSize || "25";

      page = 1;
      apply();

      viewName.value = name;
      status.textContent = "Saved report loaded.";
    }

    function deleteView() {
      const name = savedList.value;
      if (!name) return;

      if (!confirm(`Delete "${name}"?`)) return;

      const store = readStore();
      delete store[reportKey()]?.[name];

      if (saveStore(store)) {
        refreshViews();
        viewName.value = "";
      }
    }

    function reset() {
      search.value = "";
      searchField.value = "all";

      filterControls.splice(0);
      filters.replaceChildren();

      checks.forEach(input => input.checked = true);

      sort1.value = "";
      sort2.value = "";
      direction1.value = "asc";
      direction2.value = "asc";

      groupField.value = "";
      aggregateField.value = "";
      pageSize.value = "25";

      page = 1;
      apply();
    }

    toolbar.append(
      searchField,
      search,
      button("Go", apply),
      menu,
      button("Reset", reset),
      count
    );

    report.append(toolbar, paging, status);

    wrapper.parentNode.insertBefore(report, wrapper);

    [
      searchField,
      sort1, direction1,
      sort2, direction2,
      groupField,
      aggregateField,
      aggregateMethod,
      pageSize,
      highlightField,
      highlightOp
    ].forEach(control =>
      control.addEventListener("change", () => {
        page = 1;
        apply();
      })
    );

    checks.forEach(input =>
      input.addEventListener("change", apply)
    );

    search.addEventListener("input", () => {
      page = 1;
      apply();
    });

    highlightValue.addEventListener("input", apply);

    refreshViews();
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