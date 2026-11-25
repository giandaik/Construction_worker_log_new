# CWL Multi-Tenant — Test Plan: Use Cases, Journeys & Edge Cases

Branch: `feature/multi-tenants` @ `0dc03c1` (post security-fix round 2)
Env: local mongod :28017 (replica set!) + `next dev` :3100 — ή staging URL όταν γίνει deploy.
Seeded baseline (recreate με `node scripts/seed-mt-test.cjs` + provisioning μέσω UI): superadmin@gmail.com, Alpha (Alice ADMIN, Nick WORKER), Beta (Bob ADMIN, Vasilis WORKER), multi@x.test (και στα δύο tenants).

Legend: 🟢 happy path · 🔺 edge · 🔴 security/negative

---

## J1 — Platform bootstrap & Tenant provisioning (SuperAdmin)

**UC-1.1 🟢 SuperAdmin first login**
1. /login → superadmin@gmail.com / pass
2. EXPECT redirect `/platform`, όχι `/app`
3. EXPECT dashboard με tenants list (member counts σωστά)

**UC-1.2 🟢 Provision νέου tenant με initial admin**
1. /platform/tenants → «New tenant»
2. Name: «Gamma Works», admin: Gina/gina@gamma.test/«passwordG1!» ×2
3. EXPECT 201, tenant στη λίστα με memberCount=1
4. Logout → login ως gina@gamma.test → EXPECT redirect `/app`,_role ADMIN
5. EXPECT Alpha/Beta data ΟΥΤΕ ορατά ούτε στα dropdowns

**UC-1.3 🟢 Δεύτερος admin στο ίδιο tenant (add-admin)**
1. Ως superadmin: tenants → Gamma → Add Admin (Gus)
2. Logout, login ως gus → EXPECT ADMIN στο Gamma

**UC-1.4 🔺 Provision edge inputs**
1. Name με μόνο κενά/emojis → slug validation error
2. Slug που παράγεται < 2 chars → error
3. Admin password < 8 → error «at least 8 characters»
4. confirmPassword ≠ password → error
5. Διπλό tenant name (ίδιο slug) → «slug already exists»
6. Admin email που υπάρχει ήδη (alice@alpha.test) → «user with this email already exists»
7. Email με κεφαλαία/κενά (« Alice@Alpha.TEST ») → normalized, δεν δημιουργεί duplicate
8. Πολύ μακρύ name (>63 chars slug trim) → δεν κόβεται σε invalid slug

**UC-1.5 🔴 Provision χωρίς δικαίωμα**
1. Login ως Alice → POST /api/platform/tenants (devtools/fetch) → 403
2. Pending_selection token → 403
3. Ανώνυμος → 401

---

## J2 — Tenant Admin day-1 (Alpha)

**UC-2.1 🟢 Admin δημιουργεί users & projects**
1. Alice login → /app
2. Create user «Nick» (WORKER), create project «Kifisia Block A»
3. Nick login → βλέπει το project, δέν βλέπει άλλα

**UC-2.2 🟢 Members management**
1. Alice: members list = η δική της + Nick
2. Αλλαγή Nick WORKER→MANAGER→WORKER
3. Deactivate membership → ο Nick στο επόμενο login EXPECT «not associated with any organisation» (ή ανάλογο μήνυμα)
4. Reactivate → Nick ξαναμπαίνει κανονικά

**UC-2.3 🔺 Members edges (post-fix H3)**
1. Alice: προσπάθεια προσθήκης Bob (Beta admin) μέσω userId → 400 «already belongs to another organisation»
2. Προσπάθεια προσθήκης superadmin → 400 «Platform administrators cannot be added»
3. Ανύπαρκτο userId → 404
4. Ίδιο userId δύο φορές → upsert (όχι duplicate membership)

**UC-2.4 🔺 Role hierarchy (post-fix M2)**
1. Nick (WORKER) → POST /api/users → 403
2. Nick PROMOTED σε MANAGER → φτιάχνει user με role «admin» → 403 «Your role cannot create…»
3. Alice (ADMIN) → φτιάχνει MANAGER → 200· φτιάχνει ADMIN → 200 (επιτρέπεται, admin ≥ admin)

---

## J3 — Worker daily logging

**UC-3.1 🟢 Worklog lifecycle**
1. Nick login → διαλέγει project → γεμίζει ημερολόγιο (weather, temperature, personnel, equipment, materials, notes)
2. Save → εμφανίζεται στη λίστα, worklogCount του project +1
3. Edit δικό του log (χωρίς tenantId στο body — φυσιολογικό UI) → 200, tenantId αμετάβλητο στη ΒΔ
4. Alice βλέπει το log στο dashboard του project

**UC-3.2 🔺 Worklog edges (post-fix H2)**
1. PUT με `"tenantId":"deadbeef"` στο body → 400 «Unrecognized key(s)»
2. PUT με `"createdAt":"1999-01-01"`, `"author":"<άλλο id>"` → 400 ή αγνόηση — στη ΒΔ ΑΜΕΤΑΒΛΗΤΑ
3. PUT με unknown field `evilField` → 400 (strict schema)
4. PUT χωρίς αλλαγή τίποτα (empty diff) → 200 idempotent
5. Υπερβολικά μεγάλο notes (1MB) → validation error ή αποδοχή με μέτρο (τεκμηρίωσε τι ισχύει)
6. Date στο μέλλον / πολύ παλιό → τι behavior; (τεκμηρίωσε — δεν υπάρχει Explicit spec)

**UC-3.3 🔴 Cross-tenant IDOR (ήταν clean στο audit — regression check)**
1. Nick: GET/PUT/DELETE /api/worklogs/<beta log id> → 404
2. Nick: GET /api/worklogs?project=<beta id> → κενό
3. Bob: GET /api/projects/<alpha id> → 404
4. Nick: POST /api/projects → 403 (μόνο admins)

---

## J4 — Multi-tenant user (select-tenant)

**UC-4.1 🟢 Web flow**
1. multi@x.test login → οθόνη /select-tenant με ΑCRΥΒΩΣ τις 2 οργανωσεις του (Alpha WORKER, Beta WORKER)
2. Διάλεξε Alpha → /app, βλέπει μόνο Alpha projects/worklogs
3. Logout, ξανα-login, διάλεξε Beta → μόνο Beta data
4. Session cookie θυμάται την επιλογή στο refresh

**UC-4.2 🟢 Mobile/Bearer flow (post-fix 6138b0f)**
1. POST /api/login (multi) → 200 + `token` (pending_selection) + tenants list
2. Pending token σε /api/projects → 403 «select an organisation»
3. POST /api/auth/select-tenant **με Bearer pending token** → 200 + νέο token στο body
4. Νέο Bearer token σε /api/projects → μόνο selected tenant data
5. Ίδιο pending token ξανά → select Beta → δεύτερο ανεξάρτητο session

**UC-4.3 🔺 Select-tenant edges**
1. pending token + tenantId που ΔΕΝ είναι μέλος (Gamma) → 400/403 «not a member»
2. pending token + deactivated membership tenant → απόρριψη
3. pending token σε /api/platform/*, /api/worklogs, /api/tenant/members, /api/me → όλα 403
4. Token ΠΡΙΝ το select (pending) χρησιμοποιείται ως Bearer σε όλα τα tenant routes → 403
5. Double-select με το ΙΔΙΟ pending token δύο φορές → και τα δύο δουλεύουν (ή τεκμηρίωσε behavior)
6. select-tenant με impersonation token → 400 «End impersonation before selecting a tenant» (anti-laundering, post-fix H4)
7. Ταχύτητα: select → projects → select άλλο tenant → projects — κάθε switch καθαρό, όχι mixed data

---

## J5 — Impersonation (support flow)

**UC-5.1 🟢 Πλήρες κύκλος (web)**
1. Superadmin → /platform → tenants → Beta → Impersonate Bob (με reason)
2. EXPECT banner «You are impersonating…» και ότι βλέπει ο Bob
3. «End Impersonation» από το banner → πίσω στο /platform ως superadmin
4. Audit log: impersonation_logs έχει startedAt + endedAt + reason

**UC-5.2 🟢 Mobile/Bearer κύκλος (post-fix ffe5c94)**
1. POST …/impersonate με Bearer superadmin → body έχει `token`
2. Bearer imp token → /api/projects = μόνο Beta data
3. DELETE /api/platform/impersonation με Bearer imp → body έχει restored superadmin token
4. Restored token → /api/platform/tenants → 200

**UC-5.3 🔺 Statefulness (post-fix H4)**
1. Impersonate → End → προσπάθεια reuse του ΠΑΛΙΟΥ imp token σε /api/projects → 401/403 (δεν είναι πια έγκυρο — stateful έλεγχος endedAt)
2. Replay του ίδιου DELETE → 409/400 (όχι 200)
3. Imp token σε select-tenant → 400 (laundering blocked)
4. Audit log ΔΕΝ γράφει δεύτερο end

**UC-5.4 🔴 Impersonation guards (audit-clean, regression)**
1. Impersonate σε disabled/suspended tenant → 400
2. Impersonate user που ΔΕΝ είναι member του tenant → 400
3. Impersonate τον superadmin (δεν είναι member πουθενά) → 400
4. reason ως object `{"$ne":1}` → 400 (M3)
5. alice προσπαθεί impersonate → 403
6. Imp token σε ΟΛΑ τα άλλα /api/platform/* (users, tenants, members) → 403
7. reason = 501 chars → 400· reason = κενό string → τι ισχύει (optional: επιτρέπεται; τεκμηρίωσε)

---

## J6 — Tenant lifecycle (disable/suspend)

**UC-6.1 🔺 Tenant status transitions**
1. Superadmin: γίνεται διαθέσιμο status change; (PATCH /api/platform/tenants/[id] — στο audit ήταν 405/δεν υπήρχε· έλεγξε την τρέχουσα κατάσταση)
2. Αν ΔΕΝ υπάρχει ακόμα: τεκμηρίωσε ως open issue — οι guards (impersonate σε inactive, select-tenant inactive) είναι dead code μέχρι να φτιαχτεί το update path
3. Αν υπάρχει: disable Beta → Bob login → 403 «organisation disabled»· select-tenant Beta → απόρριψη· impersonate Beta → 400· Reactivate → όλα ξαναδουλεύουν

**UC-6.2 🔺 Data συμπεριφορά σε disabled tenant**
1. Ο Bob με ΠΑΛΙΟ (ακόμα έγκυρο) JWT όταν γίνεται disable — τι βλέπει; (ιδανικά 403 στο επόμενο request μέσω membership/tenant check· τεκμηρίωσε)
2. Τα projects/worklogs του disabled tenant δεν εμφανίζονται πουθενά σε superadmin lists; (ή ναι — ερώτηση product)

---

## J7 — Uploads & attachments (μέσα σε worklogs/projects)

**UC-7.1 🔺 Upload basics**
1. Αlice ανεβάζει PDF στο project της → 200, URL επιστρέφει
2. Nick (WORKER) ανεβάζει → επιτρέπεται; (DWG/PDF θέλουν isAdmin — τεκμηρίωσε τη συμπεριφορά ανά τύπο)
3. Bob: προσπελάσει το URL της Alice → ΛΟΓΩ public blob θα ανοίγει — τεκμηρίωσε (L3, γνωστό)
4. Upload με αλλαγμένο extension (.exe ως .pdf) → validation
5. Upload με αλλαγμένο/άλλου-tenant projectId στο path → 404/403 (normalizeObjectId + tenant scope)

---

## J8 — Security regression quick-suite (μετά από κάθε merge)

1. `{"email":{"$regex":"^a"}}` στο login → 400 (H1)
2. Login με σωστό email/λάθος pass ×12 γρήγορα → 429 κάποια στιγμή (M1)
3. Dummy-hash timing: λάθος email vs λάθος pass — παρόμοιος χρόνος (H1 oracle)
4. Worklog PUT με tenantId → 400 (H2)
5. members PUT foreign user → 400 (H3)
6. select-tenant με imp token → 400 (H4)
7. Alice bearer σε /api/platform/* → 403 (old)
8. Imp token σε /api/platform/users → 403 (old)
9. Manager φτιάχνει admin → 403 (M2)
10. reason object → 400 (M3)

---

## J9 — Mobile (Capacitor) journeys — σε συσκευή/emulator

1. Fresh install → login (bearer) → tenant admin: πλήρης ροή projects/worklogs
2. Multi-tenant user: login → select-tenant από κινητό (bearer pending → body token) → δουλεύει ΧΩΡΙΣ cookie
3. Offline mode: queue worklog → sync όταν επανέλθει — tenantId στο synced doc είναι server-derived
4. Impersonation FROM mobile superadmin: imp token στο body → navigation ως tenant user → end → restored token
5. Push/notification (αν υπάρχουν) — σωστό tenant context
6. App kill κατά το impersonation → επανεκκίνηση → banner even? state consistent?

---

## Δομικά edges (cross-cutting)

- 🟢 Σωστά member counts στο /platform/tenants μετά από κάθε add/remove/deactivate
- 🔺 Tenant name/slug με unicode (ελληνικά) → slugify συμπεριφορά
- 🔺 Ταυτόχρονα sessions: Alice σε 2 browsers, αλλάζει role της herself από το ένα — τι βλέπει το άλλο (JWT 12h — stale authority επιτρέπεται; τεκμηρίωσε· το M2 fix διαβάζει membership από ΒΔ, όχι token — καλό σημάδι)
- 🔺 Superadmin που γίνεται… superadmin δεύτερη φορά (duplicate email provisioning) → μπλοκάρεται
- 🔺 ΒΔ down κατά το impersonate (transactions) → clean error, όχι partial state (το transaction στο provisioning το εγγυάται — δοκίμασε με σταματημένο mongod)
- 🔺 JWT 12h expiry στη μέση σύνδεσης → καθαρό redirect στο login, όχι 500
- 🔴 Cookie + Bearer ταυτόχρονα (stale cookie + φρέσκο bearer) → cookie κερδίζει (τεκμηριωμένη συμπεριφορά) — επιβεβαίωσε ότι δεν υπάρχουν mixed-privilege states