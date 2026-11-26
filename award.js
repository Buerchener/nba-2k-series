(() => {
  "use strict";

  const artworkPath = "./assets/championship.webp";
  const bodyFont = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';
  let offlineArt;

  function posterArt() {
    if (location.protocol !== "file:") return Promise.resolve(artworkPath);
    if (window.CourtAwardImage) return Promise.resolve(window.CourtAwardImage);
    // A file:// image drawn directly onto a canvas cannot be exported. The
    // offline package includes the identical WebP as a local data URL.
    if (!offlineArt) {
      offlineArt = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "./assets/championship-offline.js";
        script.onload = () => window.CourtAwardImage ? resolve(window.CourtAwardImage) : reject();
        script.onerror = reject;
        document.head.append(script);
      }).catch(() => {
        offlineArt = null;
        throw new Error("未能读取离线奖杯图片，请检查解压后的 assets 文件夹。");
      });
    }
    return offlineArt;
  }

  function linesFor(context, name, width) {
    const lines = [];
    let current = "";
    const segmenter = typeof Intl.Segmenter === "function" && new Intl.Segmenter("zh", {granularity:"grapheme"});
    const pieces = segmenter ? segmenter.segment(name) : Array.from(name);
    for (const piece of pieces) {
      const char = typeof piece === "string" ? piece : piece.segment;
      if (current && context.measureText(current + char).width > width) {
        lines.push(current);
        current = "";
      }
      current += char;
    }
    if (current) lines.push(current);
    return lines;
  }

  function nameLayout(context, name, width, preferred, minimum, weight) {
    let size = preferred;
    context.font = weight + " " + size + "px " + bodyFont;
    const measured = context.measureText(name).width;
    if (measured > width) {
      size = Math.max(minimum, Math.floor(preferred * width / measured));
      context.font = weight + " " + size + "px " + bodyFont;
    }
    return {font:context.font, lineHeight:Math.ceil(size * 1.3), lines:linesFor(context, name, width)};
  }

  async function poster(data) {
    const photo = new Image();
    photo.src = await posterArt();
    try {
      await photo.decode();
    } catch {
      throw new Error("奖杯图片尚未加载成功，请重试。");
    }

    await document.fonts.ready;
    const canvas = document.createElement("canvas");
    const width = 1200;
    const margin = 68;
    const textWidth = width - margin * 2;
    const artHeight = Math.round(width * photo.naturalHeight / photo.naturalWidth);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器暂时无法生成海报。");

    const winner = nameLayout(ctx, data.winner, textWidth, 92, 42, 750);
    const opponent = nameLayout(ctx, "战胜 " + data.opponent, textWidth, 42, 31, 550);
    const scoreY = artHeight + 140 + winner.lines.length * winner.lineHeight;
    const footerY = scoreY + 105 + opponent.lines.length * opponent.lineHeight + 45;
    canvas.width = width;
    canvas.height = footerY + 82;

    ctx.fillStyle = "#191919";
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.drawImage(photo, 0, 0, width, artHeight);
    ctx.save();
    window.TrophyModel.paintNameplate(ctx, data, width, artHeight);
    ctx.restore();
    const gold = ctx.createLinearGradient(0, 0, width, 0);
    gold.addColorStop(0, "#675133");
    gold.addColorStop(.42, "#e9c781");
    gold.addColorStop(1, "#675133");
    ctx.fillStyle = gold;
    ctx.fillRect(0, artHeight, width, 4);
    ctx.textBaseline = "top";

    ctx.fillStyle = "#e9c781";
    ctx.font = "650 31px " + bodyFont;
    ctx.fillText("系列赛冠军", margin, artHeight + 47);
    ctx.fillStyle = "#b7b1a7";
    ctx.font = "700 36px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BO" + data.bestOf, width - margin, artHeight + 44);
    ctx.textAlign = "left";

    ctx.font = winner.font;
    ctx.fillStyle = "#fff9e9";
    winner.lines.forEach((line, index) => ctx.fillText(line, margin, artHeight + 108 + index * winner.lineHeight));

    ctx.font = "700 76px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = "#efcc89";
    ctx.fillText(data.score, margin, scoreY);
    ctx.font = opponent.font;
    ctx.fillStyle = "#e1ddd4";
    opponent.lines.forEach((line, index) => ctx.fillText(line, margin, scoreY + 102 + index * opponent.lineHeight));

    ctx.fillStyle = "#514a40";
    ctx.fillRect(margin, footerY, textWidth, 2);
    ctx.fillStyle = "#b4ada1";
    ctx.font = "italic 800 35px 'Barlow Condensed', sans-serif";
    ctx.fillText("COURTSIDE", margin, footerY + 24);
    ctx.textAlign = "right";
    ctx.font = "500 25px " + bodyFont;
    ctx.fillText(data.date, width - margin, footerY + 25);
    return new Promise((resolve,reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("海报保存失败，请再试一次。"));
    }, "image/png"));
  }

  function downloadPoster(blob, winner) {
    const filename = Array.from(winner.replace(/[\\/:*?"<>|\u0000-\u001F]/gu, "_")).slice(0, 45).join("");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Courtside-冠军-" + filename + ".png";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 30000);
  }

  function open(series, opener = document.activeElement) {
    const {champion, wins} = window.SeriesEngine.stats(series);
    if (champion === null || document.querySelector("dialog[open]")) return null;
    const other = 1 - champion;
    const date = new Date(series.games[series.games.length - 1].playedAt);
    const data = {
      winner:series.players[champion], opponent:series.players[other], bestOf:series.bestOf,
      wins:[wins[champion], wins[other]],
      score:wins[champion] + " – " + wins[other],
      date:new Intl.DateTimeFormat("zh-CN", {year:"numeric",month:"long",day:"numeric"}).format(date)
    };
    const dialog = document.createElement("dialog");
    dialog.id = "award-dialog";
    dialog.className = "award-dialog";
    dialog.setAttribute("aria-labelledby", "award-label award-winner");
    dialog.setAttribute("aria-describedby", "award-description");
    dialog.innerHTML = `
      <div class="award-hero">
        <img class="award-image" alt="球馆灯光下的金色篮球冠军奖杯">
        <canvas class="award-nameplate" aria-hidden="true"></canvas>
        <button class="award-close" type="button" aria-label="关闭颁奖画面">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="award-body">
        <div class="award-head">
          <div class="award-honoree"><p class="award-label" id="award-label">系列赛冠军</p><h2 class="award-winner" id="award-winner" tabindex="-1"></h2></div>
          <div class="award-result"><span class="award-score"></span><span class="award-result-label">系列赛总比分</span></div>
        </div>
        <p class="award-opponent" id="award-description"></p>
        <p class="award-meta"></p>
        <div class="award-actions">
          <button type="button" id="award-model" class="award-action award-primary">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7Zm-9 5 9 5 9-5m-9 5v10"/></svg>领取 3D 奖杯
          </button>
          <button type="button" id="award-save" class="award-action award-secondary">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>保存冠军海报
          </button>
        </div>
        <p class="award-status" role="status" aria-live="polite"></p>
      </div>`;
    const $ = selector => dialog.querySelector(selector);
    const photo = $(".award-image");
    photo.addEventListener("load", async () => {
      await document.fonts.ready;
      if (!dialog.open) return;
      const plate = $(".award-nameplate");
      plate.width = photo.naturalWidth;
      plate.height = photo.naturalHeight;
      const ctx = plate.getContext("2d");
      if (ctx) window.TrophyModel.paintNameplate(ctx, data, plate.width, plate.height);
    }, {once:true});
    photo.src = artworkPath;
    $(".award-winner").textContent = data.winner;
    $(".award-score").textContent = data.score;
    $(".award-opponent").textContent = "战胜 " + data.opponent;
    $(".award-meta").textContent = "BO" + data.bestOf + "　·　" + data.date;

    let prepared;
    function onClaim(selector, work, success) {
      const button = $(selector);
      button.addEventListener("click", async () => {
        button.disabled = true;
        const status = $(".award-status");
        status.textContent = "正在准备下载…";
        try {
          await work();
          status.textContent = success;
        } catch (error) {
          status.textContent = error?.message || "下载失败，请重新尝试。";
        } finally {
          button.disabled = false;
        }
      });
    }
    onClaim("#award-model", () => window.TrophyModel.download(series), "已开始下载专属 3D 奖杯。");
    onClaim("#award-save", async () => {
      if (!prepared) prepared = await poster(data);
      if (dialog.open) downloadPoster(prepared, data.winner);
    }, "已开始下载冠军海报。");

    $(".award-close").addEventListener("click", () => dialog.close());
    let outsideDown = false;
    function outside(event) {
      if (event.target !== dialog) return false;
      const r = dialog.getBoundingClientRect();
      return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    }
    dialog.addEventListener("pointerdown", event => { outsideDown = outside(event); });
    dialog.addEventListener("click", event => {
      if (outsideDown && outside(event)) dialog.close();
      outsideDown = false;
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected && opener.getClientRects().length) {
        opener.focus({preventScroll:true});
      }
    }, {once:true});
    document.body.append(dialog);
    dialog.showModal();
    // Keep the trophy in view without making a download the default action.
    $(".award-winner").focus({preventScroll:true});
    dialog.scrollTop = 0;
    return dialog;
  }

  window.CourtAward = Object.freeze({open});
})();
