# ---------- LANDING (signed out) ----------
L_CSS='''
.hdr.clear{background:transparent;border:0;backdrop-filter:none;-webkit-backdrop-filter:none;position:absolute;left:0;right:0;color:#FBF8F2}
.hdr.clear .brand i{color:rgba(251,248,242,.75)}
.hero{position:relative}
.hart{position:relative;height:500px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 55%,rgba(0,0,0,.6) 75%,transparent);mask-image:linear-gradient(#000 55%,rgba(0,0,0,.6) 75%,transparent)}
.hart .art{position:absolute;inset:0;width:100%;height:100%}
.hin{position:relative;z-index:2;padding:0 24px 24px;max-width:1120px;margin:-112px auto 0;width:100%}
.hin .eyebrow{color:var(--ver)}
.hin h1{font-size:44px;line-height:48px;margin:12px 0 16px;font-weight:400;letter-spacing:-.03em}
.hin h1 em{font-style:italic;color:var(--ver)}
.hin p{font-size:17px;line-height:26px;color:var(--ink2);margin:0 0 32px;max-width:520px}
.hin .btn.pri{height:56px;padding:0 28px;font-size:16px;width:100%;max-width:340px}
.hin .note{margin-top:16px}
.feat{padding:56px 20px 24px;max-width:1120px;margin:0 auto}
.feat>h2{font-size:30px;line-height:36px;margin:8px 0 32px;max-width:560px}
.fg{display:grid;gap:16px}
.fc{padding:24px;overflow:hidden}
.fc h3{font-size:21px;line-height:28px;margin:12px 0 8px}
.fc p{margin:0;color:var(--ink2);font-size:15px;line-height:22px}
.fi{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--paper2);border:.5px solid var(--rule2);color:var(--ver)}
.vig{margin-top:20px;border-radius:14px;background:var(--paper2);border:.5px solid var(--rule);padding:12px 14px;display:flex;align-items:center;gap:12px;font-size:13.5px}
.vig .dt .dn{font-size:28px;line-height:28px}
.mini{height:120px;border-radius:14px;margin-top:20px;position:relative;overflow:hidden}
.mini .art{position:absolute;inset:0;width:100%;height:100%}
.mini b{z-index:2;position:absolute;left:14px;bottom:10px;z-index:2;color:#FBF8F2;font:500 17px var(--serif)}
.mini::after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,.6))}
.bar{height:8px;border-radius:4px;background:var(--rule);overflow:hidden;margin-top:6px}.bar i{display:block;height:100%;background:var(--ink)}
.pr{font-size:13px;margin-top:12px}.pr div{display:flex;justify-content:space-between}
.foot{max-width:1120px;margin:0 auto;padding:40px 20px calc(48px + var(--safe-b));display:flex;justify-content:space-between;gap:16px;color:var(--ink3);font-size:13px;border-top:.5px solid var(--rule2)}
.quote{max-width:1120px;margin:24px auto 0;padding:40px 20px;text-align:center}
.quote p{font:italic 400 24px/34px var(--serif);margin:0 auto;max-width:640px}
.quote span{display:block;margin-top:12px}
@media(min-width:900px){.hin{padding:0 40px 72px}.hin h1{font-size:76px;line-height:80px;max-width:820px}.hin p{font-size:19px;line-height:30px}.hin .btn.pri{width:auto}
.fg{grid-template-columns:repeat(3,1fr)}.feat{padding:96px 40px 40px}.feat>h2{font-size:40px;line-height:48px}.hart{height:600px}.hin{margin-top:-170px}.foot{padding:40px}}
'''
land=f'''<section class="hero"><div class="hart">{cover(7,P["emb"],"tower")}</div><div class="hin">
<div class="eyebrow">For tabletop groups</div>
<h1>Every session, <em>every saga,</em> in one place.</h1>
<p>Six in the TPK keeps your party's play dates, campaign lore and recaps together. Everyone's in by default; you just say when you can't make it.</p>
<a class="btn pri" href="signin.html">{ic("mail","ic sm")}Sign in with email</a>
<div class="note">No password. Invite‑only — your GM adds you.</div></div></section>
<section class="feat"><div class="eyebrow">How it works</div><h2>Less herding cats. More rolling dice.</h2><div class="fg">
<article class="card fc"><span class="fi">{ic("dates")}</span><h3>Play dates that assume yes</h3><p>The whole party is counted in. Mark yourself out in one tap and the GM sees it instantly.</p>
<div class="vig"><div class="dt"><span class="dw">Thu</span><span class="dn">23</span></div><div style="flex:1"><b style="font-weight:600">Session 14</b><br><span class="status">5 of 6 in</span></div></div></article>
<article class="card fc"><span class="fi">{ic("camp")}</span><h3>Campaigns with a cover</h3><p>Characters, lore and recaps — typed or as a PDF — live with the story they belong to.</p>
<div class="mini">{cover(3,P["tide"],"ship")}<b>The Drowned Crown</b></div></article>
<article class="card fc"><span class="fi">{ic("polls")}</span><h3>Polls for the next arc</h3><p>Float a few dates, let the table vote, lock the winner onto the calendar.</p>
<div class="pr"><div><span>Sat, Nov 7</span><b>5</b></div><div class="bar"><i style="width:83%"></i></div><div style="margin-top:10px"><span>Sun, Nov 8</span><b>2</b></div><div class="bar"><i style="width:33%;background:var(--rule2)"></i></div></div></article>
</div></section>
<section class="quote"><p>“Finally, nobody asks ‘wait, are we playing this week?’ in the group chat.”</p><span class="note">— a very tired Dungeon Master</span></section>
<footer class="foot"><span>© 2026 · Invite-only tables</span><span>Made for the table</span></footer>'''
page('landing.html','Six in the TPK — Campaigns and play dates for your table',land,L_CSS,f'<header class="hdr clear">{BRAND.replace("#1D1915","#1D1915")}</header>')

# ---------- SIGN IN ----------
S_CSS='''
.sw{min-height:calc(100svh - 56px);display:grid}
.sart{position:relative;height:200px;overflow:hidden;margin:0 0 -48px}
.sart .art{position:absolute;inset:0;width:100%;height:100%}
.sart::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,var(--bg))}
.sp-in{position:relative;z-index:2;padding:0 20px 48px;max-width:440px;width:100%;margin:0 auto}
.sp-in h1{font-size:34px;line-height:40px;margin:8px 0 12px}
.sp-in>p{color:var(--ink2);margin:0 0 32px;font-size:16px;line-height:24px}
.form{padding:24px}
label{display:block;font:600 13px/16px var(--ui);margin-bottom:8px}
.inp{width:100%;height:52px;border-radius:12px;border:1px solid var(--rule2);background:var(--field);padding:0 16px;font-size:17px;outline:none;box-shadow:0 1px 2px rgba(60,40,20,.05) inset}
.inp:focus{border-color:var(--ink);box-shadow:0 0 0 4px rgba(29,25,21,.08)}
.form .btn{width:100%;margin-top:16px;height:52px}
.steps{list-style:none;padding:0;margin:32px 0 0;display:grid;gap:16px}
.steps li{display:flex;gap:16px;align-items:flex-start;font-size:14.5px;color:var(--ink2);line-height:22px}
.steps b{font:500 20px/22px var(--serif);color:var(--ver);min-width:16px}
@media(min-width:900px){.sw{grid-template-columns:1.1fr 1fr;min-height:calc(100vh - 68px)}.sart{height:auto;margin:0;order:2;border-radius:0}.sart::after{background:linear-gradient(90deg,var(--bg),transparent 25%)}.sp-in{align-self:center;padding:48px}.sp-in h1{font-size:44px;line-height:52px}}
'''
si=f'''<div class="sw"><div class="sart">{cover(11,P["wood"],"tree")}</div><div class="sp-in">
<div class="eyebrow">Welcome back, adventurer</div><h1>Sign in with email</h1>
<p>We'll send a one‑tap link. No password, no Google account — and you only see the campaigns you're invited to.</p>
<form class="card form" onsubmit="return false"><label for="e">Email</label><input id="e" class="inp" type="email" placeholder="you@example.com" autocomplete="email" inputmode="email">
<button class="btn pri">Email me a sign‑in link {ic("arrow","ic sm")}</button></form>
<ol class="steps"><li><b>1</b>Open the email on this device.</li><li><b>2</b>Tap the link — you're in for 30 days.</li></ol></div></div>'''
page('signin.html','Sign in · Six in the TPK',si,S_CSS,f'<header class="hdr">{BRAND}</header>')

# ---------- PLAY DATES ----------
D_CSS='''
.next{overflow:hidden;margin-bottom:32px}
.next .cover{height:168px}
.next .ctop{position:absolute;left:20px;right:72px;bottom:16px;z-index:2;color:#FBF8F2}
.next .ctop .eyebrow{color:#E9C98E}
.next .ctop h2{font-size:26px;line-height:30px;margin-top:4px}
.nb{padding:20px;display:grid;gap:20px}
.when{display:flex;gap:20px;align-items:center}
.when .meta{display:grid;gap:4px;font-size:14.5px;color:var(--ink2)}
.when .meta div{display:flex;gap:8px;align-items:center}.when .meta .ic{width:16px;height:16px;color:var(--ink3)}
.vr{width:.5px;align-self:stretch;background:var(--rule2)}
.ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.acts{display:flex;gap:8px;flex-wrap:wrap}
.sec-h{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 12px}
.sec-h h2{font-size:22px;line-height:28px}
.list{overflow:hidden}
.row{display:flex;gap:16px;align-items:center;padding:16px 20px;min-height:84px}
.row+.row{border-top:.5px solid var(--rule)}
.row .t{flex:1;min-width:0}
.row .t b{display:block;font:500 17px/24px var(--serif)}
.row .t span{font-size:13.5px;color:var(--ink3)}
.thumb{width:56px;height:56px;border-radius:12px;overflow:hidden;position:relative;flex:none}
.thumb .art{position:absolute;inset:0;width:100%;height:100%}
.stack{display:flex}.stack .av{width:26px;height:26px;font-size:10px;margin-left:-8px;box-shadow:0 0 0 2px var(--paper)}.stack .av:first-child{margin-left:0}
.stack .av.o{filter:grayscale(1);opacity:.4}
.side{display:none}
#menu{position:fixed;inset:0;z-index:60;display:none}
#menu:target{display:block}
#menu .scrim{position:absolute;inset:0;background:rgba(29,25,21,.28);backdrop-filter:blur(2px)}
.pop{position:absolute;right:12px;top:calc(60px + var(--safe-t));width:288px;padding:8px;border-radius:20px;background:rgba(251,248,242,.96);box-shadow:0 24px 64px -16px rgba(40,25,10,.45),0 0 0 .5px var(--rule2)}
.pop .me{display:flex;gap:12px;align-items:center;padding:12px}
.pop .me b{display:block;font:500 17px var(--serif)}.pop .me span{font-size:13px;color:var(--ink3)}
.pop a{display:flex;gap:12px;align-items:center;height:48px;padding:0 12px;border-radius:12px;font-size:15px}
.pop a:hover{background:var(--paper2)}.pop a .ic{width:20px;height:20px;color:var(--ink2)}
.pop .hair{margin:4px 12px}
.tog{margin-left:auto;width:44px;height:26px;border-radius:13px;background:var(--rule2);position:relative}.tog::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--paper);box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}:root[data-theme=night] .tog{background:var(--ver)}:root[data-theme=night] .tog::after{transform:translateX(18px)}
@media(min-width:900px){.grid{display:grid;grid-template-columns:1fr 320px;gap:32px}.side{display:block}.next .cover{height:240px}.next .ctop h2{font-size:34px;line-height:40px}.pop{top:64px;right:40px}}
'''
ppl=[('Seth','SM','c1',1),('Mara','MA','c2',1),('Jules','JK','c3',1),('Dev','DV','c4',0),('Ana','AR','c5',1),('Theo','TB','c6',1)]
party=''.join(f'<span class="pp {"" if i else "out"}"><span class="av {c}">{a}</span><span>{n}</span></span>' for n,a,c,i in ppl)
def stack(outs=()):
    return '<span class="stack">'+''.join(f'<span class="av {c}{" o" if k in outs else ""}">{n[0]}</span>' for k,(n,a,c,i) in enumerate(ppl))+'</span>'
rows=[(30,'Fri','Oct','Session 15 · The Drowned Crown','7:00 PM · Seth\'s place',3,(),'tide','ship','All 6 in'),
(6,'Fri','Nov','Session 7 · Ashes of Emberfall','7:30 PM · Discord',7,(1,),'emb','tower','5 of 6 in'),
(13,'Fri','Nov','Session 16 · The Drowned Crown','7:00 PM · Seth\'s place',5,(),'tide','ship','All 6 in')]
rh=''.join(f'<a class="row" href="#"><div class="dt"><span class="dw">{w}</span><span class="dn">{d}</span><span class="dm">{m}</span></div><div class="t"><b>{t}</b><span>{s}</span><div style="margin-top:8px;display:flex;gap:12px;align-items:center">{stack(o)}<span class="status{" warn" if o else ""}">{st}</span></div></div><div class="thumb">{cover(sd,P[p],f,"art")}</div></a>' for d,w,m,t,s,sd,o,p,f,st in rows)
pd=f'''<main><div class="ptitle"><div><div class="eyebrow">Tuesday, October 20</div><h1 class="lt">Play dates</h1></div><a class="btn sec sm" href="#">{ic("plus","ic sm")}New</a></div>
<div class="grid"><div>
<article class="card next"><span class="ribbon"></span><div class="cover">{cover(7,P["emb"],"tower")}<div class="ctop"><div class="eyebrow">Up next · in 3 days</div><h2>Ashes of Emberfall</h2></div></div>
<div class="nb"><div class="when"><div class="dt"><span class="dw">Fri</span><span class="dn">23</span><span class="dm">Oct</span></div><span class="vr"></span><div class="meta"><div>{ic("clock")}7:30 – 11:00 PM</div><div>{ic("pin")}Discord · #emberfall-table</div><div>{ic("quill")}Session 6 — The Cinder Vault</div></div></div>
<hr class="hair"><div><div class="ph"><span class="status warn">5 of 6 attending</span><span class="note">Dev is out</span></div><div class="party">{party}</div></div>
<div class="acts"><a class="btn pri sm" href="#">{ic("x","ic sm")}I can't make it</a><a class="btn ghost sm" href="#">Mark someone out</a></div></div></article>
<div class="sec-h"><h2>Coming up</h2><span class="note">Everyone's in unless marked out</span></div>
<div class="card list">{rh}</div></div>
<aside class="side"><div class="card" style="padding:24px"><div class="eyebrow">Open poll</div><h3 style="font-size:20px;line-height:26px;margin:8px 0 8px">Emberfall arc two — pick a Saturday</h3><p class="note" style="margin:0 0 16px">3 of 6 voted · closes Sunday</p><a class="btn sec sm" href="polls.html">Vote {ic("arrow","ic sm")}</a></div>
<div class="card" style="padding:24px;margin-top:16px"><div class="eyebrow">Your campaigns</div>
<a href="campaign.html" style="display:flex;gap:12px;align-items:center;margin-top:16px"><span class="thumb" style="width:44px;height:44px">{cover(7,P["emb"],"tower")}</span><span><b style="font:500 16px var(--serif)">Ashes of Emberfall</b><br><span class="note">GM · 6 sessions</span></span></a>
<a href="campaign.html" style="display:flex;gap:12px;align-items:center;margin-top:12px"><span class="thumb" style="width:44px;height:44px">{cover(3,P["tide"],"ship")}</span><span><b style="font:500 16px var(--serif)">The Drowned Crown</b><br><span class="note">Player · 14 sessions</span></span></a></div></aside></div></main>
<div id="menu"><a class="scrim" href="#" aria-label="Close"></a><div class="pop" role="menu"><div class="me"><span class="av c1" style="width:44px;height:44px">SM</span><div><b>Seth Morrow</b><span>seth@example.com</span></div></div><hr class="hair">
<a href="#">{ic("shield")}Profile &amp; characters</a><a href="#">{ic("link")}Calendar subscription</a><a href="#">{ic("inv")}Notification emails</a><a href="#" role="menuitemcheckbox" aria-checked="false">{ic("moon")}Night theme<span class="tog"></span></a><hr class="hair"><a href="landing.html" style="color:var(--ver)">Sign out</a></div></div>
{tabs("dates")}'''
HD=lambda k:f'<header class="hdr">{BRAND}<span class="sp"></span>{dnav(k)}<a href="#menu" aria-label="Account">{ACCT}</a></header>'
page('playdates.html','Play dates · Six in the TPK',pd,D_CSS,HD("dates"))
page('playdates-night.html','Play dates · Six in the TPK',pd,D_CSS,HD("dates"),'night')

# ---------- CAMPAIGN ----------
C_CSS=D_CSS+'''
main.cm{padding-top:0}
.chero{position:relative;height:420px;margin:0 -20px;overflow:hidden;color:#FBF8F2;display:flex;align-items:flex-end}
.chero .art{position:absolute;inset:0;width:100%;height:100%}
.chero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(10,8,6,.85))}
.chin{position:relative;z-index:2;padding:0 20px 28px;width:100%}
.chin .eyebrow{color:#E9C98E}.chin h1{font-size:40px;line-height:44px;margin:8px 0 12px;font-weight:400;letter-spacing:-.03em}
.chin p{margin:0;color:rgba(251,248,242,.8);font-size:15px;line-height:22px;max-width:560px}
.stats{display:flex;gap:24px;margin-top:20px;font-size:13px;color:rgba(251,248,242,.7)}.stats b{display:block;font:400 22px/28px var(--serif);color:#FBF8F2}
.seg{display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(160,130,90,.12);margin:24px 0 32px;width:fit-content}
.seg a{height:44px;padding:0 16px;display:flex;align-items:center;border-radius:999px;font-size:14px;font-weight:500;color:var(--ink2)}
.seg a.on{background:var(--paper);color:var(--ink);box-shadow:var(--sh)}
.chars{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:40px}
.chr{padding:16px;display:flex;flex-direction:column;gap:12px}
.por{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;color:#FBF8F2;font:500 22px var(--serif)}
.chr b{font:500 17px/22px var(--serif)}.chr span{font-size:13px;color:var(--ink3)}
.recap{padding:24px;margin-bottom:16px;overflow:hidden}
.recap .eyebrow{color:var(--ver)}
.recap h3{font-size:24px;line-height:30px;margin:8px 0 4px}
.recap .by{font-size:13px;color:var(--ink3);margin-bottom:16px}
.recap .body{font:400 17px/28px var(--serif);color:var(--ink);font-variation-settings:"opsz" 14}
.recap .body p{margin:0 0 16px}
.recap .body p:first-child::first-letter{font-size:52px;line-height:44px;float:left;margin:4px 4px 0 0;color:var(--ver);font-weight:500}
.pdf{display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:14px;background:var(--paper2);border:.5px solid var(--rule2);margin-top:8px}
.pdf .pi{width:40px;height:48px;border-radius:6px;background:var(--field);border:.5px solid var(--rule2);display:grid;place-items:center;font:700 9px var(--ui);color:var(--ver);box-shadow:2px 2px 0 var(--rule)}
.pdf div{flex:1;min-width:0}.pdf b{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.older .row{min-height:64px}
.sn{font:400 24px/28px var(--serif);color:var(--ink3);min-width:40px}
@media(min-width:900px){.chero{height:520px;margin:0 -40px;border-radius:0 0 32px 32px}.chin{padding:0 40px 48px}.chin h1{font-size:64px;line-height:68px}.chars{grid-template-columns:repeat(3,1fr)}.cg{display:grid;grid-template-columns:1fr 360px;gap:40px}}
'''
chars=[('Ilsa Vane','Tiefling warlock · Mara','c4','I'),('Brother Oskar','Dwarf cleric · Jules','c3','O'),('Rook','Halfling rogue · Dev','c6','R'),('Sable','Elf ranger · Ana','c2','S'),('Hask','Half-orc barbarian · Theo','c5','H'),('Cinderwick','Kobold sorcerer · NPC','c1','C')]
ch=''.join(f'<div class="card chr"><span class="por {c}">{l}</span><div><b>{n}</b><br><span>{r}</span></div></div>' for n,r,c,l in chars)
cp=f'''<main class="cm"><section class="chero">{cover(7,P["emb"],"tower")}<div class="chin"><div class="eyebrow">Campaign · GM Seth</div><h1>Ashes of Emberfall</h1><p>A city built on a sleeping volcano, a guild of ash-priests, and six strangers who just woke something up.</p>
<div class="stats"><span><b>6</b>sessions</span><span><b>6</b>heroes</span><span><b>Fri 23</b>next up</span></div></div></section>
<nav class="seg"><a class="on" href="#">Recaps</a><a href="#">Characters</a><a href="#">Lore</a></nav>
<div class="cg"><div><div class="sec-h"><h2>Latest recap</h2><a class="btn ghost sm" href="#">{ic("plus","ic sm")}Add</a></div>
<article class="card recap"><span class="ribbon gold" style="right:20px"></span><div class="eyebrow">Session 5 · Oct 16</div><h3>The Bell Beneath the Market</h3><div class="by">Written by Mara · 4 min read</div>
<div class="body"><p>We followed the ash-priest's tracks under the Cinder Market until the tunnels began to hum. Rook found the bell first — or rather, it found him, ringing once when he touched the rope that wasn't there.</p><p>Brother Oskar's ward held for exactly one round. The rest, as they say, is a very expensive healing potion.</p></div>
<div class="pdf"><span class="pi">PDF</span><div><b>Session-5-map-and-notes.pdf</b><span class="note">2.4 MB · 6 pages</span></div><a class="btn sec sm" href="#" aria-label="Download">{ic("down","ic sm")}</a></div></article>
<div class="card list older"><a class="row" href="#"><span class="sn">4</span><div class="t"><b>Ash-priests and Alibis</b><span>Oct 9 · by Jules</span></div></a><a class="row" href="#"><span class="sn">3</span><div class="t"><b>A Wedding, Mostly Uninterrupted</b><span>Oct 2 · PDF</span></div></a></div></div>
<div style="margin-top:40px"><div class="sec-h"><h2>The party</h2></div><div class="chars">{ch}</div></div></div></main>{tabs("camp")}'''
page('campaign.html','Ashes of Emberfall · Six in the TPK',cp,C_CSS.replace('.chars{display:grid;grid-template-columns:repeat(2,1fr)','.chars{display:grid;grid-template-columns:repeat(2,1fr)')+'@media(min-width:900px){.cg .chars{grid-template-columns:1fr;gap:8px}.cg .chr{flex-direction:row;align-items:center;padding:12px 16px}.cg .por{width:40px;height:40px;font-size:18px}}',HD('camp'))

# ---------- POLLS ----------
PO_CSS=D_CSS+'''
.poll{padding:24px;margin-bottom:24px}
.poll h2{font-size:24px;line-height:30px;margin:8px 0 4px}
.opts{display:grid;gap:8px;margin:20px 0}
.opt{display:flex;align-items:center;gap:16px;padding:12px 16px;border-radius:14px;border:1px solid var(--rule2);background:var(--paper);min-height:64px;position:relative;overflow:hidden}
.opt .fill{position:absolute;inset:0 auto 0 0;background:rgba(169,130,58,.10)}
.opt.mine{border-color:var(--ink);box-shadow:0 0 0 3px rgba(29,25,21,.06)}
.opt.lead .fill{background:rgba(158,47,31,.08)}
.opt>*{position:relative}
.opt .dt{flex-direction:row;align-items:baseline;gap:8px;min-width:120px}.opt .dt .dn{font-size:26px;line-height:28px}
.opt .t{flex:1;font-size:13.5px;color:var(--ink3)}
.opt .n{font:500 20px var(--serif)}
.chk{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--rule2);display:grid;place-items:center}
.opt.mine .chk{background:var(--ink);border-color:var(--ink);color:#fff}
.opt.mine .chk .ic{width:14px;height:14px;stroke-width:2.5}
.ph-poll{border:1.5px dashed var(--rule2);background:transparent;box-shadow:none;text-align:center;padding:40px 24px}
.ph-poll h3{font-size:20px;margin:16px 0 8px}
'''
po=f'''<main><div class="ptitle"><div><div class="eyebrow">1 needs your vote</div><h1 class="lt">Polls</h1></div><a class="btn sec sm" href="#">{ic("plus","ic sm")}New poll</a></div>
<div class="grid"><div><article class="card poll"><span class="ribbon"></span><div class="eyebrow">Ashes of Emberfall · closes Sun</div><h2>Arc two kickoff — which Saturday?</h2><p class="note" style="margin:0">Pick every date that works. Seth locks the winner.</p>
<div class="opts">
<div class="opt lead mine"><span class="fill" style="width:83%"></span><span class="chk">{ic("check")}</span><div class="dt"><span class="dw">Sat</span><span class="dn">7</span><span class="dm">Nov</span></div><span class="t">Leading</span><span class="n">5</span></div>
<div class="opt"><span class="fill" style="width:50%"></span><span class="chk"></span><div class="dt"><span class="dw">Sat</span><span class="dn">14</span><span class="dm">Nov</span></div><span class="t"></span><span class="n">3</span></div>
<div class="opt"><span class="fill" style="width:17%"></span><span class="chk"></span><div class="dt"><span class="dw">Sat</span><span class="dn">21</span><span class="dm">Nov</span></div><span class="t">Dev can't</span><span class="n">1</span></div></div>
<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">{stack((3,))}<span class="note">5 of 6 voted · Dev hasn't</span></div></article>
<div class="card ph-poll"><span class="fi" style="width:48px;height:48px;border-radius:14px;display:inline-grid;place-items:center;background:var(--paper);border:.5px solid var(--rule2);color:var(--ver)">{ic("polls")}</span><h3>Planning a one-shot?</h3><p class="note" style="margin:0 auto 20px;max-width:300px">Float a few dates and let the table decide. Polls close themselves.</p><a class="btn pri sm" href="#">{ic("plus","ic sm")}Start a date poll</a></div></div>
<aside class="side"><div class="card" style="padding:24px"><div class="eyebrow">Recently closed</div><p style="font:500 17px/24px var(--serif);margin:12px 0 4px">Drowned Crown — Halloween special</p><span class="status">Locked · Fri, Oct 30</span></div></aside></div></main>{tabs("polls")}'''
page('polls.html','Polls · Six in the TPK',po,PO_CSS,HD('polls'))

page('campaign-night.html','Ashes of Emberfall · Six in the TPK',cp,C_CSS+'@media(min-width:900px){.cg .chars{grid-template-columns:1fr;gap:8px}.cg .chr{flex-direction:row;align-items:center;padding:12px 16px}.cg .por{width:40px;height:40px;font-size:18px}}',HD("camp"),'night')
# ---------- INVITES ----------
IV_CSS=D_CSS+PO_CSS[len(D_CSS):]+'''
.inv{overflow:hidden;margin-bottom:16px;display:grid}
.inv .cover{height:120px}
.inv .ctop{position:absolute;left:20px;right:20px;bottom:14px;z-index:2;color:#FBF8F2}
.inv .ctop .eyebrow{color:#E9C98E}.inv .ctop h3{font-size:24px;line-height:28px;margin-top:4px}
.inv .ib{padding:20px;display:grid;gap:16px}
.inv .ib p{margin:0;color:var(--ink2);font-size:15px;line-height:22px}
.inv .acts .btn{flex:1}
.gm{padding:24px}
.gm h2{font-size:22px;line-height:28px;margin:8px 0 4px}
.addr{display:flex;gap:8px;margin:20px 0 8px}
.addr .inp{flex:1;min-width:0;height:48px;border-radius:12px;border:1px solid var(--rule2);background:var(--field);padding:0 14px;font-size:16px}
.addr .btn{height:48px}
.sent{margin-top:16px}
.sent .row{padding:12px 0;min-height:60px}
.sent .row+.row{border-top:.5px solid var(--rule)}
.sent .av{width:36px;height:36px;font-size:12px;box-shadow:none}
.sent .t b{font:500 16px/22px var(--ui)}
.pill{font:600 11px/16px var(--ui);letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:var(--paper2);border:.5px solid var(--rule2);color:var(--ink3);white-space:nowrap}
.pill.ok{color:var(--moss)}
.lnk{display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:14px;background:var(--paper2);border:.5px dashed var(--rule2);margin-top:20px;font-size:14px}
.lnk code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 13px ui-monospace,Menlo,monospace;color:var(--ink2)}
.ivg{display:grid;gap:32px;grid-template-columns:minmax(0,1fr)}.ivg>section{min-width:0}
@media(min-width:900px){.ivg{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}}
'''
iv=f'''<main><div class="ptitle"><div><div class="eyebrow">1 waiting for you</div><h1 class="lt">Invites</h1></div></div>
<div class="ivg"><section><div class="sec-h"><h2>For you</h2></div>
<article class="card inv"><span class="ribbon" style="right:20px"></span><div class="cover">{cover(3,P["tide"],"ship")}<div class="ctop"><div class="eyebrow">Mara invited you</div><h3>The Drowned Crown</h3></div></div>
<div class="ib"><p>A pirate-court intrigue on a sunken archipelago. Fridays, every other week, 7 PM at Seth's place. 5 players already aboard.</p>
<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">{stack()}<span class="note">Sent 2 days ago</span></div>
<div class="acts" style="display:flex;gap:8px"><a class="btn pri" href="#">{ic("check","ic sm")}Join campaign</a><a class="btn sec" href="#">Decline</a></div></div></article>
<p class="note" style="text-align:center;margin:24px 0 0">That's everything. New invites arrive by email too.</p></section>
<section><div class="sec-h"><h2>Invite players</h2><span class="note">You're GM</span></div>
<div class="card gm"><div class="eyebrow">Ashes of Emberfall</div><h2>Bring someone to the table</h2><p class="note" style="margin:0">They'll get a one-tap email link. No account needed.</p>
<form class="addr" onsubmit="return false"><label class="sr" for="iv" style="position:absolute;left:-9999px">Email</label><input id="iv" class="inp" type="email" placeholder="friend@example.com" inputmode="email"><button class="btn pri">Invite</button></form>
<div class="sent"><div class="row"><span class="av c2">P</span><div class="t"><b>priya@example.com</b><span>Sent Oct 18</span></div><span class="pill">Pending</span><button class="btn ghost" aria-label="Resend to priya" style="width:44px;padding:0">{ic("arrow","ic sm")}</button></div>
<div class="row"><span class="av c4">D</span><div class="t"><b>Dev Rao</b><span>Joined Oct 2</span></div><span class="pill ok">Joined</span><span style="width:44px"></span></div></div>
<div class="lnk">{ic("link","ic sm")}<code>sixinthetpk.com/i/emberfall-7Kq2</code><button class="btn sec sm">Copy</button></div></div></section></div></main>{tabs("inv")}'''
page('invites.html','Invites · Six in the TPK',iv,IV_CSS,HD("inv"))
page('invites-night.html','Invites · Six in the TPK',iv,IV_CSS,HD("inv"),'night')
