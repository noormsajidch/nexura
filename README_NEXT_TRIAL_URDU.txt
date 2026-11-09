NEXURA NEXT TRIAL — STAGE 1
یہ مقامی تجرباتی ورژن ہے، حقیقی آن لائن سیکیورٹی نہیں۔

اس مرحلے میں:
- First-time Creator Profile (کسی بھی designation سے)
- Staff code + password کا لوکل login demo
- Admin چھٹی ٹائل: Backup / Import / Promotion Tools / Login / Staff management under construction
- Staff Profile میں Add Previous Performance بٹن کا نام
- Records ٹیب کا نام Policy Records
- پرانے پانچ ٹائلز اور Promotion scripts برقرار

اگلے مرحلے کے لیے باقی کام:
- سال/عہدے کے لحاظ سے مکمل تاریخی کارکردگی فارم اور تصدیق
- Premium reminders کے 7/30 دن کے فلٹر اور ON/OFF
- Bulk Policy Records CSV/PDF preview/import اور no-performance-impact rules
- اصل آن لائن Supabase Auth + RLS، creator claiming اور role permissions

ٹیسٹ:
1) ZIP الگ فولڈر میں extract کریں
2) py -m http.server 5512
3) http://localhost:5512
4) پہلی مرتبہ اپنا نام، designation، code اور TEST password بنائیں
5) logout اور دوبارہ login کریں
6) Admin ٹائل کھولیں
7) اپنے سابقہ backup کو Import کرنے سے پہلے موجودہ backup محفوظ رکھیں

نوٹ: اس لوکل ڈیمو میں login صرف UI gate ہے، browser data کو محفوظ نہیں بناتا۔
کسی بھی اصلی password یا sensitive customer record کو یہاں استعمال نہ کریں۔
Creator profile localStorage میں browser origin کے مطابق رہتا ہے؛ اسے server پر sync نہیں کیا جاتا۔
