import * as THREE from "three";
import type { ListeningScene, StageCamera, StagePalette } from "./performance";

export type PlaceWorld = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  resize: (aspect: number, view: StageCamera) => void;
  update: (time: number, bass: number, air: number, palette: StagePalette) => void;
};
const accents = { ice: new THREE.Color("#96c8bc"), violet: new THREE.Color("#bca2cd"), rose: new THREE.Color("#e8a18a") };
const zooms = { front: 1.12, stands: 1, wide: .88 };
const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+3.1;a*=.5;}return n;}
`;
const seaFragment = `
varying vec2 vUv;uniform float uTime,uAspect,uBass,uAir,uZoom;uniform vec3 uAccent;
${noise}
void main(){
 vec2 uv=(vUv-.5)/uZoom+.5;
 vec3 sky=mix(vec3(.96,.80,.56),vec3(.75,.55,.40),smoothstep(.36,1.,uv.y));
 vec2 sunCenter=vec2(.77,uAspect<1.2?.48:.65);
 float sun=1.-smoothstep(.084,.087,length((uv-sunCenter)*vec2(uAspect,1.)));
 sky=mix(sky,vec3(1.,.91,.66),sun);
 sky+=vec3(.055,.034,.005)*exp(-8.*length((uv-sunCenter)*vec2(uAspect,1.)));
 float ridge=.408+.012*sin(uv.x*13.+1.)+.018*fbm(vec2(uv.x*9.+uTime*.013,2.));
 float island=smoothstep(.53,.67,uv.x)*(1.-smoothstep(.77,.87,uv.x));
 float silhouette=step(uv.y,ridge)*step(.393,uv.y)*island;
 sky=mix(sky,vec3(.30,.42,.37),silhouette);
 if(uv.y<.395){
   float depth=(.395-uv.y)/.395;
   vec3 water=mix(vec3(.51,.68,.64),vec3(.13,.35,.37),pow(depth,.65));
   float wave=sin(uv.y*190.+fbm(vec2(uv.x*23.-uTime*.09,uv.y*36.))*9.+uTime*.35);
   float sparkle=pow(max(0.,wave),16.)*smoothstep(.47,.75,noise(vec2(uv.x*120.-uTime*.28,uv.y*130.)));
   float reflection=exp(-pow((uv.x-.77)/(depth*.18+.018),2.));
   water+=sparkle*(.07+reflection*.40)*(vec3(.85,.75,.5)+uAccent*.12)*(1.+uBass*.3);
   sky=water;
 }
 gl_FragColor=vec4(sky,1.);
}`;
const rainFragment = `
varying vec2 vUv;uniform float uTime,uAspect,uBass,uAir,uZoom;uniform vec3 uAccent;
${noise}
float box(vec2 p,vec2 c,vec2 h,float blur){vec2 d=abs(p-c)-h;return 1.-smoothstep(-blur,blur,max(d.x,d.y));}
vec3 street(vec2 p){
 vec3 c=mix(vec3(.055,.13,.15),vec3(.13,.24,.25),p.x);
 c-=box(p,vec2(.7,.55),vec2(.18,.3),.03)*.028;
 c+=box(p,vec2(.72,.54),vec2(.016,.17),.031)*vec3(.66,.37,.14);
 c+=box(p,vec2(.87,.44),vec2(.063,.009),.025)*vec3(.51,.16,.10);
 c+=box(p,vec2(.72,.32),vec2(.19,.002),.008)*uAccent*.27;
 c+=exp(-length((p-vec2(.59,.47))*vec2(uAspect,1.))*88.)*vec3(.7,.48,.22);
 c+=exp(-length((p-vec2(.91,.22))*vec2(uAspect,1.))*90.)*vec3(.8,.45,.16);
 float r=pow(max(0.,sin(p.y*200.+noise(vec2(p.x*22.,p.y*70.))*7.)),5.);
 c+=box(p,vec2(.74,.19),vec2(.035,.1),.05)*vec3(.3,.19,.06)*(.6+r*.5);
 c+=box(p,vec2(.87,.17),vec2(.045,.11),.025)*vec3(.25,.08,.045)*r;
 return c;
}
void main(){
 vec2 uv=(vUv-.5)/uZoom+.5;vec2 offset=vec2(0.);float glint=0.;
 for(int i=0;i<3;i++){
  float s=13.+float(i)*7.;vec2 grid=vec2(s*uAspect,s);
  vec2 p=uv*grid+vec2(float(i)*3.7,uTime*(.09+float(i)*.027));
  vec2 id=floor(p),f=fract(p)-.5;float rnd=hash(id);
  f.x+=(rnd-.5)*.5;f.y+=.22*sin(rnd*30.);
  float drop=exp(-dot(f*vec2(32.,13.),f*vec2(32.,13.)));
  float tail=(1.-smoothstep(.009,.024,abs(f.x)))*smoothstep(-.05,.05,f.y)*(1.-smoothstep(.1,.48,f.y));
  offset+=f*drop*.22;glint+=drop*.11+tail*.025;
 }
 vec3 c=street(uv+offset);
 c+=glint*vec3(.56,.69,.66);
 c+=fbm(uv*300.)*.018;
 c*=.78+.22*smoothstep(0.,.6,uv.x);
 c+=box(uv,vec2(.72,.54),vec2(.02,.17),.05)*uAccent*uAir*.06;
 gl_FragColor=vec4(c,1.);
}`;
function flatWorld(fragment: string): PlaceWorld {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 1;
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment,
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uBass: { value: 0 }, uAir: { value: 0 }, uZoom: { value: 1 }, uAccent: { value: accents.ice } },
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  return { scene, camera,
    resize(aspect, view) { material.uniforms.uAspect.value = aspect; material.uniforms.uZoom.value = zooms[view]; },
    update(time, bass, air, palette) {
      material.uniforms.uTime.value = time; material.uniforms.uBass.value = bass;
      material.uniforms.uAir.value = air; material.uniforms.uAccent.value = accents[palette];
    },
  };
}
const standard = (color: string, roughness = .65, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);object.castShadow = true;object.receiveShadow = true;parent.add(object);return object;
}
function rod(parent: THREE.Object3D, from: number[], to: number[], radius: number, material: THREE.Material) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
  const item = mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 12), material, parent);
  item.position.copy(a.add(b).multiplyScalar(.5));item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());return item;
}
function lighting(scene: THREE.Scene, background: string, intensity = 3) {
  scene.background = new THREE.Color(background);
  scene.add(new THREE.HemisphereLight("#fff4db", "#444d50", 2));
  const key = new THREE.DirectionalLight("#fff2d3", intensity);
  key.position.set(-3, 7, 5);key.castShadow = true;key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
  key.shadow.bias = -.001;scene.add(key);
}
function vinylWorld(cover: string, invalidate: () => void): PlaceWorld {
  const scene = new THREE.Scene();lighting(scene, "#e9e4d9", 3);
  const camera = new THREE.OrthographicCamera(-6, 6, 3.4, -3.4, .1, 60);
  camera.position.set(0, 8, 9);camera.lookAt(0, 0, 0);
  const paper = mesh(new THREE.PlaneGeometry(60, 60), standard("#e9e4d9"), scene, 0, -.23);
  paper.rotation.x = -Math.PI / 2;
  const table = new THREE.Group();scene.add(table);table.rotation.y = -.22;
  mesh(new THREE.BoxGeometry(4.5, .25, 4), standard("#9a7554", .53), table);
  mesh(new THREE.BoxGeometry(4.4, .08, 3.9), standard("#cfbfa2", .54), table, 0, .165);
  const metal = standard("#a5a69c", .26, .8), charcoal = standard("#242928", .4, .2);
  const disc = new THREE.Group();disc.position.set(-.32, .25, 0);table.add(disc);
  mesh(new THREE.CylinderGeometry(1.7, 1.7, .09, 128), charcoal, disc);
  const grooveMaterial = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: `varying vec2 vUv;void main(){vec2 p=vUv-.5;float r=length(p);float a=atan(p.y,p.x);float detail=1.-smoothstep(.003,.013,fwidth(r));float groove=sin(r*1100.)*.008*detail;float sheen=pow(abs(cos(a-.55)),12.)*.055;gl_FragColor=vec4(vec3(.075,.085,.083)+groove+sheen,1.);}`,
  });
  const grooves = mesh(new THREE.CircleGeometry(1.69, 128), grooveMaterial, disc, 0, .047);
  grooves.rotation.x = -Math.PI / 2;
  const label = mesh(new THREE.CircleGeometry(.53, 64), new THREE.MeshBasicMaterial({ color: "#a7432e" }), disc, 0, .052);
  label.rotation.x = -Math.PI / 2;
  if (cover) {
    const texture = new THREE.TextureLoader().load(cover, invalidate);texture.colorSpace = THREE.SRGBColorSpace;
    (label.material as THREE.MeshBasicMaterial).map = texture;
    (label.material as THREE.MeshBasicMaterial).color.set("#ffffff");
  } else {
    // Off-centre label marks make the rotation visible without invented artwork.
    for (let i = 0; i < 6; i++) {
      mesh(new THREE.BoxGeometry(.21, .006, .012), standard("#e0c8a2"), disc, 0, .058, -.22 - i * .027);
    }
  }
  mesh(new THREE.CylinderGeometry(.052, .052, .09, 20), metal, disc, 0, .085);
  mesh(new THREE.CylinderGeometry(.19, .21, .16, 32), charcoal, table, 1.66, .28, -1.34);
  rod(table, [1.66, .45, -1.34], [1.69, .45, .4], .036, metal);
  rod(table, [1.69, .45, .4], [.98, .38, 1.01], .036, metal);
  const needle = mesh(new THREE.BoxGeometry(.16, .12, .33), charcoal, table, .98, .33, 1.01);needle.rotation.y = .7;
  const ledMat = new THREE.MeshStandardMaterial({ color: "#a64f33", emissive: "#9f3119", emissiveIntensity: .4 });
  mesh(new THREE.CylinderGeometry(.07, .07, .018, 24), ledMat, table, -1.97, .22, 1.68);
  mesh(new THREE.BoxGeometry(.85, .018, .14), metal, table, 1.25, .22, 1.65);
  return { scene, camera,
    resize(aspect, view) {
      const portrait = aspect < 1.1;
      camera.left = -3.4 * aspect;camera.right = 3.4 * aspect;camera.zoom = zooms[view];camera.updateProjectionMatrix();
      table.position.set(portrait ? 0 : 3.4 * aspect * .40, 0, portrait ? 1.45 : 0);
      table.scale.setScalar(portrait ? .73 : 1.12);
    },
    update(time, bass, air, palette) { disc.rotation.y = -time * .48;ledMat.emissive.copy(accents[palette]);ledMat.emissiveIntensity = .2 + bass * .8; },
  };
}
const earthFragment = `varying vec2 vUv;varying vec3 vNormal;uniform vec3 uAccent;${noise}
void main(){float n=fbm(vUv*vec2(13.,7.));float land=smoothstep(.47,.54,n);vec3 color=mix(vec3(.075,.20,.26),vec3(.40,.48,.36),land);float cloud=smoothstep(.54,.72,fbm(vUv*vec2(26.,13.)+7.));color=mix(color,vec3(.75,.79,.73),cloud*.8);float light=max(0.,dot(normalize(vNormal),normalize(vec3(-.7,.5,1.))));color*=.16+light;float rim=pow(1.-max(0.,vNormal.z),3.);gl_FragColor=vec4(color+uAccent*rim*.15,1.);}`;
function moonWorld(): PlaceWorld {
  const scene = new THREE.Scene();scene.background = new THREE.Color("#070d12");
  scene.add(new THREE.HemisphereLight("#b6c4d5", "#252b35", .65));
  const key = new THREE.DirectionalLight("#e1e9f2", 2.4);
  key.position.set(-6, 4, 4);key.castShadow = true;key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
  key.shadow.bias = -.001;scene.add(key);
  const camera = new THREE.OrthographicCamera(-6, 6, 3.4, -3.4, .1, 70);
  camera.position.set(0, 3, 14);camera.lookAt(0, 1.5, 0);
  const terrain = new THREE.PlaneGeometry(36, 22, 180, 110);terrain.rotateX(-Math.PI / 2);
  const positions = terrain.attributes.position;
  const craters = [[2.4, 2.4, .75], [-2, 3.7, .9], [4.8, -1, .45], [-4, -.8, 1.1], [.2, -3, .55]];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    let h = Math.sin(x * .53 + z * .31) * .14 + Math.sin(x * 2.8) * Math.cos(z * 2.1) * .018;
    for (const [cx, cz, r] of craters) {
      const d = Math.hypot(x - cx, z - cz) / r;
      h += .17 * Math.exp(-Math.pow((d - 1) * 5, 2)) - .23 * Math.exp(-d * d * 2);
    }
    positions.setY(i, h);
  }
  terrain.computeVertexNormals();mesh(terrain, standard("#646c77", .97), scene, 0, -1.8, -1);
  const stars = new Float32Array(220 * 3);
  for (let i = 0; i < 220; i++) { stars[i * 3] = Math.sin(i * 127.1) * 19;stars[i * 3 + 1] = -1 + (i * 37 % 100) / 15;stars[i * 3 + 2] = -15; }
  const starGeometry = new THREE.BufferGeometry();starGeometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: "#a5bbbf", size: .019, transparent: true, opacity: .7 })));
  const earthMaterial = new THREE.ShaderMaterial({ vertexShader: `varying vec2 vUv;varying vec3 vNormal;void main(){vUv=uv;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: earthFragment, uniforms: { uAccent: { value: accents.ice } } });
  const earth = mesh(new THREE.SphereGeometry(1.1, 64, 40), earthMaterial, scene, 2.4, 1.4, -7);
  earth.castShadow = false;
  const station = new THREE.Group();scene.add(station);
  const alloy = standard("#b8c0b9", .5, .45);
  rod(station, [0, -1.8, 0], [0, -.2, 0], .04, alloy);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    rod(station, [0, -1, 0], [Math.cos(angle) * .5, -1.8, Math.sin(angle) * .5], .03, alloy);
  }
  const dish = new THREE.Group();dish.position.y = -.2;dish.rotation.z = -.4;dish.rotation.x = .3;station.add(dish);
  const profile = Array.from({ length: 30 }, (_, i) => { const r = i / 29 * .8;return new THREE.Vector2(r, r * r * .5); });
  const dishMaterial = standard("#d2d6cf", .58, .25);dishMaterial.side = THREE.DoubleSide;
  mesh(new THREE.LatheGeometry(profile, 64), dishMaterial, dish);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    rod(dish, [Math.cos(angle) * .79, .31, Math.sin(angle) * .79], [0, 1.04, 0], .012, alloy);
  }
  const signalMaterial = new THREE.MeshBasicMaterial({ color: "#de9166", transparent: true, opacity: .28 });
  mesh(new THREE.SphereGeometry(.04, 12, 12), new THREE.MeshBasicMaterial({ color: "#eeb28a" }), dish, 0, 1.04);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = mesh(new THREE.TorusGeometry(.17 + i * .13, .004, 3, 64, Math.PI * 1.25), signalMaterial, dish, 0, 1.35 + i * .15);
    ring.rotation.x = Math.PI / 2;rings.push(ring);
  }
  return { scene, camera,
    resize(aspect, view) {
      const portrait = aspect < 1.1;camera.left = -3.4 * aspect;camera.right = 3.4 * aspect;
      camera.zoom = zooms[view];camera.updateProjectionMatrix();
      earth.position.x = portrait ? -.65 : 3.4 * aspect * .40;
      earth.position.y = portrait ? .1 : 1.4;earth.scale.setScalar(portrait ? .78 : 1);
      station.position.set(portrait ? .6 : 3.4 * aspect * .57, 0, portrait ? 1.2 : .5);
      station.scale.setScalar(portrait ? .82 : 1);
    },
    update(time, bass, air, palette) {
      earth.rotation.y = time * .013;earthMaterial.uniforms.uAccent.value = accents[palette];
      dish.rotation.y = Math.sin(time * .09) * .12;
      signalMaterial.color.copy(accents[palette]);signalMaterial.opacity = .13 + air * .5;
      rings.forEach((ring, i) => ring.scale.setScalar(1 + bass * .10 + Math.sin(time * .6 - i) * .04));
    },
  };
}
export function createPlaceWorld(scene: Exclude<ListeningScene, "concert">, cover: string, invalidate: () => void): PlaceWorld {
  switch (scene) {
    case "train": return flatWorld(seaFragment);
    case "rain": return flatWorld(rainFragment);
    case "vinyl": return vinylWorld(cover, invalidate);
    case "space": return moonWorld();
  }
}
export function disposePlaceWorld(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    }
    if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());materials.forEach((material) => material.dispose());textures.forEach((texture) => texture.dispose());
}
