import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DEFAULT_SKULL_FIT, estimateSkullFit, projectSkullPoint, SKULL_ANCHORS } from './skullFit.js';
import { FACIAL_BONES, drawAtlasLabels } from './faceSkeleton.js';

const BONES_3D={maxilla:[.13,.35,.60],zygomatic:[.33,.48,.39],nasal:[.035,.52,.59],lacrimal:[.095,.60,.46],concha:[.06,.43,.58],palatine:[.12,.40,.38],vomer:[0,.44,.56],mandible:[0,.05,.58]};

export class Skull3D {
    constructor() {
        this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
        this.renderer.setClearColor(0x000000,0);
        this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));
        this.renderer.outputColorSpace=THREE.SRGBColorSpace;
        this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
        this.scene=new THREE.Scene();
        this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10000);
        this.camera.position.z=5000;
        this.root=new THREE.Group();this.scene.add(this.root);
        this.scene.add(new THREE.HemisphereLight(0xfff0d7,0x332819,1.8));
        const key=new THREE.DirectionalLight(0xffefdb,3.2);key.position.set(-600,800,1200);this.scene.add(key);
        const rim=new THREE.DirectionalLight(0xd8e9ff,1.3);rim.position.set(700,400,-300);this.scene.add(rim);
        this.jawUniform={value:0};this.lastTime=null;
        this.disposed=false;
    }
    async load() {
        const gltf=await new GLTFLoader().loadAsync('/skull.glb');
        if(this.disposed)throw new Error('Skull renderer was disposed');
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse(object=>{
            if(!object.isMesh)return;
            const geometry=object.geometry.clone();
            // Source geometry is in metres with an offset X origin.
            // Bake only its vertex-space normalization, not the display node translation.
            geometry.translate(-.21944674,.1033091247,-.00489068);
            geometry.scale(1/.25277984,1/.25277984,1/.25277984);
            const aoMap=object.material.aoMap;
            const material=new THREE.MeshStandardMaterial({color:0xdccba8,roughness:.82,metalness:0,aoMap,aoMapIntensity:1.2});
            material.onBeforeCompile=shader=>{
                shader.uniforms.jawAngle=this.jawUniform;
                const common=`
uniform float jawAngle;
float jawWeight(vec3 p) {
 float front=clamp((p.z-0.10)/0.13,0.0,1.0);
 float top=0.39-0.125*clamp((p.z-0.28)/0.20,0.0,1.0);
 return front*clamp((top-p.y)/0.015,0.0,1.0);
}
mat3 jawRotation(float a) {float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
`;
                shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+common)
                    .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal = normalize(mix(objectNormal,jawRotation(jawAngle)*objectNormal,jawWeight(position)));')
                    .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed = mix(transformed,jawRotation(jawAngle)*(transformed-vec3(0.,.37,.24))+vec3(0.,.37,.24),jawWeight(position));');
            };
            const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;this.root.add(mesh);
        });
        this.loaded=true;return this;
    }
    reset(){this.lastTime=null;this.fit=null;}
    draw(ctx,landmarks,w,h,options={}) {
        const fit=estimateSkullFit(landmarks,w,h,options.fit||DEFAULT_SKULL_FIT,options.faceMatrix);
        if(!fit||!this.loaded)return {hitTargets:[]};
        const now=options.timestamp??performance.now(),dt=this.lastTime===null?1000:now-this.lastTime;
        const alpha=1-Math.exp(-Math.max(1,dt)/45);
        if(!this.fit||dt>300)this.fit=fit;
        else {
            this.fit.rotation.slerp(fit.rotation,alpha);this.fit.position.lerp(fit.position,alpha);
            this.fit.scale.lerp(fit.scale,alpha);this.fit.jawAngle+=(fit.jawAngle-this.fit.jawAngle)*alpha;
        }
        this.lastTime=now;
        const current=this.fit;
        if(this.w!==w||this.h!==h){
            this.w=w;this.h=h;this.renderer.setSize(w,h,false);
            Object.assign(this.camera,{left:-w/2,right:w/2,top:h/2,bottom:-h/2});this.camera.updateProjectionMatrix();
        }
        this.root.position.copy(current.position);this.root.quaternion.copy(current.rotation);this.root.scale.copy(current.scale);
        this.jawUniform.value=current.jawAngle;
        this.renderer.render(this.scene,this.camera);
        ctx.save();ctx.globalAlpha*=options.fit?.opacity??1;
        ctx.drawImage(this.renderer.domElement,0,0,w,h);ctx.restore();
        const hitTargets=FACIAL_BONES.map(b=>{
            const anchor=[...BONES_3D[b.kind]];if(b.side==='right')anchor[0]*=-1;
            const point=projectSkullPoint(anchor,current,w,h,b.kind==='mandible');
            return {...b,center:point,type:'node',radius:Math.max(8,current.scale.x*.022),group:'3D skull · estimated anatomical region'};
        });
        const mode=options.labelMode??'clean';
        const visible=mode==='detailed'?hitTargets:hitTargets.filter(b=>['zygomatic','maxilla','nasal','mandible'].includes(b.kind)&&b.side!=='left');
        const labels=mode==='off'?[]:visible.map((b,i)=>({text:b.name+(b.deep?' (deep)':''),point:b.center,priority:i}));
        const bounds=options.visibleBounds||{left:18,top:18,right:w-18,bottom:h-18};
        // Labels use projected 3D anchors, so they follow rotation with the mesh.
        drawAtlasLabels(ctx,labels,bounds,{point:(_x,y)=>projectSkullPoint([0,1-y,.3],current,w,h)});
        if((options.fit?.opacity??1)<.8) {
            ctx.save();ctx.strokeStyle='#57e9dc';ctx.fillStyle='#57e9dc';ctx.lineWidth=1.5;
            for(const anchor of [SKULL_ANCHORS.rightEye,SKULL_ANCHORS.leftEye,SKULL_ANCHORS.upperTeeth]) {
                const p=projectSkullPoint(anchor,current,w,h);ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.stroke();
            }ctx.restore();
        }
        return {hitTargets};
    }
    dispose(){
        this.disposed=true;
        this.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.aoMap?.dispose();o.material.dispose();}});
        this.renderer.dispose();this.renderer.forceContextLoss();
    }
}
