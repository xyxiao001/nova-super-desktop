import { GomokuSolution, createGomokuSearcher, createScoreMap, type IGomokuPiece } from "@algorithm.ts/gomoku";
import { GOMOKU_SEARCH_PROFILES, type GomokuDifficulty } from "./gomokuDifficulty";

type Request = {
  moves:Array<{row:number;column:number;player:0|1}>;
  player:0|1;
  difficulty:GomokuDifficulty;
  requestId:number;
};

self.onmessage=(event:MessageEvent<Request>)=>{
  const {moves,player,difficulty,requestId}=event.data;
  try{
    if(!moves.length){
      self.postMessage({row:7,column:7,requestId});
      return;
    }
    const profile=GOMOKU_SEARCH_PROFILES[difficulty];
    const scoreMap=createScoreMap(5);
    const engine=new GomokuSolution({
      MAX_ROW:15,
      MAX_COL:15,
      MAX_ADJACENT:5,
      MAX_DISTANCE_OF_NEIGHBOR:2,
      CANDIDATE_GROWTH_FACTOR:profile.candidateGrowthFactor,
      scoreMap,
      deeperSearcher:(mover)=>createGomokuSearcher({
        searchContext:mover,
        narrowSearcherOptions:profile.stages.map((stage)=>({
          MAX_SEARCH_DEPTH:stage.maxDepth,
          MAX_CANDIDATE_COUNT:stage.maxCandidates,
          MIN_PROMOTION_SCORE:scoreMap.con[stage.promotionShape][stage.promotionEnds]*stage.promotionMultiplier,
          CANDIDATE_GROWTH_FACTOR:profile.candidateGrowthFactor,
        })),
        deepSearcherOption:{MAX_SEARCH_DEPTH:profile.deepSearchDepth,MIN_PROMOTION_SCORE:scoreMap.con[4][1]},
      }),
    });
    const pieces:IGomokuPiece[]=moves.map((move)=>({r:move.row,c:move.column,p:move.player}));
    engine.init(pieces);
    const [row,column]=engine.minimaxSearch(player);
    self.postMessage({row,column,requestId});
  }catch(error){
    self.postMessage({error:error instanceof Error?error.message:"AI 搜索失败",requestId});
  }
};
