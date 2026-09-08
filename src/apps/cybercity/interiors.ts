import * as THREE from "three";

export type CyberRoomId = "ramen" | "workshop";
export const CYBER_ROOMS = {
  ramen: { title: "夜食 · 深夜食堂", detail: "坐下来，看看今夜的菜单。", accent: "#f2be79", door: [-14, 3.2, 34.5] },
  workshop: { title: "NEURAL · 义体工坊", detail: "调节工位灯，体验光学装置。", accent: "#7cddd5", door: [14, 3.2, 34.5] },
} as const;

export function roomWalkingPosition(x: number, z: number) {
  return { x: THREE.MathUtils.clamp(x, -3.15, 3.15), z: THREE.MathUtils.clamp(z, -1.4, 5.4) };
}

export type CyberInterior = {
  scene: THREE.Scene;
  targets: THREE.Mesh[];
  dispose: () => void;
};

type Callbacks = {
  leave: () => void;
  sit: (position: THREE.Vector3, target: THREE.Vector3) => void;
  message: (text: string) => void;
  render: () => void;
};

export function buildCyberInterior(id: CyberRoomId, skyline: THREE.Texture, poster: THREE.Texture, callbacks: Callbacks): CyberInterior {
  const ramen = id === "ramen";
  const scene = new THREE.Scene(); scene.background = new THREE.Color(ramen ? "#1d1510" : "#101e26");
  scene.add(new THREE.HemisphereLight(ramen ? 0xf6d5a4 : 0xc6e8ef, 0x24313a, 2.4));
  const targets: THREE.Mesh[] = [], textures: THREE.Texture[] = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  const metal = new THREE.MeshStandardMaterial({ color: 0x34444d, metalness: .4, roughness: .48 });
  const wood = new THREE.MeshStandardMaterial({ color: ramen ? 0x704932 : 0x2e4b55, roughness: .65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17252d, roughness: .8 });
  const accent = new THREE.MeshBasicMaterial({ color: CYBER_ROOMS[id].accent });
  function block(x: number,y: number,z: number,w: number,h: number,d: number, material: THREE.Material = metal) {
    const mesh = new THREE.Mesh(box,material); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); scene.add(mesh); return mesh;
  }
  function cylinder(x:number,y:number,z:number,r:number,h:number,material:THREE.Material = metal) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),material);mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  function interactive(mesh:THREE.Mesh,label:string,action:()=>void){mesh.userData.label=label;mesh.userData.interact=action;targets.push(mesh);return mesh;}
  function screen(label:string,subtitle:string,w:number,h:number,x:number,y:number,z:number,action?:()=>void){
    const canvas=document.createElement("canvas");canvas.width=1536;canvas.height=768;const ctx=canvas.getContext("2d")!;
    ctx.fillStyle=ramen?"#231b17":"#0b222c";ctx.fillRect(0,0,1536,768);ctx.fillStyle=CYBER_ROOMS[id].accent;ctx.fillRect(0,0,1536,10);
    ctx.font="32px monospace";ctx.fillText("NOVA / AFTER HOURS",65,110);ctx.fillStyle="#f3eee1";ctx.font="500 102px sans-serif";ctx.fillText(label,65,325,1400);
    ctx.fillStyle=CYBER_ROOMS[id].accent;ctx.font="42px sans-serif";ctx.fillText(subtitle,65,585,1400);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide}));mesh.position.set(x,y,z);scene.add(mesh);
    if(action)interactive(mesh,label,action);return mesh;
  }
  // Actual enclosed room, counters and props; floor tiles have geometry and metal joints.
  block(0,-.15,2,8,.3,9,dark);block(-4,2.6,2,.2,5.2,9,dark);block(4,2.6,2,.2,5.2,9,dark);block(0,2.6,-2.5,8,5.2,.2,dark);block(0,5.2,2,8,.2,9,dark);
  const tile=new THREE.MeshStandardMaterial({color:ramen?0x4f4841:0x324650,roughness:.4,metalness:.15});
  for(let x=-3.5;x<4;x++)for(let z=-2;z<6;z++)block(x,.008,z,.965,.025,.965,tile);
  const wallMaterial=new THREE.MeshStandardMaterial({color:ramen?0x2e302a:0x30424a,metalness:ramen?.15:.55,roughness:.62});
  if(ramen){
    for(let x=-3.8;x<4;x+=.4)block(x,3.6,-2.35,.34,3,.12,wood);
    for(let row=0;row<5;row++)for(let column=0;column<13;column++)block(-3.6+column*.6,1.05+row*.24,-2.28,.57,.21,.08,wallMaterial);
    block(0,2.19,-2.2,7.8,.045,.09,accent);
  }else{
    for(let x=-3;x<=3;x+=2){
      block(x,2.7,-2.32,1.91,4.4,.12,wallMaterial);
      for(const y of [.65,4.75])block(x,y,-2.23,1.6,.025,.025,metal);
      block(x-.82,3.5,-2.26,.025,1.8,.035,accent);
    }
  }
  for(const side of [-1,1]){for(let y=1;y<5;y+=1.1)block(side*3.85,y,2,.12,.05,8,metal);block(side*3.82,4.8,2,.08,.06,8,accent);}
  const windowView=new THREE.Mesh(new THREE.PlaneGeometry(4,2.8),new THREE.MeshBasicMaterial({map:skyline,toneMapped:false}));windowView.position.set(-3.88,2.65,2.4);windowView.rotation.y=Math.PI/2;scene.add(windowView);
  for(let z=.4;z<=4.4;z+=2)block(-3.8,2.65,z,.12,2.9,.08,metal);block(-3.8,1.18,2.4,.12,.12,4.1,metal);block(-3.8,4.1,2.4,.12,.12,4.1,metal);
  const artwork=new THREE.Mesh(new THREE.PlaneGeometry(1.9,2.85),new THREE.MeshBasicMaterial({map:poster,toneMapped:false}));artwork.position.set(3.86,2.7,1);artwork.rotation.y=-Math.PI/2;scene.add(artwork);
  const keyLight=new THREE.PointLight(ramen?0xffc98a:0x83e8e3,65,14,2);keyLight.position.set(0,4,1);scene.add(keyLight);
  const taskLight=new THREE.PointLight(ramen?0xffa85e:0x6bdadf,35,9,2);taskLight.position.set(1,2.8,-.8);scene.add(taskLight);
  let lightBright=true;
  screen("工位照明","点击切换 · 柔光 / 明亮",1.3,.65,2.9,2.3,-2.23,()=>{lightBright=!lightBright;taskLight.intensity=lightBright?35:8;callbacks.message(lightBright?"工位照明已调亮":"工位已切换柔光");callbacks.render();});
  // Counter is outside the walking rectangle; visitors can get close without walking through it.
  block(0,.65,-1.95,7,1.3,.95,wood);block(0,1.34,-1.75,7.5,.12,1.5,wood);block(0,1.2,-.98,7,.035,.04,accent);
  screen(CYBER_ROOMS[id].title,ramen?"一碗热汤，等你慢慢来。":"下一种感知，从此刻开始。",3.5,1.35,-.6,3.4,-2.2);
  if(ramen){
    for(let i=0;i<3;i++){
      const x=-2+i*2;const bowl=new THREE.Mesh(new THREE.SphereGeometry(.29,32,16,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xd7c7ad,side:THREE.DoubleSide,roughness:.3}));bowl.rotation.x=Math.PI;bowl.position.set(x,1.66,-1.6);scene.add(bowl);
      const soup=new THREE.Mesh(new THREE.CircleGeometry(.265,32),new THREE.MeshBasicMaterial({color:0x9a592d}));soup.rotation.x=-Math.PI/2;soup.position.set(x,1.63,-1.6);scene.add(soup);
      block(x+.4,1.43,-1.55,.035,.025,.6,wood);block(x+.47,1.43,-1.55,.035,.025,.6,wood);
      const seat=cylinder(x,.85,-.15,.38,.12,wood);cylinder(x,.43,-.15,.055,.78);cylinder(x,.05,-.15,.3,.06);
      interactive(seat,"坐在吧台",()=>{callbacks.sit(new THREE.Vector3(x,1.55,.2),new THREE.Vector3(x,1.8,-2.2));callbacks.message("已入座 · 拖动环顾，WASD 起身漫游");});
    }
    for(const x of [-2.7,0,2.7]){cylinder(x,4.3,-1,.28,.55,new THREE.MeshBasicMaterial({color:0xeab06e}));block(x,4.88,-1,.025,.7,.025,dark);}
    screen("夜食菜单","味噌拉面 / 炙烤饭团 / 热茶",2.3,1.15,2.45,3.5,-2.18,()=>callbacks.message("今夜菜单：味噌拉面、炙烤饭团、焙茶。慢慢看，街区没有打烊时间。"));
    screen("城市电台","收看今晚的街区播报",1.7,.85,-2.1,1.95,-1.7,()=>callbacks.message("街区播报：滨水高架即将亮灯。夜食营业中，欢迎在窗边看一会儿夜景。"));
  }else{
    // Layered instrument rack, articulated display arm and physical diagnostic chair.
    block(-2.8,1.7,-1.9,1,3.2,.9,dark);
    for(let y=.5;y<3;y+=.45){block(-2.8,y,-1.42,.82,.3,.08,metal);block(-3.08,y,-1.36,.035,.1,.035,accent);}
    cylinder(2.1,.28,1.15,.7,.18);cylinder(2.1,.65,1.15,.15,.8);block(2.1,1.1,1.15,1.1,.25,1.15,wood);const chair=block(2.1,1.75,1.7,1.1,1.3,.22,wood);chair.rotation.x=-.15;
    for(const side of [-1,1])block(2.1+side*.68,1.35,1.15,.18,.12,1,metal);
    interactive(chair,"体验诊断座椅",()=>{callbacks.sit(new THREE.Vector3(2.1,1.6,1.15),new THREE.Vector3(0,2,-2));callbacks.message("诊断座椅已就位 · 点击光学装置切换显示色彩");});
    block(1.2,2,-1.7,.1,1.3,.1,metal);block(.8,2.6,-1.7,.9,.1,.1,metal);
    let cool=true;
    screen("光学装置","切换冷光 / 琥珀光",2.1,1.05,.4,2.5,-1.55,()=>{cool=!cool;taskLight.color.set(cool?0x6bdadf:0xffba72);callbacks.message(cool?"光学装置：冷青模式":"光学装置：琥珀模式");callbacks.render();});
    screen("研究档案","了解 NEURAL 的故事",1.45,.73,-1.65,2.4,-1.65,()=>callbacks.message("NEURAL / 感知计划：城市并不缺少光，缺少的是停下来观看的人。"));
  }
  const exit=screen("返回街道","EXIT / 点击离开",2.5,1.25,0,2.5,6.3,callbacks.leave);exit.rotation.y=Math.PI;
  return {scene,targets,dispose(){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());textures.forEach(texture=>texture.dispose());}};
}
