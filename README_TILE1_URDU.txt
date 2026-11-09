NEXURA v2.0 — TILE 1 ONLY TEST

اس مرحلے میں Login/Logout کو نہیں چھیڑا گیا۔ دیگر ٹائلز میں کوئی نئی تبدیلی نہیں کی گئی۔

1) Completed Task کی تاریخ completedAt میں محفوظ ہوتی ہے۔ 30 مکمل دن گزرنے پر ایپ اگلی بار کھلنے یا ریکارڈ محفوظ ہونے پر خودکار صفائی کرتی ہے۔ ایپ بند ہونے پر پس منظر میں کام نہیں چلتا۔
2) پرانے Completed Tasks جن کے پاس completion timestamp نہیں، پہلی بار یہ ورژن کھلنے پر موجودہ وقت سے 30 دن کی مدت شروع کریں گے؛ غلط اندازے سے فوری حذف نہیں ہوں گے۔
3) To-Do's / Diary / Tasks کے ساتھ Premium Renewal Reminders کا تیسرا ٹیب ہے۔
4) اس ٹیب کے اندر ON/OFF اور Next 7 Days / Next 30 Days / Overdue الگ ہیں۔ 2027 کی پالیسی 2026 کے 7/30 دن والے فلٹر میں نہیں آئے گی۔
5) Policy Records کے نیچے موجود پرانا Premium Reminders سیکشن ہٹا دیا گیا ہے۔
6) Premium reminders کا ریکارڈ policy records سے پڑھا جاتا ہے، duplicate diary task نہیں بنتا۔
7) تمام موجودہ ریکارڈز اور پہلے سے منظور شدہ Diary/Task controls برقرار رکھنے کی کوشش کی گئی ہے۔

ٹیسٹنگ: پچھلا Backup محفوظ کریں، نئی ZIP extract کرکے Cloudflare پر deploy کریں، Chrome refresh کریں۔
اصل Login browser-only demonstration ہے، آن لائن محفوظ authentication نہیں۔
