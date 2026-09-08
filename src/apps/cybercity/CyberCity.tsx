import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { CITY_LOCATIONS, walkCity } from "./cityLayout";

import { buildCyberInterior, CYBER_ROOMS, roomWalkingPosition, type CyberInterior, type CyberRoomId } from "./interiors";

type Props = { active: boolean; location: number; travel: number; room: CyberRoomId | null; quality: "high" | "balanced"; onRoom: (room: CyberRoomId | null) => void; onMessage: (message: string) => void; onHover: (label: string | null) => void };

export default function CyberCity({ active, location, travel, room, quality, onRoom, onMessage, onHover }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onRoom, onMessage, onHover });
  const controls = useRef<{ visit: (index: number) => void; setActive: (value: boolean) => void; enterRoom: (room: CyberRoomId | null) => void; quality: (value: "high" | "balanced") => void } | null>(null);
  callbacks.current = { onRoom, onMessage, onHover };

  useEffect(() => {
    const element = host.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#142537");
    scene.fog = new THREE.FogExp2("#233a4a", .0045);
    const camera = new THREE.PerspectiveCamera(63, 1, .2, 450);
    camera.rotation.order = "YXZ";
    camera.position.set(...CITY_LOCATIONS[0].position);
    camera.lookAt(new THREE.Vector3(...CITY_LOCATIONS[0].target));
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .95;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "夜城三维街区，拖动观察，WASD 或方向键沿街道漫游，点击店铺入口进入室内，按 E 与装置交互");
    renderer.domElement.tabIndex = 0;
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    const composer = new EffectComposer(renderer, renderTarget);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), .3, .3, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    scene.add(new THREE.HemisphereLight(0xc3dae6, 0x35454d, 2.2));
    const moon = new THREE.DirectionalLight(0x95bdce, 1.4); moon.position.set(-50, 90, 30); scene.add(moon);
    const textures: THREE.Texture[] = [];
    let disposed = false;
    const loader = new THREE.TextureLoader();
    function texture(file: string) {
      const map = loader.load(`/assets/apps/cybercity/${file}`, () => { if (!disposed) schedule(); });
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.push(map);
      return map;
    }
    const atlas = texture("facade-atlas.png");
    const skyline = texture("distant-skyline.png");
    const poster = texture("neural-poster.png");
    const box = new THREE.BoxGeometry(1, 1, 1);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x34444e, roughness: .87, metalness: .05 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x25323a, roughness: .65, metalness: .3 });
    const facadeMaterial = new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: .75, roughness: .9, metalness: .03 });
    const neon = [0x60dcd2, 0xef6c91, 0xe9b773].map(color => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4) }));
    function block(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material = concrete) {
      const mesh = new THREE.Mesh(box, material);
      mesh.position.set(x, y, z); mesh.scale.set(w, h, d); scene.add(mesh); return mesh;
    }
    const facadeGeometries = Array.from({ length: 4 }, (_, quadrant) => {
      const geometry = new THREE.PlaneGeometry(1, 1);
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (quadrant % 2) * .5 + .003 + uv.getX(i) * .494, (quadrant < 2 ? .5 : 0) + .003 + uv.getY(i) * .494);
      return geometry;
    });
    function facade(quadrant: number, x: number, y: number, z: number, w: number, h: number, rotation = 0) {
      const mesh = new THREE.Mesh(facadeGeometries[quadrant], facadeMaterial);
      mesh.position.set(x, y, z); mesh.scale.set(w, h, 1); mesh.rotation.y = rotation; scene.add(mesh); return mesh;
    }
    const horizonMaterial = new THREE.MeshBasicMaterial({ map: skyline, fog: false, color: 0xa6c4d2, toneMapped: false });
    for (let side = 0; side < 4; side++) {
      const horizon = new THREE.Mesh(new THREE.PlaneGeometry(520, 260), horizonMaterial);
      const angle = side * Math.PI / 2;
      horizon.position.set(Math.sin(angle) * 230, 70, -45 - Math.cos(angle) * 230);
      horizon.rotation.y = -angle; scene.add(horizon);
    }
    // Textured architecture is built in measured floor modules, with actual depth on all street-facing elevations.
    for (let side = -1; side <= 1; side += 2) for (let row = 0; row < 8; row++) for (let depth = 0; depth < 2; depth++) {
      const x = side * (25 + depth * 25 + (row % 3) * 2), z = 42 - row * 26;
      const width = 16 + row % 3, thickness = 20, floors = 2 + (row + depth * 2 + (side + 1)) % 3, height = floors * 16;
      block(x, height / 2, z, width, height, thickness);
      for (let floor = 0; floor < floors; floor++) {
        const quadrant = (row + depth) % 3 === 0 ? 1 : 0;
        facade(quadrant, x, floor * 16 + 8, z + thickness / 2 + .02, width, 16);
        facade(quadrant, x - side * (width / 2 + .02), floor * 16 + 8, z, thickness, 16, -side * Math.PI / 2);
        facade(quadrant, x, floor * 16 + 8, z - thickness / 2 - .02, width, 16, Math.PI);
        if (depth === 0) block(x - side * (width / 2 + .5), floor * 16 + .3, z, 1, .45, thickness, dark);
      }
      block(x, height + 1, z, width * .7, 2, 12, dark);
      block(x + side * 4, height + 4, z, 3, 6, 4, dark);
      block(x - 3, height + 5, z, .2, 10, .2, dark);
      if (depth === 0) {
        // Shop fronts have shallow roofs, separate display panels and recessed street-side elevations.
        block(side * 16.8, 3, z, 5, 6, 23, dark);
        for (let shop = 0; shop < 3; shop++) facade(2 + (shop + row) % 2, side * 14.25, 3.1, z - 7.5 + shop * 7.5, 7.3, 6.2, -side * Math.PI / 2);
        facade(2 + row % 2, side * 16.8, 3, z + 11.55, 5, 6);
        block(side * 15.5, 6.3, z, 8, .35, 23.5, concrete);
        block(side * 12.5, 5.9, z, .08, .08, 22, neon[row % 3]);
        for (let prop = 0; prop < 3; prop++) {
          block(side * 13.5, .5, z - 8 + prop * 6, .7, 1, .8, dark);
          block(side * 13.4, .98, z - 8 + prop * 6, .75, .04, .85, concrete);
        }
      }
    }
    // Restrained wet asphalt: reflected signage comes through the rough road surface, not a perfect mirror.
    const road = new Reflector(new THREE.PlaneGeometry(27, 240), { color: 0x19232c, textureWidth: 768, textureHeight: 768 });
    road.rotation.x = -Math.PI / 2; road.position.set(0, -.04, -40); scene.add(road);
    const asphaltCanvas = document.createElement("canvas"); asphaltCanvas.width = 256; asphaltCanvas.height = 256;
    const asphaltContext = asphaltCanvas.getContext("2d")!;
    asphaltContext.fillStyle = "#26333b"; asphaltContext.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 10000; n++) { asphaltContext.fillStyle = n % 2 ? "#34424b" : "#1b2931"; asphaltContext.fillRect((n * 71) % 256, (n * 139 + Math.floor(n / 256) * 17) % 256, 1, 1); }
    const asphaltMap = new THREE.CanvasTexture(asphaltCanvas); asphaltMap.colorSpace = THREE.SRGBColorSpace; asphaltMap.wrapS = asphaltMap.wrapT = THREE.RepeatWrapping; asphaltMap.repeat.set(12, 100); textures.push(asphaltMap);
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(27, 240), new THREE.MeshBasicMaterial({ map: asphaltMap, transparent: true, opacity: .76, depthWrite: false }));
    asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(0, -.02, -40); scene.add(asphalt);
    const pavement = new THREE.MeshStandardMaterial({ color: 0x46535a, roughness: .92 });
    block(-14, -.2, -40, 2, .4, 240, pavement); block(14, -.2, -40, 2, .4, 240, pavement);
    const paint = new THREE.MeshBasicMaterial({ color: 0x7e8172 });
    for (let z = -150; z < 76; z += 9) { block(-.18, .01, z, .09, .02, 3, paint); block(.18, .01, z, .09, .02, 3, paint); }
    for (const z of [28, -48, -112]) for (let x = -10; x < 11; x += 2) block(x, .015, z, .9, .03, 4, paint);
    for (const z of [-33, -100]) {
      block(0, 18, z, 43, 3, 5, dark);
      facade(1, 0, 18, z + 2.52, 40, 3);
      block(0, 16.4, z + 2.6, 37, .06, .08, neon[0]);
      for (let x = -18; x <= 18; x += 6) block(x, 18, z + 2.65, .15, 2.7, .18, concrete);
    }
    function posterBoard(x: number, y: number, z: number, width: number, height: number, rotation = 0) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: poster, toneMapped: false }));
      board.position.set(x, y, z); board.rotation.y = rotation; scene.add(board);
      block(x, y - height / 2 - .15, z - .1, width + .3, .15, .3, neon[2]);
    }
    posterBoard(-18.8, 16, 28, 8, 12);
    posterBoard(22, 28, -14, 10, 15);
    posterBoard(-25, 37, -90, 10, 15);
    const lampGlowMapCanvas = document.createElement("canvas"); lampGlowMapCanvas.width = lampGlowMapCanvas.height = 64;
    const glowContext = lampGlowMapCanvas.getContext("2d")!; const glow = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32); glow.addColorStop(0, "#ffcc8280"); glow.addColorStop(.2, "#f9b86525"); glow.addColorStop(1, "#e69c4700"); glowContext.fillStyle = glow; glowContext.fillRect(0, 0, 64, 64);
    const glowMap = new THREE.CanvasTexture(lampGlowMapCanvas); textures.push(glowMap);
    const glowMaterial = new THREE.SpriteMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let z = 47; z > -140; z -= 25) for (const side of [-1, 1]) {
      block(side * 12, 4, z, .13, 8, .13, dark); block(side * 10.8, 8, z, 2.5, .15, .3, dark); block(side * 10.8, 7.88, z, 2, .04, .22, neon[2]);
      const halo = new THREE.Sprite(glowMaterial); halo.position.set(side * 10.8, 7.85, z); halo.scale.set(6, 6, 1); scene.add(halo);
    }
    for (const [x, z, color] of [[-11, 26, 0xe8b077], [11, -15, 0x55d8d5], [-11, -63, 0xbd6ba3]]) {
      const light = new THREE.PointLight(color, 95, 28, 2); light.position.set(x, 6, z); scene.add(light);
    }
    function terminalSign(label: string, code: string, color: string) {
      const canvas = document.createElement("canvas"); canvas.width = 1536; canvas.height = 768;
      const context = canvas.getContext("2d")!; context.scale(2,2); context.fillStyle = "#071e27"; context.fillRect(0, 0, 768, 384);
      context.fillStyle = color; context.fillRect(0, 0, 768, 5); context.fillRect(30, 35, 6, 52);
      context.font = "22px monospace"; context.fillText(`NOVA / ${code}`, 58, 72);
      context.font = "500 65px sans-serif"; context.fillStyle = "#e4eeea"; context.fillText(label, 35, 200, 690);
      context.fillStyle = color; context.font = "22px monospace"; context.fillText("探索街区                     ↗", 35, 325);
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; textures.push(map);
      return new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.DoubleSide }));
    }
    const terminals: THREE.Mesh[] = [];
    for (const id of ["ramen", "workshop"] as const) {
      const definition = CYBER_ROOMS[id];
      const entrance = terminalSign(definition.title, "ENTER / 进入店铺", definition.accent);
      entrance.position.set(definition.door[0] * .75, 2.8, definition.door[2]);
      entrance.rotation.y = id === "ramen" ? .45 : -.45;
      entrance.userData.label = `进入${definition.title}`;
      entrance.userData.interact = () => callbacks.current.onRoom(id);
      scene.add(entrance); terminals.push(entrance);
      block(entrance.position.x, 1.1, entrance.position.z + .2, .7, 2.2, .55, dark);
    }
    for (const [index, label, text] of [[0, "滨水街区", "这里曾是货运码头，如今深夜食堂和感知工坊沿街亮起了灯。"], [1, "高架旧线", "穿过两座空中连廊，可以看到雾中的中央高塔。"], [2, "城市的另一面", "这座城市不催你完成任务。找个角落，看看灯光和橱窗。"]] as const) {
      const kiosk = terminalSign(label, "CITY ARCHIVE", "#89c3c7");kiosk.position.set(index % 2 ? 10 : -10, 2.6, -5-index*35);
      kiosk.userData.label = label;kiosk.userData.interact=()=>callbacks.current.onMessage(text);scene.add(kiosk);terminals.push(kiosk);
    }
    // Small physical props break up repeated silhouettes without turning every edge into a light strip.
    const wheelGeometry = new THREE.CylinderGeometry(.46, .46, .3, 12);
    for (let i = 0; i < 5; i++) {
      const x = i % 2 ? 7 : -7, z = 12 - i * 29;
      block(x, .8, z, 2.2, .95, 4.6, concrete); block(x, 1.47, z - .3, 1.7, .65, 2.5, dark);
      for (const offset of [-.7, .7]) block(x + offset, .8, z + 2.33, .42, .1, .05, neon[2]);
      for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) { const wheel = new THREE.Mesh(wheelGeometry, dark); wheel.rotation.z = Math.PI / 2; wheel.position.set(x + sx * 1.04, .47, z + sz); scene.add(wheel); }
    }
    const cableMaterial = new THREE.LineBasicMaterial({ color: 0x29343a });
    for (let i = 0; i < 5; i++) { const z = 25 - i * 34; const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-15, 13, z), new THREE.Vector3(0, 8, z + 3), new THREE.Vector3(15, 15, z)); scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), cableMaterial)); }
    const selection=new THREE.BoxHelper(new THREE.Object3D(),0xf0f336);selection.visible=false;scene.add(selection);
    const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();const keys=new Set<string>();
    let selectedObject:THREE.Object3D|null=null;
    let isActive=true,frame=0,last=0,drag:{x:number;y:number;moved:boolean}|null=null;
    let motion:{from:THREE.Vector3;to:THREE.Vector3;fromRotation:THREE.Quaternion;toRotation:THREE.Quaternion;start:number}|null=null;
    const interiors = new Map<CyberRoomId, CyberInterior>();
    let activeRoom: CyberRoomId | null = null;
    let streetPose: { position: THREE.Vector3; rotation: THREE.Quaternion } | null = null;
    const targets = () => activeRoom === null ? terminals : interiors.get(activeRoom)!.targets;
    function moveCamera(position: THREE.Vector3, target?: THREE.Vector3) {
      const next = camera.clone();next.position.copy(position);if(target)next.lookAt(target);
      keys.clear();
      if(reduced.matches){camera.position.copy(next.position);camera.quaternion.copy(next.quaternion);motion=null;}
      else motion={from:camera.position.clone(),to:next.position.clone(),fromRotation:camera.quaternion.clone(),toRotation:next.quaternion.clone(),start:performance.now()};
      schedule();
    }
    function enterRoom(id: CyberRoomId | null) {
      if(id===activeRoom)return;
      keys.clear();drag=null;motion=null;highlight(undefined);
      if(id===null){
        renderPass.scene=scene;activeRoom=null;scene.add(selection);
        camera.position.copy(streetPose!.position);camera.quaternion.copy(streetPose!.rotation);streetPose=null;
      }else{
        if(activeRoom===null)streetPose={position:camera.position.clone(),rotation:camera.quaternion.clone()};
        if(!interiors.has(id))interiors.set(id,buildCyberInterior(id,skyline,poster,{
          leave:()=>callbacks.current.onRoom(null),sit:moveCamera,message:message=>callbacks.current.onMessage(message),render:schedule,
        }));
        activeRoom=id;renderPass.scene=interiors.get(id)!.scene;renderPass.scene.add(selection);
        camera.position.set(0,1.7,5.4);camera.lookAt(0,2,-2);
        moveCamera(new THREE.Vector3(0,1.7,3.9),new THREE.Vector3(0,2,-2));
      }
      schedule();
    }
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    function schedule(){if(!frame)frame=requestAnimationFrame(render);}
    function render(time:number){
      frame=0;const dt=Math.min((time-last)/1000,.05);last=time;
      if(motion){const t=Math.min(1,(time-motion.start)/900),ease=t*t*(3-2*t);camera.position.lerpVectors(motion.from,motion.to,ease);camera.quaternion.slerpQuaternions(motion.fromRotation,motion.toRotation,ease);if(t===1)motion=null;}
      if(isActive&&keys.size){
        const forward=Number(keys.has("w")||keys.has("arrowup"))-Number(keys.has("s")||keys.has("arrowdown"));
        const side=Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
        if(activeRoom===null){const next=walkCity(camera.position.x,camera.position.z,camera.rotation.y,forward,side,dt*10);camera.position.set(next.x,2.4,next.z);}
        else {const length=Math.hypot(forward,side);if(length){const distance=dt*3.2/length;const next=roomWalkingPosition(camera.position.x+(-Math.sin(camera.rotation.y)*forward+Math.cos(camera.rotation.y)*side)*distance,camera.position.z+(-Math.cos(camera.rotation.y)*forward-Math.sin(camera.rotation.y)*side)*distance);camera.position.set(next.x,1.7,next.z);}}
      }
      composer.render();if(motion||(isActive&&keys.size))schedule();
    }
    function visit(index:number){if(activeRoom!==null){enterRoom(null);callbacks.current.onRoom(null);}const point=CITY_LOCATIONS[index];const targetCamera=camera.clone();targetCamera.position.fromArray(point.position);targetCamera.lookAt(new THREE.Vector3().fromArray(point.target));
      keys.clear();
      if(reduced.matches){camera.position.copy(targetCamera.position);camera.quaternion.copy(targetCamera.quaternion);motion=null;}
      else motion={from:camera.position.clone(),to:targetCamera.position.clone(),fromRotation:camera.quaternion.clone(),toRotation:targetCamera.quaternion.clone(),start:performance.now()};schedule();
    }
    controls.current={visit,enterRoom,quality(value){renderer.setPixelRatio(Math.min(window.devicePixelRatio,value==="high"?2:1.25));composer.setPixelRatio(renderer.getPixelRatio());resize();},setActive(value){isActive=value;if(!value){keys.clear();drag=null;motion=null;}schedule();}};
    function resize(){const width=element.clientWidth,height=element.clientHeight;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);composer.setSize(width,height);schedule();}
    const observer=new ResizeObserver(resize);observer.observe(element);
    function pick(event:PointerEvent){const bounds=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(targets())[0]?.object;}
    function highlight(hit:THREE.Object3D|undefined){if((hit??null)===selectedObject)return;selectedObject=hit??null;selection.visible=!!hit;if(hit)selection.setFromObject(hit);callbacks.current.onHover(hit?hit.userData.label:null);schedule();}
    function goTo(event:MouseEvent){
      if(!isActive)return;
      const bounds=canvas.getBoundingClientRect();pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);raycaster.setFromCamera(pointer,camera);
      const point=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
      if(!point)return;
      const indoor=roomWalkingPosition(point.x,point.z);
      const to=activeRoom===null?new THREE.Vector3(THREE.MathUtils.clamp(point.x,-11,11),2.4,THREE.MathUtils.clamp(point.z,-137,72)):new THREE.Vector3(indoor.x,1.7,indoor.z);
      keys.clear();if(reduced.matches){camera.position.copy(to);motion=null;}else motion={from:camera.position.clone(),to,fromRotation:camera.quaternion.clone(),toRotation:camera.quaternion.clone(),start:performance.now()};schedule();
    }
    function down(event:PointerEvent){if(!isActive||event.button!==0)return;renderer.domElement.focus();motion=null;drag={x:event.clientX,y:event.clientY,moved:false};renderer.domElement.setPointerCapture(event.pointerId);}
    function move(event:PointerEvent){if(!isActive)return;if(drag){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;camera.rotation.y-=dx*.003;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.003,-.7,.85);drag.x=event.clientX;drag.y=event.clientY;schedule();}else{const hit=pick(event);highlight(hit);renderer.domElement.style.cursor=hit?"pointer":"grab";}}
    function up(event:PointerEvent){if(drag&&!drag.moved){const hit=pick(event);if(hit)hit.userData.interact();}drag=null;}
    const moveKeys=["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"];
    function keydown(event:KeyboardEvent){if(!isActive)return;if(event.key.toLowerCase()==="e"){event.stopPropagation();raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hit=raycaster.intersectObjects(targets())[0]?.object;if(hit)hit.userData.interact();}if(moveKeys.includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();keys.add(event.key.toLowerCase());motion=null;schedule();}}
    function keyup(event:KeyboardEvent){keys.delete(event.key.toLowerCase());}
    function blur(){keys.clear();drag=null;}
    const canvas=renderer.domElement;
    canvas.addEventListener("dblclick",goTo);canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",blur);
    canvas.addEventListener("keydown",keydown);canvas.addEventListener("keyup",keyup);canvas.addEventListener("blur",blur);
    resize();
    return()=>{
      disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.current=null;
      canvas.removeEventListener("dblclick",goTo);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",blur);canvas.removeEventListener("keydown",keydown);canvas.removeEventListener("keyup",keyup);canvas.removeEventListener("blur",blur);
      scene.add(selection);interiors.forEach(interior=>interior.dispose());
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Sprite){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
      geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());textures.forEach(texture=>texture.dispose());road.getRenderTarget().dispose();bloom.dispose();composer.dispose();renderer.dispose();canvas.remove();
    };
  },[]);
  useEffect(()=>{controls.current?.visit(location);},[location,travel]);
  useEffect(()=>{controls.current?.setActive(active);},[active]);
  useEffect(()=>{controls.current?.enterRoom(room);},[room]);
  useEffect(()=>{controls.current?.quality(quality);},[quality]);
  return <div className="cyber-city-canvas" ref={host}/>;
}
