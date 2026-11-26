(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const store = window.ScoreStore;
  const engine = window.SeriesEngine;
  const icons = {
    court: '<rect x="2" y="4.5" width="20" height="15" rx="2"/><path d="M12 5v14M2 9h3v6H2m20-6h-3v6h3"/><circle cx="12" cy="12" r="3"/>',
    history: '<path d="M3 5v5h5M3.5 10a8.5 8.5 0 1 1 .5 5"/><path d="M12 7.5v5l3 2"/>',
    die: '<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="currentColor" stroke="none"><circle cx="7.5" cy="7.5" r="1.5"/><circle cx="16.5" cy="7.5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></g>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v6c0 4 16 4 16 0v-6"/>',
    sliders: '<path d="M3 7h5m5 0h8M3 17h9m5 0h4"/><circle cx="10.5" cy="7" r="2.5"/><circle cx="14.5" cy="17" r="2.5"/>',
    pen: '<path d="m4 15 11-11a2.2 2.2 0 0 1 3.2 0l1.8 1.8a2.2 2.2 0 0 1 0 3.2L9 20l-6 1zM13 6l5 5M4 15l5 5"/>',
    list: '<rect x="3" y="3.5" width="18" height="17" rx="2"/><path d="M7 8h1m3 0h6M7 12h1m3 0h6M7 16h1m3 0h6"/>',
    "plus-circle": '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v3"/>',
    drive: '<path d="M3 14.5 6 5h12l3 9.5v3.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3zM3 14h18m-5 3h1"/>',
    trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v4m-4 3h8l-1.5-3h-5z"/>'
  };
  document.querySelectorAll("[data-icon]").forEach(node => {
    node.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[node.dataset.icon] + "</svg>";
  });

  let toastTimer;
  function toast(message) {
    clearTimeout(toastTimer);
    $("#toast").textContent = message;
    toastTimer = setTimeout(() => { $("#toast").textContent = ""; }, 3600);
  }

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  const pad = number => String(number).padStart(2, "0");
  function drawLog(series, earliestFinish, ended) {
    const rows = document.createDocumentFragment();
    for (let n = 0; n < series.bestOf; n++) {
      const game = series.games[n];
      const next = !ended && n === series.games.length;
      const row = element("tr", game ? "played" : next ? "upcoming" : "future");
      const gameCell = row.insertCell();
      const scoreCell = row.insertCell();
      const resultCell = row.insertCell();
      const teams = engine.gameTeams(series, n);
      const home = game ? engine.gameHomeSide(game) : engine.homeSide(series);
      gameCell.append(element("span", "game-num", "G" + pad(n + 1)));
      if (game) {
        const away = 1 - home;
        const homeWin = game.scores[home] > game.scores[away];
        const winner = homeWin ? home : away;
        const score = element("span", "log-score");
        const winnerClass = winner === 0 ? "higher-red" : "higher-blue";
        score.append(element("span", homeWin ? winnerClass : "", game.scores[home]), element("b", "", ":"), element("span", homeWin ? "" : winnerClass, game.scores[away]));
        scoreCell.append(score, element("small", "game-home", "主场 · " + series.players[home]));
        const result = element("span", "result-name");
        result.dataset.player = winner === 0 ? "red" : "blue";
        result.append(element("i", "win-dot"), element("span", "", series.players[winner] + " 胜"));
        resultCell.append(result);
        if (engine.isPublishedOpener(series, n)) {
          const report = element("a", "game-report-link", "技术统计");
          report.href = "./reports/game-01/index.html";
          report.setAttribute("aria-label", "查看 G01 火箭对湖人的技术统计");
          gameCell.append(report);
        }
      } else {
        scoreCell.append(element("span", "empty-score", "—"));
        const label = ended ? "无需比赛" : next ? "下一场" : n < earliestFinish ? "待开赛" : "如有需要";
        resultCell.append(element("span", "game-status", label));
      }
      if (teams.some(Boolean)) {
        const matchup = element("small", "game-teams");
        [home, 1 - home].forEach((side, index) => {
          if (index) matchup.append(" / ");
          const team = element("span", "", teams[side] || series.players[side]);
          team.dataset.player = side === 0 ? "red" : "blue";
          matchup.append(team);
        });
        scoreCell.append(matchup);
      }
      rows.append(row);
    }
    $("#game-list").replaceChildren(rows);
  }

  function drawBoard(state) {
    const series = state.active;
    const { wins, target, champion } = engine.stats(series);
    const ended = champion !== null;
    const count = series.games.length;
    const teams = engine.gameTeams(series, ended ? count - 1 : count);
    const home = engine.homeSide(series);
    const dice = series.homeRoll?.dice;
    const tied = dice && dice[0] === dice[1];
    const badge = $("#series-status");
    badge.className = "status-pill " + (ended ? "finished" : count ? "playing" : "");
    badge.lastElementChild.textContent = ended ? "已完赛" : count ? "进行中" : "待开赛";
    $(".scoreboard").classList.toggle("champion", ended);
    $(".scoreboard").dataset.homePlayer = home === 0 ? "red" : "blue";
    $("#hero-bo").textContent = "BO" + series.bestOf;
    $("#hero-rule").textContent = "先赢 " + target + " 场夺冠";
    $("#progress-count").textContent = "已赛 " + count + " / " + series.bestOf + " 场";
    $("#log-total").textContent = "最多 " + series.bestOf + " 场";
    $("#home-dice").hidden = ended;
    $("#home-dice-label").textContent = tied ? "平局，重新掷骰" : dice ? "查看掷骰结果" : "掷骰定主场";
    $("#home-dice").title = "第 " + (count + 1) + " 场 · " + $("#home-dice-label").textContent;
    $("#record-label").textContent = tied ? "重新掷骰后可记分" : "记录本场比分";
    $("#score-form .record-btn").disabled = submitting || Boolean(tied);
    [home, 1 - home].forEach((i, position) => {
      const key = position === 0 ? "home" : "away";
      const color = i === 0 ? "red" : "blue";
      $(".competitor." + key).dataset.player = color;
      $(".input-side." + key).dataset.player = color;
      $("#" + key + "-role-en").textContent = i === 0 ? "红方" : "蓝方";
      $("#" + key + "-role").textContent = tied ? "待定" : position === 0 ? "主场" : "客场";
      $("#name-" + key).textContent = series.players[i];
      $("#input-" + key + "-label").textContent = series.players[i];
      for (const teamLabel of [$("#team-" + key), $("#input-" + key + "-team")]) {
        teamLabel.hidden = !teams[i];
        teamLabel.textContent = teams[i];
      }
      const win = $("#wins-" + key);
      win.textContent = wins[i];
      win.setAttribute("aria-label", series.players[i] + "，" + wins[i] + " 胜");
      $("#marks-" + key).replaceChildren(...Array.from({length:target}, (_, index) => element("i", index < wins[i] ? "won" : "")));
    });
    $("#trophy-label").textContent = ended ? series.players[champion] + " 捧杯" : "近看奖杯";
    $("#trophy-preview-button").setAttribute("aria-label", ended ? "查看" + series.players[champion] + "的冠军奖杯" : "近看冠军奖杯");
    $("#game-label").textContent = ended ? "FINAL" : "GAME " + pad(count + 1);
    $("#entry-heading").textContent = ended ? "系列赛冠军" : "录入比分";
    $("#score-form").hidden = ended;
    $("#winner-card").hidden = !ended;
    $("#undo").disabled = !count;
    if (ended) {
      $("#winner-name").textContent = series.players[champion];
      $("#winner-text").textContent = "以 " + wins[champion] + " 比 " + wins[1 - champion] + " 赢下本轮系列赛";
    }
    const earliestFinish = count + target - Math.max(...wins);
    drawLog(series, earliestFinish, ended);
  }

  function drawStorage() {
    const mode = store.status();
    const warning = $("#storage-warning");
    warning.hidden = mode === "saved";
    warning.textContent = mode === "corrupt" ? "原存档无法读取。请打开「数据管理」下载原始文件，并导入备份恢复记录。" :
      mode === "memory" ? "浏览器暂时无法保存记录。关闭前请在「数据管理」中导出备份。" : "";
    $("#save-text").textContent = mode === "saved" ? "记录保存在此浏览器" : mode === "memory" ? "临时记分 · 请导出备份" : "本地存档需要恢复";
  }

  function render() {
    const state = store.get();
    const history = location.hash === "#history";
    $("#page-title").textContent = history ? "系列赛历史" : "系列赛记分台";
    $("#page-caption").textContent = history ? "已完赛 " + engine.completed(state).length + " 轮" :
      "NBA 2K 双人对决　/　第 " + pad(state.history.length + 1) + " 轮";
    $("#board-view").hidden = history;
    $("#history-view").hidden = !history;
    $("#settings").hidden = history;
    document.querySelectorAll(".nav-link[data-view]").forEach(link => {
      const active = link.dataset.view === (history ? "history" : "board");
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (history) window.renderHistory($("#history-view"), state, showAward);
    else drawBoard(state);
    drawStorage();
  }

  let scoreDraft;
  let submitting = false;
  let showingAward;
  function showAward(series, opener) {
    const dialog = window.CourtAward.open(series, opener);
    if (!dialog) return;
    showingAward = {series, dialog};
    dialog.addEventListener("close", () => {
      if (showingAward?.dialog === dialog) showingAward = null;
    }, {once:true});
  }
  const preview = $("#trophy-preview");
  $("#trophy-preview-button").addEventListener("click", event => {
    const series = store.get().active;
    if (engine.stats(series).champion !== null) {
      showAward(series, event.currentTarget);
      return;
    }
    $("#trophy-preview-art").src = "./assets/championship.webp";
    preview.showModal();
  });
  $("#award-reopen").addEventListener("click", event => showAward(store.get().active, event.currentTarget));
  const form = $("#score-form");
  const inputs = [$("#score-home"), $("#score-away")];
  function clearError() {
    $("#score-error").hidden = true;
    inputs.forEach(input => input.removeAttribute("aria-invalid"));
  }
  function clearDraft() {
    scoreDraft = null;
    form.reset();
    clearError();
  }
  form.addEventListener("input", () => {
    scoreDraft ||= store.get();
    clearError();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    form.querySelector("button").disabled = true;
    try {
      const expected = scoreDraft || store.get();
      const home = engine.homeSide(expected.active);
      const scores = inputs.map(input => input.value.trim());
      const result = await store.update(state => engine.record(state, scores[home], scores[1 - home]), expected);
      const winner = engine.stats(result.active).champion;
      if (winner === null) {
        toast("已记录第 " + result.active.games.length + " 场比分");
      } else {
        showAward(result.active, $("#award-reopen"));
      }
    } catch (error) {
      $("#score-error").textContent = error.message;
      $("#score-error").hidden = false;
      inputs.forEach(input => input.setAttribute("aria-invalid", "true"));
      const first = inputs.find(input => !/^\d+$/.test(input.value.trim())) || inputs[0];
      first.focus();
    } finally {
      submitting = false;
      const dice = store.get().active.homeRoll?.dice;
      form.querySelector("button").disabled = Boolean(dice && dice[0] === dice[1]);
    }
  });
  $("#home-dice").addEventListener("click", () => {
    window.HomeDice.open({
      getState:store.get,
      async update(transform, expected) {
        // Preserve unsubmitted scores against their players if the draw swaps sides.
        const before = engine.homeSide(expected.active);
        const draftValues = inputs.map(input => input.value);
        const result = await store.update(transform, expected);
        if (store.get() === result && draftValues.some(Boolean)) {
          if (engine.homeSide(result.active) !== before) draftValues.reverse();
          inputs.forEach((input, i) => { input.value = draftValues[i]; });
          scoreDraft = result;
        }
        return result;
      }
    });
  });
  document.addEventListener("click", event => {
    const control = event.target.closest("[data-open]");
    if (control && !control.disabled) {
      const opened = store.get();
      window.ScoreDialogs.open(control.dataset.open, {
        getState:store.get, status:store.status, rawBackup:store.rawBackup,
        update: transform => store.update(transform, opened),
        replace: value => store.replace(value, opened), toast
      });
    }
    if (event.target.closest("button[data-view='board']")) location.hash = "board";
  });
  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo(0, 0);
    $("#main").focus({preventScroll:true});
  });
  store.subscribe(reason => {
    if (reason === "warning") { drawStorage(); return; }
    if (showingAward) {
      const current = engine.completed(store.get()).find(series => series.id === showingAward.series.id);
      if (JSON.stringify(current) !== JSON.stringify(showingAward.series)) showingAward.dialog.close();
    }
    clearDraft();
    render();
    if (reason === "external") toast("已载入其他标签页的最新记录");
  });
  render();
})();
