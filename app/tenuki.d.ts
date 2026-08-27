declare module "tenuki" {
  export type GoColor = "black"|"white";
  export type GoIntersection = {
    y:number;
    x:number;
    value:"empty"|GoColor;
    isEmpty():boolean;
    isBlack():boolean;
    isWhite():boolean;
  };
  export type GoState = {
    moveNumber:number;
    color:GoColor|null;
    pass:boolean;
    blackStonesCaptured:number;
    whiteStonesCaptured:number;
    capturedPositions:GoIntersection[];
    intersections:GoIntersection[];
  };
  export class Game {
    constructor(options?:{boardSize?:number;scoring?:"area"|"territory"|"equivalence";koRule?:"simple"|"positional-superko"|"situational-superko"|"natural-situational-superko";komi?:number});
    boardSize:number;
    currentPlayer():GoColor;
    currentState():GoState;
    intersectionAt(y:number,x:number):GoIntersection;
    intersections():GoIntersection[];
    isIllegalAt(y:number,x:number):boolean;
    playAt(y:number,x:number,options?:{render?:boolean}):boolean;
    pass(options?:{render?:boolean}):boolean;
    undo():void;
    isOver():boolean;
    score():{black:number;white:number};
  }
}
