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

  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) return;
  const listen = document.getElementById("listen-commentary");
  const status = document.getElementById("commentary-audio-status");
  const passages = Array.from(document.querySelectorAll("#commentary-script p, #commentary-script h3"),
    node => node.textContent.trim());
  let speaking = null;
  function finish(message = "") {
    speaking = null;
    listen.textContent = "听解说";
    status.textContent = message;
  }
  function stop() {
    if (!speaking) return;
    finish();
    synth.cancel();
  }
  listen.hidden = false;
  listen.addEventListener("click", () => {
    if (speaking) { stop(); return; }
    const voices = synth.getVoices();
    const voice = voices.find(v => /^zh[-_]CN/i.test(v.lang)) || voices.find(v => /^zh\b/i.test(v.lang));
    listen.textContent = "停止解说";
    status.textContent = "";
    function read(index) {
      if (index === passages.length) { finish(); return; }
      const line = new SpeechSynthesisUtterance(passages[index]);
      line.lang = voice?.lang || "zh-CN";
      if (voice) line.voice = voice;
      speaking = line;
      line.onend = () => { if (speaking === line) read(index + 1); };
      line.onerror = () => {
        if (speaking === line) finish("当前设备未能播放中文语音，可直接阅读上方点评。");
      };
      synth.speak(line);
    }
    read(0);
  });
  window.addEventListener("pagehide", stop);
})();
