/* G01, transcribed from the six postgame screens. All player columns are in game display order. */
(() => {
  "use strict";
  function player(name, min, pts, reb, ast, stl, blk, to, fg, three) {
    return { name, min, pts, reb, ast, stl, blk, to, fg, three };
  }
  function metric(label, rockets, lakers) {
    return { label, rockets, lakers };
  }
  window.GameOneStats = {
    players: {
      rockets: [
        player("K. Durant", 28, 57, 8, 1, 3, 2, 5, "23/49", "8/15"),
        player("A. Thompson", 30, 32, 2, 3, 2, 0, 5, "14/30", "1/5"),
        player("J. Smith Jr.", 25, 3, 6, 3, 6, 0, 0, "1/4", "1/4"),
        player("M. Smart", 29, 3, 5, 6, 2, 0, 1, "1/2", "1/1"),
        player("F. VanVleet", 17, 2, 3, 2, 0, 0, 2, "1/2", "0/0"),
        player("T. Eason", 11, 2, 1, 1, 0, 1, 1, "1/2", "0/0"),
        player("A. Şengün", 39, 0, 14, 1, 3, 1, 1, "0/4", "0/0"),
        player("S. Adams", 18, 0, 5, 3, 1, 1, 1, "0/1", "0/0"),
        player("Q. Copeland", 6, 0, 1, 3, 0, 0, 0, "0/0", "0/0"),
        player("B. Bogdanović", 2, 0, 2, 0, 0, 0, 1, "0/1", "0/1"),
        player("R. Sheppard", null, 0, 0, 0, 0, 0, 0, "0/0", "0/0"),
        player("I. Crawford", null, 0, 0, 0, 0, 0, 0, "0/0", "0/0")
      ],
      lakers: [
        player("L. Dončić", 34, 44, 15, 9, 1, 1, 3, "19/45", "5/19"),
        player("A. Reaves", 33, 23, 4, 5, 1, 1, 0, "9/22", "3/7"),
        player("Z. Williams", 17, 11, 5, 0, 1, 1, 1, "5/7", "0/0"),
        player("M. Thybulle", 33, 8, 7, 2, 8, 1, 2, "4/7", "0/0"),
        player("Q. Grimes", 8, 6, 0, 0, 0, 0, 1, "3/8", "0/2"),
        player("S. Mamukelashvili", 18, 6, 5, 5, 1, 0, 4, "3/4", "0/0"),
        player("W. Kessler", 34, 4, 21, 2, 0, 3, 2, "2/4", "0/0"),
        player("C. Sexton", 7, 3, 0, 2, 0, 0, 1, "1/3", "1/2"),
        player("J. Vanderbilt", 7, 2, 3, 0, 0, 0, 1, "1/1", "0/0"),
        player("A. Thiero", 7, 2, 1, 0, 0, 0, 2, "1/1", "0/0"),
        player("J. LaRavia", 8, 0, 0, 3, 2, 0, 1, "0/0", "0/0"),
        player("K. Looney", null, 0, 0, 0, 0, 0, 0, "0/0", "0/0")
      ]
    },
    teamRows: [
      metric("得分", 99, 109),
      metric("投篮命中", "41/95（43%）", "48/102（47%）"),
      metric("三分", "11/26（42%）", "9/30（30%）"),
      metric("罚球", "6/8（75%）", "4/4（100%）"),
      metric("快攻得分", 26, 49),
      metric("禁区得分", 36, 58),
      metric("二次进攻得分", 5, 19),
      metric("替补球员得分", 5, 19),
      metric("助攻", 23, 28),
      metric("进攻篮板", 9, 15),
      metric("防守篮板", 40, 47),
      metric("抢断", 17, 14),
      metric("盖帽", 5, 7),
      metric("失误（得分）", "17（25）", "18（19）"),
      metric("球队犯规", 6, 5),
      metric("扣篮", 6, 12),
      metric("最大领先", 18, 10),
      metric("剩余暂停数", 2, 1)
    ],
    shotChart: { rockets: { pts: 99, reb: 47, ast: 23 }, lakers: { pts: 109, reb: 61, ast: 28 } }
  };
})();
