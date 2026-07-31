# uptime-bot — tamamen web arayüzlü uptime izleme aracı

Telegram yok, bot token yok, webhook yok. Kullanıcı siteye girer, URL ekler,
dashboard'da yeşil/kırmızı durumunu görür. Tarayıcıda otomatik oluşan bir kod
(localStorage'da saklanır) kullanıcıyı tanımlar — giriş/parola gerekmez.

## Neden bu sürüm daha basit

Önceki Telegram sürümünde bot token'ı, webhook secret'ı gibi birkaç ayrı
parça senkron olması gerekiyordu ve bunlardan biri bozulunca teşhis zordu.
Bu sürümde hiç secret yok — sadece D1 veritabanı bağlantısı var, o da zaten
`wrangler.toml` içinde tanımlı ve mevcut veritabanını (`uptime-bot-db`)
kullanıyor.

## Kurulum adımları

Aynı proje klasöründesin (`uptime-bot`). Eski dosyaların üzerine bunları koy:
`src/index.js`, `wrangler.toml`, `schema.sql`, `package.json` — hepsi
değişti, README ve node_modules kalabilir.

1. **Bağımlılıkları güncelle** (emin olmak için)
   ```
   npm install
   ```

2. **Veritabanı tablolarını yeniden oluştur**

   Önemli: bu adım eski Telegram tablolarını silip yenisini kuruyor
   (schema.sql içinde `DROP TABLE` var), bu yüzden eski test verisi silinir
   — sorun değil, zaten test amaçlıydı.
   ```
   npm run db:init:remote
   ```

3. **Deploy et**
   ```
   npm run deploy
   ```
   Çıktıda `https://uptime-bot.<hesabın>.workers.dev` gibi bir URL göreceksin.

4. **Tarayıcıda o URL'i aç**

   Doğrudan bir dashboard göreceksin. URL ekle, birkaç dakika bekle, cron
   her dakika çalışıp durumu güncelleyecek (ücretsiz planda 5 dakikada bir
   kontrol edilir).

## Eski Telegram secret'ları

Artık kullanılmıyorlar ama Cloudflare'de kayıtlı kalmaya devam ederler
(zararsız). İstersen dashboard'dan (Ayarlar > Değişkenler ve sırlar)
`TELEGRAM_BOT_TOKEN` ve `TELEGRAM_WEBHOOK_SECRET`'ı silebilirsin, gerekli
değil.

## GitHub'a ekleme

Proje bir `.gitignore` içeriyor (`node_modules/`, `.wrangler/` gibi gereksiz
dosyaları dışarıda tutar). GitHub'a göndermek için:

```
git init
git add .
git commit -m "Initial commit: web-based uptime monitor"
```

Sonra GitHub'da yeni bir repo oluşturup (Private önerilir, launch'a kadar):
```
git remote add origin https://github.com/KULLANICI_ADIN/uptime-bot.git
git branch -M main
git push -u origin main
```

Kod içinde secret/token yok (hepsi Cloudflare'in şifreli deposunda), bu
yüzden repo'yu paylaşmakta güvenlik riski yok.

## Sonraki adımlar

- E-posta bildirimi ekleme (site düşünce haber vermek için) — ayrı bir adım
  olarak, bir e-posta servisi (ör. Resend) entegre edilebilir
- Lemon Squeezy ile ödeme → `users.plan` alanını `'paid'` yapan bir webhook
- Uptime yüzdesi / geçmiş grafik
- Özel alan adı bağlama
