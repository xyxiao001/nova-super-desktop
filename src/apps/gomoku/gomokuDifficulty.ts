export type GomokuDifficulty = "casual"|"advanced"|"master"|"grandmaster";

export const GOMOKU_DIFFICULTIES = [
  {id:"casual",label:"休闲",description:"较少候选点，适合熟悉规则"},
  {id:"advanced",label:"进阶",description:"兼顾进攻与基本防守"},
  {id:"master",label:"大师",description:"更广搜索，识别连续攻防"},
  {id:"grandmaster",label:"特级大师",description:"最广候选与最深强制变化搜索"},
] as const satisfies ReadonlyArray<{id:GomokuDifficulty;label:string;description:string}>;

type SearchStage = {
  maxDepth:number;
  maxCandidates:number;
  promotionShape:2|3;
  promotionEnds:1|2;
  promotionMultiplier:number;
};

export type GomokuSearchProfile = {
  candidateGrowthFactor:number;
  stages:SearchStage[];
  deepSearchDepth:number;
};

export const GOMOKU_SEARCH_PROFILES:Record<GomokuDifficulty,GomokuSearchProfile> = {
  casual:{candidateGrowthFactor:1.35,stages:[{maxDepth:1,maxCandidates:4,promotionShape:2,promotionEnds:1,promotionMultiplier:4}],deepSearchDepth:4},
  advanced:{candidateGrowthFactor:1.8,stages:[{maxDepth:2,maxCandidates:6,promotionShape:2,promotionEnds:2,promotionMultiplier:4},{maxDepth:4,maxCandidates:3,promotionShape:3,promotionEnds:1,promotionMultiplier:2}],deepSearchDepth:10},
  master:{candidateGrowthFactor:2.8,stages:[{maxDepth:2,maxCandidates:10,promotionShape:2,promotionEnds:2,promotionMultiplier:4},{maxDepth:4,maxCandidates:5,promotionShape:3,promotionEnds:1,promotionMultiplier:2},{maxDepth:8,maxCandidates:2,promotionShape:3,promotionEnds:2,promotionMultiplier:4}],deepSearchDepth:18},
  grandmaster:{candidateGrowthFactor:4,stages:[{maxDepth:2,maxCandidates:12,promotionShape:2,promotionEnds:2,promotionMultiplier:4},{maxDepth:4,maxCandidates:7,promotionShape:3,promotionEnds:1,promotionMultiplier:2},{maxDepth:8,maxCandidates:4,promotionShape:3,promotionEnds:2,promotionMultiplier:4},{maxDepth:12,maxCandidates:2,promotionShape:3,promotionEnds:2,promotionMultiplier:2}],deepSearchDepth:24},
};

export const gomokuDifficultyDetails=(difficulty:GomokuDifficulty)=>GOMOKU_DIFFICULTIES.find((item)=>item.id===difficulty)!;
