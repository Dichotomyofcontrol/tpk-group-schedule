import random, math
I={
'dates':'<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 12.2l2.3 2.3-2.3 2.3-2.3-2.3z"/>',
'camp':'<path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5V20"/><path d="M15.5 4.8v6l1.5-1.2 1.5 1.2V4.6"/>',
'polls':'<path d="M4 20h16"/><rect x="5" y="11" width="3.5" height="6" rx="1"/><rect x="10.25" y="6" width="3.5" height="11" rx="1"/><rect x="15.5" y="13" width="3.5" height="4" rx="1"/>',
'inv':'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
'chev':'<path d="M6 9l6 6 6-6"/>','arrow':'<path d="M5 12h14M13 6l6 6-6 6"/>','mail':'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
'pin':'<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
'clock':'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>','doc':'<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M9.5 13h6M9.5 16.5h4"/>',
'plus':'<path d="M12 5v14M5 12h14"/>','check':'<path d="M5 12.5l4.5 4.5L19 7.5"/>','x':'<path d="M7 7l10 10M17 7L7 17"/>','quill':'<path d="M19.5 4.5C13 5 8 9.5 6.5 17.5M19.5 4.5c-.5 6.5-5 11-11 12.5M6.5 17.5L4.5 19.5"/>',
'shield':'<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/>','sparkle':'<path d="M12 3.5l1.8 6.7 6.7 1.8-6.7 1.8L12 20.5l-1.8-6.7-6.7-1.8 6.7-1.8z"/>',
'link':'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>','moon':'<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>','down':'<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
}
def ic(n,c='ic'): return f'<svg class="{c}" viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>'
MARK='''<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="#FBF8F2" stroke="#1D1915" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9.5l6.2 10.7H9.8z" fill="#9E2F1F"/><path d="M16 2.5v7M27.7 9.25l-5.5 10.95M4.3 9.25l5.5 10.95M9.8 20.2L4.3 22.75M22.2 20.2l5.5 2.55M9.8 20.2L16 29.5l6.2-9.3M16 9.5L4.3 9.25M16 9.5l11.7-.25" fill="none" stroke="#1D1915" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/><text x="16" y="18.6" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-size="7" font-weight="600" fill="#FBF8F2">6</text></svg>'''
BRAND=f'<a class="brand" href="landing.html">{MARK}<span>Six <i>in the</i> TPK</span></a>'
def cover(seed,pal,feat='tower',cls='art'):
    r=random.Random(seed); sky1,sky2,glow,ridges=pal; u=f"c{seed}"
    s=f'''<svg class="{cls}" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
<linearGradient id="s{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{sky1}"/><stop offset=".62" stop-color="{sky2}"/><stop offset="1" stop-color="{glow}" stop-opacity=".9"/></linearGradient>
<radialGradient id="g{u}" cx=".59" cy=".27" r=".55"><stop offset="0" stop-color="{glow}" stop-opacity=".85"/><stop offset=".35" stop-color="{glow}" stop-opacity=".25"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="m{u}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFF6E2"/><stop offset=".7" stop-color="{glow}"/><stop offset="1" stop-color="{glow}" stop-opacity=".6"/></radialGradient>
<linearGradient id="h{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{glow}" stop-opacity="0"/><stop offset=".5" stop-color="{glow}" stop-opacity=".22"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></linearGradient>
<linearGradient id="ray{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{glow}" stop-opacity=".22"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></linearGradient>
<filter id="b{u}" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="n{u}"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="{seed}"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 .95 0 0 0 0 .85 0 0 0 .09 0"/></filter></defs>
<rect width="800" height="450" fill="url(#s{u})"/><rect width="800" height="450" fill="url(#g{u})"/>'''
    for _ in range(90):
        s+=f'<circle cx="{r.uniform(0,800):.0f}" cy="{r.uniform(0,200):.0f}" r="{r.uniform(.4,1.4):.1f}" fill="#fff" opacity="{r.uniform(.15,.85):.2f}"/>'
    s+=f'<g opacity=".7">'+''.join(f'<path d="M470 120L{a} 450L{a+70} 450Z" fill="url(#ray{u})"/>' for a in (180,330,520,640))+'</g>'
    s+=f'<circle cx="470" cy="120" r="70" fill="{glow}" opacity=".18" filter="url(#b{u})"/><circle cx="470" cy="120" r="44" fill="url(#m{u})"/><circle cx="500" cy="104" r="40" fill="{sky1}" opacity=".9"/>'
    s+=f'<ellipse cx="300" cy="150" rx="260" ry="14" fill="{glow}" opacity=".12" filter="url(#b{u})"/><ellipse cx="620" cy="190" rx="200" ry="10" fill="#fff" opacity=".06" filter="url(#b{u})"/>'
    n=len(ridges)
    for i,c in enumerate(ridges):
        base=200+i*(230/n); amp=90-i*14; pts=[(0,450)]; x=0
        while x<=820:
            pts.append((x,base-r.uniform(0,amp)*(.6+.4*math.sin(x/90+i)))); x+=r.uniform(24,60)
        pts.append((820,450))
        s+=f'<path d="M{" L".join(f"{a:.0f} {b:.0f}" for a,b in pts)}Z" fill="{c}"/>'
        s+=f'<path d="M{" L".join(f"{a:.0f} {b:.0f}" for a,b in pts[1:-1])}" fill="none" stroke="{glow}" stroke-opacity="{.35-i*.07:.2f}" stroke-width="1.2"/>'
        if i==n-2 and feat=='tower':
            s+=f'<g transform="translate(250 {base-150}) scale(1.9)" fill="{c}"><path d="M0 90V30l6-4V8l9-16 9 16v18l6 4v10h10V20l6-10 6 10v70z"/><path d="M48 90V44l14-12 14 12v46z"/></g><g fill="{glow}"><rect x="278" y="{base-90}" width="4" height="9"/><rect x="342" y="{base-62}" width="4" height="7" opacity=".8"/><rect x="370" y="{base-40}" width="4" height="7" opacity=".7"/></g><circle cx="280" cy="{base-86}" r="14" fill="{glow}" opacity=".35" filter="url(#b{u})"/>'
        if i==n-2 and feat=='ship':
            s+=f'<path d="M330 {base+30}h120l-15 18h-90z M385 {base+30}V{base-50}l40 70z M380 {base-40}l-35 62h35z" fill="{c}"/><rect x="330" y="{base+48}" width="120" height="3" fill="{glow}" opacity=".3" filter="url(#b{u})"/>'
        if i==n-2 and feat=='tree':
            for k in range(12): xx=200+k*36+r.uniform(-8,8); h=r.uniform(50,100); s+=f'<path d="M{xx:.0f} {base+40:.0f}l-14 0 14-{h:.0f} 14 {h:.0f}z" fill="{c}"/>'
        if i<n-1: s+=f'<rect y="{base-30:.0f}" width="800" height="70" fill="url(#h{u})" filter="url(#b{u})"/>'
    s+=f'<rect width="800" height="450" filter="url(#n{u})" opacity=".9"/>'
    s+='<rect width="800" height="450" fill="none" stroke="#000" stroke-opacity=".0"/>'
    return s+'</svg>'
P={'emb':('#161C30','#9A5E4E','#F6CF8E',['#3B3A4F','#2B2A3B','#1E1D2A','#14131C']),
'tide':('#0F2A33','#4E7D80','#E8E1C4',['#2C5155','#1F3D42','#162D31','#0E1E21']),
'wood':('#26301F','#8C7A4E','#F0D79A',['#45502F','#323C22','#232B18','#161C0F'])}
def tabs(on,badge=True):
    t=[('dates','Play dates','playdates.html'),('camp','Campaigns','campaign.html'),('polls','Polls','polls.html'),('inv','Invites','invites.html')]
    h='<nav class="tabs" aria-label="Primary">'
    for k,l,u in t: h+=f'<a href="{u}" class="{"on" if k==on else ""}" {"aria-current=page" if k==on else ""}>{ic(k)}{l}{"<span class=badge>1</span>" if k=="polls" and badge else ""}</a>'
    return h+'</nav>'
def dnav(on):
    t=[('dates','Play dates','playdates.html'),('camp','Campaigns','campaign.html'),('polls','Polls','polls.html'),('inv','Invites','invites.html')]
    return '<nav class="dnav">'+''.join(f'<a href="{u}" class="{"on" if k==on else ""}">{ic(k)}{l}</a>' for k,l,u in t)+'</nav>'
ACCT=f'<button class="acct" aria-label="Account menu: Seth"><span class="av c1">SM</span>{ic("chev","ic ch")}</button>'
def page(name,title,body,extra_css='',hdr=None,theme='cream'):
    open(name,'w').write(f'<!doctype html><html lang="en" data-theme="{theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#F3EDE1"><title>{title}</title><link rel="stylesheet" href="style.css"><style>{extra_css}</style></head><body>{hdr}{body}</body></html>')
exec(open('pages.py').read())
