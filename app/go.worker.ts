import { Game, type GoColor } from "tenuki";

type Move = {row:number;column:number}|null;
type Request = {moves:Move[];aiColor:GoColor;requestId:number};
type Point = {row:number;column:number;score:number};

const SIZE=9;
const createGame=(moves:Move[])=>{
  const game=new Game({boardSize:SIZE,scoring:"area",koRule:"positional-superko",komi:6.5});
  for(const move of moves)move?game.playAt(move.row,move.column,{render:false}):game.pass({render:false});
  return game;
};
const captureCount=(game:Game,color:GoColor)=>color==="black"?game.currentState().whiteStonesCaptured:game.currentState().blackStonesCaptured;
const localScore=(game:Game,row:number,column:number,color:GoColor)=>{
  const before=captureCount(game,color);
  if(!game.playAt(row,column,{render:false}))return -Infinity;
  const captured=captureCount(game,color)-before;
  let liberties=0,friends=0,enemies=0;
  for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    const r=row+dr,c=column+dc;
    if(r<0||r>=SIZE||c<0||c>=SIZE)continue;
    const value=game.intersectionAt(r,c).value;
    if(value==="empty")liberties++;
    else if(value===color)friends++;
    else enemies++;
  }
  game.undo();
  const center=4-(Math.abs(row-4)+Math.abs(column-4))*.25;
  return captured*28+liberties*2+friends*2.4+enemies*1.2+center;
};
const legalPoints=(game:Game,color:GoColor)=>{
  const points:Point[]=[];
  for(let row=0;row<SIZE;row++)for(let column=0;column<SIZE;column++)if(!game.isIllegalAt(row,column))points.push({row,column,score:localScore(game,row,column,color)});
  return points.sort((a,b)=>b.score-a.score);
};
const randomMove=(game:Game,random:()=>number)=>{
  const color=game.currentPlayer(),points=legalPoints(game,color);
  if(!points.length)return false;
  const pool=points.slice(0,Math.min(14,points.length)),pick=pool[Math.floor(Math.pow(random(),1.8)*pool.length)];
  return game.playAt(pick.row,pick.column,{render:false});
};

self.onmessage=(event:MessageEvent<Request>)=>{
  const {moves,aiColor,requestId}=event.data;
  try{
    const base=createGame(moves);
    if(base.isOver()){self.postMessage({pass:true,requestId});return}
    const candidates=legalPoints(base,aiColor).slice(0,12);
    if(!candidates.length||moves.length>76||(moves.length>28&&moves.at(-1)===null&&candidates[0].score<10)){
      self.postMessage({pass:true,requestId});
      return;
    }
    let seed=moves.length*2654435761+17;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    let best=candidates[0],bestValue=-Infinity;
    for(const candidate of candidates){
      let value=candidate.score*1.8;
      for(let simulation=0;simulation<6;simulation++){
        const game=createGame([...moves,{row:candidate.row,column:candidate.column}]);
        for(let depth=0;depth<30&&!game.isOver();depth++)if(!randomMove(game,random))game.pass({render:false});
        if(!game.isOver()){game.pass({render:false});game.pass({render:false})}
        const score=game.score();
        value+=(aiColor==="black"?score.black-score.white:score.white-score.black);
      }
      if(value>bestValue){bestValue=value;best=candidate}
    }
    self.postMessage({row:best.row,column:best.column,requestId});
  }catch(error){
    self.postMessage({error:error instanceof Error?error.message:"围棋 AI 搜索失败",requestId});
  }
};
