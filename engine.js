/* Shared rules for live play and imported scorebooks. */
(() => {
  "use strict";

  const KEY = "nba2k.series-scorebook.v1";
  const VERSION = 1;
  const FORMATS = [3, 5, 7];

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function playerNames(players) {
    if (!Array.isArray(players) || players.length !== 2) {
      throw new Error("请填写双方昵称。");
    }
    return Array.from(players, name => {
      if (typeof name !== "string" || !name.trim()) {
        throw new Error("双方昵称都不能为空。");
      }
      return name.trim();
    });
  }

  function format(bestOf) {
    const value = typeof bestOf === "string" && /^[357]$/.test(bestOf) ? Number(bestOf) : bestOf;
    if (!FORMATS.includes(value)) throw new Error("请选择 BO3、BO5 或 BO7。");
    return value;
  }

  function score(value) {
    const number = typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : value;
    if (!Number.isSafeInteger(number) || number < 0) {
      throw new Error("请为双方各填一个非负整数比分。");
    }
    return number;
  }

  function scorePair(a, b) {
    const scores = [score(a), score(b)];
    if (scores[0] === scores[1]) throw new Error("平局请先打加时，再录入最终比分。");
    return scores;
  }

  function newSeries(players, bestOf) {
    const id = globalThis.crypto?.randomUUID?.() ||
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    return {
      id,
      players: playerNames(players),
      bestOf: format(bestOf),
      games: [],
      startedAt: new Date().toISOString()
    };
  }

  function create(players = ["玩家 1", "玩家 2"], bestOf = 7) {
    return { version: VERSION, active: newSeries(players, bestOf), history: [] };
  }

  function gameWinner(scores) {
    return scores[0] > scores[1] ? 0 : 1;
  }

  function stats(series) {
    const target = (series.bestOf + 1) / 2;
    const wins = [0, 0];
    for (const game of series.games) wins[gameWinner(game.scores)] += 1;
    const winner = wins.findIndex(count => count >= target);
    return { wins, target, champion: winner === -1 ? null : winner };
  }

  function configure(state, players, bestOf) {
    const current = state.active;
    const value = format(bestOf);
    if (current.games.length && value !== current.bestOf) {
      throw new Error("本轮已有比分，重置本轮后可以更改赛制。");
    }
    return { ...state, active: { ...current, players: playerNames(players), bestOf: value } };
  }

  function record(state, a, b) {
    const current = state.active;
    if (stats(current).champion !== null) throw new Error("本轮已决出冠军。");
    const game = { scores: scorePair(a, b), playedAt: new Date().toISOString() };
    return { ...state, active: { ...current, games: [...current.games, game] } };
  }

  function undo(state) {
    const current = state.active;
    if (!current.games.length) throw new Error("本轮还没有可以撤销的比分。");
    return { ...state, active: { ...current, games: current.games.slice(0, -1) } };
  }

  function reset(state) {
    return { ...state, active: newSeries(state.active.players, state.active.bestOf) };
  }

  function completed(state) {
    return stats(state.active).champion === null
      ? [...state.history]
      : [state.active, ...state.history];
  }

  function next(state, players = state.active.players, bestOf = state.active.bestOf) {
    if (state.active.games.length && stats(state.active).champion === null) {
      throw new Error("本轮尚未结束。要放弃比分，请先重置本轮。");
    }
    return { version: VERSION, active: newSeries(players, bestOf), history: completed(state) };
  }

  function timestamp(value) {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString() !== value) {
      throw new Error("备份中的比赛时间无效。");
    }
    return value;
  }

  function validateSeries(value, archived) {
    if (!isObject(value) || typeof value.id !== "string" || !value.id.trim() ||
        !FORMATS.includes(value.bestOf) || !Array.isArray(value.games) ||
        value.games.length > value.bestOf) {
      throw new Error("备份中的系列赛记录无效。");
    }
    const players = playerNames(value.players);
    const startedAt = timestamp(value.startedAt);
    const wins = [0, 0];
    const target = (value.bestOf + 1) / 2;
    const games = value.games.map(game => {
      if (wins.includes(target)) throw new Error("备份中包含决出冠军之后的多余场次。");
      if (!isObject(game) || !Array.isArray(game.scores) || game.scores.length !== 2 ||
          !game.scores.every(Number.isSafeInteger)) {
        throw new Error("备份中的单场比分无效。");
      }
      const scores = scorePair(...game.scores);
      wins[gameWinner(scores)] += 1;
      return { scores, playedAt: timestamp(game.playedAt) };
    });
    if (archived && !wins.includes(target)) throw new Error("历史系列赛缺少决胜场次。");
    return { id: value.id, players, bestOf: value.bestOf, games, startedAt };
  }

  function validateState(value) {
    if (!isObject(value) || value.version !== VERSION || !Array.isArray(value.history)) {
      throw new Error("请选择本计分板导出的受支持版本 JSON 备份。");
    }
    const active = validateSeries(value.active, false);
    const ids = new Set([active.id]);
    const history = value.history.map(item => {
      const series = validateSeries(item, true);
      if (ids.has(series.id)) throw new Error("备份中包含重复的系列赛。");
      ids.add(series.id);
      return series;
    });
    return { version: VERSION, active, history };
  }

  function encode(state) {
    return JSON.stringify(validateState(state), null, 2);
  }

  function decode(text) {
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("文件内容不是有效的 JSON。");
    }
    return validateState(value);
  }

  globalThis.SeriesEngine = Object.freeze({
    KEY, create, configure, record, undo, reset, next, completed, stats, encode, decode
  });
})();
