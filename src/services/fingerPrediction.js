const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

function shape(points) {
    const center={x:points.reduce((sum,p)=>sum+p.x,0)/points.length,
        y:points.reduce((sum,p)=>sum+p.y,0)/points.length};
    const size=Math.sqrt(points.reduce((sum,p)=>sum+(p.x-center.x)**2+(p.y-center.y)**2,0)/points.length);
    return {...center,size,angle:Math.atan2(points.at(-1).y-points[0].y,points.at(-1).x-points[0].x)};
}

function slope(history,values) {
    const times=history.map(sample=>sample.time-history.at(-1).time);
    const mt=times.reduce((sum,t)=>sum+t,0)/times.length,mv=values.reduce((sum,v)=>sum+v,0)/values.length;
    const denominator=times.reduce((sum,t)=>sum+(t-mt)**2,0);
    return denominator ? times.reduce((sum,t,i)=>sum+(t-mt)*(values[i]-mv),0)/denominator : 0;
}

// Use only recent measured/image-supported samples. Predicted points must never
// be appended to this history or renew their own visibility deadline.
export function predictFinger(history,now,maxPredictionMs=300) {
    const recent=history.slice(-5),last=recent.at(-1);
    if(!last)return null;
    const shapes=recent.map(sample=>shape(sample.points)),origin=shapes.at(-1);
    if(origin.size<1)return null;
    const horizon=clamp(now-last.time,0,maxPredictionMs);
    const angles=[shapes[0].angle];
    for(let i=1;i<shapes.length;i++)angles.push(angles.at(-1)+angleDelta(shapes[i].angle,shapes[i-1].angle));
    const limit=Math.max(12,origin.size*.9);
    const dx=clamp(slope(recent,shapes.map(s=>s.x))*horizon,-limit,limit);
    const dy=clamp(slope(recent,shapes.map(s=>s.y))*horizon,-limit,limit);
    const scale=clamp(Math.exp(slope(recent,shapes.map(s=>Math.log(Math.max(1,s.size))))*horizon),.8,1.55);
    const angle=clamp(slope(recent,angles)*horizon,-.35,.35),cosine=Math.cos(angle),sine=Math.sin(angle);
    const apply=p=>({x:origin.x+dx+scale*((p.x-origin.x)*cosine-(p.y-origin.y)*sine),
        y:origin.y+dy+scale*((p.x-origin.x)*sine+(p.y-origin.y)*cosine)});
    return {points:last.points.map(apply),width:last.width*scale};
}

export function fingerDistanceToPoint(points,point) {
    let nearest=Infinity;
    for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
        const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
        nearest=Math.min(nearest,Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy));
    }
    return nearest;
}
