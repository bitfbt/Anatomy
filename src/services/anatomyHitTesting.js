function segmentDistance(point,a,b) {
    if (!a || !b) return Infinity;
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length ? Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)) : 0;
    return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}

export function findAnatomyHit(point,targets) {
    if(!point)return null;
    // Labels are drawn over anatomy. Prefer the topmost visible label box to
    // the underlying bone, and use its final layout rather than its leader tip.
    for(const target of [...targets].reverse()){
        const r=target.rect;
        if(target.type==='label'&&r&&point.x>=r.x&&point.x<=r.x+r.w&&point.y>=r.y&&point.y<=r.y+r.h)return target;
    }
    let best=null,bestDistance=Infinity;
    for(const target of targets){
        if(target.type==='label')continue;
        const distance=target.type==='node'
            ? Math.hypot(point.x-target.center.x,point.y-target.center.y)
            : segmentDistance(point,target.from,target.to);
        if(distance<=target.radius&&distance<bestDistance){best=target;bestDistance=distance;}
    }
    return best;
}
