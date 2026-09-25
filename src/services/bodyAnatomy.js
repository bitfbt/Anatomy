// Pose-aligned educational major structures; hidden joints are never inferred.
export function visibleJoint(p, w = 1, h = 1, bounds = {left:0,top:0,right:w,bottom:h}) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= 0.55
        && p.x*w >= bounds.left && p.x*w <= bounds.right && p.y*h >= bounds.top && p.y*h <= bounds.bottom;
}
export const BODY_SEGMENTS = [
    [11,13,'Humerus','Upper arm muscles',.12], [12,14,'Humerus','Upper arm muscles',.12],
    [13,15,'Radius / ulna','Forearm muscles',.09], [14,16,'Radius / ulna','Forearm muscles',.09],
    [23,25,'Femur','Thigh muscles',.18], [24,26,'Femur','Thigh muscles',.18],
    [25,27,'Tibia / fibula','Lower leg muscles',.12], [26,28,'Tibia / fibula','Lower leg muscles',.12],
    [27,31,'Foot bones','Foot tendons',.06], [28,32,'Foot bones','Foot tendons',.06],
    [15,19,'Hand region','Hand tendons',.045], [16,20,'Hand region','Hand tendons',.045],
];
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export function drawBodyAnatomy(ctx, landmarks, w, h, {layer='skeleton',labelMode='off',visibleBounds}={}) {
    const bounds=visibleBounds || {left:0,top:0,right:w,bottom:h};
    if (!Array.isArray(landmarks) || landmarks.length !== 33) return {count:0,partial:true};
    const visible=i=>visibleJoint(landmarks[i],w,h,bounds);
    const p=i=>({x:landmarks[i].x*w,y:landmarks[i].y*h});
    const torso=[11,12,23,24].every(visible);
    const span=visible(11)&&visible(12)?Math.hypot(p(11).x-p(12).x,p(11).y-p(12).y):w*.18;
    const unit=Math.max(20,span), muscle=layer==='muscles';
    const labels=[]; let count=0;
    const line=(a,b,width,color)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineCap='round';ctx.stroke();};
    const bone=(a,b,width)=>{
        line(a,b,width+2,'#8e8064');line(a,b,width,'#d9ceb0');line(a,b,width*.40,'#f2ead5');
        for(const q of [a,b]) {ctx.beginPath();ctx.ellipse(q.x,q.y,width*.66,width*.55,0,0,Math.PI*2);ctx.fillStyle='#dfd3b6';ctx.fill();}
    };
    const tissue=(a,b,width)=>{
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy); if(len<2)return;
        const nx=-dy/len,ny=dx/len;
        ctx.beginPath();ctx.moveTo(a.x,a.y);
        ctx.bezierCurveTo(a.x+nx*width,a.y+ny*width,b.x+nx*width*.7,b.y+ny*width*.7,b.x,b.y);
        ctx.bezierCurveTo(b.x-nx*width*.7,b.y-ny*width*.7,a.x-nx*width,a.y-ny*width,a.x,a.y);
        const grad=ctx.createLinearGradient(a.x-nx*width,a.y-ny*width,a.x+nx*width,a.y+ny*width);
        grad.addColorStop(0,'#713c39');grad.addColorStop(.5,'#d39180');grad.addColorStop(1,'#8b4944');ctx.fillStyle=grad;ctx.fill();
        ctx.save();ctx.clip();
        for(let i=-8;i<=8;i++){const o=i*width/10;line({x:a.x+nx*o,y:a.y+ny*o},{x:b.x+nx*o*.65,y:b.y+ny*o*.65},.7,'#e2ae9b');}ctx.restore();
        line(mix(a,b,.90),b,Math.max(2,width*.16),'#e9e1d0');
    };
    ctx.save();ctx.globalAlpha*=.94;
    for(const [a,b,boneName,muscleName,width] of BODY_SEGMENTS){
        if(!visible(a)||!visible(b))continue;
        const from=p(a),to=p(b); count++;
        if(muscle)tissue(from,to,unit*width);
        else if(boneName.includes('/')){
            const length=Math.hypot(to.x-from.x,to.y-from.y)||1;
            const nx=-(to.y-from.y)/length*unit*.025,ny=(to.x-from.x)/length*unit*.025;
            for(const sign of [-1,1])bone({x:from.x+nx*sign,y:from.y+ny*sign},{x:to.x+nx*sign,y:to.y+ny*sign},unit*.024);
        }else bone(from,to,unit*.045);
        labels.push({text:muscle?muscleName:boneName,point:mix(from,to,.5)});
    }
    if(torso){
        const shoulders=mix(p(11),p(12),.5),hips=mix(p(23),p(24),.5);
        const at=(x,y)=>mix(mix(p(11),p(23),y),mix(p(12),p(24),y),x);
        if(muscle){
            for(const side of [0,1]){
                tissue(at(.5,.16),at(side,.23),unit*.20);
                tissue(at(side,.35),at(side*.8+.1,.90),unit*.12);
            }
            for(let row=0;row<4;row++)for(const col of [.42,.58])tissue(at(col,.38+row*.13),at(col,.48+row*.13),unit*.075);
            labels.push({text:'Chest muscles',point:at(.5,.2)},{text:'Abdominal muscles',point:at(.5,.65)});
        }else{
            bone(p(11),mix(shoulders,hips,.09),unit*.03);bone(p(12),mix(shoulders,hips,.09),unit*.03);
            for(let i=0;i<16;i++)bone(mix(shoulders,hips,i/18),mix(shoulders,hips,(i+.5)/18),unit*.055);
            for(let rib=0;rib<7;rib++)for(const side of [0,1]){
                const y=.12+rib*.075;const start=at(.5,y);const end=at(.5,y+.10);const edge=at(side===0?.08:.92,y+.055);
                ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.quadraticCurveTo(edge.x,edge.y,end.x,end.y);ctx.lineWidth=unit*.026;ctx.strokeStyle='#e0d5b8';ctx.stroke();
            }
            for(const side of [0,1]){const hip=p(side===0?23:24);bone(at(side,.79),hip,unit*.10);bone(hip,at(.5,1.10),unit*.065);}
            labels.push({text:'Rib cage',point:at(.5,.35)},{text:'Pelvis',point:hips});
        }count++;
    }
    if(labelMode!=='off'){
        const used=new Set(); let lastY=-Infinity;
        for(const label of labels.sort((a,b)=>a.point.y-b.point.y)){
            if(labelMode==='clean'&&used.has(label.text))continue;
            const y=Math.max(bounds.top+16,label.point.y); if(y-lastY<23)continue;
            ctx.font='12px sans-serif';const width=ctx.measureText(label.text).width+12;
            const x=Math.max(bounds.left,Math.min(bounds.right-width,label.point.x+unit*.10));
            if(y>bounds.bottom-5)continue;
            ctx.fillStyle='rgba(14,30,26,.85)';ctx.fillRect(x,y-15,width,20);ctx.fillStyle='#eff3e8';ctx.fillText(label.text,x+6,y);
            used.add(label.text);lastY=y;
        }
    }
    ctx.restore();
    return {count,partial:![11,12,13,14,15,16,23,24,25,26,27,28,31,32].every(visible)};
}
