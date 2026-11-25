import { readFileSync } from 'node:fs';
const require=()=>({});

const BASE='http://127.0.0.1:3100';
const r0 = await fetch(BASE+'/api/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'10.77.0.1'},body:JSON.stringify({email:'nick@alpha.test',password:'passwordA1!'})});
const cookie = (r0.headers.getSetCookie?.()||[]).map(c=>c.split(';')[0]).join('; ');
const fx = JSON.parse(readFileSync('./fixture.json','utf8'));
const p = fx.projects['Alpha — Kifisia Block A'].id;
const nick = fx.users['nick@alpha.test'];
const body = {date:'2026-11-24',project:p,author:nick,workDescription:'x',weather:'sunny',temperature:22,personnel:[{role:'Mason',count:4,workDetails:'f'}],equipment:[{type:'Excavator',count:1,hours:3}],materials:[{name:'Concrete',quantity:12,unit:'m3'}],notes:'n'};
const r = await fetch(BASE+'/api/worklogs',{method:'POST',headers:{'content-type':'application/json','cookie':cookie,'x-forwarded-for':'10.77.0.2'},body:JSON.stringify(body)});
console.log(r.status, await r.text());
