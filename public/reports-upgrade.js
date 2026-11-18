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