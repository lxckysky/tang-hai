/**
 * config.local.example.js
 * ตัวอย่างไฟล์ตั้งค่า API Key สำหรับการรันแบบ Local (เปิดไฟล์ตรงๆ หรือรันผ่าน localhost)
 *
 * วิธีใช้งาน:
 * 1. คัดลอกไฟล์นี้แล้วเปลี่ยนชื่อเป็น config.local.js
 * 2. วาง Google AI Studio API Key (AIzaSy...) ในช่อง LOCAL_DEV_KEY
 * 3. ไฟล์ config.local.js จะถูกซ่อนด้วย .gitignore อัตโนมัติ ไม่หลุดขึ้น GitHub
 */
(function() {
  const LOCAL_DEV_KEY = ''; // วาง AIzaSy... ที่นี่
  if (LOCAL_DEV_KEY && !localStorage.getItem('tanghai_gemini_api_key')) {
    localStorage.setItem('tanghai_gemini_api_key', LOCAL_DEV_KEY);
  }
})();
