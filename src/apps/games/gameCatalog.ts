export const GAME_CATALOG = [
  {id:"mines",label:"扫雷",category:"逻辑",meta:"经典 · 三档难度",artwork:"/assets/game-covers/mines.jpg"},
  {id:"chess",label:"国际象棋",category:"策略",meta:"Stockfish 18",artwork:"/assets/game-covers/chess.jpg"},
  {id:"gomoku",label:"五子棋",category:"棋类",meta:"Alpha-Beta AI",artwork:"/assets/game-covers/gomoku.jpg"},
  {id:"tower",label:"魔塔",category:"角色扮演",meta:"77 层 · 完整剧情",artwork:"/assets/game-covers/tower.jpg"},
  {id:"youtd2",label:"YouTD 2",category:"塔防",meta:"200+ 防御塔 · 300+ 物品",artwork:"/assets/game-covers/youtd2.jpg"},
  {id:"wolfslot",label:"童年老虎机",category:"街机",meta:"开火车 · 大三元 · 猜大小",artwork:"/assets/games/wolf-slot/wolf-slot-icon-v2.png"},
  {id:"frontline",label:"王国大作战：前线",category:"塔防",meta:"原版战斗 · 招募养成 · 本地存档",artwork:"/assets/games/frontline/world-map.png"},
] as const;


export function gameSharePath(id: typeof GAME_CATALOG[number]["id"]) { return `/?game=${id}`; }
