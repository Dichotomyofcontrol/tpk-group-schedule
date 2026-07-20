// Phase 3f: lifecycle-aware access (archived / deleted / notifications).
let currentUser = null, allCampaigns = {}, allShares = {}, allNotifications = {}, redeemedCodes = [], allCodes = {}, userCampaigns = [];
const campaignNames = { strahd: 'Curse of Strahd' };
const MIGRATION_OWNER = 'sthomas131@gmail.com';
function campaignOwner(c) { if (allCampaigns[c]) return allCampaigns[c].owner || null; if (campaignNames[c]) return MIGRATION_OWNER; return null; }
function isArchived(c) { return !!(allCampaigns[c] && allCampaigns[c].archived); }
function isDeleted(c) { return !!(allCampaigns[c] && allCampaigns[c].deleted); }
function myEmail() { return currentUser && currentUser.email ? currentUser.email.toLowerCase() : null; }
function myNotifStatus(c) { const me = myEmail(); const n = me && allNotifications[`${me}__${c}`]; return n ? n.status : null; }
function shareKey(o, c) { return `${o}__${c}`; }
function shareMembers(o, c) { return allShares[shareKey(o, c)] || []; }
function campaignShareMembers(c) { const o = campaignOwner(c); return o ? shareMembers(o, c) : []; }
function codeGrants() { return redeemedCodes.map(c => allCodes[c]).filter(Boolean); }
function codeGrantsCampaign(c) { return codeGrants().some(g => g.campaign === c); }
function campaignAccessible(c) {
    const me = myEmail();
    if (isDeleted(c)) {
        const st = myNotifStatus(c);
        if (st === 'pending' || st === 'archived') return true;
        if (me && allCampaigns[c] && allCampaigns[c].successor === me) return true;
        return false;
    }
    if (me && campaignOwner(c) === me) return true;
    if (codeGrantsCampaign(c)) return true;
    if (me && campaignShareMembers(c).includes(me)) return true;
    if (me && userCampaigns.includes(c)) return true;
    return false;
}
function sessionVisible(s) {
    if (s.owner) { const me = myEmail(); if (!me) return false; return s.owner === me || (s.invited||[]).includes(me) || shareMembers(s.owner, s.campaign).includes(me); }
    return campaignAccessible(s.campaign);
}
function canManage(s) { if (isArchived(s.campaign) || isDeleted(s.campaign)) return false; if (s.owner) return s.owner === myEmail(); const me = myEmail(); return !!me && campaignOwner(s.campaign) === me; }
function isCampaignOwner(c) { const me = myEmail(); return !!me && campaignOwner(c) === me; }
function canManageCampaign(c) { return isCampaignOwner(c) && !isArchived(c) && !isDeleted(c); }
function inNav(c) { if (isDeleted(c)) return myNotifStatus(c) === 'archived'; if (isCampaignOwner(c)) return true; return false; } // (no sessions in this test)

let pass = 0, fail = 0;
function reset() { currentUser = null; allCampaigns = {}; allShares = {}; allNotifications = {}; redeemedCodes = []; allCodes = {}; userCampaigns = []; }
const check = (l, a, e) => { const ok = a === e; ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  (got ${a}, want ${e})`); };
const ev = (c) => ({ campaign: c });

console.log('\n== archived campaign, owner ==');
reset(); currentUser = { email: 'dm@x' }; allCampaigns = { g: { owner: 'dm@x', archived: true } };
check('accessible (read-only)', campaignAccessible('g'), true);
check('owner can open settings', isCampaignOwner('g'), true);
check('cannot manage schedule (archived)', canManageCampaign('g'), false);
check('sessions read-only', canManage(ev('g')), false);
check('shows in nav (owner)', inNav('g'), true);

console.log('\n== archived campaign, member ==');
reset(); currentUser = { email: 'p@x' }; allCampaigns = { g: { owner: 'dm@x', archived: true } }; allShares = { 'dm@x__g': ['p@x'] };
check('member sees read-only', campaignAccessible('g'), true);
check('member cannot manage', canManage(ev('g')), false);

console.log('\n== deleted campaign, pending notification ==');
reset(); currentUser = { email: 'p@x' }; allCampaigns = { g: { owner: 'dm@x', deleted: true, deletedBy: 'dm@x' } }; allNotifications = { 'p@x__g': { email: 'p@x', campaign: 'g', status: 'pending' } };
check('accessible via pending notif', campaignAccessible('g'), true);
check('read-only (deleted)', canManage(ev('g')), false);

console.log('\n== deleted campaign, archived choice ==');
reset(); currentUser = { email: 'p@x' }; allCampaigns = { g: { owner: 'dm@x', deleted: true } }; allNotifications = { 'p@x__g': { status: 'archived', campaign: 'g' } };
check('accessible (kept read-only)', campaignAccessible('g'), true);
check('shows in nav', inNav('g'), true);

console.log('\n== deleted campaign, dismissed ==');
reset(); currentUser = { email: 'p@x' }; allCampaigns = { g: { owner: 'dm@x', deleted: true } }; allNotifications = { 'p@x__g': { status: 'dismissed', campaign: 'g' } };
check('NOT accessible after dismiss', campaignAccessible('g'), false);
check('not in nav', inNav('g'), false);

console.log('\n== deleted campaign, successor (no notif yet) ==');
reset(); currentUser = { email: 'succ@x' }; allCampaigns = { g: { owner: 'dm@x', deleted: true, successor: 'succ@x' } };
check('successor can access to take over', campaignAccessible('g'), true);

console.log('\n== deleted campaign, the deleting owner released it ==');
reset(); currentUser = { email: 'dm@x' }; allCampaigns = { g: { owner: 'dm@x', deleted: true, deletedBy: 'dm@x' } };
check('deletedBy owner no longer accesses', campaignAccessible('g'), false);

console.log('\n== active campaign sanity ==');
reset(); currentUser = { email: 'dm@x' }; allCampaigns = { g: { owner: 'dm@x' } };
check('owner manages active campaign', canManageCampaign('g'), true);
check('owner manages session', canManage(ev('g')), true);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
