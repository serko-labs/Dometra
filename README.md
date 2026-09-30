# Dometra Tenant Step 1

Requires the tenancy migration from the previous step (`20260930_004_tenancies.sql`) to be applied first.

Then apply:

- `supabase/migrations/20260930_005_tenant_audit_enrichment.sql`

Copy the full source files into the matching paths in the Dometra project.

This package adds:

- Add tenant method screen
- Manual tenant profile flow
- Rental terms flow
- Dometra invitation generation + native share sheet
- Tenant invitation deep link `dometra://invite/<token>`
- Tenant profile completion for invited users
- Invitation acceptance
- Apartment tenant summary
- Apartment audit/history enrichment

Business data is saved in Supabase. Screen form state is only unsaved UI input.
