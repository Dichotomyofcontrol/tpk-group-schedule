// DOM smoke test: run the REAL module code against a jsdom DOM with Firebase stubbed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
process.on('uncaughtException', e => { console.log('UNCAUGHT:', e && e.stack || e); });
process.on('unhandledRejection', e => { console.log('UNHANDLED REJECTION:', e && e.stack || e); });

const __dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dir, '..', 'index.html'), 'utf8');
const modMatch = html.match(/<script type="module">([\s\S]*?)<\/script>\s*<\/body>/);
let moduleSrc = modMatch[1];
// strip ES import lines (we provide the symbols as locals)
moduleSrc = moduleSrc.split('\n').filter(l => !/^\s*import\s/.test(l)).join('\n');

let pass = 0, fail = 0;
const check = (label, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); };

function makeFirebase(codes = [], invites = [], user = null, campaigns = [], writes = [], shares = [], notifications = [], sess = [], polls = []) {
    const snap = (rows) => ({ empty: rows.length === 0, forEach: (f) => rows.forEach(f), docs: rows });
    const onSnapshot = (ref, cb) => {
        const name = ref && (ref.name || (ref.coll && ref.coll.name));
        if (name === 'codes') cb(snap(codes.map(c => ({ id: c.id, data: () => c }))));
        else if (name === 'invites') cb(snap(invites.map(i => ({ id: i.id, data: () => i }))));
        else if (name === 'campaigns') cb(snap(campaigns.map(c => ({ id: c.id, data: () => c }))));
        else if (name === 'shares') cb(snap(shares.map(s => ({ id: `${s.owner}__${s.campaign}`, data: () => s }))));
        else if (name === 'notifications') cb(snap(notifications.map(n => ({ id: n.id, data: () => n }))));
        else if (name === 'sessions') cb(snap(sess.map(s => ({ id: s.id, data: () => s }))));
        else if (name === 'polls') cb(snap(polls.map(p => ({ id: p.id, data: () => p }))));
        else cb(snap([]));
        return () => {};
    };
    return {
        initializeApp: () => ({}), getFirestore: () => ({}), getStorage: () => ({}),
        collection: (db, name) => ({ name }), query: (coll) => ({ coll }), orderBy: () => ({}),
        doc: (db, coll, id) => ({ coll, id }),
        getDoc: () => Promise.resolve({ exists: () => false, data: () => ({}) }),
        getDocs: () => Promise.resolve(snap([])),
        setDoc: (ref, data) => { writes.push({ op: 'set', coll: ref && ref.coll, id: ref && ref.id, data }); return Promise.resolve(); },
        updateDoc: (ref, data) => { writes.push({ op: 'update', coll: ref && ref.coll, id: ref && ref.id, data }); return Promise.resolve(); },
        deleteDoc: (ref) => { writes.push({ op: 'delete', coll: ref && ref.coll, id: ref && ref.id }); return Promise.resolve(); },
        onSnapshot, arrayUnion: (x) => x, arrayRemove: (x) => x,
        getAuth: () => ({}), signInWithEmailAndPassword: () => Promise.resolve(),
        createUserWithEmailAndPassword: () => Promise.resolve(), signOut: () => Promise.resolve(),
        signInAnonymously: () => Promise.resolve(), sendPasswordResetEmail: () => Promise.resolve(), verifyBeforeUpdateEmail: () => Promise.resolve(),
        onAuthStateChanged: (auth, cb) => { cb(user); return () => {}; },
        ref: () => ({}), uploadBytes: () => Promise.resolve(), getDownloadURL: () => Promise.resolve(''),
        deleteObject: () => Promise.resolve(), uploadBytesResumable: () => ({ on() {}, snapshot: {} }),
    };
}

async function run(name, { preCode, groupAuth, user, codes = [], invites = [], campaigns = [], shares = [], notifications = [], sessions = [], polls = [] }, assert) {
    const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
    const { window } = dom;
    const { document } = window;
    if (preCode) window.localStorage.setItem('tpk_codes', JSON.stringify(preCode));
    if (groupAuth) window.sessionStorage.setItem('tpk_auth', 'true');
    class Quill { constructor(){ this.root = { innerHTML: '' }; } on(){} getText(){ return ''; } }
    Quill.register = () => {};
    window.Quill = Quill;
    window.console = console;
    const writes = [];
    Object.assign(window, makeFirebase(codes, invites, user, campaigns, writes, shares, notifications, sessions, polls)); // inject Firebase stubs as window globals
    let threw = null;
    // Run the module in the jsdom window's global scope so `window.x =` creates real
    // globals and bare cross-function calls (closeNav, navigateTo, ...) resolve correctly.
    try { window.eval(moduleSrc); } catch (e) { threw = e; }
    await new Promise(r => setTimeout(r, 30)); // let async auth/snapshot settle
    console.log(`\n== ${name} ==`);
    check('module executed without throwing', !threw);
    if (threw) { console.log('   ERROR:', threw.message); return; }
    try { await assert(window, document, writes); }
    catch (e) { fail++; console.log('FAIL  assertion threw:', e.message); }
}

await run('code guest (returning, STRA-1)',
    { preCode: ['STRA-1'], codes: [{ id: 'STRA-1', owner: 'dm@x', campaign: 'strahd', label: 'Sandy' }] },
    (window, document) => {
        window.openProfile();
        const overlay = document.getElementById('profile-overlay');
        const body = document.getElementById('profile-body').innerHTML;
        check('profile overlay opened', overlay.classList.contains('open'));
        check('shows guest name Sandy', /Sandy/.test(body));
        check('shows guest tag', /profile-guest-tag/.test(body));
        check('lists Curse of Strahd', /Curse of Strahd/.test(body));
        check('labels it via code', /via code/.test(body));
        check('does NOT list Frostmaiden', !/Rime of the Frostmaiden/.test(body));
        check('has Join a campaign action', /Join a campaign/.test(body));
        check('offers Create an account (guest)', /Create an account/.test(body));
        check('nav identity shows guest', /guest/.test(document.getElementById('nav-identity').textContent));
        check('Add Session button hidden for guest', document.getElementById('nav-add-btn').style.display === 'none');
    });

await run('signed-in user with pending invite',
    { user: { email: 'friend@x.com' }, invites: [{ id: 'friend@x.com__strahd', email: 'friend@x.com', campaign: 'strahd', status: 'pending', owner: 'dm@x' }] },
    (window, document) => {
        window.openProfile();
        const body = document.getElementById('profile-body').innerHTML;
        check('shows email identity', /friend@x\.com/.test(body));
        check('shows Pending Invites', /Pending Invites/.test(body));
        check('has Accept button', /acceptInviteFromProfile/.test(body));
        check('no Create-account section (already has account)', !/profile-register/.test(body));
    });

await run('fresh signed-in, no campaigns (empty state)',
    { user: { email: 'new@x.com' } },
    (window, document) => {
        const banner = document.getElementById('no-campaigns-banner');
        const home = document.getElementById('home-view');
        check('empty-state banner shown', banner.style.display !== 'none');
        check('no full takeover (One-Shots still shows)', !home.classList.contains('campaigns-empty'));
        check('One-Shots section visible for everyone', /One-Shots/.test(document.getElementById('campaign-grid').innerHTML));
    });

// ---- C: scoped Manage Schedule button on the campaign page ----
await run('DM (owner) on campaign page → Manage menu + scoping',
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        window.navigateTo('strahd');
        check('Manage menu visible for owner', document.getElementById('campaign-manage-menu').style.display !== 'none');
        check('header shows campaign name', document.getElementById('campaign-page-title').textContent.includes('Curse of Strahd'));
        check('header shows a subtitle', document.getElementById('cp-sub').textContent.length > 0);
        window.toggleCampaignMenu();
        check('menu opens', document.getElementById('cp-menu-list').classList.contains('open'));
        window.openCampaignSchedule();
        check('bulk overlay opened', document.getElementById('bulk-form-overlay').classList.contains('open'));
        check('bulk campaign locked to strahd', document.getElementById('bulk-campaign').value === 'strahd');
        check('campaign picker row hidden (scoped)', document.getElementById('bulk-campaign').closest('.form-row').style.display === 'none');
    });

await run('code guest on campaign page → no Manage menu',
    { preCode: ['STRA-1'], codes: [{ id: 'STRA-1', owner: 'dm@x', campaign: 'strahd', label: 'Sandy' }] },
    (window, document) => {
        window.navigateTo('strahd');
        check('Manage menu hidden for read-only guest', document.getElementById('campaign-manage-menu').style.display === 'none');
        check('Share still available to everyone', /Share/.test(document.querySelector('.cp-actions').textContent));
    });

// ---- Add Session UX: success confirmation + reset ----
await run('add session → success state → add another',
    { user: { email: 'sthomas131@gmail.com' } },
    async (window, document) => {
        window.openAddSession();
        document.getElementById('new-session-date').value = '2026-09-01';
        await window.submitAddSession();
        check('success panel shown after add', document.getElementById('add-success').style.display !== 'none');
        check('form fields hidden after add', document.getElementById('add-form-fields').style.display === 'none');
        check('success detail names campaign', /Frostmaiden/.test(document.getElementById('add-success-detail').textContent));
        check('View session button present', /viewAddedSession/.test(document.getElementById('add-success').innerHTML));
        window.addAnotherSession();
        check('add-another restores form fields', document.getElementById('add-form-fields').style.display !== 'none');
        check('add-another hides success panel', document.getElementById('add-success').style.display === 'none');
        window.closeAddSession();
        check('close resets to form view', document.getElementById('add-form-fields').style.display !== 'none' && document.getElementById('add-success').style.display === 'none');
    });

// ---- 3d: dynamic nav renders campaign items from data ----
await run('DM sees original campaigns in dynamic nav',
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        const nav = document.getElementById('nav-campaigns').innerHTML;
        check('nav container populated', nav.length > 0);
        check('nav has Strahd', /Curse of Strahd/.test(nav));
        check('nav has a nav-strahd item', !!document.getElementById('nav-strahd'));
        check('nav dot uses inline color', /nav-campaign-dot" style="background:/.test(nav));
    });

// ---- 3c + 3d: a user-created campaign themes + appears in nav ----
await run('new campaign: themed + in nav',
    { user: { email: 'dm2@x.com' }, campaigns: [{ id: 'seaofstars', owner: 'dm2@x.com', name: 'Sea of Stars', color: '#33ccff' }] },
    (window, document) => {
        const nav = document.getElementById('nav-campaigns').innerHTML;
        check('new campaign in nav', /Sea of Stars/.test(nav));
        check('new campaign nav item id', !!document.getElementById('nav-seaofstars'));
        const theme = document.getElementById('campaign-theme');
        check('theme style element exists', !!theme);
        check('theme defines --seaofstars-primary', /--seaofstars-primary:\s*rgb\(51, 204, 255\)/.test(theme.textContent));
        check('theme has session-card rule', /\.session-card\.seaofstars::before/.test(theme.textContent));
        check('does NOT theme hardcoded campaigns', !/--strahd-primary/.test(theme.textContent));
        window.navigateTo('seaofstars');
        check('can navigate to new campaign', document.getElementById('campaign-page').classList.contains('active'));
    });

// ---- 3e: create a campaign + recurring sessions in one flow ----
await run('create campaign + weekly x4',
    { user: { email: 'dm2@x.com' } },
    async (window, document, writes) => {
        window.openAddSession();
        document.getElementById('new-session-campaign').value = '__new__';
        window.onAddCampaignChange();
        document.getElementById('nc-name').value = 'Sea of Stars';
        window.setAddMode('recurring');
        document.getElementById('rec-start').value = '2026-08-04';
        document.getElementById('rec-freq').value = 'weeks';
        document.getElementById('rec-interval').value = '1';
        document.getElementById('rec-end-type').value = 'count';
        window.onRecEndChange();
        document.getElementById('rec-count').value = '4';
        window.renderRecurrencePreview();
        check('preview shows 4 sessions', /4<\/strong> session/.test(document.getElementById('rec-preview').innerHTML) || /4<\/strong>/.test(document.getElementById('rec-preview').innerHTML));
        writes.length = 0;
        await window.submitAddSession();
        const campWrites = writes.filter(w => w.coll === 'campaigns');
        const sessWrites = writes.filter(w => w.coll === 'sessions');
        check('one campaign doc written', campWrites.length === 1);
        check('campaign owned by creator', campWrites[0] && campWrites[0].data.owner === 'dm2@x.com');
        check('campaign name saved', campWrites[0] && campWrites[0].data.name === 'Sea of Stars');
        check('4 session docs written', sessWrites.length === 4);
        check('sessions point at new campaign', sessWrites.every(w => w.data.campaign === campWrites[0].id));
        check('sessions are Everyone (unowned)', sessWrites.every(w => !w.data.owner));
        check('success shows 4 sessions', /4 sessions added/.test(document.getElementById('add-success-title').textContent));
    });

// ---- 3e: multiple hand-picked dates on an existing owned campaign ----
await run('multi-date on existing campaign',
    { user: { email: 'dm2@x.com' }, campaigns: [{ id: 'strahd', owner: 'dm2@x.com', name: 'Strahd', color: '#ef5350' }] },
    async (window, document, writes) => {
        window.openAddSession();
        document.getElementById('new-session-campaign').value = 'strahd';
        window.onAddCampaignChange();
        window.setAddMode('multi');
        document.getElementById('multi-date-input').value = '2026-09-05'; window.addMultiDate();
        document.getElementById('multi-date-input').value = '2026-09-19'; window.addMultiDate();
        check('multi list shows 2 chips', (document.getElementById('multi-date-list').innerHTML.match(/multi-chip/g) || []).length === 2);
        writes.length = 0;
        await window.submitAddSession();
        const sessWrites = writes.filter(w => w.coll === 'sessions');
        check('no new campaign written', writes.filter(w => w.coll === 'campaigns').length === 0);
        check('2 sessions written to strahd', sessWrites.length === 2 && sessWrites.every(w => w.data.campaign === 'strahd'));
    });

// ---- 3e: recurring monthly by weekday preview ----
await run('recurring monthly weekday label',
    { user: { email: 'dm2@x.com' } },
    (window, document) => {
        window.openAddSession();
        window.setAddMode('recurring');
        document.getElementById('rec-start').value = '2026-08-18'; // 3rd Tuesday
        document.getElementById('rec-freq').value = 'months';
        window.onRecFreqChange();
        const opt = document.getElementById('rec-monthly-mode').options[1].textContent;
        check('weekday option reads "3rd Tuesday"', /3rd Tuesday/.test(opt));
    });

// ---- 3f: archive ----
await run('owner archives a campaign',
    { user: { email: 'dm@x.com' }, campaigns: [{ id: 'mygame', owner: 'dm@x.com', name: 'My Game', color: '#4fc3f7' }] },
    async (window, document, writes) => {
        window.navigateTo('mygame');
        check('Manage menu visible for owner', document.getElementById('campaign-manage-menu').style.display !== 'none');
        window.openCampaignSettings();
        writes.length = 0;
        await window.toggleArchiveCampaign();
        const upd = writes.find(w => w.op === 'update' && w.coll === 'campaigns' && w.id === 'mygame');
        check('archive writes campaigns update', !!upd && upd.data.archived === true);
    });

// ---- 3f: delete with a member → tombstone + notification (no purge) ----
await run('owner deletes with a member → notifies',
    { user: { email: 'dm@x.com' },
      campaigns: [{ id: 'mygame', owner: 'dm@x.com', name: 'My Game' }],
      shares: [{ owner: 'dm@x.com', campaign: 'mygame', members: ['p@x.com'] }] },
    async (window, document, writes) => {
        window.navigateTo('mygame');
        window.openCampaignSettings();
        window.showDeleteSection();
        document.getElementById('cs-delete-confirm').value = 'DELETE';
        writes.length = 0;
        await window.deleteCampaign();
        const tomb = writes.find(w => w.op === 'update' && w.coll === 'campaigns');
        check('campaign tombstoned', !!tomb && tomb.data.deleted === true);
        const notif = writes.find(w => w.op === 'set' && w.coll === 'notifications' && w.id === 'p@x.com__mygame');
        check('member notified', !!notif && notif.data.status === 'pending');
        check('NOT purged (member holds it)', !writes.some(w => w.op === 'delete' && w.coll === 'campaigns'));
    });

// ---- 3f: delete solo (no members) → immediate purge ----
await run('owner deletes solo → purge',
    { user: { email: 'dm@x.com' }, campaigns: [{ id: 'solo', owner: 'dm@x.com', name: 'Solo' }] },
    async (window, document, writes) => {
        window.navigateTo('solo');
        window.openCampaignSettings();
        window.showDeleteSection();
        document.getElementById('cs-delete-confirm').value = 'delete'; // case-insensitive
        writes.length = 0;
        await window.deleteCampaign();
        check('campaign doc purged', writes.some(w => w.op === 'delete' && w.coll === 'campaigns' && w.id === 'solo'));
        check('no notifications written', !writes.some(w => w.coll === 'notifications'));
    });

// ---- 3f: delete requires typed DELETE ----
await run('delete blocked without typing DELETE',
    { user: { email: 'dm@x.com' }, campaigns: [{ id: 'g', owner: 'dm@x.com', name: 'G' }] },
    async (window, document, writes) => {
        window.navigateTo('g'); window.openCampaignSettings(); window.showDeleteSection();
        document.getElementById('cs-delete-confirm').value = 'nope';
        writes.length = 0;
        await window.deleteCampaign();
        check('nothing deleted without confirm', writes.length === 0);
    });

// ---- 3f: member gets the removal notification and dismisses → purge ----
await run('member notified → dismiss → purge',
    { user: { email: 'p@x.com' },
      campaigns: [{ id: 'gone', owner: 'dm@x.com', name: 'Gone', deleted: true, deletedBy: 'dm@x.com' }],
      notifications: [{ id: 'p@x.com__gone', email: 'p@x.com', campaign: 'gone', deletedBy: 'dm@x.com', kind: 'campaign-deleted', status: 'pending' }] },
    async (window, document, writes) => {
        check('removal modal opened', document.getElementById('campaign-notif-overlay').classList.contains('open'));
        check('modal names the campaign', /Gone/.test(document.getElementById('cn-text').innerHTML));
        check('no take-over button (not successor)', document.getElementById('cn-takeover-btn').style.display === 'none');
        writes.length = 0;
        await window.cnDismiss();
        const upd = writes.find(w => w.op === 'update' && w.coll === 'notifications');
        check('notification marked dismissed', !!upd && upd.data.status === 'dismissed');
        check('campaign purged (last holder left)', writes.some(w => w.op === 'delete' && w.coll === 'campaigns' && w.id === 'gone'));
    });

// ---- 3f: successor sees Take over ----
await run('successor is offered Take over',
    { user: { email: 'succ@x.com' },
      campaigns: [{ id: 'gone', owner: 'dm@x.com', name: 'Gone', deleted: true, deletedBy: 'dm@x.com', successor: 'succ@x.com' }],
      notifications: [{ id: 'succ@x.com__gone', email: 'succ@x.com', campaign: 'gone', deletedBy: 'dm@x.com', kind: 'campaign-deleted', status: 'pending' }] },
    async (window, document, writes) => {
        check('take-over button shown for successor', document.getElementById('cn-takeover-btn').style.display !== 'none');
        writes.length = 0;
        await window.cnTakeover();
        const own = writes.find(w => w.op === 'update' && w.coll === 'campaigns');
        check('take over sets new owner + un-deletes', !!own && own.data.owner === 'succ@x.com' && own.data.deleted === false);
    });

// ---- Home redesign: campaign grid ----
await run('home grid renders campaign cards → navigates',
    { user: { email: 'dm2@x.com' }, campaigns: [{ id: 'seaofstars', owner: 'dm2@x.com', name: 'Sea of Stars', color: '#33ccff', icon: '🌊' }] },
    (window, document) => {
        const grid = document.getElementById('campaign-grid');
        check('grid populated', /campaign-card/.test(grid.innerHTML));
        check('card shows campaign name', /Sea of Stars/.test(grid.innerHTML));
        check('card carries accent color var', /--cc:#33ccff/.test(grid.innerHTML));
        check('card shows a Next session label', /Next session/.test(grid.innerHTML));
        check('old stats-bar filter is gone', !document.getElementById('stats-bar'));
        window.navigateTo('seaofstars');
        check('card click navigates to campaign page', document.getElementById('campaign-page').classList.contains('active'));
    });

// ---- Home grid: sorted by soonest next session ----
await run('grid orders by soonest upcoming session',
    { user: { email: 'sthomas131@gmail.com' },
      sessions: [
        { id: 's1', campaign: 'frostmaiden', date: '2026-12-01', status: 'active' },
        { id: 's2', campaign: 'strahd', date: '2026-08-06', status: 'active' },
        { id: 's3', campaign: 'drawsteel', date: '2026-08-02', status: 'active' },
        { id: 's4', campaign: 'special', date: '2099-01-01', status: 'active' }, // far future
      ] },
    (window, document) => {
        const html = document.getElementById('campaign-grid').innerHTML;
        const order = [...html.matchAll(/class="cc-name">([^<]+)</g)].map(m => m[1]);
        const idx = (frag) => order.findIndex(n => n.includes(frag));
        check('Draw Steel (Aug 2) before Strahd (Aug 6)', idx('Draw Steel') < idx('Strahd'));
        check('Strahd (Aug 6) before Frostmaiden (Dec 1)', idx('Strahd') < idx('Frostmaiden'));
        check('Frostmaiden before One-Shots (2099)', idx('Frostmaiden') < idx('One-Shots'));
        check('soonest (Draw Steel) is first', order[0].includes('Draw Steel'));
    });

// ---- Pass 1: Add-Campaign chooser + One-Shots + view icons ----
await run('signed-in user gets Create/Join chooser; guest goes to Join',
    { user: { email: 'dm2@x.com' } },
    (window, document) => {
        window.openAddCampaign();
        check('chooser opens for signed-in user', document.getElementById('add-campaign-overlay').classList.contains('open'));
        check('chooser offers Create', /Create a new campaign/.test(document.getElementById('add-campaign-overlay').innerHTML));
        check('chooser offers Join with a code', /Join with a code/.test(document.getElementById('add-campaign-overlay').innerHTML));
        window.closeAddCampaign();
    });
await run('guest Add Campaign → straight to Join code',
    { preCode: ['STRA-1'], codes: [{ id: 'STRA-1', owner: 'dm@x', campaign: 'strahd', label: 'Sandy' }] },
    (window, document) => {
        window.openAddCampaign();
        check('chooser NOT shown for guest', !document.getElementById('add-campaign-overlay').classList.contains('open'));
        check('join-code modal opened instead', document.getElementById('join-code-overlay').classList.contains('open'));
    });
await run("'special' campaign now reads One-Shots",
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        window.navigateTo('special');
        check('campaign page title = One-Shots', document.getElementById('campaign-page-title').textContent.includes('One-Shots'));
    });
await run('one-shots behave differently: propose prompt, no party sidebar, self sign-up',
    { user: { email: 'sthomas131@gmail.com' },
      sessions: [{ id: 'os1', campaign: 'special', date: '2026-09-20', status: 'active', title: 'The Tithe', roster: [], attendance: {} }] },
    (window, document) => {
        window.navigateTo('special');
        const c = document.getElementById('campaign-page-content').innerHTML;
        check('shows "Propose a one-shot"', /Propose a one-shot/.test(c));
        check('single-column, no persistent party sidebar', /cp-solo/.test(c) && !/class="cp-side"/.test(c));
        check('one-shot session has a self sign-up control', /toggleSignup\('os1'\)/.test(c));
    });
await run('one-shots are PRIVATE: outsider does not see someone else\'s proposal',
    { user: { email: 'outsider@x.com' },
      polls: [{ id: 'osp', campaign: 'special', owner: 'dm@x.com', title: 'Heist Night', options: [{ id: 'oa', date: '2026-09-20', time: '6:00 PM' }], responses: {}, status: 'open' }] },
    (window, document) => {
        window.navigateTo('special');
        const c = document.getElementById('campaign-page-content').innerHTML;
        check("outsider cannot see another owner's one-shot", !/Heist Night/.test(c));
        check('outsider still has the section + can propose their own', /Propose a one-shot/.test(c));
        check('one-shot poll not surfaced on home banner', !/Heist Night/.test(document.getElementById('poll-banners').innerHTML));
    });
await run('view toggles are icon buttons',
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        window.navigateTo('strahd');
        const listBtn = document.querySelector('[data-view="list"]');
        check('list toggle has view-icon class', listBtn.classList.contains('view-icon'));
        check('list toggle has an aria-label', !!listBtn.getAttribute('aria-label'));
    });

// ---- Pass 2: account panel + campaign two-column layout ----
await run('account panel: manage email + Characters',
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        window.openProfile();
        const body = document.getElementById('profile-body').innerHTML;
        check('shows Change email', /Change email/.test(body));
        check('shows Reset password', /Reset password/.test(body));
        check('shows Your characters section', /Your characters/.test(body));
        // Phase B: profile lists only characters you OWN — roster members no longer count as "yours".
        check('empty until a character is owned', /No character assigned to you yet/.test(body));
    });
await run('campaign page: two-column party sidebar',
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        window.navigateTo('frostmaiden');
        const content = document.getElementById('campaign-page-content').innerHTML;
        check('two-column layout present', /class="cp-layout"/.test(content));
        check('party rendered as compact list', /class="party-list"/.test(content));
        check('party has a member row', /class="party-row"/.test(content));
        check('main column present', /class="cp-main"/.test(content));
    });

// ---- Slim controls toolbar ----
await run('controls are a slim toolbar, not a thick card',
    { user: { email: 'sthomas131@gmail.com' }, sessions: [{ id: 'x', campaign: 'strahd', date: '2026-12-01', status: 'active' }] },
    (window, document) => {
        window.navigateTo('strahd');
        const c = document.getElementById('campaign-page-content').innerHTML;
        check('uses slim controls-bar', /class="controls-bar"/.test(c));
        check('no thick controls-panel', !/class="controls-panel"/.test(c));
        check('sort/collapse are ctrl-links', /class="ctrl-link"/.test(c));
    });

// ---- Security: recap HTML is sanitized before render (stored-XSS defense) ----
await run('malicious recap HTML is neutralized on render',
    { user: { email: 'sthomas131@gmail.com' },
      sessions: [{ id: 'r1', campaign: 'strahd', date: '2026-01-01', status: 'active',
        recapHtml: '<p>Safe <strong>bold</strong> <a href="javascript:alert(1)">x</a><a href="https://ok.com">ok</a></p><img src=x onerror="alert(1)"><script>alert(2)</script>' }] },
    (window, document) => {
        window.navigateTo('strahd');
        window.setCampaignTimeFilter('all', 'strahd');   // the old past session renders in the list (Last-Session block was removed)
        const c = document.getElementById('campaign-page-content').innerHTML;
        check('keeps safe text', /Safe/.test(c) && /bold/.test(c));
        check('strips <script>', !/<script/i.test(c));
        check('strips onerror handler', !/onerror/i.test(c));
        check('strips <img>', !/<img/i.test(c));
        check('drops javascript: href', !/javascript:/i.test(c));
        check('keeps safe https link', /https:\/\/ok\.com/.test(c));
    });

// ---- A11y: Escape closes an open modal ----
await run('Escape closes the open overlay',
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        window.openProfile();
        check('profile overlay open', document.getElementById('profile-overlay').classList.contains('open'));
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        check('Escape closed it', !document.getElementById('profile-overlay').classList.contains('open'));
    });

// ---- Auth: anonymous session (Firestore token) is treated as a guest, not an account ----
await run('anonymous session is a guest, not a signed-in account',
    { user: { uid: 'anon1', isAnonymous: true } },
    (window, document) => {
        window.openProfile();
        const body = document.getElementById('profile-body').innerHTML;
        check('no email account identity shown', !/@/.test(body));
        check('Add Session hidden (not an account)', document.getElementById('nav-add-btn').style.display === 'none');
    });

// ---- Availability polls (date + time options; multiple per day) ----
await run('owner creates a poll with date+time options (incl. two on one day)',
    { user: { email: 'sthomas131@gmail.com' } },
    async (window, document, writes) => {
        window.navigateTo('strahd');
        check('shows create-poll prompt', /Ask when to play/.test(document.getElementById('campaign-page-content').innerHTML));
        window.openCreatePoll();
        document.getElementById('poll-date-input').value = '2026-08-05'; document.getElementById('poll-time-input').value = '6:00 PM'; window.addPollSlot();
        document.getElementById('poll-date-input').value = '2026-08-05'; document.getElementById('poll-time-input').value = '8:00 PM'; window.addPollSlot();
        document.getElementById('poll-date-input').value = '2026-08-12'; document.getElementById('poll-time-input').value = '6:00 PM'; window.addPollSlot();
        check('slot list shows 3 options', (document.getElementById('poll-slot-list').innerHTML.match(/poll-slot-dt/g) || []).length === 3);
        writes.length = 0;
        await window.submitCreatePoll();
        const pw = writes.find(w => w.coll === 'polls');
        check('poll written with options[] (date+time)', !!pw && pw.data.options.length === 3 && !!pw.data.options[0].time && !!pw.data.options[0].date);
        check('two options share Aug 5', pw.data.options.filter(o => o.date === '2026-08-05').length === 2);
        check('poll open + owned', pw.data.status === 'open' && pw.data.owner === 'sthomas131@gmail.com');
    });

await run('vote/tally/best-option; owner confirms → session with that time',
    { user: { email: 'sthomas131@gmail.com' },
      polls: [{ id: 'p1', campaign: 'strahd', owner: 'sthomas131@gmail.com', title: 'When?',
        options: [{ id: 'oa', date: '2026-08-05', time: '6:00 PM' }, { id: 'ob', date: '2026-08-12', time: '6:00 PM' }],
        responses: { a_b: { name: 'a@b.com', votes: { oa: 'yes', ob: 'no' } }, c_d: { name: 'c@d.com', votes: { oa: 'yes', ob: 'maybe' } } }, status: 'open' }] },
    async (window, document, writes) => {
        window.navigateTo('strahd');
        const c = document.getElementById('campaign-page-content').innerHTML;
        check('vote buttons rendered', /class="poll-vote/.test(c));
        check('option shows date · time', /6:00 PM/.test(c));
        check('tally counts on best', /2✓/.test(c));
        check('best option tagged', /poll-best-tag/.test(c));
        writes.length = 0;
        await window.votePoll('p1', 'oa', 'yes');
        check('vote writes to poll', writes.some(w => w.coll === 'polls' && w.op === 'update'));
        writes.length = 0;
        window.confirmPoll('p1', 'oa');   // opens the milestone confirmation modal (no writes yet)
        check('confirm opens milestone modal', document.getElementById('scm-overlay').classList.contains('open'));
        await window.confirmPollGo();      // performs the confirmation
        check('confirm creates session on date+time', writes.some(w => w.coll === 'sessions' && w.op === 'set' && w.data.date === '2026-08-05' && w.data.time === '6:00 PM'));
        check('confirm closes poll', writes.some(w => w.coll === 'polls' && w.op === 'update' && w.data.status === 'confirmed'));
    });

await run('non-owner votes but no confirm/create/delete',
    { user: { email: 'friend@x.com' },
      campaigns: [{ id: 'strahd', owner: 'sthomas131@gmail.com' }],
      shares: [{ owner: 'sthomas131@gmail.com', campaign: 'strahd', members: ['friend@x.com'] }],
      polls: [{ id: 'p2', campaign: 'strahd', owner: 'sthomas131@gmail.com', options: [{ id: 'oa', date: '2026-08-05', time: '6:00 PM' }, { id: 'ob', date: '2026-08-12', time: '6:00 PM' }], responses: {}, status: 'open' }] },
    (window, document) => {
        window.navigateTo('strahd');
        const c = document.getElementById('campaign-page-content').innerHTML;
        check('member can vote', /class="poll-vote/.test(c));
        check('no Confirm buttons', !/poll-confirm/.test(c));
        check('cannot delete', !/deletePoll/.test(c));
    });

// ---- Access roles: editor can manage, viewer cannot; settings owner-only ----
await run('editor (access role) can manage the campaign',
    { user: { email: 'ed@x.com' },
      campaigns: [{ id: 'strahd', owner: 'dm@x.com', name: 'Strahd', access: { 'ed@x.com': 'editor' } }],
      shares: [{ owner: 'dm@x.com', campaign: 'strahd', members: ['ed@x.com'] }],
      polls: [{ id: 'pe', campaign: 'strahd', owner: 'dm@x.com', options: [{ id: 'oa', date: '2026-08-05', time: '6:00 PM' }], responses: {}, status: 'open' }] },
    (window, document) => {
        window.navigateTo('strahd');
        check('editor sees Manage menu', document.getElementById('campaign-manage-menu').style.display !== 'none');
        check('editor can confirm a poll', /poll-confirm/.test(document.getElementById('campaign-page-content').innerHTML));
        check('editor cannot open Settings (owner only)', document.getElementById('cp-menu-settings').style.display === 'none');
    });

await run('viewer (share member, no access role) cannot manage',
    { user: { email: 'view@x.com' },
      campaigns: [{ id: 'strahd', owner: 'dm@x.com', name: 'Strahd' }],
      shares: [{ owner: 'dm@x.com', campaign: 'strahd', members: ['view@x.com'] }] },
    (window, document) => {
        window.navigateTo('strahd');
        check('viewer has no Manage menu', document.getElementById('campaign-manage-menu').style.display === 'none');
    });

await run('owner sees Members & roles with access + in-game selects',
    { user: { email: 'dm@x.com' },
      campaigns: [{ id: 'strahd', owner: 'dm@x.com', name: 'Strahd' }],
      shares: [{ owner: 'dm@x.com', campaign: 'strahd', members: ['ed@x.com'] }] },
    (window, document) => {
        window.navigateTo('strahd');
        window.openCampaignSettings();
        const m = document.getElementById('cs-members').innerHTML;
        check('member listed in roles table', /ed@x\.com/.test(m));
        check('has an access select', /setMemberAccess/.test(m));
        check('has an in-game role select', /setMemberGameRole/.test(m));
        check('owner row shows fixed Owner', /cs-role-fixed/.test(m));
    });

await run('legacy poll shape (dates[]) still renders', // back-compat via pollOptions()
    { user: { email: 'sthomas131@gmail.com' },
      polls: [{ id: 'pl', campaign: 'strahd', owner: 'sthomas131@gmail.com', dates: ['2026-08-05'], time: '7:00 PM', responses: {}, status: 'open' }] },
    (window, document) => {
        window.navigateTo('strahd');
        check('legacy poll renders options', /class="poll-vote/.test(document.getElementById('campaign-page-content').innerHTML));
    });

await run('home banner surfaces a poll needing my response',
    { user: { email: 'sthomas131@gmail.com' },
      polls: [{ id: 'p3', campaign: 'strahd', owner: 'sthomas131@gmail.com', options: [{ id: 'oa', date: '2026-08-05', time: '6:00 PM' }], responses: {}, status: 'open' }] },
    (window, document) => {
        check('poll banner on home', /class="poll-banner"/.test(document.getElementById('poll-banners').innerHTML));
        check('banner names campaign', /Curse of Strahd/.test(document.getElementById('poll-banners').innerHTML));
    });

// ---- Leave a campaign ----
await run('guest can leave — join code forgotten, sent to gate',
    { preCode: ['STRA-1'], codes: [{ id: 'STRA-1', owner: 'dm@x', campaign: 'strahd', label: 'Sandy' }] },
    async (window, document) => {
        window.confirm = () => true;
        window.openProfile();
        check('Strahd listed with a Leave button', /leaveCampaign\('strahd'\)/.test(document.getElementById('profile-body').innerHTML));
        window.leaveCampaign('strahd'); await window.runGenericConfirm();
        check('code forgotten from localStorage', !JSON.parse(window.localStorage.getItem('tpk_codes') || '[]').includes('STRA-1'));
        check('sent back to the gate (no access left)', document.getElementById('password-gate').style.display !== 'none');
    });

await run('signed-in member can leave — removed from share + profile',
    { user: { email: 'friend@x.com' },
      campaigns: [{ id: 'strahd', owner: 'dm@x.com', name: 'Strahd' }],
      shares: [{ owner: 'dm@x.com', campaign: 'strahd', members: ['friend@x.com'] }] },
    async (window, document, writes) => {
        window.confirm = () => true;
        window.openProfile();
        writes.length = 0;
        window.leaveCampaign('strahd'); await window.runGenericConfirm();
        const sw = writes.find(w => w.coll === 'shares' && w.op === 'update');
        check('removed from the campaign share', !!sw);
        check('leave used arrayRemove on members', !!(sw && sw.data && 'members' in sw.data));
    });

await run('owner cannot "leave" their own campaign', // no Leave button for owned
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        window.openProfile();
        const body = document.getElementById('profile-body').innerHTML;
        // strahd is owned by sthomas131 (fallback) → its row must not offer Leave
        check('owned campaign has no Leave', !/leaveCampaign\('strahd'\)/.test(body));
    });

// ---- Campaign page: List/Calendar toggle now works ----
await run('campaign List/Calendar toggle switches views',
    { user: { email: 'sthomas131@gmail.com' },
      sessions: [{ id: 'cs1', campaign: 'strahd', date: '2026-09-15', status: 'active' }] },
    (window, document) => {
        window.navigateTo('strahd');
        let c = document.getElementById('campaign-page-content').innerHTML;
        check('defaults to list (session card shown)', /session-card/.test(c) && !/cal-month/.test(c));
        window.setCampaignView('calendar', 'strahd');
        c = document.getElementById('campaign-page-content').innerHTML;
        check('calendar view renders a month grid', /cal-month/.test(c));
        check('calendar toggle marked active', /view-icon active[^>]*Calendar|Calendar view" onclick="setCampaignView\('calendar'/.test(c) || /view-icon active/.test(c));
        window.setCampaignView('list', 'strahd');
        check('back to list', /session-card/.test(document.getElementById('campaign-page-content').innerHTML));
    });

// Expanded session cards survive a re-render (so toggling attendance doesn't collapse the card).
await run('expanded session stays open across a re-render',
    { user: { email: 'sthomas131@gmail.com' },
      sessions: [{ id: 'ex1', campaign: 'strahd', date: '2026-09-15', status: 'active', recap: 'We fought.', recapHtml: '<p>We fought.</p>' }] },
    (window, document) => {
        window.navigateTo('strahd');
        window.toggleSessionExpand('ex1');
        check('card expands on tap', document.querySelector('#campaign-page-content [data-session-id="ex1"]').classList.contains('expanded'));
        window.renderCampaignPage('strahd');   // simulate a re-render (e.g. from an attendance write)
        const card = document.querySelector('#campaign-page-content [data-session-id="ex1"]');
        check('still expanded after re-render', !!card && card.classList.contains('expanded'));
    });

// ---- #4: calendar keyboard accessibility ----
await run('calendar session days are keyboard-operable + labeled',
    { user: { email: 'sthomas131@gmail.com' }, sessions: [{ id: 'k1', campaign: 'strahd', date: '2026-09-15', status: 'active' }] },
    (window, document) => {
        window.navigateTo('strahd');
        window.setCampaignView('calendar', 'strahd');
        const c = document.getElementById('campaign-page-content').innerHTML;
        check('session day is a focusable button', /class="cal-day has-session[^"]*" role="button" tabindex="0"/.test(c));
        check('session day has an aria-label', /aria-label="1 session on/.test(c));
        check('session day handles Enter/Space', /onkeydown="if\(event\.key==='Enter'/.test(c));
    });

// ---- #5: account controls ----
await run('account panel: Download my data + Delete account (signed-in)',
    { user: { email: 'sthomas131@gmail.com' } },
    (window, document) => {
        window.openProfile();
        const body = document.getElementById('profile-body').innerHTML;
        check('Download my data present', /exportMyData\(\)/.test(body));
        check('Delete account present for account', /deleteAccountFromProfile\(\)/.test(body));
    });
await run('guest sees export but not delete-account',
    { preCode: ['STRA-1'], codes: [{ id: 'STRA-1', owner: 'dm@x', campaign: 'strahd', label: 'Sandy' }] },
    (window, document) => {
        window.openProfile();
        const body = document.getElementById('profile-body').innerHTML;
        check('guest can export', /exportMyData\(\)/.test(body));
        check('guest has no Delete account', !/deleteAccountFromProfile\(\)/.test(body));
    });
await run('export builds a JSON blob download',
    { user: { email: 'sthomas131@gmail.com' }, sessions: [{ id: 'e1', campaign: 'strahd', date: '2026-09-15', time: '6:00 PM', gm: 'Sage', status: 'active' }] },
    (window, document) => {
        let created = null; const origCreate = window.URL.createObjectURL; window.URL.createObjectURL = (b) => { created = b; return 'blob:x'; }; window.URL.revokeObjectURL = () => {};
        window.exportMyData();
        check('a Blob was created for download', !!created);
        window.URL.createObjectURL = origCreate;
    });

// ---- Polls nav section (consolidated open + closed) ----
await run('Polls list groups open (needs vote) and confirmed',
    { user: { email: 'sthomas131@gmail.com' },
      polls: [
        { id: 'op', campaign: 'strahd', title: 'Next session', options: [{ id: 'oa', date: '2026-08-05', time: '6:00 PM' }], responses: {}, status: 'open', createdAt: 2 },
        { id: 'cl', campaign: 'strahd', title: 'Prev', options: [{ id: 'ob', date: '2026-07-01', time: '6:00 PM' }], responses: {}, status: 'confirmed', confirmedDate: '2026-07-01', confirmedTime: '6:00 PM', createdAt: 1 } ] },
    (window, document) => {
        window.openPollsList();
        const body = document.getElementById('polls-list-body').innerHTML;
        check('shows Open section', /Open<\/div>/.test(body));
        check('open poll flagged Needs your vote', /Needs your vote/.test(body));
        check('shows Confirmed / closed section', /Confirmed \/ closed/.test(body));
        check('confirmed poll shows its date', /Confirmed · Jul 1/.test(body));
        check('rows link to the campaign', /navigateTo\('strahd'\)/.test(body));
    });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
