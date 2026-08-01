# Jurnal de probleme și soluții — WorkSphere

Acest document e un istoric cronologic al problemelor reale întâlnite în
dezvoltarea și testarea platformei — nu bug-uri ipotetice, ci lucruri care
chiar s-au întâmplat, cu cauza găsită și soluția care a funcționat. Scopul
lui e dublu: să nu repetăm aceleași greșeli, și să existe o referință rapidă
la "de ce e codul așa" pentru orice problemă care pare rezolvată ciudat sau
prea defensiv la prima vedere.

Convenție de status:
- **✅ Rezolvat (confirmat)** — testat din nou după fix și confirmat explicit
  că problema a dispărut.
- **✅ Rezolvat (aplicat)** — fixul a fost aplicat și verificat tehnic
  (typecheck/teste/reproducere manuală), dar nu a mai fost adus vorba din
  nou — ceea ce, în practică, a însemnat de fiecare dată că a funcționat.

Fiecare intrare are hash-ul commit-ului unde s-a aplicat soluția, pentru
`git show <hash>`.

---

## 1. Setup local incomplet — `.env` lipsă pentru `pnpm db:seed`

**Simptom:** pe un checkout curat, `pnpm db:seed` eșua cu
`Environment variable not found: DATABASE_URL`.

**Cauză:** `prisma.config.ts` încarcă `.env` pentru CLI-ul Prisma
(`migrate`/`generate`), dar `prisma/seed.ts` rulează direct prin `tsx`,
ocolind complet acea configurare — funcționa doar dacă `DATABASE_URL` era
deja setat manual în shell.

**Soluție:** `.env` propriu, încărcat explicit la începutul scriptului de
seed.

**Status:** ✅ Rezolvat (aplicat) — `cd1ed1a`

---

## 2. Build incremental TypeScript desincronizat cu `dist/`

**Simptom:** după un compile eșuat (ex. o dependență de workspace încă
neconstruită), un recompile ulterior reușit raporta „Found 0 errors" dar
`dist/main.js` nu exista — API-ul nu pornea.

**Cauză:** `tsBuildInfoFile` era în afara `outDir`
(`apps/api/tsconfig.tsbuildinfo`). `nest-cli` șterge `dist/` la fiecare
rebuild, dar nu și acel fișier de cache, care rămânea "la zi" din
perspectiva TypeScript și făcea ca următorul compile să nu re-emită nimic.

**Soluție:** cache-ul incremental mutat în interiorul `dist/`, ca să fie
șters și regenerat împreună cu output-ul pe care îl descrie.

**Status:** ✅ Rezolvat (aplicat) — `17b6bbd`

---

## 3. `pnpm dev` eșua pe checkout curat — dependențele de workspace nu erau construite

**Simptom:** `Cannot find module '@worksphere/database'` la primul
`pnpm dev` pe o mașină nouă.

**Cauză:** task-ul `dev` din Turborepo nu avea `dependsOn: ["^build"]`, spre
deosebire de `lint`/`typecheck`/`test`. `apps/api` importă
`@worksphere/database` din `dist/`-ul lui compilat (conform
`package.json` `main`/`types`), deci fără build întâi, modulul pur și
simplu nu există.

**Soluție:** adăugat `dependsOn` corect pentru task-ul `dev`.

**Status:** ✅ Rezolvat (aplicat) — `2859968`

---

## 4. README cu pași de instalare incompleți

**Simptom:** `docker compose up` și `pnpm db:migrate` eșuau pe un checkout
nou urmând exact pașii din README.

**Cauză:** lipseau două precizări: `docker-compose.yml` citește variabilele
dintr-un `.env` din rădăcină (nedocumentat), iar `packages/database` are
nevoie de propriul `.env` pentru CLI-ul Prisma (nu preia automat
`apps/api/.env`).

**Soluție:** README completat cu ambii pași.

**Status:** ✅ Rezolvat (aplicat) — `ce41910`

---

## 5. Scurgere de sesiune între taburi prin cookie-ul de refresh comun

**Simptom:** un tab lăsat deschis pe dashboard-ul Companiei A începea, fără
niciun avertisment, să afișeze datele Companiei B (angajați, pontaj,
concedii) — dacă între timp, în alt tab (sau în același, mai târziu),
cineva se înregistra sau se autentifica în Compania B.

**Cauză:** cookie-ul httpOnly de refresh e per-browser, nu per-tab. Orice
autentificare nouă suprascrie același cookie unic; tab-ul vechi, la
următoarea restaurare pasivă de sesiune (reload, sau expirarea token-ului
de acces la 15 minute + refresh silențios pe 401), prelua fără să știe
cookie-ul companiei noi.

**Investigație:** reprodus determinist cu Playwright, două scenarii pe
același context de browser: (1) reload într-un tab vechi după ce alt tab
înregistra o companie nouă, (2) 401 forțat pe o cerere în zbor în tab-ul
vechi, simulând expirarea token-ului — ambele scenarii confirmau problema
înainte de fix.

**Soluție:** gardă de identitate per-tab (`session-identity.ts`), susținută
de `sessionStorage` (spre deosebire de cookie/localStorage, e izolat
per-tab). Fiecare tab își reține contul cu care crede că rulează; orice
restaurare pasivă de sesiune compară id-ul din tokenul nou cu ce avea deja
tab-ul — la mismatch, respinge răspunsul și forțează delogare cu mesaj
explicit, în loc să adopte silențios noua identitate.

**Status:** ✅ Rezolvat (confirmat, verificat cu cele 2 scenarii Playwright) — `494a4e6`

---

## 6. Race la restaurarea sesiunii poate suprascrie un login/register proaspăt

**Simptom:** un cont cu sesiune veche validă putea, printr-o coincidență de
timing, să suprascrie silențios un login/register nou-nouț în același tab
— UI-ul ajungea să arate datele contului VECHI sub sesiunea nou creată.

**Cauză:** la montare, `AuthProvider` pornește un `POST /auth/refresh`
asincron ca să restaureze o sesiune existentă. Dacă răspunsul acelei cereri
sosea DUPĂ ce utilizatorul făcuse deja login/register explicit, suprascria
sesiunea nouă cu cea veche.

**Notă importantă:** nu era o scurgere de date la nivel de backend/RLS —
izolarea pe server era corectă tot timpul. Era strict o cursă (race
condition) pe frontend între restaurarea de sesiune de la montare și
apelurile explicite login()/register()/logout().

**Soluție:** un contor de versiune de sesiune (`sessionVersionRef`),
incrementat de login/register/logout. Restaurarea de la montare verifică
versiunea la cele două puncte de control asincrone ale ei și își aruncă
rezultatul dacă între timp s-a stabilit o sesiune mai nouă.

**Status:** ✅ Rezolvat (confirmat, verificat cu răspuns de refresh întârziat
determinist, pe ambele variante — declanșată de register și de login) — `77125e8`

---

## 7. Coliziune de `employeeCode` după ștergerea definitivă a unui angajat

**Simptom:** adăugarea unui angajat nou eșua cu violare de constrângere
unică pe `(companyId, employeeCode)`, după ce anterior fusese șters
definitiv (hard-delete) un angajat din mijlocul listei.

**Cauză:** codul se genera din `tx.employee.count(companyId) + 1` — corect
doar dacă numărul de angajați crește mereu. Hard-delete chiar șterge
rânduri: ștergerea lui EMP-0003 (din 5) scade count-ul, deci următoarea
angajare calcula un cod care coincidea cu EMP-0005, încă în uz.

**Soluție:** codul următor se generează din cel mai mare `employeeCode`
existent, nu din numărul de rânduri — monoton, indiferent de golurile
lăsate de ștergeri.

**Status:** ✅ Rezolvat (aplicat) — `1114401`

---

## 8. Butoanele Aprobă/Respinge la cererile de concediu nu făceau nimic vizibil

**Simptom:** click pe Aprobă/Respinge, fără nicio reacție vizibilă în UI.

**Cauză:** pagina apela mutațiile cu `.mutate()` simplu, fără gestionare de
eroare — orice eșec (permisiune, rețea, orice) era înghițit silențios, fără
niciun feedback.

**Investigație:** aprobarea Manager/HR reprodusă direct — backend-ul
funcționa corect. Problema era strict de prezentare pe frontend.

**Soluție:** mutațiile folosesc acum `mutateAsync` cu mesaj de eroare
vizibil la eșec, iar butoanele Aprobă/Respinge sunt ascunse complet pentru
cine nu are `leave_requests:approve` (în loc să afișeze un buton care ar da
403 silențios).

**Status:** ✅ Rezolvat (aplicat) — `ab06a02`

---

## 9. Dropdown-ul "Tip concediu" gol pentru angajați noi + permisiuni de self-service lipsă

**Simptom:** un angajat nou-angajat, la prima cerere de concediu, vedea
dropdown-ul de tip de concediu complet gol.

**Cauză:** dropdown-ul era construit din rândurile `LeaveBalance` ale
angajatului, nu din lista `LeaveType` a companiei. Soldurile se creează
abia lazily, la aprobarea unei cereri — deci orice angajat fără nicio
cerere aprobată încă avea, structural, zero solduri și deci dropdown gol.

**Soluție:** adăugat `GET /leave-requests/types`, bazat pe `LeaveType` (nu
pe `LeaveBalance`), și dropdown-ul frontend redirecționat spre el.

**Bug secundar găsit testând sistematic "la fiecare rol":** MANAGER, HR și
ACCOUNTANT nu aveau `leave_requests:create`/`attendance:create` în
`DEFAULT_ROLE_PERMISSIONS`, iar ACCOUNTANT nu avea deloc
`leave_requests:read`/`attendance:read` — puteau aproba/gestiona concediile
și pontajul altora, dar nu puteau cere concediu sau ponta pentru ei înșiși.

**Soluție:** catalogul de permisiuni implicite corectat pentru companii
noi + migrare de backfill pentru companiile deja înregistrate.

**Status:** ✅ Rezolvat (aplicat) — `f77fb97`

---

## 10. Scurgere de cache cross-cont pe cererile de concediu ("Cererile mele")

**Simptom raportat:** un admin vedea, pentru scurt timp, cererea de
concediu a unui angajat sub "Cererile mele" — după o schimbare de cont.

**Cauză:** `QueryClient`-ul din react-query trăiește deasupra
`AuthProvider` și supraviețuiește login/logout (nu are loc niciun reload
complet de pagină la schimbarea contului). Chei de cache precum
`['leave-requests', 'mine']` nu erau scoped per-utilizator, deci
schimbarea contului în același tab putea scurt afișa datele contului
anterior sub cel nou.

**Soluție:** `queryClient.clear()` apelat la login/register/logout.

**Status:** ✅ Rezolvat (aplicat) — `d49131f` (vezi și #14 mai jos — aceeași
clasă de problemă, reapărută mai târziu la o scară mai largă)

---

## 11. Ultimul Admin activ își putea schimba singur rolul, blocând compania

**Simptom:** era posibil să schimbi rolul singurului Admin activ al unei
companii către un rol fără `employees:update` — găsit testând direct
fluxul de auto-retrogradare.

**Cauză:** nicio verificare la schimbarea rolului nu ținea cont de faptul
că target-ul era ultimul Admin activ.

**Soluție:** blocaj explicit — schimbarea rolului departe de Admin e
respinsă când target-ul e singurul Admin activ al companiei.

**Status:** ✅ Rezolvat (aplicat) — `f8770d6`

---

## 12. Angajat dintr-o firmă apărând sub altă firmă (raportul inițial) — investigație în mai mulți pași

Asta a fost cea mai lungă investigație — raportul inițial al userului
("un angajat de la o firmă apare la alta") s-a dovedit a avea **două cauze
distincte**, găsite în etape succesive.

### 12.1 — Chei de cache react-query comune tuturor companiilor

**Simptom raportat:** testând panoul nou de dezvoltator, un admin a văzut
scurt un angajat al altei companii în propria listă de angajați.

**Investigație:** reproduse mai multe scenarii realiste de schimbare de
cont — relogin în același tab cu o cerere lentă în zbor, cookie comun +
reload în două taburi. Izolarea la nivel de API și gărzile de identitate de
sesiune (#5, #6) au ținut corect în toate cazurile.

**Soluție aplicată oricum, ca strat suplimentar de apărare:** `companyId`
adăugat în toate cheile de cache react-query (angajați, departamente,
concedii, pontaje, roluri, companie, abonament) — un răspuns întârziat
poate acum scrie doar în sertarul companiei lui, niciodată peste compania
activă.

**Status la acel moment:** ✅ Rezolvat (aplicat) — `cb83015`

### 12.2 — Cauza reală: aplicația rula cu rol de superuser Postgres, RLS complet ocolit

**Cum a ieșit la iveală:** testând crearea unei firme noi, dropdown-ul de
roluri la "Adaugă angajat" arăta 10 intrări în loc de 5 (fiecare rol
duplicat). Verificare directă în bază (`SELECT "companyId", name,
"systemKey" FROM roles`) a arătat că cele 10 rânduri aparțineau la **două
`companyId` diferite**, nu erau duplicate reale — RLS nu filtra deloc
pe compania curentă.

**Cauză rădăcină confirmată:** rolul dedicat, non-superuser
(`worksphere_app`, referențiat în `apps/api/.env`) nu fusese niciodată creat
efectiv în baza de date. Interogarea `SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles` a arătat un singur rol real existent — `worksphere`, cu
`rolsuper = t` și `rolbypassrls = t` — userul bootstrap al imaginii oficiale
Postgres. Postgres exceptează superuserii de la Row Level Security
necondiționat, indiferent de `FORCE ROW LEVEL SECURITY`. Toate politicile
RLS din migrarea `enable_row_level_security` erau scrise corect, dar complet
decorative — asta explică, cel mai probabil, și raportul inițial de la
începutul acestei intrări (#12.1), nu (doar) cache-ul react-query.

**Soluție:**
- `docker/postgres/init-app-role.sh` — rulează automat la primul boot al
  containerului Postgres (`docker-entrypoint-initdb.d`) și creează rolul
  `worksphere_app` (`NOSUPERUSER NOBYPASSRLS`) cu grant-uri corecte,
  inclusiv `ALTER DEFAULT PRIVILEGES` pentru tabelele viitoare.
- `docker-compose.yml` — serviciul `api` folosește acum `worksphere_app`,
  nu userul bootstrap; serviciul `migrate` rămâne pe superuser (are nevoie
  de el pentru DDL: `CREATE POLICY`, `ALTER TABLE`).
- Filtrare explicită `where: { companyId: TenantContext.requireCompanyId() }`
  adăugată ca strat doi de apărare (nu doar RLS) în toate query-urile de
  tip listă care se bazau exclusiv pe RLS: `employees`, `roles`,
  `departments`, `attendance` (listă + raport lunar), `leave-requests`
  (listă, contor pending, tipuri de concediu, solduri).

**Discuție colaterală:** userul a întrebat dacă n-ar fi mai simplu să existe
o bază de date separată per cont. Răspuns: nu — modelul "un tenant, o bază"
crește costul operațional liniar cu numărul de firme (migrări, pooling,
backup per bază) și complică raportarea la nivel de platformă, fără să
rezolve o problemă de arhitectură — problema era o eroare de provisionare,
nu design-ul cu bază comună + RLS.

**Probleme practice întâmpinate la aplicarea fix-ului pe mașina locală a
userului:**
- Comanda SQL inițială (bloc `DO $$ ... $$`) nu putea fi lipită în sesiunea
  interactivă `psql` din terminalul Windows (Ctrl+V nepermis) — rezolvat
  rescriind comanda ca o singură linie, cu `CREATE ROLE` + `ALTER ROLE`
  separate în loc de bloc `DO $$`, rulată direct din shell cu mai multe
  flag-uri `-c` (evită complet caracterele `$$`, care oricum ar fi fost
  interpretate greșit de `cmd.exe`/bash ca alte lucruri).
- `echo $DATABASE_URL` nu funcționează în Command Prompt (Windows) — acolo
  sintaxa corectă e `echo %DATABASE_URL%`.

**Status:** ✅ **Rezolvat (confirmat de user)** — `bc972e2`. Confirmarea a
venit după ce userul a rulat fix-ul pe baza locală și a retestat manual
crearea unei firme noi + adăugarea unui angajat.

---

## 13. 403 Forbidden pe `/employees`, `/departments`, `/roles` — clarificare, nu bug

**Context:** în timpul investigației de la #12, userul a văzut în log-urile
API-ului `WARN [ExceptionFilter] GET /employees → 403` (și la fel pentru
`/departments`, `/roles`).

**Explicație:** comportament corect al `PermissionsGuard`
(`apps/api/src/common/guards/permissions.guard.ts`) — respinge cererea
când rolul curent nu are permisiunea cerută de `@RequirePermission(...)`.
Nu a fost identificat niciun bug asociat direct acestui log; a fost
relevant doar ca semnal colateral în investigația de la #12.

**Status:** clarificare — nu a necesitat fix separat.

---

## 14. Roluri de editare — funcție lipsă la editarea departamentului unui angajat

**Simptom:** modalul "Editează rol / funcție" permitea schimbarea rolului
și a funcției unui angajat, dar nu și a departamentului — nu exista nicio
cale din UI să muți un angajat existent în alt departament fără să-l ștergi
și să-l re-adaugi.

**Cauză:** backend-ul (`PATCH /employees/:id`) accepta deja `departmentId`
în body — lipsea doar câmpul din formularul de editare.

**Soluție:** select de "Departament" adăugat în același modal, alături de
rol și funcție.

**Status:** ✅ Rezolvat (confirmat) — `3ed8cb5`

---

## 15. Tema implicită a platformei urma preferința sistemului de operare, nu era mereu light

**Simptom:** vizitatori noi (sau cu sistemul de operare setat pe dark)
vedeau platforma implicit în dark, deși comportamentul dorit era light by
default pentru toată lumea.

**Cauză:** `ThemeProvider` avea `defaultTheme="system"` — la prima
vizită, fără nicio preferință salvată, tema urma exact setarea sistemului
de operare al vizitatorului.

**Soluție:** `defaultTheme` schimbat în `"light"`. Comutatorul de temă
rămâne funcțional pentru oricine vrea dark sau vrea să urmeze sistemul.

**Status:** ✅ Rezolvat (confirmat) — `3ed8cb5`

---

## 16. Departamentele nu puteau fi editate sau șterse din UI

**Simptom:** odată creat un departament greșit (nume introdus greșit, sau
pur și simplu nu mai era nevoie de el), nu exista nicio cale din interfață
să fie editat sau șters.

**Cauză:** exact tiparul de la #14/`1bb2afa` — `DELETE /departments/:id` și
`PATCH /departments/:id` existau deja pe backend (`remove()` refuză deja
corect ștergerea dacă departamentul are angajați sau sub-departamente),
dar pagina de Departamente (`apps/web/src/app/(dashboard)/dashboard/departments/page.tsx`)
nu avea deloc butoane de editare/ștergere — doar listă + creare.

**Soluție:** adăugate `useUpdateDepartment`/`useDeleteDepartment` în
`use-departments.ts` și butoane editare (creion) / ștergere (coș) pe
fiecare card, cu dialog de confirmare la ștergere care afișează mesajul
de eroare al backend-ului (ex. "are angajați asociate") în loc să eșueze
silențios.

**Status:** ✅ Rezolvat (confirmat) — `0a1f152`

---

## 17. Nu exista nicio cale să scoți un angajat dintr-un departament (ca să-l poți șterge)

**Context:** venit direct din #16 — guard-ul de ștergere e corect (nu
lasă ștergerea unui departament cu angajați), dar userul a întrebat cum
ar trebui rezolvat: să slăbim guard-ul (ștergere forțată, cu angajații
scoși automat/silențios), sau să dăm o cale explicită să muți angajații
afară întâi.

**Decizie:** a doua variantă — slăbirea guard-ului ar însemna că ștergerea
unui departament devine, pe ascuns, o editare în masă a tuturor angajaților
lui (fie li se golește departamentul fără ca nimeni să vadă exact cine a
fost afectat, fie — și mai rău — ar fi șterși și ei). Un guard care poate
fi ocolit doar editând angajați unul câte unul, explicit, rămâne o plasă
de siguranță reală.

**Cauză:** select-ul de "Departament" din modalul "Editează rol / funcție"
(#14) putea comuta doar între departamente existente, niciodată înapoi la
"niciunul" — Radix Select nu acceptă `value=""` pe un item, deci lipsea
o sentinelă pentru "fără departament".

**Soluție:** adăugată opțiunea "Fără departament" (sentinelă `__none__`,
mapată la `null` la submit) în select-ul din modalul de editare. Acum un
departament poate fi golit angajat cu angajat și apoi șters cu `DELETE
/departments/:id`, care rămâne neschimbat.

**Status:** ✅ Rezolvat (confirmat) — `b4fbbd6`

---

## 18. Schimbarea de plan permitea upgrade gratuit, fără nicio plată, odată ce Stripe a fost adăugat

**Context:** găsit chiar în timpul implementării billing-ului Stripe, nu
raportat separat de user — `PATCH /companies/me/subscription` (folosit de
pagina de setări cont) atribuia orice plan direct, fără procesare de
plată. Asta era corect și intenționat CÂT TIMP Stripe nu exista deloc
(comentariul din cod spunea explicit asta) — dar odată ce
`POST /billing/checkout` a devenit calea reală de plată, același endpoint
vechi rămânea deschis ca o cale de upgrade la orice plan plătit, complet
gratuit, ocolind Stripe în totalitate.

**Cauză:** `CompaniesService.updateSubscription()` nu avea nicio verificare
asupra prețului planului cerut — accepta orice `planSlug` valid.

**Soluție:** endpoint-ul respinge acum explicit (403) orice plan cu
`priceMonthlyCents > 0`, îndrumând către `POST /billing/checkout`. Rămâne
funcțional doar pentru downgrade la planul gratuit (`trial`).

**Status:** ✅ Rezolvat (aplicat) — `6071ba1`

---

## 19. Webhook Stripe pica cu 500 pe `checkout.session.completed` — planul rămânea "trial" după plată reală

**Simptom raportat:** userul a testat checkout-ul real (card de test Stripe),
plata a mers, dar în aplicație planul a rămas tot "Trial" — nicio schimbare
vizibilă după ce s-a întors din Stripe.

**Investigație:** log-ul `stripe listen` arăta toate evenimentele
întoarse cu `[200]`, cu o singură excepție: `checkout.session.completed`
→ `[500]` — exact evenimentul care ar fi trebuit să actualizeze
abonamentul.

**Prima rundă de cauze găsite (reale, dar nu cauza finală):**
1. `resolveCompanyId` (fallback după `stripeCustomerId`) și ambele
   interogări din `onInvoiceEvent` foloseau clientul Prisma brut
   (`this.prisma.subscription`/`this.prisma.invoice`) în loc de
   `this.prisma.tenantScoped...` — bypass complet al contextului de
   tenant, nu doar al flag-ului de RLS bypass. Aceeași clasă de bug ca
   #12.2 — reparat, dar nu era declanșatorul exact aici.
2. `current_period_start`/`current_period_end` citite doar de pe
   `SubscriptionItem` — puteau produce `new Date(NaN)` pe versiuni API
   Stripe mai vechi. Reparat cu un helper `toSafeDate()`, tot nu era
   cauza reală a acestui 500 specific (`0529357`).

**Cauza reală** (găsită abia din stack trace-ul complet, cerut explicit de
la user): `subscription.update({ where: { companyId } })` folosește
`update()`, care aruncă `P2025` ("no record found for an update") dacă 0
rânduri se potrivesc — și în acest caz se potriveau 0, deși rândul chiar
exista cu `companyId`-ul corect (confirmat direct în Postgres, cu
superuser). Nici migrațiile RLS, nici datele nu erau problema.

**Soluție finală:** `TenantContext.runAsBypass()` + `this.prisma.tenantScoped`
(bazate pe `AsyncLocalStorage`) nu produceau, din motive neclare, efectul
așteptat pentru acest apel — înlocuite cu un mecanism auto-conținut,
propriu `BillingService` (`runBypassingRls`): o singură tranzacție Prisma
interactivă, cu `app.bypass_rls = true` setat manual, explicit, direct pe
ea — fără AsyncLocalStorage, fără nimic împărțit cu alt cod.

**Status:** ✅ Rezolvat (confirmat — checkout real, plan activat corect) — `414112f`

---

## 20. Stripe te trimitea înapoi pe pagina greșită după plată — plus lipsea confirmarea vizuală

**Simptom raportat:** după alegerea și plata unui plan, userul ajungea pe
"Setări companie" fără niciun semn vizibil că plata a fost înregistrată —
și a remarcat, pe bună dreptate, că un checkout mai profesional ar trebui
să-i arate datele firmei înainte de plată, și un mesaj clar de succes după.

**Cauză:** `success_url`/`cancel_url`/`return_url` din `BillingService`
indicau toate spre `/dashboard/settings` ("Setări companie"), dar
selectorul de plan există pe `/dashboard/account` ("Setările contului") —
o pagină complet diferită. Nicio confirmare pre-plată, niciun mesaj
post-plată.

**Soluție:**
- Corectate toate cele trei URL-uri spre `/dashboard/account`.
- Adăugat un dialog de confirmare ÎNAINTE de checkout — arată numele
  firmei, CUI, email și planul/prețul ales, cu buton explicit "Continuă
  spre plată", în loc de redirect instant la click.
- La întoarcere, banner clar de succes/anulare (citit o singură dată din
  `?checkout=`, apoi URL-ul e curățat cu `router.replace` ca un refresh să
  nu repete mesajul) + câteva refetch-uri automate în ~6s, ca planul nou
  (actualizat de webhook asincron) să apară fără reîncărcare manuală.

**Status:** ✅ Rezolvat (confirmat — checkout real, de la un capăt la altul) — `7784a2c`

---

## 21. Activarea push-ului dădea `AbortError: no active Service Worker`

**Simptom raportat:** click pe "Activează notificările push", userul
acceptă permisiunea browserului, apoi eroare pe ecran: `AbortError: Failed
to execute 'subscribe' on 'PushManager': Subscription failed - no active
Service Worker`.

**Cauză:** `navigator.serviceWorker.register()` se rezolvă imediat ce
înregistrarea e creată, nu neapărat după ce worker-ul chiar s-a instalat
și activat. `getToken()` (intern, `PushManager.subscribe()`) are nevoie de
un worker deja activ — la o primă înregistrare, de obicei nu e încă activ
în momentul în care `register()` se rezolvă.

**Soluție:** după `register()`, se așteaptă `navigator.serviceWorker.ready`
(se rezolvă exact când un worker devine activ și preia controlul paginii,
inclusiv la prima instalare) înainte de a apela `getToken()`, în loc să se
folosească direct obiectul de înregistrare întors de `register()`.

**Status:** ✅ Rezolvat (aplicat, în așteptarea confirmării userului) — `35e3c03`

---

## 22. Butonul "Activează notificările push" nu făcea nimic vizibil / dispărea fără să fi funcționat

**Simptom raportat:** click pe buton — nimic vizibil (niciun popup de
permisiune, nicio cerere către Firebase în Network). Activând manual
permisiunea din setările browserului și reîncărcând, clopoțelul arăta ca
și cum notificările ar fi active, deși niciun token nu fusese vreodată
înregistrat pe server.

**Cauze (două, ambele în cod client):**
1. `requestPushToken()` întorcea `null` — tăcut, fără nicio diferență —
   pentru orice eșec: config Firebase incomplet (ex. lipsă VAPID key),
   browser nesuportat, SAU refuzul userului. Un `.env` incomplet arăta
   identic cu "nu s-a întâmplat nimic".
2. Butonul era ascuns pe baza `Notification.permission === 'granted'` —
   dar permisiunea browserului acordată nu înseamnă că s-a obținut
   vreodată efectiv un token FCM (poate eșua independent). Odată
   permisiunea acordată dintr-o încercare anterioară eșuată, butonul
   dispărea definitiv, fără nicio cale de reîncercare.

**Soluție:** doar refuzul explicit de permisiune mai întoarce `null` —
orice altă condiție aruncă o eroare specifică, afișată direct sub buton.
Vizibilitatea butonului nu mai depinde de starea permisiunii, doar de
config+suport browser — un nou click e mereu sigur (reînregistrarea
aceluiași token e idempotentă pe server).

**Status:** ✅ Rezolvat (aplicat, în așteptarea confirmării userului) — `ee2dc4f`

---

## Tipare observate (ca să nu se repete)

1. **RLS nu e suficient singur** — orice tabel tenant-scoped are nevoie și
   de filtrare explicită `companyId` la nivel de aplicație (#12.2). RLS e
   strat doi de apărare, nu singurul strat.
2. **Cache-ul de pe client trebuie scoped per-tenant/per-cont explicit** —
   nu e suficient să te bazezi doar pe `queryClient.clear()` la
   login/logout (#10, #12.1); orice cheie de cache dintr-o aplicație
   multi-tenant ar trebui să includă `companyId`/`userId` din start.
3. **Testarea "la fiecare rol", nu doar happy-path-ul Admin**, a găsit de
   fiecare dată bug-uri reale de permisiuni (#9, #11) care ar fi rămas
   invizibile testând doar cu un cont de Admin.
4. **Provisioning-ul de infrastructură (roluri DB, useri, parole) nu
   trebuie lăsat ca instrucțiune manuală într-un comentariu** — exact asta
   a cauzat #12.2; acum e automatizat în
   `docker/postgres/init-app-role.sh`.
5. **Un endpoint backend gata nu înseamnă că UI-ul chiar îl expune** — s-a
   repetat de două ori (#14 angajați → `1bb2afa`, #16 departamente →
   `0a1f152`): CRUD-ul complet exista pe server, dar pagina nu avea
   butonul. Merită verificat explicit, la fiecare modul nou, că fiecare
   endpoint de mutație (`POST`/`PATCH`/`DELETE`) chiar are un loc din care
   poate fi declanșat din interfață.
6. **La adăugarea unei plăți reale (Stripe), verifică ce cale "de test,
   fără plată" exista înainte** (#18) — un shortcut care era corect cât
   timp nu exista billing real devine o gaură de monetizare în momentul
   în care apare o cale de plată reală în paralel cu el.
