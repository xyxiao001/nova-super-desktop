import { GomokuSolution, type IGomokuPiece } from "@algorithm.ts/gomoku";

type Request = {
  moves:Array<{row:number;column:number;player:0|1}>;
  player:0|1;
  requestId:number;
};

self.onmessage=(event:MessageEvent<Request>)=>{
  const {moves,player,requestId}=event.data;
  try{
    if(!moves.length){
      self.postMessage({row:7,column:7,requestId});
      return;
    }
    const engine=new GomokuSolution({
      MAX_ROW:15,
      MAX_COL:15,
      MAX_ADJACENT:5,
      MAX_DISTANCE_OF_NEIGHBOR:2,
      CANDIDATE_GROWTH_FACTOR:1.8,
    });
    const pieces:IGomokuPiece[]=moves.map((move)=>({r:move.row,c:move.column,p:move.player}));
    engine.init(pieces);
    const [row,column]=engine.minimaxSearch(player);
    self.postMessage({row,column,requestId});
  }catch(error){
    self.postMessage({error:error instanceof Error?error.message:"AI 搜索失败",requestId});
  }
};
