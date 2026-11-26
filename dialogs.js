/* Court-side controls. All user-provided names and filenames are inserted as text. */
(() => {
  "use strict";

  const glyphs = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    settings: '<path d="M4 7h8m4 0h4M4 17h3m4 0h9"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    data: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v13c0 4 15 4 15 0v-13M4.5 12c0 4 15 4 15 0"/>',
    reset: '<path d="M4 5v5h5"/><path d="M4.8 10a8 8 0 1 1 .7 6"/>',
    undo: '<path d="m8 4-5 5 5 5M3 9h9a7 7 0 0 1 7 7v3"/>',
    next: '<path d="M12 4v16M4 12h16"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
    download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v4h16v-4"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    device: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18h4"/>'
  };

  function icon(name, size = 20) {
    return '<svg aria-hidden="true" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
      glyphs[name] + '</svg>';
  }

  let currentDialog = null;

  function open(section, context) {
    if (currentDialog?.open) return;
    const engine = window.SeriesEngine;
    const opener = document.activeElement;
    const dialog = document.createElement("dialog");
    const titleId = "cs-dialog-title";
    const descriptionId = "cs-dialog-description";
    let busy = false;
    let draft = null;

    dialog.className = "cs-dialog";
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.setAttribute("aria-describedby", descriptionId);
    document.body.append(dialog);
    currentDialog = dialog;
    const $ = selector => dialog.querySelector(selector);

    function close() {
      if (!busy && dialog.open) dialog.close();
    }

    dialog.addEventListener("close", () => {
      dialog.remove();
      if (currentDialog === dialog) currentDialog = null;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    });
    dialog.addEventListener("cancel", event => {
      if (busy) event.preventDefault();
    });

    // A drag that begins inside the panel must never discard form edits.
    let pressedBackdrop = false;
    function outsidePanel(event) {
      if (event.target !== dialog) return false;
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom;
    }
    dialog.addEventListener("pointerdown", event => { pressedBackdrop = outsidePanel(event); });
    dialog.addEventListener("click", event => {
      if (pressedBackdrop && outsidePanel(event)) close();
      pressedBackdrop = false;
    });

    function frame(symbol, title, description, body, buttons) {
      dialog.innerHTML = '<div class="cs-d-inner">' +
        '<header class="cs-d-head"><div class="cs-d-heading">' + icon(symbol) +
        '<h2 class="cs-d-title" id="' + titleId + '"></h2></div>' +
        '<button type="button" class="cs-d-close" aria-label="关闭">' + icon("close", 18) + '</button></header>' +
        '<p class="cs-d-description" id="' + descriptionId + '"></p>' +
        '<form class="cs-d-form"><div class="cs-d-body">' + body + '</div>' +
        '<p class="cs-d-error" role="alert" hidden></p>' +
        (buttons ? '<footer class="cs-d-actions">' + buttons + '</footer>' : '') + '</form></div>';
      $(".cs-d-title").textContent = title;
      $(".cs-d-description").textContent = description;
      $(".cs-d-close").addEventListener("click", close);
      const cancel = $(".cs-d-cancel");
      if (cancel) cancel.addEventListener("click", close);
      const form = $(".cs-d-form");
      form.addEventListener("submit", event => event.preventDefault());
    }

    function showError(error) {
      const output = $(".cs-d-error");
      output.textContent = error?.message || "操作失败，请重试。";
      output.hidden = false;
    }

    function focus(selector) {
      const el = $(selector);
      if (!el) return;
      el.setAttribute("autofocus", "");
      if (dialog.open) el.focus({ preventScroll: true });
    }

    function cancelButton(label = "取消") {
      return '<button type="button" class="cs-d-btn cs-d-secondary cs-d-cancel">' + label + '</button>';
    }
    function primaryButton(label, danger = false) {
      return '<button type="submit" class="cs-d-btn ' + (danger ? 'cs-d-danger' : 'cs-d-primary') + '">' + label + '</button>';
    }

    function perform(callback, notice) {
      $(".cs-d-form").addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;
        busy = true;
        const submit = $('button[type="submit"]');
        submit.disabled = true;
        try {
          await callback();
        } catch (error) {
          showError(error);
          submit.disabled = false;
          busy = false;
          return;
        }
        busy = false;
        close();
        context.toast(notice);
      });
    }

    function verifyRound(latest, expected, checkGames = false) {
      if (latest.active.id !== expected.id ||
          (checkGames && JSON.stringify(latest.active.games) !== JSON.stringify(expected.games))) {
        throw new Error("本轮记录已更新，请关闭后重新查看。");
      }
    }

    function settings(nextRound = false) {
      const series = context.getState().active;
      const locked = !nextRound && series.games.length > 0;
      const preset = draft || {
        players: series.players,
        teams: nextRound ? ["", ""] : engine.gameTeams(series, 0),
        bestOf: series.bestOf
      };
      const labels = ["三场两胜", "五场三胜", "七场四胜"];
      const options = [3, 5, 7].map((n, i) =>
        '<label class="cs-d-option"><input type="radio" name="format" value="' + n + '">' +
        '<span><b>BO' + n + '</b><small>' + labels[i] + '</small></span></label>').join("");
      const sides = ["红方", "蓝方"];
      const names = sides.map((side, i) =>
        '<label class="cs-d-player"><span><i class="cs-d-dot p' + (i + 1) + '"></i>' + side + '昵称</span>' +
        '<input type="text" name="player' + i + '" autocomplete="off" required></label>').join("");
      const teams = sides.map((side, i) =>
        '<label class="cs-d-player"><span>' + side + '首场球队</span>' +
        '<input type="text" name="team' + i + '" placeholder="选填" autocomplete="off"></label>').join("");
      const resetLink = !nextRound && (series.games.length || series.homeRoll)
        ? '<div class="cs-d-reset-row"><button type="button" class="cs-d-text-btn cs-d-reset">' +
          icon("reset", 16) + '重置本轮比分</button></div>' : "";
      frame(nextRound ? "next" : "settings",
        nextRound ? "开始下一轮" : "系列赛设置",
        nextRound ? "确认双方昵称和赛制后，开始新的系列赛。" :
          (locked ? "修改昵称会同步更新本轮所有场次的显示。" : "填写双方昵称，再选定本轮赛制。"),
        '<div class="cs-d-players">' + names + teams + '</div><fieldset class="cs-d-fieldset">' +
        '<legend>系列赛赛制</legend><div class="cs-d-formats">' + options + '</div>' +
        (locked ? '<p class="cs-d-hint">已有比分，本轮赛制已锁定。</p>' : '') + '</fieldset>' + resetLink,
        cancelButton() + primaryButton(nextRound ? "开始下一轮" : "保存设置"));
      const nameInputs = [...dialog.querySelectorAll('input[name^="player"]')];
      const teamInputs = [...dialog.querySelectorAll('input[name^="team"]')];
      nameInputs.forEach((input, i) => { input.value = preset.players[i]; });
      teamInputs.forEach((input, i) => { input.value = preset.teams[i]; });
      const radios = [...dialog.querySelectorAll('input[name="format"]')];
      radios.forEach(input => {
        input.checked = Number(input.value) === preset.bestOf;
        input.disabled = locked;
      });
      const values = () => ({
        players: nameInputs.map(input => input.value),
        teams: teamInputs.map(input => input.value),
        bestOf: Number(radios.find(input => input.checked).value)
      });
      const resetControl = $(".cs-d-reset");
      if (resetControl) resetControl.addEventListener("click", () => {
        draft = values();
        confirmRound("reset", settings);
      });
      perform(() => {
        const chosen = values();
        return context.update(latest => {
          verifyRound(latest, series, nextRound);
          const configured = nextRound ? engine.next(latest, chosen.players, chosen.bestOf) :
            engine.configure(latest, chosen.players, chosen.bestOf);
          return engine.setGameTeams(configured, 0, chosen.teams);
        });
      }, nextRound ? "新一轮系列赛已开始" : "系列赛设置已保存");
      focus(nextRound ? 'input[name="player0"]' : ".cs-d-close");
    }

    function confirmRound(action, back) {
      const state = context.getState();
      const series = state.active;
      const undoing = action === "undo";
      const last = series.games[series.games.length - 1];
      const champion = engine.stats(series).champion;
      const title = undoing ? "撤销上一场？" : "重置本轮比分？";
      const description = undoing
        ? (champion !== null ? "撤销决胜场后，本轮将重新开放记分。" : "撤销后，可以重新录入这场比赛的正确比分。")
        : "将清空本轮的比分、主场掷骰和冠军结果。昵称、赛制及往期已归档的系列赛会保留。";
      frame(undoing ? "undo" : "reset", title, description,
        '<div class="cs-d-summary"><span></span><strong></strong></div>',
        cancelButton(back ? "返回设置" : "取消") + primaryButton(undoing ? "撤销上一场" : "确认重置", true));
      $(".cs-d-summary span").textContent = undoing ? '第 ' + series.games.length + ' 场' : "本轮已记录";
      $(".cs-d-summary strong").textContent = undoing && last ?
        series.players[0] + " " + last.scores[0] + " ∶ " + last.scores[1] + " " + series.players[1] :
        series.games.length + " 场比赛";
      if (undoing && series.homeRoll) {
        $(".cs-d-description").textContent += " 本场待用的掷骰会清除，并恢复上一场的主客场。";
      }
      if (back) {
        const cancel = $(".cs-d-cancel");
        cancel.removeEventListener("click", close);
        cancel.addEventListener("click", () => back());
      }
      perform(() => context.update(latest => {
        verifyRound(latest, series, true);
        return undoing ? engine.undo(latest) : engine.reset(latest);
      }), undoing ? "已撤销上一场比分" : "本轮比分已重置");
      focus(".cs-d-cancel");
    }

    function download(content, name) {
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      dialog.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }

    function dataRow(action, symbol, name, hint) {
      return '<button type="button" class="cs-d-data-row" data-action="' + action + '">' +
        '<span class="cs-d-data-icon">' + icon(symbol, 19) + '</span><span class="cs-d-data-copy">' +
        '<strong>' + name + '</strong><small>' + hint + '</small></span>' + icon("arrow", 16) + '</button>';
    }

    function data() {
      const storageStatus = context.status();
      const extra = storageStatus === "memory" ? "当前浏览器无法保存，请在关闭前导出。" :
        storageStatus === "corrupt" ? "此前保存的数据读取失败。可以先下载原始文件，再导入可用备份。" : "";
      frame("data", "存档管理", "记录保存在当前浏览器。换设备或交给朋友接着记分时，可用备份文件转移。",
        '<div class="cs-d-data-list">' +
        (storageStatus === "corrupt"
          ? dataRow("original", "download", "下载原始文件", "保留读取失败的本地数据")
          : dataRow("export", "download", "导出备份", "下载本轮比分及全部系列赛历史")) +
        dataRow("import", "upload", "导入备份", "从 JSON 文件恢复记录") + '</div>' +
        '<input type="file" accept=".json,application/json" hidden>' +
        '<p class="cs-d-storage">' + icon("device", 15) + '<span></span></p>', '');
      $(".cs-d-storage span").textContent = extra || "同一个网址在不同设备上不会自动同步比分。";
      const fileInput = $('input[type="file"]');
      $('[data-action="import"]').addEventListener("click", () => {
        fileInput.value = "";
        fileInput.click();
      });
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
          const imported = engine.decode(await file.text());
          if (dialog.open && fileInput.isConnected) confirmImport(imported, file.name);
        } catch (error) {
          if (dialog.open && fileInput.isConnected) showError(error);
        }
      });
      const exportDate = new Date();
      const date = [exportDate.getFullYear(), String(exportDate.getMonth() + 1).padStart(2, "0"),
        String(exportDate.getDate()).padStart(2, "0")].join("-");
      $('[data-action="export"]')?.addEventListener("click", () => {
        try {
          download(engine.encode(context.getState()), "courtside-" + date + ".json");
        } catch (error) { showError(error); }
      });
      const rawButton = $('[data-action="original"]');
      if (rawButton) rawButton.addEventListener("click", () => {
        try {
          const raw = context.rawBackup();
          if (typeof raw !== "string") throw new Error("原始文件已不可用。");
          download(raw, "courtside-original-" + date + ".json");
        } catch (error) { showError(error); }
      });
      focus(".cs-d-close");
    }

    function confirmImport(imported, filename) {
      frame("upload", "导入这份备份？", "导入会替换当前设备上的本轮比分和全部系列赛历史。",
        '<div class="cs-d-summary cs-d-preview"><span></span><strong></strong><small></small></div>',
        cancelButton("返回") + primaryButton("确认导入"));
      $(".cs-d-summary span").textContent = filename;
      $(".cs-d-summary strong").textContent = imported.active.players.join("  vs  ");
      $(".cs-d-summary small").textContent = "本轮已记 " + imported.active.games.length +
        " 场 · 已归档 " + imported.history.length + " 轮";
      const cancel = $(".cs-d-cancel");
      cancel.removeEventListener("click", close);
      cancel.addEventListener("click", data);
      perform(() => context.replace(imported), "已导入备份");
      focus(".cs-d-cancel");
    }

    if (section === "settings" || section === "next") settings(section === "next");
    else if (section === "undo" || section === "reset") confirmRound(section);
    else if (section === "data") data();
    else {
      dialog.remove();
      currentDialog = null;
      return;
    }
    dialog.showModal();
  }

  window.ScoreDialogs = Object.freeze({ open });
})();
