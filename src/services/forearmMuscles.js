import { FOREARM_ATLAS, FOREARM_OUTLINE, FOREARM_TENDONS } from './forearmAtlasData.js';

// Parse authored paths once; project their control points into the current
// elbow/wrist frame. This also works with canvas mocks without Path2D support.
const cache = new Map();
function commands(path) {
    if (!cache.has(path)) {
        const tokens = path.match(/[MLCQZ]|-?\d+(?:\.\d+)?/g);
        const result = [];
        const counts = {M:2, L:2, C:6, Q:4, Z:0};
        for (let i=0;i<tokens.length;) {
            const op=tokens[i++], values=tokens.slice(i,i+counts[op]).map(Number);
            if (!(op in counts) || values.length!==counts[op] || !values.every(Number.isFinite)) throw new Error('Invalid forearm atlas path');
            result.push([op,values]);i+=counts[op];
        }
        cache.set(path,result);
    }
    return cache.get(path);
}

export function drawForearmMuscles(ctx, hand, at, width, nx, ny, w, h, side) {
    const view=side==='back'?'back':'palm';
    const radialSign=((hand[2].x-hand[17].x)*w*nx+(hand[2].y-hand[17].y)*h*ny)>=0?1:-1;
    const project=(x,y)=>at(y/600,x*width*radialSign/100);
    const unit=width/100;
    const trace=(source,shiftX=0)=>{
        ctx.beginPath();
        for(const [op,v] of commands(source)) {
            const pts=[];
            for(let i=0;i<v.length;i+=2){const p=project(v[i]+shiftX,v[i+1]);pts.push(p.x,p.y);}
            if(op==='M')ctx.moveTo(...pts);
            if(op==='L')ctx.lineTo(...pts);
            if(op==='C')ctx.bezierCurveTo(...pts);
            if(op==='Q')ctx.quadraticCurveTo(...pts);
            if(op==='Z')ctx.closePath();
        }
    };
    const linear=(a,b,stops)=>{
        const pa=project(...a),pb=project(...b),g=ctx.createLinearGradient(pa.x,pa.y,pb.x,pb.y);
        stops.forEach(([position,color])=>g.addColorStop(position,color));return g;
    };
    const fascia='M -60 357 C -38 374 35 371 61 370 L 52 625 L -52 625 Z';
    ctx.save();
    trace(FOREARM_OUTLINE);
    ctx.fillStyle=linear([-100,200],[100,200],[[0,'#a96659'],[.2,'#d49781'],[.7,'#e6b39c'],[1,'#b47060']]);ctx.fill();
    ctx.clip();
    trace(fascia);ctx.fillStyle=linear([0,350],[0,620],[[0,'#b97565'],[.35,'#e0bc9e'],[1,'#dfc9b0']]);ctx.fill();
    // Bone windows between the tendon corridors, with a soft rounded profile.
    for(const [x,sign] of [[39,1],[-37,-1]]) {
        trace(`M ${x} 331 C ${x+sign*13} 409 ${x+sign*10} 516 ${x+sign*5} 567 C ${x} 580 ${x-sign*8} 579 ${x-sign*9} 565 C ${x-sign*9} 500 ${x-sign*4} 418 ${x-sign*6} 350 Z`);
        ctx.fillStyle=linear([x-12,0],[x+12,0],[[0,'#af9b77'],[.5,'#e8d7b6'],[1,'#c0ad89']]);ctx.fill();
    }
    for(const region of FOREARM_ATLAS[view]) {
        const [x0,y0,x1,y1,x2,y2,x3,y3,spread,taper]=region.fiber;
        trace(region.path);
        ctx.fillStyle=linear([region.anchor[0]-32,region.anchor[1]],[region.anchor[0]+32,region.anchor[1]],
            region.tone==='deep'?[[0,'#854c48'],[.45,'#b57368'],[1,'#824942']]:[[0,'#8e4845'],[.24,'#bc6b62'],[.55,'#dda08b'],[.80,'#b96e63'],[1,'#81413e']]);
        ctx.fill();ctx.strokeStyle='rgba(104,53,48,.58)';ctx.lineWidth=Math.max(.45,unit*.75);ctx.stroke();
        ctx.save();ctx.clip();
        // Subtle curved fascicles spread through each independently shaped belly.
        for(let i=-18;i<=18;i++) {
            const f=i/18,offset=f*spread;
            const a=project(x0+offset,y0),b=project(x1+offset*.95,y1),c=project(x2+offset*.65,y2),d=project(x3+f*taper,y3);
            ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(b.x,b.y,c.x,c.y,d.x,d.y);
            ctx.strokeStyle=i%4===0?'rgba(106,48,45,.22)':'rgba(249,198,173,.28)';ctx.lineWidth=Math.max(.4,unit*.65);ctx.stroke();
        }
        // Fine translucent fascia along the belly adds volume without white stripes.
        trace(region.path);ctx.strokeStyle='rgba(239,181,160,.22)';ctx.lineWidth=unit*2;ctx.stroke();ctx.restore();
    }
    // Broad central aponeurosis feeds the finger tendons, with an uneven proximal
    // border so red fibers visibly insert into white connective tissue.
    const sheet=view==='palm'
        ? 'M -33 359 L -23 374 L -17 364 L -9 381 L 0 374 L 7 386 L 17 376 C 17 431 7 482 4 534 L -23 535 C -22 470 -23 414 -33 359 Z'
        : 'M -46 386 L -37 400 L -28 390 L -21 409 L -13 401 L -4 418 L 6 405 C 1 454 -8 492 -9 531 L -35 531 C -35 475 -43 432 -46 386 Z';
    trace(sheet);ctx.fillStyle=linear([-35,0],[17,0],[[0,'#bfb9b0'],[.45,'#eee9e0'],[1,'#d2cbc0']]);ctx.fill();
    for(const [,path,size] of FOREARM_TENDONS[view]) {
        ctx.lineCap='round';ctx.lineJoin='round';
        const origin=commands(path)[0][1];
        const fade=(color)=>linear(origin,[origin[0],origin[1]+44],[[0,'rgba(225,218,204,0)'],[1,color]]);
        trace(path);ctx.lineWidth=(size+1.8)*unit;ctx.strokeStyle=fade('rgba(120,106,91,.34)');ctx.stroke();
        trace(path);ctx.lineWidth=size*unit;ctx.strokeStyle=fade('#e4e0d9');ctx.stroke();
        trace(path,-size*.18);ctx.lineWidth=Math.max(.6,size*.25*unit);ctx.strokeStyle=fade('#fffaf0');ctx.stroke();
        trace(path,size*.22);ctx.lineWidth=Math.max(.4,unit*.6);ctx.strokeStyle=fade('rgba(168,160,152,.50)');ctx.stroke();
    }
    // Keep one retinaculum: the detailed hand renderer draws the palmar band.
    if(view==='back') {
        const band='M -51 570 C -14 586 14 584 53 566 L 52 590 C 15 607 -19 607 -51 594 Z';
        trace(band);ctx.fillStyle='rgba(223,217,205,.93)';ctx.fill();
        for(let i=0;i<5;i++){trace(`M -50 ${574+i*4} Q 2 ${598+i*4} 52 ${570+i*4}`);ctx.lineWidth=unit*.8;ctx.strokeStyle='#f5ece0';ctx.stroke();}
    }
    ctx.restore();
    const labels=FOREARM_ATLAS[view].map(region=>({text:region.name,point:project(...region.anchor)}));
    labels.push({text:view==='palm'?'Flexor tendons':'Extensor tendons',point:project(-7,546)});
    return labels;
}
