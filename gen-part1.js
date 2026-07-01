const fs=require("fs");
const fp="C:/Users/miken/Desktop/Havoc Software/Freally-Complete-All-Files/src/lyrics/engine/locales/de.json";
const d=JSON.parse(fs.readFileSync(fp,"utf8"));
function au(a,n){const e=new Set(a.map(s=>s.toLowerCase()));let c=0;for(const i of n){if(!e.has(i.toLowerCase())){a.push(i);e.add(i.toLowerCase());c++}}return c}
let t=0;
console.log("Script loaded");