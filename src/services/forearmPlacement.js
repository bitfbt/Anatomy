import {trackImagePoints} from './fingerMotion.js';

const finite = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const distance = (a,b,w,h) => Math.hypot((a.x-b.x)*w,(a.y-b.y)*h);
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];

function geometry(hand,w,h,bounds) {
    if (!Array.isArray(hand) || hand.length!==21 || !hand.every(finite)
        || ![w,h,bounds?.left,bounds?.top,bounds?.right,bounds?.bottom].every(Number.isFinite)
        || w<=0 || h<=0) return null;
    const inside=p=>p.x*w>=bounds.left&&p.x*w<=bounds.right&&p.y*h>=bounds.top&&p.y*h<=bounds.bottom;
    if (!inside(hand[0]) || [5,9,13,17].filter(i=>inside(hand[i])).length<3) return null;
    const span=distance(hand[5],hand[17],w,h), palm=distance(hand[0],hand[9],w,h);
    if(span<8||palm<5||span/palm<.3||span/palm>2.5)return null;
    return {wrist:hand[0],span,palm};
}

// Placement is separate from measured pose tracking. A missing body detection
// still gets a connected teaching preview, explicitly marked as approximate.
// The user can set an actual elbow location instead of relying on that preview.
export class ForearmPlacement {
    constructor(){this.entries=new Map();this.frame=null;this.frameTime=null;}
    reset(){this.entries.clear();this.frame=null;this.frameTime=null;}
    clearManual(){for(const entry of this.entries.values())delete entry.manual;}

    updateFrame(frame,now){
        if(!Number.isFinite(now)){this.reset();return;}
        for(const [id,entry] of this.entries)if(now-entry.seen>1000)this.entries.delete(id);
        for(const entry of this.entries.values()){
            const manual=entry.manual;
            if(!manual?.tracking)continue;
            if(!frame||!this.frame||now<=this.frameTime||now-this.frameTime>250||frame.width!==this.frame.width||frame.height!==this.frame.height){
                manual.tracking=false;continue;
            }
            const x=manual.elbow.x*frame.width,y=manual.elbow.y*frame.height;
            const points=[];
            for(const dx of [-5,0,5])for(const dy of [-5,0,5])points.push({x:x+dx,y:y+dy});
            const matches=trackImagePoints(this.frame,frame,points);
            if(matches.length<4){manual.tracking=false;continue;}
            const dx=median(matches.map(m=>m.to.x-m.from.x)),dy=median(matches.map(m=>m.to.y-m.from.y));
            const agreed=matches.filter(m=>Math.hypot(m.to.x-m.from.x-dx,m.to.y-m.from.y-dy)<1.75);
            if(agreed.length<4||agreed.length<matches.length*.7){manual.tracking=false;continue;}
            manual.elbow={x:manual.elbow.x+dx/frame.width,y:manual.elbow.y+dy/frame.height};
        }
        this.frame=frame;this.frameTime=now;
    }

    setElbow(trackId,elbow,hand,w,h,bounds,now){
        const shape=geometry(hand,w,h,bounds);
        if(!trackId||!shape||!finite(elbow)||!Number.isFinite(now))return false;
        const length=distance(shape.wrist,elbow,w,h);
        if(elbow.x*w<bounds.left||elbow.x*w>bounds.right||elbow.y*h<bounds.top||elbow.y*h>bounds.bottom
            || length<Math.max(20,shape.span*.55)||length>Math.hypot(w,h))return false;
        const entry=this.entries.get(trackId)||{};
        entry.manual={elbow:{...elbow},tracking:!!this.frame};
        entry.w=w;entry.h=h;entry.seen=now;
        this.entries.set(trackId,entry);
        return true;
    }

    resolve(hand,measured,{trackId,w,h,bounds,now}){
        const shape=geometry(hand,w,h,bounds);
        if(!trackId||!shape||!Number.isFinite(now))return measured;
        let entry=this.entries.get(trackId);
        if(!entry||entry.w!==w||entry.h!==h||now-entry.seen>1000||now<entry.seen){
            entry={w,h,seen:now};this.entries.set(trackId,entry);
        }
        entry.seen=now;
        if(entry.manual){
            return {wrist:shape.wrist,elbow:{...entry.manual.elbow},index:`placement-${trackId}`,
                source:entry.manual.tracking?'manual-tracked':'manual-pinned',estimated:!entry.manual.tracking,held:false,ageMs:0};
        }
        if(measured){
            if(!measured.held)entry.reference={span:shape.span,
                offset:{x:measured.elbow.x-shape.wrist.x,y:measured.elbow.y-shape.wrist.y}};
            entry.last=measured;
            return measured;
        }
        if(!entry.reference){
            const length=Math.min(Math.sqrt(shape.palm*2.65*shape.span*3.1),Math.hypot(w,h));
            entry.reference={span:shape.span,offset:{
                x:-(hand[9].x-shape.wrist.x)*length/shape.palm,
                y:-(hand[9].y-shape.wrist.y)*length/shape.palm,
            }};
        }
        const ratio=shape.span/entry.reference.span;
        // Preserve the initial or last observed arm direction when the HAND
        // bends. Do not rotate the entire forearm on every palm rotation.
        entry.last={wrist:shape.wrist,elbow:{x:shape.wrist.x+entry.reference.offset.x*ratio,
            y:shape.wrist.y+entry.reference.offset.y*ratio},index:`placement-${trackId}`,
            source:'approximate',estimated:true,held:false,ageMs:0};
        return entry.last;
    }

    // A short hand-detector blink may reuse an existing placement, but cannot
    // create a new one or extend its lifetime from predicted hand landmarks.
    coast(hand,{trackId,w,h,bounds,now}){
        const entry=this.entries.get(trackId),shape=geometry(hand,w,h,bounds);
        if(!entry||!shape||entry.w!==w||entry.h!==h||!Number.isFinite(now)
            ||now<entry.seen||now-entry.seen>180)return null;
        if(entry.manual)return {wrist:shape.wrist,elbow:{...entry.manual.elbow},index:`placement-${trackId}`,
            source:entry.manual.tracking?'manual-tracked':'manual-pinned',estimated:true,held:true,ageMs:now-entry.seen};
        if(!entry.last)return null;
        const {last}=entry;
        return {...last,wrist:shape.wrist,elbow:{x:shape.wrist.x+last.elbow.x-last.wrist.x,
            y:shape.wrist.y+last.elbow.y-last.wrist.y},estimated:true,held:true,ageMs:now-entry.seen};
    }
}
