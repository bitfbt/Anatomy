import { drawForearmMuscles } from './forearmMuscles.js';
import { createForearmGeometry } from './forearmGeometry.js';
import { muscleLabelTarget } from './muscleInfo.js';
export { matchForearm } from './forearmTracking.js';

// Original educational contours: x points toward the thumb and y runs from
// elbow (0) to wrist (1). The radius has a small disc head, bowed shaft and broad
// wrist surface; the ulna has a broad elbow end and small distal head. These are
// forearm projections, never humerus/upper-arm geometry. OpenStax A&P 8.2.
const FOREARM_BONES = [
    {name:'Ulna', anchor:[-.35,.42], range:[-.70,.01], path:[
        ['M',-.66,0], ['C',-.57,0,-.30,0,-.20,.023],
        ['C',-.12,.046,-.15,.072,-.27,.088],
        ['C',-.17,.090,-.05,.105,-.08,.132],
        ['C',-.11,.160,-.25,.174,-.27,.206],
        ['C',-.30,.326,-.27,.500,-.27,.660],
        ['C',-.27,.810,-.25,.894,-.22,.938],
        ['C',-.18,.961,-.22,.981,-.32,.984],
        ['C',-.39,.985,-.43,.976,-.47,.979],
        ['C',-.48,.988,-.51,.992,-.53,.980],
        ['C',-.55,.960,-.51,.937,-.49,.901],
        ['C',-.45,.767,-.46,.626,-.47,.488],
        ['C',-.49,.357,-.50,.243,-.55,.177],
        ['C',-.61,.124,-.72,.065,-.66,0],
    ]},
    {name:'Radius', anchor:[.37,.45], range:[-.12,.64], path:[
        ['M',.25,.026], ['C',.33,.016,.52,.016,.59,.031],
        ['C',.63,.045,.60,.060,.52,.066],
        ['C',.43,.071,.46,.105,.48,.133],
        ['C',.58,.222,.64,.313,.56,.421],
        ['C',.49,.514,.45,.604,.45,.709],
        ['C',.44,.824,.46,.897,.52,.962],
        ['C',.55,.985,.54,1,.48,1],
        ['C',.44,.995,.41,.985,.36,.983],
        ['C',.22,.977,.01,.986,-.08,.971],
        ['C',-.12,.954,-.08,.919,-.03,.886],
        ['C',.12,.790,.16,.741,.15,.666],
        ['C',.14,.548,.25,.425,.28,.325],
        ['C',.32,.247,.29,.196,.24,.162],
        ['C',.15,.143,.18,.119,.29,.112],
        ['C',.33,.095,.31,.075,.28,.068],
        ['C',.22,.060,.20,.039,.25,.026],
    ]},
];

function drawForearmBones(ctx, project, width) {
    const trace = bone => {
        ctx.beginPath();
        for (const [command,...values] of bone.path) {
            const points=[];
            for(let i=0;i<values.length;i+=2) {
                const point=project(values[i],values[i+1]);
                points.push(point.x,point.y);
            }
            if(command==='M')ctx.moveTo(...points);
            else ctx.bezierCurveTo(...points);
        }
        ctx.closePath();
    };
    ctx.save();
    try {
        ctx.globalAlpha *= .88;
        ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
        for(const bone of FOREARM_BONES) {
            const a=project(bone.range[0],.45),b=project(bone.range[1],.45);
            const density=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
            for(const [stop,color] of [[0,'#dce1d8'],[.2,'#bec8bc'],[.45,'#94a28f'],[.65,'#a9b4a4'],[1,'#dde3d8']])density.addColorStop(stop,color);
            trace(bone);ctx.fillStyle=density;ctx.fill();
            ctx.save();
            try {
                ctx.clip();
                trace(bone);ctx.strokeStyle='rgba(244,247,236,.48)';ctx.lineWidth=Math.max(1.5,width*.055);ctx.stroke();
                // Fixed local grain follows the tracked arm without flickering.
                for(let pass=0;pass<2;pass++) {
                    ctx.beginPath();
                    for(let i=pass;i<100;i+=2) {
                        const u=((i*37)%101)/101,v=((i*61)%103)/103;
                        const x=bone.range[0]+u*(bone.range[1]-bone.range[0]);
                        const y=i%3===0?.15+v*.68:i%2===0?v*.18:.84+v*.16;
                        const start=project(x,y),end=project(x+.015*(u-.5),y+.012);
                        ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);
                    }
                    ctx.lineWidth=Math.max(.35,width*.006);
                    ctx.strokeStyle=pass?'rgba(246,249,236,.27)':'rgba(64,81,63,.18)';ctx.stroke();
                }
            } finally {ctx.restore();}
            trace(bone);ctx.lineWidth=Math.max(.65,width*.010);ctx.strokeStyle='rgba(237,242,229,.85)';ctx.stroke();
        }
    } finally {ctx.restore();}
    return FOREARM_BONES.map(bone=>({text:bone.name,point:project(...bone.anchor)}));
}

export function drawForearm(ctx, hand, match, w, h, {layer='skeleton',side='palm',labelMode='off',visibleBounds,labelCollector}={}) {
    const geometry = createForearmGeometry(hand, match, w, h, {layer});
    if (!geometry) return false;
    const {at, project, width, wristRadial, clipPolygon} = geometry;
    let anatomyLabels;
    ctx.save();
    if (visibleBounds) {
        ctx.beginPath();
        ctx.rect(visibleBounds.left, visibleBounds.top, visibleBounds.right-visibleBounds.left, visibleBounds.bottom-visibleBounds.top);
        ctx.clip();
    }
    // The clip follows the measured wrist orientation instead of slicing the
    // tendons across the elbow axis at a bent wrist. Its short distal overlap is
    // covered by the subsequently drawn palm; the proximal edge stays at elbow.
    ctx.beginPath();
    clipPolygon.forEach((point,index)=>{
        if(index===0)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y);
    });
    ctx.closePath();ctx.clip();
    if(layer==='skeleton'){
        anatomyLabels=drawForearmBones(ctx,project,width);
    }else{
        anatomyLabels = drawForearmMuscles(ctx, hand, at, width, wristRadial.x, wristRadial.y, w, h, side);
    }
    ctx.restore();
    if (labelMode !== 'off') {
        const labels = labelMode === 'detailed' ? anatomyLabels : [{
            text: layer === 'skeleton' ? 'Radius / ulna' : side === 'back' ? 'Forearm extensor group' : 'Forearm flexor group',
            point: at(.4, 0),
        }];
        const request = {labels, center: at(.45, 0), bounds: visibleBounds || {left:0,top:0,right:w,bottom:h}};
        // Defer in the live app so the subsequently rendered hand cannot cover
        // forearm labels. Standalone renderers retain their existing behavior.
        if (Array.isArray(labelCollector)) labelCollector.push(request);
        else drawForearmLabels(ctx, [request]);
    }
    return true;
}

function wrappedLabel(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
        } else line = candidate;
    }
    if (line) lines.push(line);
    return lines;
}

// All anchors and visible bounds use the same translated video coordinates as
// the anatomy canvas. Columns stay at screen edges when the forearm rotates.
export function drawForearmLabels(ctx, requests) {
    const hitTargets = [];
    const groups = new Map();
    for (const {labels, bounds, center} of requests) {
        const key = [bounds.left, bounds.top, bounds.right, bounds.bottom].join(',');
        if (!groups.has(key)) groups.set(key, {bounds, labels: []});
        const group = groups.get(key);
        for (const label of labels) {
            const {point} = label;
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < bounds.left || point.x > bounds.right
                || point.y < bounds.top || point.y > bounds.bottom) continue;
            group.labels.push({...label, side: point.x < center.x ? 'left' : 'right'});
        }
    }
    for (const {bounds, labels} of groups.values()) {
        const areaWidth = bounds.right - bounds.left;
        const areaHeight = bounds.bottom - bounds.top;
        if (areaWidth < 100 || areaHeight < 55 || !labels.length) continue;
        const columnWidth = Math.min(195, areaWidth * .24, (areaWidth - 28) / 2);
        const padding = 6;
        const lineHeight = 14;
        const gap = 6;
        const top = bounds.top + 8;
        const bottom = bounds.bottom - 8;
        const columns = {left: [], right: []};
        const layouts = [];
        ctx.save();
        ctx.beginPath();
        ctx.rect(bounds.left, bounds.top, areaWidth, areaHeight);
        ctx.clip();
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (const label of labels) {
            const lines = wrappedLabel(ctx, label.text, columnWidth - padding * 2);
            columns[label.side].push({...label, lines, height: lines.length * lineHeight + padding * 2});
        }
        // With a horizontal arm, anchors can all land on one side. Balance the
        // columns by moving the closest-to-center anchors before packing rows.
        while (Math.abs(columns.left.length - columns.right.length) > 2) {
            const from = columns.left.length > columns.right.length ? 'left' : 'right';
            const to = from === 'left' ? 'right' : 'left';
            columns[from].sort((a,b) => from === 'left' ? b.point.x-a.point.x : a.point.x-b.point.x);
            const label = columns[from].shift();
            columns[to].push({...label, side: to});
        }
        for (const side of ['left', 'right']) {
            const column = columns[side].sort((a,b) => a.point.y-b.point.y);
            // Small viewports cannot show every name legibly. Keep only complete
            // rows instead of clipping text or overlaying adjacent rows.
            const selected = [];
            let totalHeight = 0;
            for (const label of column) {
                const nextHeight = totalHeight + label.height + (selected.length ? gap : 0);
                if (nextHeight > bottom-top) continue;
                selected.push(label);
                totalHeight = nextHeight;
            }
            let nextY = top;
            for (const label of selected) {
                label.y = Math.max(nextY, Math.min(bottom-label.height, label.point.y-label.height/2));
                nextY = label.y + label.height + gap;
            }
            let previousBottom = bottom;
            for (let i=selected.length-1; i>=0; i--) {
                const label = selected[i];
                label.y = Math.min(label.y, previousBottom-label.height);
                previousBottom = label.y-gap;
                label.width = columnWidth;
                label.x = side === 'left' ? bounds.left+8 : bounds.right-8-columnWidth;
                layouts.push(label);
            }
        }
        // Draw leaders first so no later line crosses a previously drawn name.
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(232,234,213,.83)';
        ctx.fillStyle = 'rgba(240,240,216,.95)';
        for (const label of layouts) {
            const edgeX = label.side === 'left' ? label.x+label.width : label.x;
            const edgeY = label.y + label.height/2;
            const bendX = edgeX + (label.side === 'left' ? 10 : -10);
            ctx.beginPath();
            ctx.moveTo(label.point.x, label.point.y);
            ctx.lineTo(bendX, edgeY);
            ctx.lineTo(edgeX, edgeY);
            ctx.stroke();
            ctx.beginPath();ctx.arc(label.point.x,label.point.y,1.8,0,Math.PI*2);ctx.fill();
        }
        for (const label of layouts) {
            ctx.fillStyle = 'rgba(14,30,26,.92)';
            ctx.fillRect(label.x,label.y,label.width,label.height);
            ctx.strokeStyle = 'rgba(165,187,161,.38)';
            ctx.lineWidth = .7;
            ctx.strokeRect(label.x,label.y,label.width,label.height);
            ctx.fillStyle = '#edf3e8';
            label.lines.forEach((line,i) => ctx.fillText(line,label.x+padding,label.y+padding+i*lineHeight,columnWidth-padding*2));
            const target=muscleLabelTarget(label.text,{x:label.x,y:label.y,w:label.width,h:label.height});
            if(target)hitTargets.push(target);
        }
        ctx.restore();
    }
    return hitTargets;
}
