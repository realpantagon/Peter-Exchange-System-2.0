# แผนงาน: Super Rich Rate บนหน้าตั้งค่าเรท + กราฟเปรียบเทียบเรทย้อนหลัง

สถานะ: **แผน/todo — ยังไม่ implement**
เกี่ยวข้อง: `worker/` (Cloudflare Worker scrape เรท Super Rich, มีอยู่แล้ว), `src/components/AdminPage.tsx` (หน้า "ตั้งค่าเรท"), ระบบธุรกรรม (`Peter_Exchange_Transaction`)

---

## 1. เป้าหมาย

สองฟีเจอร์บนหน้า **ตั้งค่าเรท** (`/admin2025`, `AdminPage.tsx`):

- **(A) Super Rich rate + เรทแนะนำวันนี้** — แสดงเรทซื้อ/ขายของ Super Rich วันนี้คู่กับเรทของร้าน พร้อม "เรทแนะนำ" ให้แอดมินตัดสินใจตั้งเรทร้านง่ายขึ้น
- **(B) กราฟเรทย้อนหลัง** — กราฟเทียบ เรทซื้อสูงสุด/ต่ำสุดที่ร้านซื้อจริงในแต่ละวัน กับเรท Super Rich ของวันนั้น ต่อสกุลเงิน

---

## 2. สถานะปัจจุบัน (ground truth จากโค้ด)

### Worker scrape Super Rich (`worker/src/index.js`)
- เขียนลง D1 table `superrich_rates` — คอลัมน์: `scraped_at, code, currency, country_name, denomination, buying, selling, created_date` (schema ไม่มีไฟล์ `.sql` เก็บไว้ในโปรเจกต์ — สร้างผ่าน `wrangler d1 execute` เอง)
- Endpoint ที่มีอยู่แล้ว: `/trigger`, `/backfill?from=&to=`, `/latest`, `/rates?code=&limit=`, `/stats`
- Cron: ทุกวัน 09:00 ICT (`0 2 * * *` UTC)
- สกุลเงินที่ scrape: `USD (100/50), USD2 (20/10), USD1 (1), EUR, JPY, GBP, SGD, AUD, CHF, HKD, CAD, NZD, TWD, MYR, CNY, KRW` — USD แยกตามแบงค์ 3 โค้ด
- **ยังไม่เชื่อมกับ frontend เลย** — grep ทั้ง repo ไม่เจอการเรียก worker นี้จากฝั่ง `src/` และ worker response **ไม่มี CORS header** ตอนนี้ ถ้าจะ fetch ตรงจากเบราว์เซอร์จะโดนบล็อก ต้องเพิ่มก่อน

### หน้าตั้งค่าเรท (`AdminPage.tsx`)
- CRUD ง่ายๆ: `getRates()` → ตาราง `Peter_Exchange_Rate` (คอลัมน์ `id, Currency, Cur, Rate` — `Rate` เป็น string) → กด edit ทีละแถว → `updateRate(id, value)`
- ไม่มีการเทียบเรทกับที่ไหนเลยตอนนี้

### ข้อมูลเรทซื้อจริงของร้าน
- มาจากตาราง `Peter_Exchange_Transaction` (ผ่าน `getTransactions()`) — field ที่ใช้ได้: `Cur, Rate, Transaction_Type ('Buying'|'Selling'), created_at, Branch`
- คำนวณ "เรทซื้อสูงสุด/ต่ำสุดต่อวันต่อสกุล" ได้จาก filter `Transaction_Type = 'Buying'` group by วัน+`Cur` แล้ว min/max บน `Rate` (ต้อง cast string→number)

### Charting
- โปรเจกต์มี `recharts` (^3.7.0) ติดตั้งอยู่แล้ว และใช้จริงใน `DailySalesAnalytics.tsx` / `ClientTimeAnalytics.tsx` — กราฟใหม่ควรใช้ตัวเดียวกัน ไม่ต้องหา lib เพิ่ม

---

## 3. จุดที่ต้องตัดสินใจก่อนเริ่มโค้ด (ถามผู้ใช้)

1. **ทางเชื่อมข้อมูล Worker ↔ Frontend**: แนะนำให้ frontend `fetch()` ตรงไปที่ Worker endpoint (`/latest`, `/rates`) — ไม่ต้อง sync เข้า Supabase ให้ซับซ้อน แต่ต้อง:
   - เพิ่ม CORS header (`Access-Control-Allow-Origin`) ใน worker responses
   - เก็บ Worker URL เป็น env var ฝั่ง frontend (เช่น `VITE_SUPERRICH_WORKER_URL`)
2. **Mapping โค้ดสกุลเงิน**: worker มี `USD/USD2/USD1` แยกตามแบงค์ (100/50, 20/10, 1) แต่ `Peter_Exchange_Rate` น่าจะมีแค่ `USD` เดียว — ต้องตัดสินใจว่าจะ map ยังไง (เช่น ใช้ `USD` แบงค์ใหญ่ (100/50) เป็นตัวเทียบหลัก แล้วโชว์แบงค์ย่อยเป็นข้อมูลเสริม)
3. **สูตร "เรทแนะนำวันนี้"**: ยังไม่รู้ business logic — เรทแนะนำ = เรท Super Rich ± ส่วนต่างเท่าไหร่? ส่วนต่างเท่ากันทุกสกุลหรือ configurable ต่อสกุล? ต้องถามร้านว่าปกติตั้งเรทห่างจาก Super Rich เท่าไหร่
4. **ช่วงเวลากราฟย้อนหลัง**: default กี่วัน (7/30/90)? ให้เลือกช่วงได้ไหม เหมือนหน้า Super Admin ที่เพิ่งทำ (วันนี้/เลือกวันที่/ช่วงวันที่)?

---

## 4. Todo — แบ่งเป็นเฟส

### Phase 0 — เตรียม Worker ให้เรียกได้จริง
- [ ] เพิ่ม CORS header ให้ทุก response ใน `worker/src/index.js`
- [ ] เขียน schema `superrich_rates` เป็นไฟล์ `.sql` เก็บใน `worker/` ให้ reproducible (ตอนนี้ schema อยู่แค่ใน D1 จริง ไม่มีไฟล์)
- [ ] ตัดสินใจเรื่อง auth ของ endpoint (ตอนนี้ไม่มี auth เลย — เปิดสาธารณะโอเคไหมสำหรับ endpoint อ่านอย่างเดียว `/latest` `/rates` `/stats`)
- [ ] เพิ่ม `VITE_SUPERRICH_WORKER_URL` ใน `.env` และ deploy config

### Phase 1 — Feature A: การ์ด Super Rich rate + เรทแนะนำ บน `AdminPage.tsx`
- [ ] เขียน `src/lib/superrichApi.ts` (หรือรวมใน `api.ts`) — ฟังก์ชัน `getSuperRichLatest()` fetch จาก `/latest`
- [ ] ต่อ currency-code mapping (worker code ↔ `Peter_Exchange_Rate.Cur`) ตามข้อ 3.2
- [ ] ออกแบบ UI การ์ดต่อแถวเรท: โชว์ เรทร้าน (ของเดิม, edit ได้) | เรท Super Rich วันนี้ (ซื้อ/ขาย) | เรทแนะนำ (คำนวณตามสูตรข้อ 3.3)
- [ ] Loading/error state เวลา worker เรียกไม่ได้ (network, CORS พลาด, ยังไม่ scrape วันนี้) — fallback ให้หน้ายังใช้งาน rate table เดิมได้ปกติ ไม่ block การ edit

### Phase 2 — Feature B: กราฟเรทย้อนหลัง
- [ ] Query ฝั่ง Supabase: min/max `Rate` ต่อวันต่อสกุล จาก `Peter_Exchange_Transaction` (`Transaction_Type='Buying'`) — พิจารณาใช้ Postgres view หรือ query ฝั่ง client ด้วย `getTransactions(startDate, endDate)` แล้ว aggregate ใน frontend (เหมือน pattern ที่ `DailySalesAnalytics.tsx` ทำอยู่)
- [ ] Query ฝั่ง Worker: history ต่อสกุลจาก `/rates?code=X&limit=N` (ต้องเช็คว่า endpoint นี้ filter ตามช่วงวันที่ได้ไหม หรือรับแค่ limit — อาจต้องเพิ่ม query param `from`/`to` ให้ endpoint นี้ด้วย)
- [ ] สร้าง component ใหม่ (เช่น `src/components/root_component/RateHistoryChart.tsx`) ด้วย `recharts` — เส้น min/max เรทซื้อร้าน + เส้นเรท Super Rich วันนั้น ต่อวัน, เลือกสกุลเงินได้ (dropdown เหมือนที่อื่นในระบบ)
- [ ] เลือกช่วงเวลา (ตามข้อ 3.4) — ทำ UI ให้สอดคล้องกับ pattern ตัวเลือกวันที่ที่เพิ่งสร้างในหน้า Super Admin (วันนี้/เลือกวันที่/ช่วงวันที่) เพื่อความสม่ำเสมอ
- [ ] วางกราฟนี้ไว้ที่หน้า `AdminPage.tsx` (ตั้งค่าเรท) ต่อจากการ์ด Super Rich ของ Feature A

### Phase 3 — ทดสอบ/ปรับจูน
- [ ] ทดสอบกรณี worker ยังไม่มีข้อมูลวันนี้ (cron ยังไม่รัน) — UI ต้อง degrade ได้สวยงาม ไม่พัง
- [ ] ทดสอบ mapping สกุลเงินที่ไม่ตรงกัน (worker มีแต่ `Peter_Exchange_Rate` ไม่มี หรือกลับกัน)
- [ ] เช็ค mobile responsive ของกราฟ + การ์ดใหม่ (ตามแนวทาง mobile-first ที่ใช้ทั้งระบบ)
- [ ] เช็คว่าไม่กระทบ flow เดิมของการแก้เรทร้าน (edit/save ยังทำงานปกติ)

---

## 5. Non-goals (รอบนี้ไม่ทำ)

- ไม่ sync ข้อมูล Super Rich เข้า Supabase (อ่านตรงจาก Worker ก่อน ถ้าจำเป็นค่อยเพิ่มทีหลัง)
- ไม่ทำ auto-apply เรทแนะนำเข้าตาราง `Peter_Exchange_Rate` อัตโนมัติ — แค่ "แนะนำ" ให้แอดมินกดยืนยัน/แก้เองเหมือนเดิม
