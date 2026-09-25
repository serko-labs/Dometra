# Implementation status

## Working in the generated client

- [x] Demo login
- [x] Supabase email/password Auth adapter
- [x] Landlord / Tenant UI mode switch
- [x] Dashboard KPI calculations
- [x] Properties
- [x] Add property
- [x] Property details
- [x] Meters
- [x] Single-tariff meter creation
- [x] Dual T1/T2 meter creation
- [x] Separate camera photo per register
- [x] Manual reading validation
- [x] Consumption calculation
- [x] Invoice generation in local MVP state
- [x] Invoice list / details
- [x] Payment entry and history
- [x] Tenant home
- [x] Reminder display
- [x] Local notification test
- [x] UK / EN / DE / RU runtime switching
- [x] Remote translation JSON update mechanism
- [x] Local state persistence
- [x] Full Supabase schema bundled
- [x] Supabase private-photo upload helper

## Production integrations still intentionally server-side / environment-dependent

- [ ] User bootstrap transaction after first confirmed Supabase signup
- [ ] Replace demo repositories with Supabase CRUD for all modules
- [ ] Server-side transactional invoice generation
- [ ] NBU/ECB FX provider integration
- [ ] OCR recognition
- [ ] Invoice PDF generation
- [ ] Remote push delivery / Edge Function scheduler
- [ ] Tenant invitation email/SMS delivery
- [ ] App Store subscription purchase / entitlement validation

The client is structured so these can be replaced module-by-module without redesigning navigation or the domain model.
