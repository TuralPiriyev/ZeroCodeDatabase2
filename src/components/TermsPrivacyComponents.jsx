import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Helper: read ?lang=en
function useLang() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  return params.get('lang') === 'en' ? 'en' : 'az';
}

export function LegalHeader({ titleAz, titleEn, effectiveDate }) {
  const lang = useLang();
  const navigate = useNavigate();
  const toggle = () => {
    const params = new URLSearchParams(window.location.search);
    params.set('lang', lang === 'en' ? 'az' : 'en');
    navigate({ search: params.toString() });
  };
  return (
    <header className="bg-white shadow-sm py-6 mb-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{lang === 'en' ? titleEn : titleAz}</h1>
          <div className="text-sm text-gray-600">Effective date: {effectiveDate || '2025-09-27'}</div>
        </div>
        <div className="mt-3 text-sm">
          <button onClick={toggle} className="text-sm text-blue-600 hover:underline">{lang === 'en' ? 'Azerbaijani' : 'English'}</button>
        </div>
      </div>
    </header>
  );
}

export function SummaryBox({ bullets }) {
  const lang = useLang();
  return (
    <div className="max-w-4xl mx-auto px-4 mb-6">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <ul className="list-disc ml-5 text-sm text-gray-800">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TermsPage() {
  const lang = useLang();
  const titleAz = 'Xidmət Şərtləri (Terms of Service)';
  const titleEn = 'Terms of Service';
  const effectiveDate = '2025-09-27';

  const summaryAz = [
    'Abunəliklər monthly olaraq avtomatik yenilənir; ləğv üçün support ilə əlaqə saxlayın.',
    'Ödənişlər Paddle vasitəsilə emal olunur; kart məlumatları bizdə saxlanmır.',
    'Geri qaytarma: default 14 gün (placeholder).'
  ];
  const summaryEn = [
    'Subscriptions auto-renew monthly; contact support to cancel.',
    'Payments are processed via Paddle; we do not store card details.',
    'Refund: default 14 days (placeholder).'
  ];

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <LegalHeader titleAz={titleAz} titleEn={titleEn} effectiveDate={effectiveDate} />
      <div className="max-w-4xl mx-auto px-4">
        <SummaryBox bullets={lang === 'en' ? summaryEn : summaryAz} />

        <article className="bg-white p-6 rounded shadow-sm">
          <section>
            <h2 className="text-lg font-semibold mb-2">{lang === 'en' ? '1. Introduction' : '1. Giriş'}</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {lang === 'en'
                ? 'These Terms set out the agreement between ZeroCodeDB and users of https://zerocodedb.online. They govern access to subscription courses (Basic/Pro/Ultimate) and other services.'
                : 'ZeroCodeDB ilə https://zerocodedb.online saytından istifadə edənlər arasında bağlanan bu Xidmət Şərtlərini müəyyən edir. Bu şərtlər Basic/Pro/Ultimate abunə xidmətlərini və digər xidmətləri əhatə edir.'}
            </p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '2. Subscriptions & Payments' : '2. Abunəlik və Ödənişlər'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? (
              <>Subscriptions are billed as indicated on checkout. Payments are processed by Paddle. Subscriptions auto-renew until cancelled.</>
            ) : (
              <>Ödənişlər checkout zamanı göstərilən qaydada həyata keçirilir. Ödənişlər Paddle tərəfindən emal olunur. Abunəliklər ləğv olunana qədər avtomatik yenilənir.</>
            )}</p>
            <ul className="mt-2 ml-5 text-sm list-disc text-gray-700">
              <li>{lang === 'en' ? 'Currency example: AZN.' : 'Valyuta nümunəsi: AZN.'}</li>
              <li>{lang === 'en' ? 'Refund policy: default 14 days — replace if different.' : 'Geri qaytarma siyasəti: default 14 gün — fərqli olarsa dəyişdirin.'}</li>
            </ul>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '3. Cancellation & Refunds' : '3. Ləğv və Geri Qaytarma'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? (
              <>To cancel subscriptions, users should use their account settings or contact support at support@zerocodedb.online. Refund requests are handled according to our refund policy.</>
            ) : (
              <>Abunəlikləri ləğv etmək üçün istifadəçilər hesab parametrlərindən istifadə etməli və ya support@zerocodedb.online ünvanına müraciət etməlidirlər. Geri qaytarma tələbləri siyasətimizə uyğun olaraq işlənir.</>
            )}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '4. Restrictions' : '4. Məhdudiyyətlər'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? 'You may not use the service for unlawful or abusive activities.' : 'Xidmətdən qanunsuz və ya zərərli məqsədlər üçün istifadə etmək qadağandır.'}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '5. Intellectual Property' : '5. Əqli Mülkiyyət'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? 'All content is owned by ZeroCodeDB and protected by copyright.' : 'Bütün məzmun ZeroCodeDB-ə məxsusdur və müəllif hüquqları ilə qorunur.'}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '6. Liability Limitations' : '6. Məsuliyyətin Məhdudlaşdırılması'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? 'Liability is limited to the maximum extent permitted by law.' : 'Məsuliyyət qanunun icazə verdiyi maksimum həddə qədər məhdudlaşdırılır.'}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '7. Governing Law' : '7. Tətbiq Olunan Qanun'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? 'These Terms are governed by the laws of the Republic of Azerbaijan.' : 'Bu Şərtlər Azərbaycan Respublikası qanunlarına uyğun tənzimlənir.'}</p>
          </section>

          <section className="mt-6">
            <h3 className="font-semibold">{lang === 'en' ? 'Contact' : 'Əlaqə'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? (
              <>For questions contact: support@zerocodedb.online</>
            ) : (
              <>Suallar üçün əlaqə: support@zerocodedb.online</>
            )}</p>
          </section>
        </article>
      </div>
    </main>
  );
}

export function PrivacyPage() {
  const lang = useLang();
  const titleAz = 'Məxfilik Siyasəti (Privacy Policy)';
  const titleEn = 'Privacy Policy';
  const effectiveDate = '2025-09-27';

  const summaryAz = [
    'Hansı məlumatları topladığımız və necə istifadə etdiyimiz barədə məlumat.',
    'Ödəniş metadata və webhook payloads audit üçün saxlanır.',
    'İstifadəçilər məlumat tələb edə və ya silinməsini xahiş edə bilər.'
  ];
  const summaryEn = [
    'What data we collect and how we use it.',
    'Payment metadata and webhook payloads are retained for auditing.',
    'Users can request data access or deletion.'
  ];

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <LegalHeader titleAz={titleAz} titleEn={titleEn} effectiveDate={effectiveDate} />
      <div className="max-w-4xl mx-auto px-4">
        <SummaryBox bullets={lang === 'en' ? summaryEn : summaryAz} />

        <article className="bg-white p-6 rounded shadow-sm">
          <section>
            <h2 className="text-lg font-semibold">{lang === 'en' ? '1. Information We Collect' : '1. Topladığımız Məlumatlar'}</h2>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? (
              <>We collect account information (name, email), payment metadata, and analytics data. Payment processing is handled by Paddle; payment card details are not stored by us.</>
            ) : (
              <>Biz hesab məlumatları (ad, email), ödəniş metadata və analitika məlumatları toplayırıq. Ödəniş emalı Paddle tərəfindən həyata keçirilir; kart məlumatları bizdə saxlanmır.</>
            )}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '2. How We Use Data' : '2. Məlumatları Necə İstifadə Edirik'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? 'To provide services, process payments, send transactional emails, and improve our product.' : 'Xidmət göstərmək, ödənişləri emal etmək, tranzaksiya emailləri göndərmək və məhsulu yaxşılaşdırmaq üçün istifadə edirik.'}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '3. Cookies & Tracking' : '3. Cookie və İzləmə'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? (
              <>We use necessary cookies and analytics. Examples: Paddle cookies for checkout, Google Analytics for usage statistics.</>
            ) : (
              <>Biz lazım olan cookie-lər və analitika cookie-ləri istifadə edirik. Nümunələr: Paddle checkout cookie-ləri, Google Analytics istifadə statistikasını toplamaq üçün.</>
            )}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '4. Third-party Processors' : '4. Üçüncü Tərəf Emalçılar'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? (
              <>Third parties include Paddle (payments), Google (analytics), and email providers. We may share necessary data with them to provide services.</>
            ) : (
              <>Üçüncü tərəflər arasında Paddle (ödənişlər), Google (analitika) və email təminatçıları var. Xidmət göstərmək üçün lazım olan məlumatlar bu tərəflərlə paylaşılır.</>
            )}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '5. Data Retention' : '5. Məlumatların Saxlanma Müddəti'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? 'Billing and payment records are retained for 7 years by default (placeholder).' : 'Ödəniş və billing qeydləri default olaraq 7 il saxlanılır (placeholder).'}
            </p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '6. Your Rights' : '6. Sizin Hüquqlarınız'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? 'You can request access, correction or deletion of your personal data by contacting support@zerocodedb.online.' : 'Şəxsi məlumatlarınıza giriş, düzəliş və ya silinmə tələb edə bilərsiniz: support@zerocodedb.online.'}</p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold">{lang === 'en' ? '7. Security' : '7. Təhlükəsizlik'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? 'We implement reasonable security measures but cannot guarantee absolute security.' : 'Biz məqbul təhlükəsizlik tədbirləri görürük, lakin tam təhlükəsizliyi zəmanət verə bilmərik.'}</p>
          </section>

          <section className="mt-6">
            <h3 className="font-semibold">{lang === 'en' ? 'Contact' : 'Əlaqə'}</h3>
            <p className="text-sm text-gray-700 mt-2">{lang === 'en' ? <>For data requests: support@zerocodedb.online</> : <>Məlumat tələbləri üçün: support@zerocodedb.online</>}</p>
          </section>
        </article>
      </div>
    </main>
  );
}

export function LegalFooter() {
  return (
    <footer className="bg-white border-t mt-12">
      <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between text-sm text-gray-600">
        <div>© ZeroCodeDB • 123456789</div>
        <div className="space-x-4">
          <a href="https://zerocodedb.online/terms" className="hover:underline">Xidmət Şərtləri</a>
          <a href="https://zerocodedb.online/privacy" className="hover:underline">Məxfilik Siyasəti</a>
        </div>
      </div>
    </footer>
  );
}

// Default export helper (optional) - you can import specific components instead
export default function TermsPrivacyBundle() {
  return (
    <div>
      <p className="p-4 text-sm text-gray-600">This file exports TermsPage, PrivacyPage and LegalFooter components. Use them in routes.</p>
    </div>
  );
}
