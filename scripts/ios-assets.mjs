import sharp from "sharp"; import fs from "fs";
const mark = fs.readFileSync("app/icon.svg","utf8").replace(/<svg[^>]*>/,"").replace("</svg>","");
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 32 32"><defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#2a1c17"/><stop offset="1" stop-color="#0b0a0c"/></radialGradient></defs><rect width="32" height="32" fill="url(#g)"/><g transform="translate(16 16) scale(.72) translate(-16 -16)">${mark}</g></svg>`;
await sharp(Buffer.from(icon)).flatten({background:"#0b0a0c"}).removeAlpha().png().toFile("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#0b0a0c"/><g transform="translate(1166 1086) scale(12.5)">${mark}</g><text x="1366" y="1560" text-anchor="middle" font-family="Georgia,serif" font-size="96" fill="#efe7da" letter-spacing="4">Taverning</text></svg>`;
for (const f of ["splash-2732x2732.png","splash-2732x2732-1.png","splash-2732x2732-2.png"]) await sharp(Buffer.from(splash)).removeAlpha().png().toFile("ios/App/App/Assets.xcassets/Splash.imageset/"+f);
await sharp(Buffer.from(splash)).resize(600).toFile("/workspace/taverning-splash-preview.png");
