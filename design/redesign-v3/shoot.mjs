import { chromium } from "/tmp/pw/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const D="/workspace/sixinthetpk-review/redesign-v3/";
const pages=["landing","signin","playdates","campaign","polls","invites","playdates#menu","playdates-night","campaign-night","invites-night","playdates-night#menu"];
for (const vp of [[390,844],[1280,800]]) { const ctx=await b.newContext({viewport:{width:vp[0],height:vp[1]},deviceScaleFactor:vp[0]==390?3:1,isMobile:vp[0]==390,hasTouch:vp[0]==390,colorScheme:"dark"});
 for (const pg of pages){ const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  const [f,h]=pg.split("#"); await p.goto("file://"+D+f+".html"+(h?"#"+h:"")); await p.waitForTimeout(400);
  const r=await p.evaluate(()=>{const hd=document.querySelector(".hdr");const h1=document.querySelector("h1");const hb=getComputedStyle(hd).position=="sticky"?hd.getBoundingClientRect().bottom:0;
   const signins=[...document.querySelectorAll("a,button")].filter(e=>/sign in/i.test(e.textContent)&&e.offsetWidth).length;
   const ov=document.documentElement.scrollWidth-innerWidth; const bad=[...document.querySelectorAll("a,button")].filter(e=>e.offsetWidth&&(e.getBoundingClientRect().height<44||e.getBoundingClientRect().width<44)&&!e.closest(".foot")&&getComputedStyle(e).visibility!="hidden"&&!(e.closest("#menu")&&location.hash!="#menu")).map(e=>e.textContent.trim().slice(0,20));
   const brands=[...document.querySelectorAll(".brand")].filter(e=>e.offsetWidth).length;
   return {theme:document.documentElement.dataset.theme,h1top:h1&&h1.getBoundingClientRect().top,hb,ov,signins,brands,bad:bad.slice(0,5)}});
  console.log(vp[0],pg,JSON.stringify(r),errs.join("|"));
  const n=pg.replace("#","-"); await p.screenshot({path:`${D}shots/${n}-${vp[0]}.png`,fullPage:false}); if(!h) await p.screenshot({path:`${D}shots/${n}-${vp[0]}-full.png`,fullPage:true}); await p.close();}
 await ctx.close();}
await b.close();
