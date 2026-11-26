(() => {
  "use strict";

  const dateFormat = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric"
  });

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function trophyIcon() {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", "M7.5 3.5h9v5.2a4.5 4.5 0 0 1-9 0zM7.5 5h-4v2a4 4 0 0 0 4.2 4m8.8-6h4v2a4 4 0 0 1-4.2 4M12 13.2v4.3m-4.5 3h9l-1.7-3H9.2z");
    svg.append(path);
    return svg;
  }

  function emptyState() {
    const section = element("section", "archive-empty");
    const emblem = element("div", "archive-empty-emblem");
    emblem.append(trophyIcon());
    const button = element("button", "archive-return", "回到记分板");
    button.type = "button";
    button.dataset.view = "board";
    section.append(emblem,
      element("h2", "", "还没有完赛记录"),
      element("p", "", "打完第一轮系列赛，就能在这里回看冠军和每场比分。"),
      button
    );
    return section;
  }

  function boxScore(series) {
    const table = element("table", "archive-games");
    table.append(element("caption", "archive-visually-hidden", "逐场比分"));
    const header = table.createTHead().insertRow();
    ["场次", ...series.players].forEach(label => {
      const cell = element("th", "", label);
      cell.scope = "col";
      header.append(cell);
    });
    const body = table.createTBody();
    series.games.forEach((game, index) => {
      const row = body.insertRow();
      const heading = element("th", "", "第 " + (index + 1) + " 场");
      heading.scope = "row";
      row.append(heading);
      const home = window.SeriesEngine.gameHomeSide(game);
      game.scores.forEach((score, side) => {
        const cell = row.insertCell();
        cell.textContent = score;
        if (score > game.scores[1 - side]) {
          cell.className = "archive-game-win side-" + (side === home ? 0 : 1);
          cell.append(element("span", "archive-visually-hidden", "，本场胜"));
        }
        const role = side === home ? "主场" : "客场";
        const draw = game.homeRoll ? " · 骰子 " + game.homeRoll.dice[side] + " 点" : "";
        cell.append(element("small", "archive-game-role", role + draw));
      });
    });
    return table;
  }

  function seriesEntry(series, number, openAward) {
    const { wins, champion } = window.SeriesEngine.stats(series);
    const details = element("details", "archive-entry");
    const summary = element("summary", "archive-summary");
    const mark = element("span", "archive-mark");
    mark.append(trophyIcon());
    const description = element("span", "archive-description");
    const metadata = element("span", "archive-meta");
    const end = series.games[series.games.length - 1].playedAt;
    const time = element("time", "", dateFormat.format(new Date(end)));
    time.dateTime = end;
    metadata.append(element("span", "archive-series-num", "系列赛 #" + String(number).padStart(2, "0")),
      element("span", "", "BO" + series.bestOf), time);
    const championLine = element("span", "archive-champion");
    championLine.append(element("span", "archive-winner-name", series.players[champion]),
      element("span", "archive-winner-label", "冠军"));
    description.append(metadata, championLine);
    const tally = element("span", "archive-tally");
    tally.setAttribute("aria-label", "系列赛总比分，" + series.players[champion] + " " + wins[champion] + " 比 " + wins[1 - champion] + " 战胜 " + series.players[1 - champion]);
    const scoreline = element("span", "archive-scoreline");
    scoreline.append(element("strong", "", wins[champion]), element("span", "", "–"), element("span", "", wins[1 - champion]));
    tally.append(scoreline, element("span", "archive-opponent", "对手 · " + series.players[1 - champion]));
    const chevron = element("span", "archive-chevron");
    chevron.setAttribute("aria-hidden", "true");
    summary.append(mark, description, tally, chevron);
    const award = element("button", "archive-award", "查看冠军奖杯");
    award.type = "button";
    award.setAttribute("aria-haspopup", "dialog");
    award.setAttribute("aria-label", "查看" + series.players[champion] + "的冠军奖杯");
    award.addEventListener("click", () => openAward(series, award));
    details.append(summary, award, boxScore(series));
    return details;
  }

  window.renderHistory = function renderHistory(container, state, openAward) {
    const finished = window.SeriesEngine.completed(state);
    if (!finished.length) {
      container.replaceChildren(emptyState());
      return;
    }
    const list = element("div", "archive-list");
    finished.forEach((series, index) => list.append(seriesEntry(series, finished.length - index, openAward)));
    container.replaceChildren(list);
  };
})();
