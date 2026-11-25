# Notification Service — Revision Notes

Last updated: 2026-11-20 · Lessons 1–3 complete

---

## Lesson 1: End-to-end request flow

API email khud nahi bhejti. Woh kaam ko Postgres mein register karti hai, BullMQ queue mein schedule karti hai, aur turant 201 return kar deti hai. Email baad mein worker bhejta hai. Ise **asynchronous processing** kehte hain.

```
Client ──POST──► API process (route → controller → service)
   ◄──201 turant──┘   │
                      ├─ 1. save row (PENDING) ─────────► PostgreSQL (source of truth)
                      └─ 2. queue.add() ──► Redis (BullMQ)            ▲
                                               │                      │ 4. status update
                                               └─ 3. job uthao ──► Worker
                                                                      │ 5. sendEmail()
                                                                      ▼
                                                                   SendGrid
```

Client ko 201 step 2 ke baad hi mil jaata hai. Steps 3 se 5 worker background mein karta hai.

### Layers aur unka kaam

| Layer | File | Kaam |
| --- | --- | --- |
| Route | src/api/routes/notification.route.js | URL + method ko function se map karna |
| Controller | src/api/controllers/notification.ctrl.js | req/res handle karna, status code set karna |
| Service | src/api/services/notification.service.js | Business logic, Express se independent (test karna aasaan) |
| Queue | src/queues/notification.queue.js | Redis se connected BullMQ Queue |
| Worker | src/workers/notification.worker.js | Job process karna, DB status update, email bhejna |
| Email | src/api/services/email.service.js | SendGrid ko {to, from, subject, text} bhejna |

### Queue kyun use karte hain

- User ko wait nahi karna padta. API ~100ms mein jawab de deti hai, chahe 10,000 emails hon.
- Crash ho jaaye toh bhi kaam lost nahi hota. Job Redis mein hai aur row DB mein.
- Retries aur backoff free mein milte hain.
- Rate limiting: SendGrid ki limits ke hisaab se speed control kar sakte ho.
- Scaling: load badhe toh bas aur workers chala do.

### Job data: sirf ID ya poora object?

- **Sirf ID** (`{ notificationId }`): Redis halka rehta hai, worker DB se fresh data padhta hai (delayed job ke beech edit ya cancel hua ho toh bhi sahi data milta hai), aur source of truth ek hi rehta hai. Cost: har job par ek DB read.
- **Poora object**: DB read nahi lagta, lekin data stale ho sakta hai, Redis memory zyada lagti hai, aur data do jagah duplicate hota hai.
- **Best of both**: batch mein IDs bhejo, worker mein ek `findAll({ where: { id: ids } })` karo.

### Dual-write problem

Postgres aur Redis do alag systems hain. Agar DB save ho gaya lekin `queue.add()` fail ho gaya, toh job bani hi nahi, isliye BullMQ retry nahi karega. Row hamesha PENDING reh jaayegi (orphan). Agar client ne dobara request bheji, toh duplicates bhi ban jaayenge.

Solutions:
1. try/catch karke row ko FAILED mark karo
2. Sweeper cron jo purani PENDING rows ko dobara queue mein daale
3. Transactional Outbox pattern

### dotenv

`require()` synchronous hai, aur file ka top-level code require hote hi chal jaata hai. Isliye `require('dotenv').config()` entry file ki **sabse pehli line** honi chahiye.

---

## Redis aur BullMQ ka rishta

BullMQ sirf ek library hai (tumhare Node process ke andar ka code). Jobs Redis mein store hoti hain, jo API (producer) aur worker (consumer) ke beech shared notice board ka kaam karta hai.

**Redis hi kyun?** JS array crash hone par data kho deta hai aur doosre process use dekh nahi sakte. Postgres mein polling karni padti hai aur locking heavy ho jaati hai. Redis shared hai, in-memory (sub-ms) hai, aur uske paas queue-friendly data structures hain.

| BullMQ concept | Redis structure | Kyun |
| --- | --- | --- |
| Waiting jobs | List | FIFO, queue ka natural shape |
| Delayed jobs (sendAt, backoff) | Sorted Set (score = timestamp) | "Kiska time aa gaya" ek fast query mein nikal jaata hai |
| Job data | Hash (bull:notificationQueue:12) | Ek job ke saare fields ek key mein |
| Events | Streams / Pub-Sub | Bull Board jaisi cheezein live updates sun sakti hain |

- **Atomicity:** BullMQ Redis ke andar Lua scripts chalata hai. Redis single-threaded hai, isliye "wait se nikalo, active mein daalo, lock lagao" ek hi atomic step mein hota hai. Isse ek job ek hi worker ko milti hai.
- **Blocking commands:** worker baar-baar poll nahi karta, job aane tak Redis par so jaata hai. Isi wajah se ioredis mein `maxRetriesPerRequest: null` mandatory hai.
- **Locks aur stalled jobs:** active job par worker lock lagata hai aur use renew karta rehta hai. Worker crash hua toh lock expire ho jaata hai, job stalled maani jaati hai aur wapas wait mein chali jaati hai. Job lost nahi hoti, lekin email do baar ja sakti hai, isliye **idempotency** zaroori hai.

### Job lifecycle

```
queue.add()
   ├─ delay hai? ──► [delayed] ──(time aaya)──┐
   ▼                                           ▼
 [wait] ─────── worker uthata hai ─────► [active] (lock)
                     resolve ◄──────────────┴──────► reject (throw)
                        ▼                              │
                  [completed]            attempts bache hain?
                                         ├─ haan → [delayed] (backoff) → wait
                                         └─ nahi → [failed]
```

### return vs throw (sabse important)

- BullMQ return ki **value** nahi dekhta, sirf Promise ka result dekhta hai.
- Promise **resolve** hua (`return true`, `undefined`, kuch bhi) → job `completed`, aur retry kabhi nahi hota.
- Promise **reject** hua (uncaught throw) → `failedReason` save hota hai, aur attempts bache hon toh backoff ke baad retry hota hai.
- Catch karke error nigal liya aur function khatam ho gaya, toh bhi job `completed` hi maani jaayegi. Return na likhna bhi resolve hi hai.

### Production Redis settings

- `maxmemory-policy noeviction`: warna memory full hone par Redis chupchaap jobs delete (evict) kar sakta hai.
- AOF persistence on rakho, taaki restart par jobs bachi rahein.

**Khud dekho:** `redis-cli -p 6380 KEYS "bull:notificationQueue:*"` aur `redis-cli -p 6380 HGETALL bull:notificationQueue:1`

---

## Lesson 2: Sequelize models aur migrations

Migration DB ka schema badalti hai (ek baar chalti hai, git mein versioned hoti hai). Model JS code ko batata hai ki table kaisi dikhti hai (har run par use hota hai).

**ORM kyun:** parameterized queries ki wajah se SQL injection se bachav, associations aur transactions aasaan. Trade-off: complex queries mein ORM slow ya confusing ho sakta hai, tab `sequelize.query()` se raw SQL likho.

| | Migration | Model |
| --- | --- | --- |
| Kya hai | Schema change script (up/down) | Table ka JS description |
| Kab chalta hai | Ek baar, `npx sequelize-cli db:migrate` | Har baar app start hone par |
| Kis ke liye | Database | Tumhara code |

- **`sync({ alter: true })` production mein kyun nahi:** yeh columns drop ya badal sakta hai (data loss), history nahi rakhta, code review nahi hota, aur rollback ka option nahi hota.
- **SequelizeMeta:** yeh DB ki ek table hai jismein har chali hui migration ka filename save hota hai. Filename mein timestamp hota hai taaki order fix rahe.

### Migration rules

- `down()` hamesha `up()` ka exact ulta hona chahiye: createTable ↔ dropTable, addColumn ↔ removeColumn.
- Postgres ENUM column ek alag TYPE banata hai (`enum_<table>_<column>`). `dropTable` us type ko nahi hatata, isliye `down()` mein `DROP TYPE IF EXISTS` likho. **Yeh sirf ENUM columns ke liye hota hai**, DATE/STRING ke liye koi type nahi banta.
- Jo migration shared environment mein chal chuki hai, uska `up()` kabhi edit mat karo. Nayi migration banao.

### Baaki concepts

- **models/index.js:** `NODE_ENV` ke hisaab se config uthata hai, models folder ki har file auto-load karta hai, phir saare models load hone ke baad har model ka `associate()` call karta hai. Associations baad mein isliye, kyunki Campaign model pehle se loaded hona chahiye.
- **Associations vs Foreign Key:** `hasMany`/`belongsTo` sirf JS methods aur JOIN (include) dete hain. Asli FK constraint migration mein `references` se banta hai. `onDelete: 'SET NULL'` ka matlab hai ki campaign delete hone par notifications bachi rehti hain, bas unka campaignId null ho jaata hai.
- **increment vs read-then-update:** `Campaign.increment()` se SQL banta hai `SET successCount = successCount + 1`, jo DB ke andar atomic hai. Agar pehle `findByPk` karke phir `update` karo, toh concurrent workers dono 10 padhenge, dono 11 likhenge, aur ek count kho jaayega. Ise **lost update / race condition** kehte hain.
- **Transaction:** `sequelize.transaction(async (t) => { ... })` ke andar ki saari queries ya toh sab commit hongi ya sab rollback. Yeh sirf Postgres ke andar kaam karta hai, Redis iske bahar hai (isliye dual-write problem alag se solve karni padti hai).
- **Indexes:** Postgres foreign key par apne aap index nahi banata (MySQL banata hai). Index na ho toh `WHERE campaignId = ?` full table scan karega. Iske liye `queryInterface.addIndex('notifications', ['campaignId'])` wali migration chahiye.
- **Validation ki 3 layers:** API (Joi) bura input darwaze par 400 ke saath rokta hai. Model (`allowNull`, `validate: { isEmail: true }`) JS level par check karta hai. DB constraint last line of defence hai.

---

## Lesson 3: BullMQ deep dive

### Retries (`attempts`)

- `attempts: 3` = **total 3 runs** (1 original + 2 retries), "3 retries" nahi.
- **Default `attempts` = 1**, matlab koi retry nahi. Option na diya toh pehli failure par hi job permanently failed.
- Retry sirf **transient** failures ke liye hai (SendGrid 5xx, 429, network timeout, DB timeout).
- **Permanent** failures (invalid email, SendGrid 400/401/403) par retry bekaar hai, toh `throw new UnrecoverableError('...')` karo, BullMQ attempts bache hone par bhi retry nahi karega.

### Backoff

| Type | delay: 5000, attempts: 3 | Kab |
| --- | --- | --- |
| fixed | run1 → 5s → run2 → 5s → run3 | Simple cases |
| exponential | run1 → 5s → run2 → 10s → run3 (`delay × 2^(attemptsMade-1)`) | External APIs (SendGrid) |

- 3 attempts mein sirf **2 waits** hote hain (pehla run turant).
- **Thundering herd:** fixed backoff mein hazaaron failed jobs ek hi second par wapas service par hit karti hain, aur woh aur overload ho jaati hai. Exponential + **jitter** (random delay) isse bachata hai.

### Delayed jobs

- `delay` wali job `delayed` **sorted set** mein jaati hai (score = run time). Time aane par `wait` mein move hoti hai.
- **Timezone trap:** bina timezone ki date string server ke local time mein parse hoti hai (laptop IST, Docker UTC). ISO + offset lo (`2026-12-01T10:00:00+05:30`) aur Joi se validate karo.
- **Cancel:** delayed job ko `job.remove()` se hatao. Meaningful `jobId` (`notif-${id}`) do taaki dhundh sako. Bonus: same `jobId` dobara add nahi hota, toh duplicate enqueue se bachav.

### Concurrency vs Limiter

- **concurrency** = ek worker process ek saath kitni jobs chalaye (slots). Total slots = processes × concurrency.
- **limiter** = poori queue (saare workers milke, Redis mein shared counter) per second kitni jobs **start** kar sakti hai.
- Dono alag limits hain, aur jo pehle hit ho wahi bottleneck hai. Inhe multiply nahi karte.
  - 3 × 5 = 15 slots. Job 2s leti hai → max 15/2 = 7.5 jobs/sec, limiter (20/s) kabhi hit nahi hoga.
  - Job 100ms leti hai → slots 150/sec de sakte hain, lekin limiter 20/sec par rok dega.
- Restaurant analogy: concurrency = tables kitni hain, limiter = darwaze par guard jo per minute kitne log andar aane deta hai.
- **Worker ≠ job.** Worker = chef (kaam karne wala), job = order (kaam). Limiter jobs ke **start** ginta hai, workers nahi.
- **Calculate karne ke 4 steps:**
  1. Slots (chefs) = worker processes × concurrency
  2. Slots ki speed = slots ÷ ek job ka time (seconds)
  3. Limiter ki speed = max / duration
  4. Asli speed = dono mein jo **chhota** ho → wahi bottleneck
- **Worked example:** 4 workers × concurrency 10 = 40 slots, job 4s leti hai, limiter 50/sec.
  ```
  Second 0: 40 jobs shuru (guard 50 tak allow, par slots sirf 40)
  Second 1-3: sab busy, koi nayi job shuru nahi
  Second 4: 40 khatam → 40 nayi shuru ... (har 4s mein 40)
  ```
  Slots speed = 40 ÷ 4 = 10/sec, limiter = 50/sec → asli speed **10/sec**, bottleneck **concurrency**.
- **Kyun zaroori:** bottleneck concurrency hai → workers/concurrency badhao. Bottleneck limiter hai → workers badhane se kuch nahi hoga, pehle provider (SendGrid) ki limit check karo, phir limiter badhao.
- Node single-threaded hai, phir bhi concurrency kaam karti hai kyunki email bhejna **I/O bound** hai (await ke time event loop doosri job chalata hai). CPU-heavy kaam ke liye sandboxed processors.
- Limiter **jobs** count karta hai, emails nahi. 100 emails wali batch job × 20/sec = 2000 emails/sec.
- SendGrid 429 de toh: `await worker.rateLimit(ms)` + `throw Worker.RateLimitError()`.

### Idempotency (duplicate email se bachav)

- BullMQ **at-least-once** deta hai: retry ya stalled job ki wajah se same job dobara chal sakti hai.
- Worker email bhejne se pehle DB check kare: status `SUCCESS` hai toh skip.
- Duplicate enqueue se bachne ke liye `jobId` do.
- Bacha hua window: email chali gayi, lekin `SUCCESS` likhne se pehle crash ho gaya → retry par dobara jaayegi. Exactly-once possible nahi hai, at-least-once + idempotent checks = effectively once.

### Production must-haves

- `defaultJobOptions` Queue par: attempts/backoff/removeOnComplete ek jagah likho, har `add()` mein copy-paste mat karo.
- `removeOnComplete` / `removeOnFail` (`{ count: 1000 }` ya `{ age: 86400 }`), warna completed jobs hamesha Redis mein padi rehti hain.
- Graceful shutdown: `SIGTERM` par `await worker.close()`, warna active jobs beech mein kat kar stall hongi aur duplicate emails jaa sakti hain.

---

## Lesson 4: Bug fixing (in progress)

### Design decision: ek email = ek job (`{ notificationId }`)

- Batch job (100 emails) mein ek email fail hui toh poori batch retry hoti hai → 99 duplicate emails + campaign counts double.
- Ek email = ek job: sirf wahi email retry hoti hai, counts sahi rehte hain, limiter seedha emails ginta hai, worker DB se fresh data padhta hai.
- Ek design change ne 3 bugs ki jad khatam kar di (#3 double count, #9 limiter, stale data). Trade-off: zyada jobs Redis mein → `removeOnComplete` zaroori.

### Worker likhte waqt seekha

- `findByPk(id)` mein seedha ID jaati hai. `{ where: ... }` `findOne`/`findAll` ke saath chalta hai.
- DB calls Promise return karti hain. `await` bhoola toh variable mein row nahi, Promise aayega.
- "try/catch hatao" = catch ka **poora block, andar ke code ke saath**. Catch ka code bahar reh gaya toh woh success ke baad bhi chalega (SUCCESS ke baad FAILED, aur `err` undefined → ReferenceError → retry → duplicate email).
- Bug dhundhne ki technique: code ko line by line "chala ke" dekho ki har line par kya hoga. Aur same kaam karne wali saari jagahon ko side by side compare karo.
- Array par `.data` nahi hota. Andar ke objects ki field chahiye toh `.map()`.

### Testing se seekha

- `ENOTFOUND api.sendgrid.com` = DNS/network fail → **transient**, retry karna chahiye.
- `401 Unauthorized` (galat key / trial khatam) = **permanent**, retry bekaar → `UnrecoverableError`.
- BullMQ job ID (#2157) aur notification ID (2270) alag hote hain → `jobId: notif-${id}` do taaki tracing ho sake aur duplicate enqueue ruke.
- Retry ke beech FAILED mat likho. Sirf aakhri attempt par FAILED + failedCount++, warna counts galat ho jaate hain.
- **Mock email provider:** `EMAIL_PROVIDER=mock|sendgrid`, `MOCK_EMAIL_MODE=success|fail|flaky`. Dev/test mein asli email nahi jaati, paise nahi lagte, aur failures control mein rehte hain (adapter pattern).

---

## Interview Q&A bank

"Meri galti" waali lines woh hain jahan pehli baar maine galat socha tha. Revision mein unhe zaroor padhna.

### Lesson 1

1. **Emails API request ke andar seedha kyun nahi bhejte?**
   User wait nahi karta (fast 201), crash hone par kaam lost nahi hota, retries/backoff milte hain, rate limit control hota hai, aur workers alag se scale ho sakte hain.
2. **Job mein sirf ID ya poora object?**
   Sirf ID: Redis halka, delayed jobs ko fresh data, DB single source of truth; cost ek DB read. Poora object: fast, lekin stale data aur zyada memory.
   *Meri galti:* maine bas "Redis lambe time tak save nahi karta" bola tha. Asli point yeh hai ki Redis query-able relational store nahi hai, aur completed jobs delete ho jaati hain.
3. **DB save hua par queue.add() fail ho gaya, toh kya?**
   Job bani hi nahi, isliye BullMQ retry nahi karega. Row PENDING mein atak jaati hai (dual-write problem). Fix: try/catch karke FAILED mark karo, sweeper cron, ya Transactional Outbox.
   *Meri galti:* maine "BullMQ retry kar lega" bola tha.
4. **Processor mein return vs throw?**
   Resolve hua toh completed, retry nahi. Reject hua toh failed, aur attempts bache hon toh backoff ke baad retry.
   *Meri galti:* maine socha tha ki throw par "kuch nahi hota", aur catch ke baad return na likhne se job failed maani jaayegi. Dono galat hain: catch ke baad function resolve hi hota hai, isliye job completed maani jaati hai.

### Lesson 2

1. **Model vs migration; sync({alter:true}) kyun nahi?**
   Migration DB schema ko versioned tareeke se badalti hai (up/down, git history, review). Model runtime par JS ko table ka description deta hai, table khud nahi banata. alter:true columns drop/change karke data loss kar sakta hai, aur iska koi rollback ya history nahi hoti.
2. **Kaunsi migrations chal chuki hain, yeh kaise pata chalta hai?**
   SequelizeMeta table mein har chali hui migration ka filename hota hai.
3. **increment vs findByPk + update?**
   increment DB ke andar atomic `x = x + 1` karta hai. Read-then-update mein do concurrent workers same purani value (10) padhte hain, dono 11 likhte hain, aur ek update kho jaata hai (lost update).
4. **Kya Postgres FK par index banata hai?**
   Nahi. Index na ho toh `WHERE campaignId = ?` aur `ON DELETE SET NULL` dono full table scan karenge. Iske liye addIndex wali migration banao.

### Lesson 3

1. **attempts: 3 + exponential delay 5000 — kitni baar, kitna wait?**
   Total 3 runs: run1 turant → 5s → run2 → 10s → run3 → phir bhi fail toh `failed`. Sirf 2 waits.
   *Meri galti:* formula bata diya tha lekin actual numbers aur "sirf 2 waits" nahi bataye.
2. **concurrency vs limiter; 3 workers × concurrency 5, limiter 20/sec?**
   Ek saath max 15 jobs chal sakti hain (3 × 5). Per second max 20 jobs shuru ho sakti hain (poori queue ke liye). Dono alag caps hain, jo pehle hit ho wahi bottleneck hai.
   *Meri galti:* maine 15 × 20 multiply kar diya tha. Inhe multiply nahi karte.
   *Practice (sahi kiya):* 2 workers × concurrency 5 = 10 slots, job 1s, limiter 4/sec → slots 10/sec, guard 4/sec → asli 4/sec, bottleneck limiter (6 slots khaali baithe rehte hain).
3. **Retry/stalled ki wajah se duplicate email kaise rokoge?**
   Email se pehle DB mein status check karo (`SUCCESS` → skip), duplicate enqueue rokne ke liye `jobId` do. Phir bhi ek chhota window rehta hai (bheji gayi lekin SUCCESS likhne se pehle crash), isliye system at-least-once hai.
4. **Har failure par retry kyun nahi?**
   Permanent failure (invalid email, SendGrid 400/401) retry se theek nahi hogi. `UnrecoverableError` throw karo. Transient (5xx, 429, timeout) ke liye normal throw karo taaki retry ho.

### Code exercises

- **Kis endpoint ko retry nahi milta?** `/send-notification`: `notification.service.js` mein `notificationQueue.add('sendNotification', { notificationId })` mein teesra argument (opts) hi nahi hai, toh default `attempts: 1`.
- **Options ek jagah kaise?** `new Queue(name, { connection, defaultJobOptions: { attempts, backoff, removeOnComplete } })`.

---

## Bug tracker

Ab tak 23 bugs: 3 fixed, 2 partly fixed, 18 open.

| # | Bug | File | Status | Kab |
| --- | --- | --- | --- | --- |
| 1 | Worker sirf batch jobs (job.data.notifications) samajhta hai, lekin /send-notification aur /bulk-emails { notificationId } bhejte hain (worker ab notificationId samajhta hai; CSV ko per-notification jobs bhejna baaki) | notification.worker.js | Partly fixed | Lesson 4 |
| 2 | sendEmail object { to, subject, text } maangta hai, worker positional args bhejta tha | notification.worker.js | Fixed | Lesson 4 |
| 3 | Per-email try/catch error nigal leta hai, isliye retry nahi hota; retry hua toh campaign counts double | notification.worker.js | Open | Lesson 4 |
| 4 | CSV parser email/EMAIL/Email check karta hai, lekin padhta sirf row.email hai | notification.service.js | Open | Lesson 4 |
| 5 | README.md .gitignore mein hai, isliye GitHub par nahi hai | .gitignore | Open | Lesson 4 |
| 6 | Worker API process ke andar chalta hai | server.js | Open | Lesson 5 |
| 7 | Redis host/port hardcoded hain | config/redis.js | Open | Lesson 5 |
| 8 | joi/helmet/cors/winston installed hain par use nahi hote | package.json | Open | Lesson 4 |
| 9 | Rate limiter batch jobs count karta hai, emails nahi | notification.worker.js | Open | Lesson 4 |
| 10 | /test route galat job shape { userId, message } bhejta hai | test.route.js | Open | Lesson 4 |
| 11 | dotenv late load; ab routes se upar hai lekin redis require ke neeche, ise pehli line banao | server.js | Partly fixed | Lesson 4 |
| 12 | Queue option maxRetries: null invalid hai, kuch nahi karta | notification.queue.js | Open | Lesson 4 |
| 13 | campaignName validation: check add ho gaya, lekin controller abhi bhi 500 deta hai, 400 chahiye | notification.ctrl.js | Partly fixed | Lesson 4 |
| 14 | /bulk-emails campaign ka sendAt save nahi karta tha | notification.service.js | Fixed | Lesson 2 |
| 15 | add-sendat migration ka down() khaali tha | migrations | Fixed | Lesson 2 |
| 16 | ENUM types down() mein drop nahi hote the (sendAt DATE hai, uska DROP TYPE extra hai, hatao) | migrations | Fixed | Lesson 2 |
| 17 | Campaign.create + bulkCreate transaction mein nahi hain | notification.service.js | Open | Lesson 4 |
| 18 | notifications.campaignId par index nahi hai | migrations | Open | Lesson 4 |
| 19 | config.json mein credentials hardcoded hain, test/production env nahi hai | config/config.json | Open | Lesson 5 |
| 20 | /send-notification ki job mein opts hi nahi hain → default attempts 1, koi retry nahi | notification.service.js | Open | Lesson 4 |
| 21 | attempts/backoff do jagah copy-paste; Queue par defaultJobOptions use karo | notification.queue.js | Open | Lesson 4 |
| 22 | removeOnComplete/removeOnFail nahi hain → Redis memory badhti rahegi | notification.queue.js | Open | Lesson 4 |
| 23 | Graceful shutdown nahi hai (SIGTERM par worker.close()) | notification.worker.js | Open | Lesson 5 |
