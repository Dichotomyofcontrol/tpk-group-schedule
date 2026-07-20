// Phase 3b + passphrase removal: campaign-centric access, code/invite/owner only.
let currentUser = null, userCampaigns = [], redeemedCodes = [], allCodes = {}, allShares = {}, sessions = [], allCampaigns = {};
const campaignNames = { frostmaiden: "Rime of the Frostmaiden", strahd: "Curse of Strahd", special: "Special", drawsteel: "Draw Steel", leyfarers: "Leyfarers", beerovia: "Beerovia" };
const MIGRATION_OWNER = 'sthomas131@gmail.com';

function campaignOwner(c) { if (allCampaigns[c]) return allCampaigns[c].owner || null; if (campaignNames[c]) return MIGRATION_OWNER; return null; }
function codeGrants() { return redeemedCodes.map(c => allCodes[c]).filter(Boolean); }
function codeGrantsCampaign(c) { return codeGrants().some(g => g.campaign === c); }
function myEmail() { return currentUser && currentUser.email ? currentUser.email.toLowerCase() : null; }
function shareKey(o, c) { return `${o}__${c}`; }
function shareMembers(o, c) { return allShares[shareKey(o, c)] || []; }
function campaignShareMembers(c) { const o = campaignOwner(c); return o ? shareMembers(o, c) : []; }
function campaignAccessible(c) {
    const me = myEmail();
    if (me && campaignOwner(c) === me) return true;
    if (codeGrantsCampaign(c)) return true;
    if (me && campaignShareMembers(c).includes(me)) return true;
    if (me && userCampaigns.includes(c)) return true;
    return false;
}
function sessionVisible(s) {
    if (s.owner) {
        if (codeGrants().some(g => g.owner === s.owner && g.campaign === s.campaign)) return true;
        const me = myEmail(); if (!me) return false;
        return s.owner === me || (s.invited || []).includes(me) || shareMembers(s.owner, s.campaign).includes(me);
    }
    return campaignAccessible(s.campaign);
}
function canManage(s) { if (s.owner) return s.owner === myEmail(); const me = myEmail(); return !!me && campaignOwner(s.campaign) === me; }
function canManageCampaign(c) { const me = myEmail(); return !!me && campaignOwner(c) === me; }

let pass = 0, fail = 0;
function reset() { currentUser = null; userCampaigns = []; redeemedCodes = []; allCodes = {}; allShares = {}; sessions = []; allCampaigns = {}; }
const check = (l, a, e) => { const ok = a === e; ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  (got ${a}, want ${e})`); };
const ev = (c) => ({ campaign: c });
const jm = (o, c, x = {}) => ({ owner: o, campaign: c, ...x });

console.log('\n== DM signed in (owner of everything) ==');
reset(); currentUser = { email: 'sthomas131@gmail.com' };
check('sees Everyone strahd', sessionVisible(ev('strahd')), true);
check('manages strahd', canManage(ev('strahd')), true);
check('manages campaign', canManageCampaign('strahd'), true);
check('sees leyfarers (owner)', sessionVisible(ev('leyfarers')), true);
check('sees own Just Me', sessionVisible(jm('sthomas131@gmail.com', 'special')), true);

console.log('\n== NO passphrase: tpk_auth is meaningless now ==');
reset(); // nobody signed in, no code
check('anonymous sees nothing (strahd)', sessionVisible(ev('strahd')), false);
check('anonymous cannot manage', canManage(ev('strahd')), false);

console.log('\n== code guest (strahd) ==');
reset(); redeemedCodes = ['S1']; allCodes = { S1: { owner: 'dm@x', campaign: 'strahd', label: 'Sandy' } };
check('sees Everyone strahd (code)', sessionVisible(ev('strahd')), true);
check('does NOT see frostmaiden', sessionVisible(ev('frostmaiden')), false);
check('read-only', canManage(ev('strahd')), false);

console.log('\n== invited via share ==');
reset(); currentUser = { email: 'friend@x.com' }; allCampaigns = { strahd: { owner: 'sthomas131@gmail.com' } }; allShares = { 'sthomas131@gmail.com__strahd': ['friend@x.com'] };
check('sees strahd (shared)', sessionVisible(ev('strahd')), true);
check('read-only', canManage(ev('strahd')), false);
check('does NOT see frostmaiden', sessionVisible(ev('frostmaiden')), false);

console.log('\n== Just Me privacy (private even from owner) ==');
reset(); currentUser = { email: 'sthomas131@gmail.com' };
check('DM does NOT see another user Just Me', sessionVisible(jm('player@x', 'strahd')), false);

console.log('\n== new user-created campaign ==');
reset(); currentUser = { email: 'dm2@x.com' }; allCampaigns = { mygame: { owner: 'dm2@x.com', name: 'My Game' } };
check('owner sees + manages', canManageCampaign('mygame') && sessionVisible(ev('mygame')), true);
reset(); redeemedCodes = ['G1']; allCodes = { G1: { owner: 'dm2@x.com', campaign: 'mygame' } }; allCampaigns = { mygame: { owner: 'dm2@x.com' } };
check('code guest sees it', sessionVisible(ev('mygame')), true);
reset(); currentUser = { email: 'nobody@x.com' }; allCampaigns = { mygame: { owner: 'dm2@x.com' } };
check('unrelated user does NOT see it', sessionVisible(ev('mygame')), false);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
