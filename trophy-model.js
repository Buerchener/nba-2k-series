(() => {
  "use strict";

  let modelPromise;
  function offlineModel() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "./assets/model-offline.js";
      script.onload = () => {
        script.remove();
        try {
          const binary = atob(window.CourtTrophyData);
          delete window.CourtTrophyData;
          resolve(Uint8Array.from(binary, char => char.charCodeAt(0)).buffer);
        } catch (error) { reject(error); }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("无法读取离线奖杯模型，请重新解压完整网页后再试。"));
      };
      document.head.append(script);
    });
  }

  function loadModel() {
    if (!modelPromise) {
      const request = location.protocol === "file:" ? offlineModel() :
        fetch("./assets/championship.glb").then(response => {
          if (!response.ok) throw new Error("暂时无法取得奖杯模型，请重试。");
          return response.arrayBuffer();
        });
      modelPromise = request.catch(error => { modelPromise = null; throw error; });
    }
    return modelPromise;
  }

  // This texture is used both on the GLB mesh and in the championship photograph.
  function inscriptionCanvas(award) {
    const plate = document.createElement("canvas");
    plate.width = 1536;
    plate.height = 256;
    const g = plate.getContext("2d");
    const ground = g.createLinearGradient(0, 0, 1260, 256);
    ground.addColorStop(0, "#3e3429");
    ground.addColorStop(.45, "#241f1a");
    ground.addColorStop(1, "#3c3328");
    g.fillStyle = ground;
    g.fillRect(0, 0, plate.width, plate.height);
    g.strokeStyle = "#927b54";
    g.lineWidth = 3;
    g.strokeRect(11, 11, plate.width - 22, plate.height - 22);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const family = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    let name = award.winner;
    let size = 135;
    g.font = '700 ' + size + 'px ' + family;
    while (g.measureText(name).width > 1420 && size > 50) {
      size -= 4;
      g.font = '700 ' + size + 'px ' + family;
    }
    if (g.measureText(name).width > 1420) {
      const letters = Array.from(name);
      let limit = Math.min(letters.length, 150);
      do { name = letters.slice(0, limit--).join("") + "…"; } while (limit > 0 && g.measureText(name).width > 1420);
    }
    g.fillStyle = "#fff0c9";
    g.fillText(name, 768, 109);
    g.font = '650 30px ' + family;
    g.fillStyle = "#e6c894";
    g.fillText("BO" + award.bestOf + "     /     " + award.wins.join(" – "), 768, 206);
    return plate;
  }

  // Projected UV corners of the visible plaque in the Blender hero-camera render.
  const heroPlate = [
    [.41379234, .84117642], [.54789299, .85586688],
    [.41395220, .87511119], [.54780191, .89063872]
  ];

  function paintNameplate(ctx, award, width, height) {
    const [tl, tr, bl, br] = heroPlate.map(([x,y]) => ({x:x*width, y:y*height}));
    const plate = inscriptionCanvas(award);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tl.x,tl.y);
    ctx.lineTo(tr.x,tr.y);
    ctx.lineTo(br.x,br.y);
    ctx.lineTo(bl.x,bl.y);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "#342a20";
    ctx.fillRect(0,0,width,height);
    // Average opposite edges; their perspective divergence is under one rendered pixel.
    const ux = (tr.x - tl.x + br.x - bl.x) / 2;
    const uy = (tr.y - tl.y + br.y - bl.y) / 2;
    const vx = (bl.x - tl.x + br.x - tr.x) / 2;
    const vy = (bl.y - tl.y + br.y - tr.y) / 2;
    const x = (tl.x + tr.x + bl.x + br.x) / 4 - (ux + vx) / 2;
    const y = (tl.y + tr.y + bl.y + br.y) / 4 - (uy + vy) / 2;
    ctx.transform(ux / plate.width, uy / plate.width, vx / plate.height, vy / plate.height, x, y);
    ctx.drawImage(plate, 0, 0);
    ctx.restore();
  }

  function makeInscription(award) {
    const plate = inscriptionCanvas(award);
    return new Promise((resolve, reject) => plate.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("生成冠军铭牌失败，请重试。"));
    }, "image/png"));
  }

  const JSON_CHUNK = 0x4e4f534a;
  const BIN_CHUNK = 0x004e4942;
  const GLB = 0x46546c67;
  const align4 = size => Math.ceil(size / 4) * 4;

  function awardModel(source, image, award) {
    const header = new DataView(source);
    const jsonLength = header.getUint32(12, true);
    const binHeader = 20 + jsonLength;
    if (header.getUint32(0, true) !== GLB || header.getUint32(4, true) !== 2 ||
        header.getUint32(16, true) !== JSON_CHUNK || header.getUint32(binHeader + 4, true) !== BIN_CHUNK) {
      throw new Error("无法读取这份奖杯模型，请刷新后重试。");
    }
    const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(source, 20, jsonLength)));
    const plaque = gltf.materials.find(mat => mat.name === "Champion_Inscription");
    if (!plaque) throw new Error("模型缺少冠军铭牌，请刷新后重试。");
    const geometry = new Uint8Array(source, binHeader + 8, gltf.buffers[0].byteLength);
    const plateOffset = align4(geometry.byteLength);
    const binaryLength = align4(plateOffset + image.byteLength);
    gltf.images ??= [];
    gltf.textures ??= [];
    const viewId = gltf.bufferViews.push({buffer:0, byteOffset:plateOffset, byteLength:image.byteLength}) - 1;
    const imageId = gltf.images.push({name:"Champion nameplate", mimeType:"image/png", bufferView:viewId}) - 1;
    const textureId = gltf.textures.push({source:imageId}) - 1;
    plaque.pbrMetallicRoughness = {
      baseColorFactor:[1,1,1,1], baseColorTexture:{index:textureId}, metallicFactor:.25, roughnessFactor:.46
    };
    plaque.emissiveTexture = {index:textureId};
    plaque.emissiveFactor = [.18,.18,.18];
    gltf.asset.extras = {...gltf.asset.extras, courtsideAward:award};
    gltf.buffers[0].byteLength = plateOffset + image.byteLength;
    const json = new TextEncoder().encode(JSON.stringify(gltf));
    const paddedJsonLength = align4(json.length);
    const output = new Uint8Array(28 + paddedJsonLength + binaryLength);
    const out = new DataView(output.buffer);
    out.setUint32(0, GLB, true);
    out.setUint32(4, 2, true);
    out.setUint32(8, output.length, true);
    out.setUint32(12, paddedJsonLength, true);
    out.setUint32(16, JSON_CHUNK, true);
    output.set(json, 20);
    output.fill(0x20, 20 + json.length, 20 + paddedJsonLength);
    const binStart = 20 + paddedJsonLength;
    out.setUint32(binStart, binaryLength, true);
    out.setUint32(binStart + 4, BIN_CHUNK, true);
    output.set(geometry, binStart + 8);
    output.set(image, binStart + 8 + plateOffset);
    return new Blob([output], {type:"model/gltf-binary"});
  }

  async function download(series) {
    const {champion, wins} = window.SeriesEngine.stats(series);
    if (champion === null) throw new Error("赢下本轮系列赛后即可领取奖杯。");
    const award = {
      winner:series.players[champion], opponent:series.players[1 - champion],
      bestOf:series.bestOf, wins:[wins[champion], wins[1 - champion]],
      decidedAt:series.games[series.games.length - 1].playedAt
    };
    const [model, inscription] = await Promise.all([loadModel(), makeInscription(award)]);
    const blob = awardModel(model, new Uint8Array(await inscription.arrayBuffer()), award);
    const link = document.createElement("a");
    const name = Array.from(award.winner.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")).slice(0,50).join("");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = "Courtside-" + name + "-冠军奖杯.glb";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }

  window.TrophyModel = Object.freeze({download, paintNameplate});
})();
