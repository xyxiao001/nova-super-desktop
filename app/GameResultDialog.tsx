"use client";

export default function GameResultDialog({title,detail,tone,onRestart,onDismiss}:{title:string;detail:string;tone:"win"|"loss"|"draw";onRestart:()=>void;onDismiss:()=>void}){
  return <section className={`game-result-layer ${tone}`} role="dialog" aria-modal="true" aria-label={title}>
    <div>
      <span className="game-result-mark" aria-hidden="true">{tone==="win"?"✓":tone==="loss"?"×":"="}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
      <footer><button onClick={onDismiss}>查看本局</button><button onClick={onRestart}>再来一局</button></footer>
    </div>
  </section>;
}
