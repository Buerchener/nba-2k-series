(() => {
  "use strict";
  const data = window.GameOneStats;
  const columns = [
    ["min", "分钟"], ["pts", "得分"], ["reb", "篮板"], ["ast", "助攻"],
    ["stl", "抢断"], ["blk", "盖帽"], ["to", "失误"], ["fg", "投篮"], ["three", "三分"]
  ];
  function cell(tag, value, scope) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (scope) node.scope = scope;
    return node;
  }
  function playerTable(team, title) {
    const section = document.createElement("details");
    section.open = true;
    section.className = "team-box " + team;
    const summary = document.createElement("summary");
    summary.textContent = title;
    const scroll = document.createElement("div");
    scroll.className = "scroll-box";
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", title + "球员数据，可横向滚动");
    const table = document.createElement("table");
    table.className = "box-table";
    table.createCaption().className = "sr-only";
    table.caption.textContent = title + "球员数据";
    const header = table.createTHead().insertRow();
    header.append(cell("th", "球员", "col"));
    for (const [, label] of columns) header.append(cell("th", label, "col"));
    const tbody = table.createTBody();
    for (const p of data.players[team]) {
      const row = tbody.insertRow();
      row.append(cell("th", p.name, "row"));
      for (const [key] of columns) {
        const value = p[key] ?? (key === "min" ? "未出场" : "—");
        row.append(cell("td", value));
      }
    }
    scroll.append(table);
    section.append(summary, scroll);
    return section;
  }
  document.getElementById("box-tables").append(playerTable("rockets", "火箭 · jesse"), playerTable("lakers", "湖人 · Buerchener"));
  const body = document.getElementById("team-stats");
  for (const stat of data.teamRows) {
    const row = body.insertRow();
    row.append(cell("th", stat.label, "row"), cell("td", stat.rockets), cell("td", stat.lakers));
  }
})();
