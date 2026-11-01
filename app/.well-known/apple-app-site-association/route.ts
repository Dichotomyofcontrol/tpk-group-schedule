// Universal links: taverning.com/join/... and invite links open in the iOS app.
// Needs APPLE_TEAM_ID (and optionally TAVERNING_BUNDLE_ID) in the Vercel env; returns 404 until set.
export const dynamic = "force-static";

export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const bundle = process.env.TAVERNING_BUNDLE_ID || "com.taverning.app";
  if (!team) return new Response("Not found", { status: 404 });
  const appID = `${team}.${bundle}`;
  return Response.json({
    applinks: {
      details: [{
        appIDs: [appID],
        components: [
          { "/": "/join/*" }, { "/": "/invite/*" }, { "/": "/invites/*" },
          { "/": "/polls/*" }, { "/": "/sessions*" }, { "/": "/campaigns*" }, { "/": "/almanac*" },
          { "/": "/p/*" },
        ],
      }],
    },
    webcredentials: { apps: [appID] },
  });
}
