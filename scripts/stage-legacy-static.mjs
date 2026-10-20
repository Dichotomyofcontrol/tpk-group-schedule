import { cpSync, existsSync, mkdirSync } from "node:fs";

for (const name of ["iven", "maloren"]) {
  if (!existsSync(name)) continue;
  mkdirSync("public", { recursive: true });
  cpSync(name, `public/${name}`, { recursive: true });
  console.log(`staged ${name} → public/${name}`);
}
