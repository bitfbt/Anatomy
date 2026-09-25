// Educational anterior projection. Inventory and relationships:
// https://openstax.org/books/anatomy-and-physiology/pages/7-2-the-skull
// Six paired facial bones plus mandible and vomer = 14. The frontal bone
// provides cranial context and is deliberately excluded from that count.
const PAIRS = [
    ['maxilla', 'Maxilla', 'Upper jaw and inferior orbital rim.'],
    ['zygomatic', 'Zygomatic bone', 'Cheek prominence and lateral orbital rim.'],
    ['nasal', 'Nasal bone', 'Bony bridge of the nose.'],
    ['lacrimal', 'Lacrimal bone', 'Small plate in the medial orbital wall.'],
    ['concha', 'Inferior nasal concha', 'Curled bone on the lateral nasal wall.'],
    ['palatine', 'Palatine bone', 'Forms the posterior hard palate and a small part of the orbital floor. The deep orbital contribution is shown as a schematic cutaway.'],
];
export const FACIAL_BONES = [
    ...PAIRS.flatMap(([kind, name, explanation]) => ['right', 'left'].map(side => ({
        id: `${kind}-${side}`, kind, side, name: `${side === 'left' ? 'Left' : 'Right'} ${name.toLowerCase()}`,
        explanation, deep: kind === 'palatine',
    }))),
    { id: 'mandible', kind: 'mandible', name: 'Mandible', explanation: 'Single lower jaw bone; follows the tracked chin and lower mouth.' },
    { id: 'vomer', kind: 'vomer', name: 'Vomer', explanation: 'Midline bone of the posterior-inferior nasal septum.' },
];

// Coordinates in a face-oriented frame: x = half face width, y = forehead–chin.
// Plates meet at sutures; the orbital and nasal apertures remain open spaces.
const SHAPES = {
    frontal: [[-.92,.31],[-.93,.21],[-.80,.105],[-.48,.025],[0,-.015],[.48,.025],[.80,.105],[.93,.21],[.92,.31],[.76,.29],[.55,.26],[.31,.28],[.15,.34],[0,.35],[-.15,.34],[-.31,.28],[-.55,.26],[-.76,.29]],
    zygomatic: [[.78,.30],[.94,.33],[1,.47],[.96,.58],[.82,.61],[.61,.56],[.48,.49],[.67,.47],[.78,.40]],
    maxilla: [[.13,.36],[.24,.45],[.46,.48],[.69,.47],[.78,.54],[.61,.61],[.49,.70],[.32,.745],[.01,.73],[.01,.64],[.20,.615],[.22,.53],[.13,.45]],
    nasal: [[.01,.345],[.115,.355],[.15,.46],[.04,.49],[.005,.475]],
    lacrimal: [[.19,.35],[.25,.365],[.26,.425],[.205,.45],[.17,.405]],
    concha: [[.17,.535],[.19,.585],[.11,.62],[.045,.595],[.095,.57]],
    palatine: [[.25,.425],[.31,.44],[.28,.475],[.22,.46]],
    vomer: [[0,.48],[.035,.535],[.035,.624],[0,.65],[-.035,.624],[-.035,.535]],
    mandible: [[-.91,.55],[-.80,.57],[-.72,.72],[-.55,.81],[-.43,.80],[-.40,.78],[0,.80],[.40,.78],[.43,.80],[.55,.81],[.72,.72],[.80,.57],[.91,.55],[.85,.77],[.66,.92],[.35,.985],[0,1],[-.35,.985],[-.66,.92],[-.85,.77]],
    parietal: [[.50,.02],[.81,.09],[.98,.21],[1.0,.33],[.91,.32],[.91,.20],[.78,.11],[.50,.04]],
    temporal: [[.96,.31],[1.02,.35],[1.04,.50],[.99,.65],[.86,.68],[.90,.57],[.98,.46]],
    sphenoid: [[.27,.38],[.39,.345],[.48,.37],[.63,.365],[.70,.405],[.63,.46],[.42,.465],[.28,.445]],
    ethmoid: [[.14,.35],[.20,.36],[.23,.43],[.16,.47],[.12,.43]],
    septum: [[0,.40],[.024,.48],[.025,.56],[0,.59],[-.025,.56],[-.024,.48]],
};

export const SKULL_PALETTE = {
    frontal: ['#f3e6c7','#c9b58c','#78613e'], parietal: ['#e5d6b2','#baa279','#725b3b'],
    temporal: ['#deceaa','#ad946d','#655033'], sphenoid: ['#bca579','#7e6843','#3d2e19'],
    ethmoid: ['#c4b18a','#917b52','#4f3e23'], septum: ['#d4c39b','#a48d61','#5a472a'],
    zygomatic: ['#f1e2ba','#c4ad7e','#80683e'], maxilla: ['#eeddb4','#c6b083','#81683e'],
    nasal: ['#f1e4c5','#c9b78c','#87704a'], lacrimal: ['#dfcba2','#af9569','#685130'],
    concha: ['#bda780','#8a734b','#45341d'], palatine: ['#baa276','#8e744c','#554023'],
    vomer: ['#ddcaa3','#a99163','#68502e'], mandible: ['#e8d9b8','#beaa80','#78613e'],
    tooth: ['#fff5de','#e6d7b6','#9e8965'],
};

const FEATURES = [
    ['Coronal suture',-.82,.13], ['Glabella',0,.30], ['Supraorbital foramen',-.50,.275],
    ['Supraorbital margin',-.62,.285], ['Orbit',.49,.34], ['Optic canal',.31,.39],
    ['Superior orbital fissure',.43,.38], ['Inferior orbital fissure',.48,.46],
    ['Infraorbital foramen',.41,.54], ['Middle nasal concha',.105,.52],
    ['Perpendicular plate of ethmoid',-.012,.49],
    ['Alveolar process of maxilla',-.40,.70], ['Alveolar process of mandible',.40,.83],
    ['Mental foramen',-.38,.91],
];

export function createFaceSkeleton(landmarks, width, height) {
    if (!Array.isArray(landmarks) || landmarks.length < 468 || !(width > 0 && height > 0)
        || landmarks.some(p => !Number.isFinite(p?.x) || !Number.isFinite(p?.y))) return null;
    const pixel = i => ({ x: landmarks[i].x * width, y: landmarks[i].y * height });
    const top = pixel(10), chin = pixel(152), a = pixel(234), b = pixel(454);
    const length = Math.hypot(chin.x - top.x, chin.y - top.y);
    const halfWidth = Math.hypot(b.x - a.x, b.y - a.y) / 2;
    if (length < 2 || halfWidth < 2) return null;
    const down = { x: (chin.x - top.x) / length, y: (chin.y - top.y) / length };
    let across = { x: down.y, y: -down.x };
    if ((b.x - a.x) * across.x + (b.y - a.y) * across.y < 0) across = { x: -across.x, y: -across.y };
    const local = i => {
        const p = pixel(i), dx = p.x - top.x, dy = p.y - top.y;
        return { x: (dx * across.x + dy * across.y) / halfWidth, y: (dx * down.x + dy * down.y) / length };
    };
    // Use mouth/chin motion without letting eyelid closure flatten the sockets.
    const upper = Math.max(.60, Math.min(.78, local(13).y));
    const lower = Math.max(upper + .045, Math.min(.89, local(14).y));
    const warpY = y => y <= .60 ? y : y <= .715
        ? .60 + (y - .60) / .115 * (upper - .60)
        : y <= .80 ? upper + (y - .715) / .085 * (lower - upper)
        : lower + (y - .80) / .20 * (1 - lower);
    const point = (x, y) => ({ x: top.x + across.x * x * halfWidth + down.x * warpY(y) * length,
        y: top.y + across.y * x * halfWidth + down.y * warpY(y) * length });
    const plate = (kind, sign = 1) => SHAPES[kind].map(([x,y]) => point(x * sign, y));
    const bones = FACIAL_BONES.map(bone => {
        const points = plate(bone.kind, bone.side === 'right' ? -1 : 1);
        const center = bone.kind === 'mandible' ? chin : {
            x: points.reduce((sum,p) => sum+p.x,0)/points.length,
            y: points.reduce((sum,p) => sum+p.y,0)/points.length,
        };
        return { ...bone, points, center };
    });
    const sockets = [-1,1].map(sign => {
        const ids = sign < 0 ? [33,133] : [362,263];
        const p = local(ids[0]), q = local(ids[1]);
        const cx = (p.x+q.x)/2, cy = Math.max(.29, Math.min(.42,(p.y+q.y)/2));
        const rx = Math.max(.20, Math.min(.31, Math.abs(p.x-q.x)*.70));
        const ry = .115;
        return Array.from({length:24},(_,i) => {
            const angle = i/24*Math.PI*2;
            return point(cx+Math.cos(angle)*rx,cy+Math.sin(angle)*ry);
        });
    });
    const cranial = [
        {id:'frontal',kind:'frontal',name:'Frontal bone',points:plate('frontal'),center:point(0,.16)},
        ...['parietal','temporal'].flatMap(kind=>[-1,1].map(sign=>({
            id:`${kind}-${sign}`,kind,name:`${sign<0?'Right':'Left'} ${kind} bone`,
            points:plate(kind,sign),center:point(sign*.96,kind==='parietal'?.23:.55),
        }))),
        ...['sphenoid','ethmoid'].map(kind=>({
            id:kind,kind,name:`${kind[0].toUpperCase()+kind.slice(1)} bone`,
            points:plate(kind),pairedPoints:plate(kind,-1),center:point(kind==='sphenoid'?-.47:-.18,.41),
        })),
    ];
    const features=FEATURES.map(([name,x,y])=>({id:name,name,center:point(x,y),group:'Skull landmark',explanation:`${name}: schematic anatomical feature, not an additional facial bone.`}));
    return { bones, cranial, features, frontal: plate('frontal'), sockets, point, length, halfWidth, across, down };
}

function contour(ctx, points) {
    ctx.beginPath();
    const last = points[points.length-1], first = points[0];
    ctx.moveTo((last.x+first.x)/2,(last.y+first.y)/2);
    points.forEach((p,i) => {
        const next=points[(i+1)%points.length];
        ctx.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);
    });
    ctx.closePath();
}

export function renderFaceSkeleton(ctx, landmarks, w, h, options = {}) {
    const model = createFaceSkeleton(landmarks,w,h);
    if (!model) return { hitTargets: [], labels: [] };
    const detailed = options.labelMode === 'detailed';
    ctx.save();
    const shade = (points, kind='frontal', deep=false) => {
        contour(ctx,points);
        const top=points.reduce((a,b)=>a.y<b.y?a:b), bottom=points.reduce((a,b)=>a.y>b.y?a:b);
        const center={x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length};
        const radius=Math.max(...points.map(p=>Math.hypot(p.x-center.x,p.y-center.y)),1);
        const gradient=ctx.createRadialGradient(center.x-radius*.28,center.y-radius*.32,radius*.04,center.x,center.y,radius*1.15);
        const colors=SKULL_PALETTE[kind];
        gradient.addColorStop(0,colors[0]);
        gradient.addColorStop(.55,colors[1]);
        gradient.addColorStop(1,colors[2]);
        ctx.fillStyle=gradient;
        ctx.fill();
        // Local surface shading and deterministic pores stay attached to the
        // plate as it moves; no frame-random noise or flickering texture.
        ctx.save();contour(ctx,points);ctx.clip();
        const side=ctx.createLinearGradient(center.x-radius,center.y,center.x+radius,center.y);
        side.addColorStop(0,'rgba(47,30,12,.31)');side.addColorStop(.4,'rgba(255,246,216,.12)');
        side.addColorStop(.68,'rgba(255,246,216,0)');side.addColorStop(1,'rgba(43,28,12,.25)');
        ctx.fillStyle=side;ctx.fillRect(center.x-radius,top.y-radius*.1,radius*2,bottom.y-top.y+radius*.2);
        if(kind!=='tooth') {
            const grainCount=kind==='frontal'?200:45;
            for(let i=0;i<grainCount;i++) {
                const angle=i*2.399963, r=radius*Math.sqrt((i+.5)/grainCount);
                // Face-oriented coordinates preserve grain under head roll.
                const u=Math.cos(angle)*r,v=Math.sin(angle)*r;
                const x=center.x+model.across.x*u+model.down.x*v,y=center.y+model.across.y*u+model.down.y*v;
                ctx.beginPath();ctx.ellipse(x,y,Math.max(.3,model.halfWidth*(.0015+(i%4)*.0005)),Math.max(.2,model.halfWidth*.0012),Math.atan2(model.across.y,model.across.x),0,Math.PI*2);
                ctx.fillStyle=i%3===0?'rgba(252,237,202,.25)':'rgba(65,45,20,.13)';ctx.fill();
            }
        }
        ctx.restore();contour(ctx,points);
        const facial=FACIAL_BONES.some(b=>b.kind===kind);
        ctx.strokeStyle=facial?'rgba(219,188,105,.85)':kind==='tooth'?'#95815d':'rgba(97,77,44,.50)';
        ctx.lineWidth=Math.max(.65,model.halfWidth*(facial?.0045:.0025));
        ctx.setLineDash(deep?[4,3]:[]);
        ctx.stroke();
        ctx.setLineDash([]);
    };
    model.cranial.filter(b=>['parietal','temporal'].includes(b.kind)).forEach(b=>shade(b.points,b.kind));
    shade(model.frontal,'frontal');
    // Dark recessed cavities, not a solid plate covering the entire face.
    for (const socket of model.sockets) {
        const center={x:socket.reduce((sum,p)=>sum+p.x,0)/socket.length,y:socket.reduce((sum,p)=>sum+p.y,0)/socket.length};
        const recess=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,model.halfWidth*.35);
        recess.addColorStop(0,'#110e08');recess.addColorStop(.50,'#302513');recess.addColorStop(.80,'#75603b');recess.addColorStop(1,'#bdab7f');
        contour(ctx,socket); ctx.fillStyle=recess; ctx.fill();
        ctx.strokeStyle='#cfba8b';ctx.lineWidth=model.halfWidth*.014;ctx.stroke();
    }
    model.cranial.filter(b=>b.pairedPoints).forEach(b=>{shade(b.points,b.kind);shade(b.pairedPoints,b.kind);});
    const nasal=[[-.02,.455],[-.17,.51],[-.20,.60],[0,.65],[.20,.60],[.17,.51],[.02,.455]].map(([x,y])=>model.point(x,y));
    contour(ctx,nasal);ctx.fillStyle='#21190e';ctx.fill();
    const visible=model.bones.filter(b=>!b.deep||detailed);
    for (const kind of ['maxilla','zygomatic','nasal','lacrimal','mandible','concha','vomer','palatine']) {
        visible.filter(b=>b.kind===kind).forEach(b=>shade(b.points,b.kind,b.deep));
    }
    shade(SHAPES.septum.map(([x,y])=>model.point(x,y)),'septum');
    // Paired alveolar arches with a curved row of illustrative teeth.
    // Teeth and orbital spaces are not counted as facial bones.
    for (const row of ['upper','lower']) {
        for(let i=0;i<10;i++) {
            const x=(i-4.5)*.092, bow=Math.abs(x)*.045;
            const y=row==='upper'?.70-bow:.845+bow;
            const front=Math.abs(x)<.19, canine=Math.abs(x)>.19&&Math.abs(x)<.29;
            const dy=(row==='upper'?1:-1)*(front?.069:canine?.078:.060);
            const half=front?.047:.042;
            shade([[x-half,y],[x,y+(row==='upper'?-.007:.007)],[x+half,y],[x+half*.90,y+dy*.65],
                [x+half*.55,y+dy],[x-half*.55,y+dy],[x-half*.90,y+dy*.65]].map(([px,py])=>model.point(px,py)),'tooth');
        }
    }
    // Small foramina give the maxilla and jaw readable surface detail.
    for(const sign of [-1,1]) for(const [x,y] of [[.41,.54],[.38,.91]]) {
        const p=model.point(x*sign,y);ctx.beginPath();ctx.arc(p.x,p.y,model.halfWidth*.014,0,Math.PI*2);
        ctx.fillStyle='#4f3d24';ctx.fill();
    }
    for(const sign of [-1,1]) {
        // Optic canal and narrow orbital fissures in the recessed orbital wall.
        const canal=model.point(sign*.31,.39);
        ctx.beginPath();ctx.arc(canal.x,canal.y,model.halfWidth*.018,0,Math.PI*2);ctx.fillStyle='#332714';ctx.fill();
        for(const [x,y,dx,dy] of [[.43,.38,.12,.025],[.48,.46,.16,-.008]]) {
            const a=model.point(sign*x,y),b=model.point(sign*(x+dx),y+dy);
            ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#47351b';ctx.lineWidth=model.halfWidth*.017;ctx.stroke();
        }
        const middle=[[.065,.49],[.12,.48],[.155,.52],[.11,.545],[.06,.525]].map(([x,y])=>model.point(sign*x,y));
        shade(middle,'ethmoid');
        const supra=model.point(sign*.50,.275);
        ctx.beginPath();ctx.arc(supra.x,supra.y,model.halfWidth*.012,0,Math.PI*2);ctx.fillStyle='#8c734e';ctx.fill();
        ctx.beginPath();
        for(let i=0;i<=20;i++) {
            const t=i/20, x=.79+.14*t+Math.sin(i*2.4)*.006, y=.12+.19*t;
            const p=model.point(sign*x,y);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
        }
        ctx.strokeStyle='#786340';ctx.lineWidth=Math.max(.7,model.halfWidth*.003);ctx.stroke();
    }
    ctx.restore();
    const cranial=model.cranial.map(b=>({...b,group:'Cranial bone',explanation:`${b.name}: cranial context, excluded from the 14 facial bones.`}));
    const hitTargets=[...cranial,...visible,...(detailed?model.features:[])].map(b=>({...b,type:'node',radius:Math.max(6,model.halfWidth*(b.deep?.04:.055)),group:b.group||(b.deep?'Deep facial bone · cutaway':'Facial bone')}));
    const labels=(options.labelMode==='off'?[]:detailed?[...cranial,...visible,...model.features]:[cranial[0],...visible.filter(b=>['mandible','maxilla','zygomatic','nasal'].includes(b.kind)&&b.side!=='left')])
        .map((b,i)=>({text:b.name+(b.deep?' · cutaway':''),point:b.center,priority:i}));
    return { hitTargets, labels, model };
}

// Atlas-style label columns: preserve every label and keep text off the face.
export function drawAtlasLabels(ctx, labels, bounds, model) {
    if (!labels.length || !model) return;
    const center=model.point(0,.5), left=[],right=[];
    labels.forEach(label=>(label.point.x<center.x?left:right).push(label));
    const fontSize=Math.max(8,Math.min(11,(bounds.right-bounds.left)/95));
    ctx.save();ctx.font=`${fontSize}px system-ui, sans-serif`;ctx.lineWidth=.9;
    const top=Math.max(bounds.top+20,model.point(0,.08).y), bottom=Math.min(bounds.bottom-20,model.point(0,.95).y);
    for(const [items,side] of [[left,-1],[right,1]]) {
        items.sort((a,b)=>a.point.y-b.point.y);
        items.forEach((label,i)=>{
            const y=top+(bottom-top)*(i+.5)/items.length;
            const x=side<0?bounds.left+8:bounds.right-8;
            const maxWidth=Math.max(95,(bounds.right-bounds.left)*.235);
            const textWidth=Math.min(ctx.measureText(label.text).width,maxWidth);
            const edge=side<0?x+textWidth+8:x-textWidth-8;
            ctx.strokeStyle='rgba(223,207,163,.85)';ctx.beginPath();ctx.moveTo(label.point.x,label.point.y);
            ctx.lineTo(side<0?Math.min(edge+18,label.point.x-8):Math.max(edge-18,label.point.x+8),y);
            ctx.lineTo(edge,y);ctx.stroke();
            ctx.fillStyle='rgba(13,14,12,.88)';ctx.fillRect(side<0?x-4:x-textWidth-4,y-fontSize/2-4,textWidth+8,fontSize+8);
            ctx.fillStyle='#e0c16f';ctx.textBaseline='middle';ctx.textAlign=side<0?'left':'right';ctx.fillText(label.text,x,y,maxWidth);
        });
    }
    ctx.restore();
}
