from __future__ import annotations

from audit_fix_common import read, write, replace_once

# Static legal pages: add French and Urdu to the selectors and language routing.
for legal_path in ['public/privacy.html', 'public/support.html']:
    legal = read(legal_path)
    legal = legal.replace('<option value="tr">Türkçe</option></select>', '<option value="tr">Türkçe</option><option value="fr">Français</option><option value="ur">اردو</option></select>')
    legal = legal.replace("['en', 'ar', 'id', 'ms', 'tr'].includes(language)", "['en', 'ar', 'id', 'ms', 'tr', 'fr', 'ur'].includes(language)")
    legal = legal.replace("chosen === 'ar' ? 'rtl' : 'ltr'", "chosen === 'ar' || chosen === 'ur' ? 'rtl' : 'ltr'")
    write(legal_path, legal)

privacy_path = 'public/privacy.html'
privacy = read(privacy_path)
privacy_insert = r'''
      <article data-lang="fr" lang="fr" dir="ltr">
        <section><h2>1. À propos de SafarOne</h2><p>SafarOne est une application de planification de voyages pour les musulmans développée par Firas Badran. Assistance : <a href="mailto:planetearthkh@gmail.com">planetearthkh@gmail.com</a>. Dernière mise à jour : 4 juillet 2026.</p></section>
        <section><h2>2. Informations stockées localement</h2><p>Selon vos choix, l’application peut conserver localement la langue, les préférences, les itinéraires, les plans de vol hors ligne et les détails de voyage facultatifs.</p><ul><li>Le stockage local n’est pas chiffré de bout en bout.</li><li>Toute personne ayant accès au même appareil ou profil peut potentiellement consulter ces informations.</li><li>La suppression de l’application ou des données du site peut effacer les informations enregistrées.</li><li>N'entrez pas de mots de passe, données bancaires, numéros de carte, passeport ou document d’identité.</li></ul></section>
        <section><h2>3. Localisation</h2><p>L’accès à la localisation est facultatif et utilisé uniquement lorsque vous demandez la Qibla ou une recherche à proximité. Les coordonnées ou termes de recherche peuvent être transmis au fournisseur nécessaire pour répondre à la demande.</p></section>
        <section><h2>4. Services tiers</h2><p>SafarOne peut utiliser OpenStreetMap, Overpass, OpenFreeMap, Open-Meteo, Frankfurter, Wikimedia, Wikipedia, Wikidata, GitHub, Apple Maps et un fournisseur distant de fichier audio d’adhan. Ces services peuvent recevoir les données techniques nécessaires à la requête, notamment l’adresse IP, la destination, les termes de recherche ou les coordonnées.</p></section>
        <section><h2>5. Assistance</h2><p>Lorsque vous écrivez à l’assistance, vous choisissez les informations envoyées. N’envoyez aucune donnée très sensible.</p></section>
        <section><h2>6. Signalements</h2><p>Le bouton de signalement peut ouvrir OpenStreetMap ou un ticket GitHub prérempli. Rien n’est envoyé automatiquement.</p></section>
        <section><h2>7. Partage et export</h2><p>Le partage, la copie, l’impression et l’export de calendrier sont déclenchés par vous. Vérifiez toujours le contenu avant de le transmettre.</p></section>
        <section><h2>8. Enfants</h2><p>SafarOne ne propose pas de compte utilisateur et n’est pas conçu pour collecter sciemment des données personnelles d’enfants. L’utilisation par un mineur doit être supervisée.</p></section>
        <section><h2>9. Sécurité</h2><p>Aucun stockage ou transfert n’est totalement sécurisé. Protégez votre appareil et vos fichiers.</p></section>
        <section><h2>10. Choix et suppression</h2><p>Vous pouvez refuser la localisation, supprimer les voyages et détails enregistrés, ou effacer les données de l’application.</p></section>
        <section><h2>11. Modifications</h2><p>La date de mise à jour sera modifiée lors de changements importants.</p></section>
        <section><h2>12. Contact</h2><p>Firas Badran · Assistance SafarOne · <a href="mailto:planetearthkh@gmail.com">planetearthkh@gmail.com</a></p><p><a href="/muslim-travel-planner/">Application</a> · <a href="/muslim-travel-planner/support.html?lang=fr">Assistance</a></p></section>
      </article>

      <article data-lang="ur" lang="ur" dir="rtl">
        <section><h2>۱. SafarOne کے بارے میں</h2><p>SafarOne مسلمانوں کے سفر کی منصوبہ بندی کی ایپ ہے جسے فراس بدران نے تیار کیا ہے۔ مدد: <a href="mailto:planetearthkh@gmail.com">planetearthkh@gmail.com</a>۔ آخری تازہ کاری: 4 جولائی 2026۔</p></section>
        <section><h2>۲. مقامی طور پر محفوظ معلومات</h2><p>آپ کے انتخاب کے مطابق ایپ زبان، ترجیحات، محفوظ سفری منصوبے، آف لائن پرواز کا منصوبہ اور اختیاری سفری تفصیلات اسی آلے پر محفوظ کر سکتی ہے۔</p><ul><li>مقامی ذخیرہ مکمل طور پر خفیہ نہیں ہوتا۔</li><li>اسی آلے یا پروفائل تک رسائی رکھنے والا شخص معلومات دیکھ سکتا ہے۔</li><li>ایپ یا سائٹ کا ڈیٹا مٹانے سے محفوظ معلومات ختم ہو سکتی ہیں۔</li><li>پاس ورڈ، بینک یا کارڈ کی معلومات، پاسپورٹ یا شناختی دستاویز درج نہ کریں۔</li></ul></section>
        <section><h2>۳. مقام</h2><p>مقام کی اجازت اختیاری ہے اور صرف قبلہ یا قریبی جگہ تلاش کرنے پر استعمال ہوتی ہے۔ درخواست پوری کرنے کے لیے متعلقہ خدمت کو نقاط یا تلاش کے الفاظ بھیجے جا سکتے ہیں۔</p></section>
        <section><h2>۴. بیرونی خدمات</h2><p>SafarOne، OpenStreetMap، Overpass، OpenFreeMap، Open-Meteo، Frankfurter، Wikimedia، Wikipedia، Wikidata، GitHub، Apple Maps اور اذان کی آڈیو فراہم کرنے والی بیرونی خدمت استعمال کر سکتا ہے۔ ان خدمات کو درخواست کے لیے ضروری تکنیکی معلومات مل سکتی ہیں۔</p></section>
        <section><h2>۵. مدد</h2><p>مدد کے لیے ای میل کرتے وقت آپ خود طے کرتے ہیں کہ کیا بھیجنا ہے۔ بہت حساس معلومات نہ بھیجیں۔</p></section>
        <section><h2>۶. غلطی کی اطلاع</h2><p>غلطی کی اطلاع OpenStreetMap یا پہلے سے بھرا GitHub مسئلہ کھول سکتی ہے۔ کچھ بھی خودکار طور پر جمع نہیں ہوتا۔</p></section>
        <section><h2>۷. اشتراک اور برآمد</h2><p>اشتراک، نقل، پرنٹ اور کیلنڈر برآمد آپ کے عمل سے ہوتے ہیں۔ بھیجنے سے پہلے مواد ضرور دیکھیں۔</p></section>
        <section><h2>۸. بچے</h2><p>SafarOne صارف اکاؤنٹ نہیں بناتا اور بچوں کی ذاتی معلومات جان بوجھ کر جمع کرنے کے لیے نہیں بنایا گیا۔ کم عمر استعمال کی نگرانی ضروری ہے۔</p></section>
        <section><h2>۹. حفاظت</h2><p>کوئی ذخیرہ یا ترسیل مکمل محفوظ نہیں۔ اپنے آلے اور فائلوں کی حفاظت کریں۔</p></section>
        <section><h2>۱۰. انتخاب اور حذف</h2><p>آپ مقام کی اجازت رد کر سکتے ہیں، محفوظ سفر یا تفصیلات حذف کر سکتے ہیں، یا ایپ کا ڈیٹا صاف کر سکتے ہیں۔</p></section>
        <section><h2>۱۱. تبدیلیاں</h2><p>اہم تبدیلی پر آخری تازہ کاری کی تاریخ بدلی جائے گی۔</p></section>
        <section><h2>۱۲. رابطہ</h2><p>فراس بدران · SafarOne مدد · <a href="mailto:planetearthkh@gmail.com">planetearthkh@gmail.com</a></p><p><a href="/muslim-travel-planner/">مرکزی ایپ</a> · <a href="/muslim-travel-planner/support.html?lang=ur">مدد</a></p></section>
      </article>
'''
privacy = replace_once(privacy, '    </main>\n    <script>', privacy_insert + '    </main>\n    <script>', 'French and Urdu privacy pages')
write(privacy_path, privacy)

support_path = 'public/support.html'
support = read(support_path)
support_insert = r'''
      <article data-lang="fr" lang="fr" dir="ltr">
        <section><h2>Contact</h2><p>Développeur : Firas Badran</p><p>Assistance SafarOne : <a href="mailto:planetearthkh@gmail.com">planetearthkh@gmail.com</a></p><p><a class="button" href="mailto:planetearthkh@gmail.com">Écrire à l’assistance</a></p><p>N’envoyez pas de mots de passe, données bancaires, numéros de carte, passeport, document d’identité ou référence privée.</p></section>
        <section><h2>Dépannage</h2><ul><li><strong>Mise à jour :</strong> rechargez puis fermez et rouvrez l’application si nécessaire.</li><li><strong>Localisation :</strong> vous pouvez l’autoriser ou la refuser et utiliser la recherche manuelle.</li><li><strong>Internet :</strong> cartes, météo, taux de change et résultats en direct nécessitent une connexion.</li><li><strong>Voyages enregistrés :</strong> ils sont conservés localement et peuvent être perdus lorsque les données sont effacées.</li><li><strong>Notifications :</strong> vérifiez les autorisations du système et, sur Android, l’autorisation des alarmes exactes.</li><li><strong>Mode hors ligne :</strong> les données enregistrées restent disponibles, mais les services en direct peuvent ne pas fonctionner.</li></ul></section>
        <section><h2>Informations utiles</h2><p>Indiquez le problème, le type d’appareil, la langue et les étapes pour le reproduire, sans données sensibles.</p><p><a href="/muslim-travel-planner/">Application</a> · <a href="/muslim-travel-planner/privacy.html?lang=fr">Confidentialité</a></p></section>
      </article>

      <article data-lang="ur" lang="ur" dir="rtl">
        <section><h2>رابطہ</h2><p>ڈویلپر: فراس بدران</p><p>SafarOne مدد: <a href="mailto:planetearthkh@gmail.com">planetearthkh@gmail.com</a></p><p><a class="button" href="mailto:planetearthkh@gmail.com">مدد کو ای میل کریں</a></p><p>پاس ورڈ، بینک یا کارڈ کی معلومات، پاسپورٹ، شناختی دستاویز یا نجی بکنگ حوالہ نہ بھیجیں۔</p></section>
        <section><h2>مسئلہ حل کرنا</h2><ul><li><strong>تازہ کاری:</strong> صفحہ دوبارہ لوڈ کریں، پھر ضرورت ہو تو ایپ بند کر کے کھولیں۔</li><li><strong>مقام:</strong> اجازت دی یا رد کی جا سکتی ہے، اور دستی تلاش استعمال کی جا سکتی ہے۔</li><li><strong>انٹرنیٹ:</strong> نقشے، موسم، شرح تبادلہ اور براہ راست نتائج کے لیے انٹرنیٹ درکار ہے۔</li><li><strong>محفوظ سفر:</strong> یہ اسی آلے پر رہتے ہیں اور ڈیٹا صاف ہونے پر ختم ہو سکتے ہیں۔</li><li><strong>اطلاعات:</strong> نظام کی اجازتیں اور Android پر درست وقت کی الارم اجازت چیک کریں۔</li><li><strong>آف لائن:</strong> محفوظ مواد کھل سکتا ہے، مگر براہ راست خدمات کام نہ کریں۔</li></ul></section>
        <section><h2>مددگار معلومات</h2><p>مسئلہ، آلے کی قسم، ایپ کی زبان اور دوبارہ پیدا کرنے کے مراحل لکھیں، مگر حساس معلومات شامل نہ کریں۔</p><p><a href="/muslim-travel-planner/">مرکزی ایپ</a> · <a href="/muslim-travel-planner/privacy.html?lang=ur">رازداری</a></p></section>
      </article>
'''
support = replace_once(support, '    </main>\n    <script>', support_insert + '    </main>\n    <script>', 'French and Urdu support pages')
write(support_path, support)

print('Deep-audit fixes applied successfully.')
