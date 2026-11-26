(() => {
  "use strict";

  // Positions on a physical die, numbered across a 3 × 3 face.
  const faces = [
    [], [5], [1, 9], [1, 5, 9], [1, 3, 7, 9],
    [1, 3, 5, 7, 9], [1, 3, 4, 6, 7, 9]
  ];

  function seat() {
    const node = document.createElement("div");
    node.className = "dice-seat";
    node.innerHTML = '<strong class="dice-player"></strong><div class="dice-face" aria-hidden="true"></div>' +
      '<span class="dice-value"></span>';
    return node;
  }

  function showFace(node, value) {
    const face = node.querySelector(".dice-face");
    if (!value) {
      face.textContent = "?";
      return;
    }
    const pips = faces[value].map(position => {
      const pip = document.createElement("i");
      pip.style.gridRow = Math.ceil(position / 3);
      pip.style.gridColumn = ((position - 1) % 3) + 1;
      return pip;
    });
    face.replaceChildren(...pips);
  }

  function open(context) {
    if (document.querySelector("dialog[open]")) return;
    const opener = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.id = "home-dice-dialog";
    dialog.className = "cs-dialog dice-dialog";
    dialog.setAttribute("aria-labelledby", "dice-title");
    dialog.setAttribute("aria-describedby", "dice-rule");
    dialog.innerHTML = '<div class="cs-d-inner">' +
      '<header class="cs-d-head"><h2 class="cs-d-title" id="dice-title">掷骰定主场</h2>' +
      '<button type="button" class="cs-d-close" aria-label="关闭"><svg width="18" height="18" ' +
      'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">' +
      '<path d="m6 6 12 12M18 6 6 18"/></svg></button></header>' +
      '<p class="cs-d-description" id="dice-rule"></p>' +
      '<div class="dice-tray"></div><p class="dice-outcome" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<p class="cs-d-error" role="alert" hidden></p><div class="cs-d-actions">' +
      '<button type="button" class="cs-d-btn cs-d-primary" data-dice-action autofocus></button></div></div>';

    const tray = dialog.querySelector(".dice-tray");
    const seats = [seat(), seat()];
    tray.append(...seats);
    const outcome = dialog.querySelector(".dice-outcome");
    const action = dialog.querySelector("[data-dice-action]");
    const error = dialog.querySelector(".cs-d-error");
    let snapshot = context.getState();
    let canRoll = false;
    let busy = false;

    function render() {
      const series = snapshot.active;
      const dice = series.homeRoll?.dice;
      const tied = dice && dice[0] === dice[1];
      const assigned = dice && !tied;
      const home = window.SeriesEngine.homeSide(series);
      const completed = window.SeriesEngine.stats(series).champion !== null;
      canRoll = !completed && !assigned;
      dialog.querySelector("#dice-rule").textContent = completed ? "本轮系列赛已结束。" :
        "第 " + (series.games.length + 1) + " 场开始前，双方各掷一颗六面骰。点数大的一方当主场，平局重掷。";
      seats.forEach((node, side) => {
        const role = side === home ? "主场" : "客场";
        node.dataset.player = side === 0 ? "red" : "blue";
        node.dataset.side = assigned ? (side === home ? "home" : "away") : "";
        node.querySelector(".dice-player").textContent = series.players[side];
        node.querySelector(".dice-value").textContent = dice ?
          dice[side] + " 点" + (assigned ? " · " + role : "") : "待掷骰";
        showFace(node, dice?.[side]);
      });
      if (assigned) {
        outcome.textContent = series.players[home] + " 以 " + dice[home] + " 比 " + dice[1 - home] + " 赢得本场主场。";
      } else if (tied) {
        outcome.textContent = "双方都掷出 " + dice[0] + " 点，需要重新掷骰。";
      } else {
        outcome.textContent = "";
      }
      action.textContent = !canRoll ? "返回记分台" : tied ? "重新掷骰" : "双方掷骰";
    }

    action.addEventListener("click", async () => {
      if (busy) return;
      if (!canRoll) { dialog.close(); return; }
      busy = true;
      action.disabled = true;
      error.hidden = true;
      tray.classList.add("dice-rolling");
      action.textContent = "掷骰中…";
      try {
        // The random draw runs inside the store's revision check.
        snapshot = await context.update(window.SeriesEngine.rollHome, snapshot);
        await new Promise(resolve => setTimeout(resolve, 430));
        render();
      } catch (failure) {
        snapshot = context.getState();
        render();
        error.textContent = failure.message || "掷骰失败，请重新操作。";
        error.hidden = false;
      } finally {
        tray.classList.remove("dice-rolling");
        busy = false;
        action.disabled = false;
        action.focus({preventScroll:true});
      }
    });
    dialog.querySelector(".cs-d-close").addEventListener("click", () => {
      if (!busy) dialog.close();
    });
    dialog.addEventListener("cancel", event => {
      if (busy) event.preventDefault();
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll:true});
    });
    render();
    document.body.append(dialog);
    dialog.showModal();
  }

  window.HomeDice = Object.freeze({open});
})();
