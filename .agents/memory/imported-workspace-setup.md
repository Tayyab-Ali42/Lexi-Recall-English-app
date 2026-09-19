---
name: Imported workspace setup
description: Environment-specific setup expectations for imported pnpm workspaces with database-backed artifacts.
---

Imported pnpm workspaces can arrive with a valid lockfile but without `node_modules`, and the provisioned development PostgreSQL database can exist without the repository schema applied.

**Why:** The managed workflows otherwise fail with missing executables or the app appears broken because API queries target tables that have not been created.

**How to apply:** When an imported workspace has these symptoms, install from the existing lockfile and apply the repository's documented development schema command before debugging application code. Do not replace the workspace structure.