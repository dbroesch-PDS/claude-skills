# Deploy via REST API (Script)

Alternative to MCP deployment. Best for repeated deploys, CI/CD, or team automation.

## 1. Configure Base Path (if needed)

**Option A: Use CLI flag (Vite only)**
No config needed! Use `--base` flag in your script (see step 2).

**Option B: Framework config (SvelteKit, Next.js)**

For **SvelteKit**, edit `svelte.config.js`:

```javascript
import adapter from "@sveltejs/adapter-static";
export default {
  kit: {
    adapter: adapter(),
    paths: { base: process.env.BLOCKCELL_BASE || "" },
  },
};
```

For **Next.js**, edit `next.config.js`:

```javascript
module.exports = {
  basePath: process.env.BLOCKCELL_BASE || "",
  assetPrefix: process.env.BLOCKCELL_BASE || "",
};
```

## 2. Add Deploy Scripts

Add to `package.json` (example using a site named `cash-onboarding-demo`):

**For Vite:**

```json
{
  "scripts": {
    "build": "vite build",
    "build:blockcell": "vite build --base /sites/cash-onboarding-demo/",
    "deploy:blockcell": "npm run build:blockcell && cd dist && zip -r ../site.zip . && curl -X POST 'https://blockcell.sqprod.co/api/v1/sites/cash-onboarding-demo/upload' -H 'Accept: application/json' -F 'file=@site.zip' && rm ../site.zip"
  }
}
```

**For SvelteKit:**

```json
{
  "scripts": {
    "build": "vite build",
    "build:blockcell": "BLOCKCELL_BASE=/sites/cash-onboarding-demo npm run build",
    "deploy:blockcell": "npm run build:blockcell && cd build && zip -r ../site.zip . && curl -X POST 'https://blockcell.sqprod.co/api/v1/sites/cash-onboarding-demo/upload' -H 'Accept: application/json' -F 'file=@site.zip' && rm ../site.zip"
  }
}
```

**For Next.js:**

```json
{
  "scripts": {
    "build": "next build",
    "build:blockcell": "BLOCKCELL_BASE=/sites/cash-onboarding-demo next build && next export",
    "deploy:blockcell": "npm run build:blockcell && cd out && zip -r ../site.zip . && curl -X POST 'https://blockcell.sqprod.co/api/v1/sites/cash-onboarding-demo/upload' -H 'Accept: application/json' -F 'file=@site.zip' && rm ../site.zip"
  }
}
```

Replace `cash-onboarding-demo` with your site name, and update the output directory (`dist`, `build`, or `out`) for your framework.

## 3. Deploy

```bash
npm run deploy:blockcell
```

## 4. Rollback (if needed)

```bash
# List versions
curl "https://blockcell.sqprod.co/api/v1/sites/cash-onboarding-demo/versions"

# Promote a specific version
curl -X POST "https://blockcell.sqprod.co/api/v1/sites/cash-onboarding-demo/versions/abc123/promote"
```
