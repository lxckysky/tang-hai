/**
 * api/gemini.js
 * Vercel Serverless Function (Backend Proxy สำหรับเรียกใช้ Gemini API)
 *
 * สถาปัตยกรรมความปลอดภัย & ประโยชน์:
 * 1. ผู้ใช้ทุกคนที่เข้าเว็บผ่าน Live URL สามารถใช้โหมด Gemini AI ได้ทันทีโดยไม่ต้องใส่ API Key
 * 2. ซ่อนค่า GEMINI_API_KEY ไว้ใน Environment Variables ฝั่ง Server ของ Vercel
 * 3. มีระบบ Fallback ระหว่างโมเดล (Gemini 2.5 Flash -> Gemini 2.0 Flash -> Gemini 1.5 Flash)
 * 4. รองรับหมวดหมู่เฉพาะบุคคล (Personalized Custom Categories) และการแนะนำหมวดหมู่ตามไลฟ์สไตล์
 */

export default async function handler(req, res) {
  // รองรับ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({
      error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Environment Variables ของ Vercel (โปรดใส่ Key ใน Vercel Dashboard Settings -> Environment Variables)'
    });
  }

  try {
    const { items = [], customCategories = [], overviewContext = null, promptOverride } = req.body || {};
    if ((!Array.isArray(items) || items.length === 0) && !overviewContext && !promptOverride) {
      return res.status(400).json({ error: 'ไม่พบรายการสำหรับวิเคราะห์' });
    }

    // จำกัดจำนวนรายการต่อคำขอ (ไม่เกิน 80 รายการที่ไม่ซ้ำกัน) เพื่อรองรับการอัปโหลดหลายเดือนรวมกัน
    const safeItems = Array.isArray(items) ? items.slice(0, 80) : [];

    let promptText = '';
    if (promptOverride && typeof promptOverride === 'string') {
      promptText = promptOverride;
    } else {
      const defaultCatDesc = [
        'FOOD (อาหารและเครื่องดื่ม)',
        'GROCERY (ของใช้/ของชำ/สะดวกซื้อ)',
        'TRANSPORT (การเดินทาง/รถไฟฟ้า/น้ำมัน)',
        'SHOPPING (ช้อปปิ้ง/ออนไลน์/เสื้อผ้า)',
        'EDUCATION_HEALTH (การศึกษา/ยา/คลินิก/สุขภาพ)',
        'BILLS (ค่าไฟ/ค่าเน็ต/ค่าหอ/บิล)',
        'WALLET (เติมเงิน e-Wallet)',
        'CASH_ATM (ถอนเงินสด)',
        'TRANSFER_PERSON (โอนให้บุคคล/เพื่อน/บุคคลธรรมดา)',
        'UNKNOWN (อื่นๆ)'
      ];

      if (Array.isArray(customCategories)) {
        for (const c of customCategories) {
          if (c && c.id && c.label) {
            defaultCatDesc.push(`${c.id} (${c.label})`);
          }
        }
      }

      promptText = `คุณคือผู้เชี่ยวชาญระดับสูงด้านการวิเคราะห์รายการเดินบัญชีธนาคารในประเทศไทย (Thai Bank Statement & Merchant Intelligence Specialist) และระบบจัดหมวดหมู่การเงินส่วนบุคคลอัตโนมัติ

ภารกิจของคุณแบ่งเป็น 2 งานหลักที่ต้องทำอย่างละเอียด รอบคอบ และอ้างอิงจากข้อเท็จจริงทางธุรกิจในประเทศไทยเท่านั้น:

====================================================================
งานที่ 1: จำแนกหมวดหมู่รายการธุรกรรม (Transaction Categorization & Merchant Decoding)
====================================================================
ให้วิเคราะห์แต่ละรายการใน Array ที่ได้รับ โดยพิจารณาประกอบกันทั้ง "ชื่อรายการ (desc/key)", "จำนวนเงิน (amount)" และ "เวลาที่ทำรายการ (time)" แล้วเลือก category ที่ตรงที่สุดเพียง 1 หมวด จากรายการหมวดหมู่ต่อไปนี้:
- ${defaultCatDesc.join('\n- ')}

เกณฑ์การจำแนกหมวดหมู่เชิงลึก (ครอบคลุมทุกรูปแบบในสเตทเมนต์ธนาคารไทย):

1. หมวด FOOD (อาหาร เครื่องดื่ม คาเฟ่ ของหวาน สตรีทฟู้ด ฟู้ดเดลิเวอรี):
   - ร้านอาหารทุกประเภท: ข้าวแกง, ตามสั่ง, ก๋วยเตี๋ยว, บะหมี่, ส้มตำ, อีสาน, หมูกระทะ, ชาบู, สุกี้, หมาล่า (เช่น หมาล่าฮับ, YI JIA MALA, สุกี้ตี๋น้อย, MK, Haidilao, Mo-Mo-Paradise), ปิ้งย่าง, บุฟเฟต์, ราเมน (โออิชิ ราเมน, ฮะจิบัง, A Ramen), ซูชิ, สเต็ก
   - ฟาสต์ฟู้ดและเครือร้านอาหารใหญ่: MINOR FOOD (ไมเนอร์ ฟู้ด), CRG (เซ็นทรัล เรสตอรองส์), KFC, McDonald's, Burger King, Texas Chicken, Pizza Company, Domino's, Pizza Hut, Bonchon, Yayoi, Fuji, Oishi, S&P, Chester's
   - คาเฟ่ กาแฟ ชา และของหวาน: Cafe Amazon, Inthanin, พันธุ์ไทย, Starbucks, Kamu, KOI The, ชาตรามือ, Bearhouse, GAGA, Nose Tea, หนึ่ง นม นัว, มหาเฮง, นมสด, ขนมปังปิ้ง, โทสต์, บิงซู, After You, Swensen's, Dairy Queen, เบเกอรี่, ไอศกรีม, ของหวาน
   - ศูนย์อาหารและโรงอาหาร: CPN SLY FOOD PATIO (ศูนย์อาหารเซ็นทรัล), Food Republic, Pier 21, โรงอาหารมหาวิทยาลัย/ตึกเรียน/โรงพยาบาล (เช่น ตึกจุลฯ, ร้านเบอร์ 1-10)
   - แพลตฟอร์มสั่งอาหาร: GrabFood, LINE MAN (ค่าอาหาร), Foodpanda, Robinhood, ShopeeFood
   - ร้านค้าถุงเงิน / มณี SHOP / K+ shop / ร้านค้าออมสิน: หากมีคำเกี่ยวกับอาหาร/เครื่องดื่ม/ชื่อเมนู หรือมียอดใช้จ่ายระดับมื้ออาหาร (ประมาณ 20 - 800 บาท) ในช่วงเวลามื้อเช้า (06:00-10:00), มื้อกลางวัน (11:00-14:00), มื้อเย็น/ดึก (17:00-23:00) ให้จัดเป็น FOOD

2. หมวด GROCERY (ร้านสะดวกซื้อ ซูเปอร์มาร์เก็ต สหกรณ์ ของใช้ประจำวัน ตู้กดอัตโนมัติ):
   - ร้านสะดวกซื้อและมินิมาร์ท: 7-Eleven (CP ALL), จิฟฟี่ (Jiffy), Lawson 108, FamilyMart, CJ More / CJ Express, Mini Big C, โลตัส โก เฟรช, ถูกดี มีมาตรฐาน
   - ซูเปอร์มาร์เก็ตและไฮเปอร์มาร์เก็ต: Tops (Tops Daily / Tops Market / TOPS-C2B), Big C, Lotus's (โลตัส), Makro (แม็คโคร), Gourmet Market, Villa Market, Foodland, MaxValu, Don Don Donki
   - สหกรณ์และร้านค้าสวัสดิการ: สหกรณ์จุฬาฯ, สหกรณ์มหาวิทยาลัย, สหกรณ์ออมทรัพย์/ร้านค้าสวัสดิการ
   - ตู้จำหน่ายสินค้าอัตโนมัติ: เวนดิ้งบายบุญเติม, SUN Vending, ตู้กดน้ำ/ขนมอัตโนมัติ, เต่าบิน (Tao Bin / ฟอร์ท เวนดิ้ง)

3. หมวด TRANSPORT (การเดินทาง รถไฟฟ้า ทางด่วน น้ำมัน จุดชาร์จ EV ที่จอดรถ เรียกรถ สกู๊ตเตอร์ ตั๋วเดินทาง):
   - รถไฟฟ้าและระบบขนส่งมวลชน: BTS, MRT, BEM (ทางด่วนและรถไฟฟ้ากรุงเทพ), รถไฟฟ้าสายสีแดง (SRTET), Airport Rail Link (ARL), ขสมก., เรือด่วน
   - ทางด่วนและค่าผ่านทาง: การทางพิเศษแห่งประเทศไทย (EXAT), Easy Pass, M-Flow, ดอนเมืองโทลล์เวย์ (Tollway)
   - สถานีบริการน้ำมัน ก๊าซ และจุดชาร์จรถยนต์ไฟฟ้า (EV): PTT (ปตท. / พีทีที / OR Oil), บางจาก (Bangchak), Shell, Caltex, Esso, PT (พีทีจี), Susco, RITTIDOL OIL (ริทธิดล ออยล์), หจก./บจก. ที่มีคำว่า ออยล์ (OIL) / ปิโตรเลียม (PETROLEUM) / น้ำมัน / เชื้อเพลิง / แก๊ส / เซอร์วิสสเตชั่น, PEA VOLTA, EA Anywhere, ReverSharger
   - บริหารลานจอดรถและค่าที่จอดรถ: JENKONGKLAI (บมจ. เจนก้องไกล / JPARK), Park2Go, Smart Parking, ค่าจอดรถอาคาร/ห้างสรรพสินค้า/โรงพยาบาล/มหาวิทยาลัย
   - บริการเรียกรถและเช่ายานพาหนะระยะสั้น: Grab (GrabCar/GrabBike/GrabTaxi), Bolt, LINE MAN Ride/Taxi, TADA, InDrive, MuvMi (มูฟมี), GCOO (จีคู สกู๊ตเตอร์ไฟฟ้า), BEAM (บีม สกู๊ตเตอร์), Gokoo, เช่ารถยนต์/จักรยานยนต์, วินมอเตอร์ไซค์, แท็กซี่
   - การเดินทางระหว่างเมืองและสายการบิน: การรถไฟแห่งประเทศไทย (รฟท.), บขส., นครชัยแอร์, สมบัติทัวร์, AirAsia, NokAir, Thai Vietjet, Thai Lion Air, Bangkok Airways, การบินไทย
4. หมวด SHOPPING (ช้อปปิ้งออนไลน์ แฟชั่น ห้างสรรพสินค้า ไอที ความบันเทิง ภาพยนตร์ สตรีมมิ่ง เกม):
   - อีคอมเมิร์ซและ Payment Gateway สินค้าออนไลน์: Shopee, Lazada, TikTok Shop (รวมถึง OMISE - TIKTOK SHOP / PIPO), Central Online, Konvy, Pomelo, Shein, Temu, ลีแอนลีแอน (LianLian Payment), 2C2P, Omise (Opn Payments), Stripe, Atome, Paysolutions, ChillPay
   - แฟชั่น เครื่องแต่งกาย ห้างสรรพสินค้า และของแต่งบ้าน: Uniqlo (ยูนิโคล่), H&M, Zara, Muji (มูจิ), Gentlewoman, IKEA (อิเกีย), Daiso, Miniso, Moshi Moshi, MR.D.I.Y., HomePro, Index Living Mall, Robinson, Central Department Store, The Mall, Siam Piwat
   - อุปกรณ์ไอทีและเครื่องใช้ไฟฟ้า: Apple Store, Studio7 (Com7 / คอมเซเว่น), Banana IT, JIB, Advice, Power Buy, Jaymart, Dotlife, Sony, Samsung
   - ความบันเทิง โรงภาพยนตร์ ดนตรี สตรีมมิ่ง และงานอดิเรก: SF Cinema (เอส เอฟ ซีเนม่า), Major Cineplex (เมเจอร์ ซีนีเพล็กซ์), House Samyan, Netflix, Spotify, YouTube Premium, Apple Services, Google Play, Steam, Garena, Riot Games, Coda Payments, ThaiTicketMajor, Ticketmelon, Eventpop, ร้านบอร์ดเกม, คาราโอเกะ, ตู้ถ่ายรูป (Photobooth)

5. หมวด EDUCATION_HEALTH (การศึกษา มหาวิทยาลัย ศูนย์สอบ หนังสือ โรงพยาบาล คลินิก ร้านยา สุขภาพ):
   - การศึกษา มหาวิทยาลัย และศูนย์สอบ: จุฬาลงกรณ์มหาวิทยาลัย, ม.ธรรมศาสตร์, ม.มหิดล, ม.เกษตรศาสตร์, มจธ., สจล., มศว, ม.เชียงใหม่, ม.ขอนแก่น, ม.สงขลานครินทร์, CONSORTIUM OF THAI MEDICA (กสพท / กลุ่มสถาบันแพทยศาสตร์แห่งประเทศไทย), สทศ. (NIETS), ทปอ. (TCAS), ศูนย์สอบภาษาอังกฤษ (IELTS/TOEIC/CU-TEP/TU-GET), สถาบันกวดวิชา, คอร์สเรียนออนไลน์
   - ร้านหนังสือ เครื่องเขียน และสิ่งพิมพ์: ศูนย์หนังสือจุฬาฯ (Chulalongkorn University Book Center), SE-ED (ซีเอ็ด), นายอินทร์ (Naiin), B2S (บีทูเอส), Kinokuniya (คิโนะคูนิยะ), สมใจ (Somjai), ร้านถ่ายเอกสาร/เข้าเล่ม/ปริ้นท์งาน
   - โรงพยาบาล คลินิก และห้องปฏิบัติการทางการแพทย์: โรงพยาบาลรัฐและเอกชนทุกแห่ง (เช่น ศิริราช, จุฬาลงกรณ์, รามาธิบดี, กรุงเทพ BDMS, บำรุงราษฎร์, สมิติเวช, พญาไท, เปาโล, วิภาวดี), คลินิกเวชกรรม, คลินิกทันตกรรม (ทำฟัน), คลินิกผิวหนัง/ความงาม, กายภาพบำบัด, แล็บตรวจสุขภาพ
   - ร้านขายยา เวชภัณฑ์ และสุขภาพความงาม: Watsons (วัตสัน), Boots (บู๊ทส์), Fascino (ฟาสซิโน), Pharmax, อัลติเมด (ULTIMED), ร้านขายยา/เภสัชกรรม, ร้านแว่นตา (ท็อปเจริญ/หอแว่น/Owndays), ฟิตเนสและยิมออกกำลังกาย (Fitness First, Virgin Active, Jetts)
6. หมวด BILLS (สาธารณูปโภค ค่าไฟ ค่าน้ำ ค่าเน็ต ค่าโทรศัพท์ ค่าหอพัก/คอนโด/นิติบุคคล ร้านซักอบ ประกัน ค่าธรรมเนียม):
   - ไฟฟ้าและประปา: การไฟฟ้านครหลวง (MEA / METROPOLITAN ELECTRICITY), การไฟฟ้าส่วนภูมิภาค (PEA / PROVINCIAL ELECTRICITY), การประปานครหลวง (MWA), การประปาส่วนภูมิภาค (PWA)
   - อินเทอร์เน็ตและโทรศัพท์มือถือ: AIS (AIS Postpaid / AIS Fibre / Advanced Info Service / AWN), True (TrueMove H / TrueOnline / True Visions), DTAC, 3BB, NT (โทรคมนาคมแห่งชาติ)
   - ที่อยู่อาศัย หอพัก คอนโดมิเนียม และนิติบุคคล: นิติบุคคลอาคารชุด (ทุกโครงการ เช่น ไอดีโอ IDEO, Life, Lumpini LPN, Aspire, Chapter, Plum, Kave, Rhythm, Noble, Sansiri, Supalai, Origin, Ananda, AP), ค่าเช่าหอพัก/อพาร์ตเมนต์, ค่าส่วนกลาง, ค่าน้ำ-ค่าไฟหอพัก
   - ร้านซักอบรีดและเครื่องซักผ้าอัตโนมัติ: Otteri Wash & Dry (อ๊อตเทริ), WashXpress, 24Wash, Laundrybar, Browny, บริการซักรีดรายวัน/รายเดือน
   - ประกันภัยและค่าธรรมเนียมทางการเงิน: AIA, FWD, เมืองไทยประกันชีวิต, ไทยประกันชีวิต, กรุงไทย-แอกซ่า, อลิอันซ์ อยุธยา, ทิพยประกันภัย, วิริยะประกันภัย, ค่าธรรมเนียมบัตรเดบิต/เครดิตรายปี, ค่าธรรมเนียมธนาคาร

7. หมวด WALLET (การเติมเงินเข้ากระเป๋าเงินอิเล็กทรอนิกส์ e-Wallet):
   - TrueMoney Wallet (SIPS TRUE MONEY CO.,LTD. / TMW), K PLUS Wallet (WIDx.../K Plus W), LINE Pay / Rabbit LINE Pay, ShopeePay (AirPay), Dolfin Wallet, เป๋าตังเปย์

8. หมวด CASH_ATM (การถอนเงินสด):
   - ถอนเงินสดไม่ใช้บัตร (Cardless ATM), ถอนเงินสดผ่านตู้ ATM / CDM ทุกธนาคาร

9. หมวด TRANSFER_PERSON (การโอนเงินให้บุคคลธรรมดา):
   - รายการที่มีคำนำหน้าชื่อบุคคล (นาย, นาง, น.ส., นางสาว, ด.ช., ด.ญ., เด็กชาย, เด็กหญิง, MR., MS., MRS., MISS) หรือเป็นชื่อ-นามสกุลบุคคลธรรมดาที่โอนผ่าน PromptPay หรือเลขบัญชีธนาคาร โดยไม่มีคำว่า "จ่ายบิล" และไม่มีคำบ่งชี้ว่าเป็นบริษัท/หจก./ร้านค้า
   - หมายเหตุ: หากรายการมีคำนำหน้าว่า "จ่ายบิล" หรือมีคำว่า บจก., จำกัด, หจก., บมจ., CO.,LTD., LTD., PART., SHOP, STORE, CLINIC, CAFE, FOOD แปลว่าเป็นร้านค้าหรือนิติบุคคล ห้ามจัดเป็น TRANSFER_PERSON เด็ดขาด ให้วิเคราะห์ตามประเภทธุรกิจจริง

10. หมวดหมู่ที่ผู้ใช้สร้างเพิ่มเติม (Custom Categories):
   - หากมีหมวดหมู่เพิ่มเติมในรายการตัวเลือกที่ตรงกับลักษณะธุรกรรมอย่างชัดเจน ให้เลือกใช้หมวดหมู่นั้นได้ทันที

11. หมวด UNKNOWN (อื่นๆ):
   - ใช้เฉพาะกรณีที่เป็นรหัสตัวเลขล้วนหรือชื่อย่อที่ไม่สามารถระบุประเภทธุรกิจได้เลยจริงๆ เท่านั้น พยายามวิเคราะห์จากบริบทธุรกิจไทยให้ได้มากที่สุดก่อนเลือกหมวดนี้

ข้อกำหนดสำหรับฟิลด์ "hint" ของแต่ละรายการใน items:
- ต้องเขียนคำอธิบายสั้นๆ ภาษาไทย (ความยาว 3-8 คำ) ที่ระบุชัดเจนว่าร้านค้าหรือบริษัทนั้นคืออะไร เช่น "ร้านของหวานและเครื่องดื่ม", "บริหารลานจอดรถ JPARK", "ศูนย์สอบ กสพท", "นิติบุคคลคอนโดมิเนียม", "สถานีบริการน้ำมัน", "โรงภาพยนตร์", "ชำระสินค้าออนไลน์" (ห้ามใส่อีโมจิ)

รายการที่ต้องวิเคราะห์หมวดหมู่:
${JSON.stringify(safeItems)}

ข้อมูลภาพรวมสเตทเมนต์เพิ่มเติมสำหรับสรุปพฤติกรรมการเงิน:
${overviewContext ? JSON.stringify(overviewContext) : 'ไม่มีข้อมูลเพิ่มเติม'}

====================================================================
งานที่ 2: สรุปภาพรวมพฤติกรรมการเงิน (summaryBullets) จำนวน 3 ข้อ
====================================================================
ให้วิเคราะห์จากข้อมูลจริงในรายการข้างต้นและข้อมูลภาพรวมสเตทเมนต์ เพื่อเขียนสรุปอินไซต์ทางการเงินสั้นๆ 3 ข้อ (ภาษาไทย สุภาพ กระชับ อ่านเข้าใจง่าย และห้ามใส่อีโมจิเด็ดขาด):
- ข้อที่ 1: สรุปภาพรวมการใช้จ่ายจริง (True Personal Spend) เทียบกับยอดโอนระหว่างบัญชีตัวเองที่ถูกตัดออก (ถ้ามี) หรือภาพรวมหมวดหมู่ที่ใช้จ่ายสูงสุด
- ข้อที่ 2: เจาะลึกพฤติกรรมความถี่หรือช่วงเวลาการใช้จ่าย เช่น รายการใช้จ่ายช่วงดึก (00:00-05:00 น.) หรือกลุ่มร้านค้า/บริการที่ใช้บ่อยในรอบนี้
- ข้อที่ 3: ข้อสังเกตที่เป็นประโยชน์ในการบริหารจัดการเงินจากข้อมูลจริง เช่น สัดส่วนรายการโอนให้บุคคล หรือค่าใช้จ่ายประจำรายเดือน (ห้ามแต่งตัวเลขที่ไม่มีในข้อมูลเด็ดขาด)

ตอบกลับเป็น JSON Object ที่ถูกต้องตามโครงสร้างนี้เท่านั้น (ห้ามมีข้อความอื่นนอก JSON):
{"items":[{"key":"...","category":"...","hint":"..."}],"summaryBullets":["...","...","..."]}`;
    }

    const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

    let lastError = null;
    let parsedData = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const payload = {
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.15
          }
        };

        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload)
        });

        if (!geminiRes.ok) {
          const errBody = await geminiRes.text();
          lastError = `Gemini API (${model}) Error ${geminiRes.status}: ${errBody}`;
          // ถ้า 429 (โควตาโมเดลเต็ม), 404, 400 หรือ 503 -> สลับไปลองโมเดลถัดไปทันที
          if (geminiRes.status === 429 || geminiRes.status === 404 || geminiRes.status === 400 || geminiRes.status === 503) {
            continue;
          }
          break;
        }

        const data = await geminiRes.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const allText = parts.map(p => p.text || '').filter(Boolean).join('\n');
        let cleaned = allText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*"items"[\s\S]*\}/);
        parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
        break;
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!parsedData) {
      return res.status(502).json({
        error: `ไม่สามารถเรียก Gemini API ได้ (${lastError || 'Unknown Error'})`
      });
    }

    return res.status(200).json(parsedData);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
