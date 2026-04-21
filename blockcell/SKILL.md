---
name: blockcell
description: Use when deploying, uploading, publishing, hosting, pushing, or serving static websites and demos on Blockcell for internal sharing at Block. Also use when restricting, limiting, or controlling Blockcell site access with acl.yaml.
roles: [cash-design]
metadata:
  status: experimental
  author: block
  version: "0.1"
---

# Blockcell Deployment Skill

Blockcell is a static site hosting service for internal sharing playground websites at Block.

**Sites are hosted at:** `https://blockcell.sqprod.co/sites/{site_name}/`

Features:

- Version-controlled deployments
- Automatic `index.html` serving
- Square authentication integration

**STOP**: If the user is not connected to WARP VPN, instruct them to connect before proceeding. Do not attempt deployment without VPN access.

**STOP**: If the user wants MCP-based deployment (Path 1) and the MCP server is not configured, instruct them to set it up before proceeding.

## Agent Instructions

When a user requests Blockcell deployment:

- [ ] **Always ask for site name** if not provided
- [ ] **Check existing versions** using `list_versions` to understand ownership
- [ ] **Decide on the best deployment path** there are 2 options -- MCP or REST API documented below
- [ ] **Confirm base path configuration** before building
- [ ] **Validate build directory** contains `index.html` before uploading
- [ ] **Provide clear success feedback** with URL and version ID

## Deploy via MCP (Agent)

For REST API deployment without MCP, see [references/rest-api-deployment.md](references/rest-api-deployment.md).

### 1. Choose Site Name

**Agent Instructions for Site Names:**

- **Prompt for a name** if not provided
- **Check if it exists**: Use `manage_site(site_name="example", action="list_versions")` to see if the name is already in use
- **If site already exists**:
  - **If user owns it**: Upload creates a new version automatically (recommended workflow)
  - **If user doesn't own it**: Upload will fail - ask if they want to use `force=True` or choose a different name
- **DO NOT** automatically use `force=True` or pick a different name without confirmation
- **DO NOT** append numbers (`my-site-2`, `my-site-3`) without asking

**Naming Best Practices:** Use descriptive, reusable names like `block-brand-tools` or `cash-spring26-demo`. Every upload creates a new version automatically - **reuse the same name when iterating**!

### 2. Configure Base Path

Once you have a site name, set the base path **before building**:

```javascript
// vite.config.js — example for a site named "cash-onboarding-demo"
export default {
  base: "/sites/cash-onboarding-demo/",
};
```

Sites live at `/sites/{site-name}/`.

### 3. Build

```bash
npm run build  # outputs to dist/
```

Must be static output. **SvelteKit** needs `adapter-static`, **Next.js** needs static export.

### 4. Deploy

**Agent Action:** Use the `manage_site` MCP tool to upload the build directory:

```
manage_site(
    site_name="cash-onboarding-demo",
    action="upload",
    directory_path="./dist"  // Or ./build, ./out depending on framework
)
```

**What to tell the user:** Confirm the deployment with the site URL and version ID.

### 5. Visit

**What to tell the user:** The site is live at `https://blockcell.sqprod.co/sites/cash-onboarding-demo/`

### 6. Rollback (if needed)

**Agent Actions:**

To list versions:

```
manage_site(site_name="cash-onboarding-demo", action="list_versions")
```

To rollback to a specific version:

```
manage_site(site_name="cash-onboarding-demo", action="promote", version_id="abc123")
```

---

## Access Control (acl.yaml)

By default, all blockcell sites are accessible to any authenticated Block user. To restrict access, add an `acl.yaml` file to the root of the site directory before uploading.

```yaml
# acl.yaml
allow_users:
  - jsmith
  - ajones
allow_capabilities:
  - my-site-viewers
```

- **`allow_users`** — LDAP usernames that can access the site
- **`allow_capabilities`** — blockcell app capabilities from Registry (matched via `x-forwarded-capabilities` header set by cf-doorman)
- Access is granted if the user matches **any** `allow_users` entry **or** has **any** of the `allow_capabilities`
- If `acl.yaml` is absent or empty, the site is open to everyone (default)
- Users denied access will see a 403 page directing them to contact the site owner

To use capability-based access:
1. Ask a Registry admin to create a capability under the `blockcell` app
2. Add users to that capability in Registry
3. Reference it in your `acl.yaml`

---

For REST API deployment (without MCP), see [references/rest-api-deploy.md](references/rest-api-deploy.md).

## Troubleshooting

| Issue                       | Solution                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------- |
| **VPN Connection Required** | Connect to WARP VPN                                                                    |
| **Broken images/CSS/JS**    | Wrong base path - rebuild with `--base /sites/NAME/`                                   |
| **Upload fails**            | Check build directory exists and contains `index.html`                                 |
| **Can't upload to site**    | You don't own it - choose different name (or use `force=True` if intentional override) |
| **SvelteKit not working**   | Use `adapter-static` + add `export const prerender = true` to `+layout.js`             |

---
