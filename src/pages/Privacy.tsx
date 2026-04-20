import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";

const PrivacyPage = () => {
  return (
    <Layout>
      <SectionWrapper className="bg-background pt-28 md:pt-36">
        <div className="max-w-3xl mx-auto">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            Legal
          </p>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10">
            Privacy Policy
          </h1>

          <div className="font-body text-muted-foreground leading-relaxed space-y-8">
            <section>
              <p>
                This privacy policy explains what personal data LD Move
                collects, why, where it is stored and what rights you have over
                it. If you have any question, email{" "}
                <a
                  href="mailto:ld_move@icloud.com"
                  className="text-accent hover:underline"
                >
                  ld_move@icloud.com
                </a>{" "}
                at any time.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Who is responsible for your data
              </h2>
              <p>
                Maxime Ledieu, publisher of LD Move (see the{" "}
                <a href="/legal" className="text-accent hover:underline">
                  legal notice
                </a>
                ), is the data controller.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                What data we collect
              </h2>
              <p className="mb-3">We only collect what is needed to run the service:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Contact and application forms:</strong> first name,
                  last name, email, WhatsApp number (or "no WhatsApp" if you
                  opt out), country, training goal, level, desired duration,
                  and the free-text message you send us.
                </li>
                <li>
                  <strong>Account signup (client area):</strong> email and
                  name; a password that is hashed and never visible in clear
                  to us.
                </li>
                <li>
                  <strong>Form-check uploads:</strong> videos you voluntarily
                  send to your coach for review, together with any comment
                  attached.
                </li>
                <li>
                  <strong>Payments (when active):</strong> handled directly by
                  Stripe; we never see or store your card details.
                </li>
                <li>
                  <strong>Technical logs:</strong> standard server logs kept
                  for a short period to operate and secure the service.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Why we use your data
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Reply to your coaching application or contact message.</li>
                <li>Deliver the training programs you purchase.</li>
                <li>
                  Review your form-check videos and send you personalized
                  feedback.
                </li>
                <li>
                  Send you transactional emails tied to your account (confirmations,
                  payment receipts, program updates).
                </li>
                <li>Comply with our legal obligations.</li>
              </ul>
              <p className="mt-3">
                We do <strong>not</strong> sell your data, share it with
                advertisers, or use it for profiling.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Where your data is stored
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Supabase</strong> (database, authentication and
                  video storage) — EU region, Ireland (eu-west-1).
                </li>
                <li>
                  <strong>Resend</strong> (transactional emails) — EU region.
                </li>
                <li>
                  <strong>Stripe</strong> (payments, when active) — processes
                  payments under its own privacy policy and never exposes your
                  card details to us.
                </li>
                <li>
                  <strong>Vercel</strong> (website hosting and server logs) —
                  global edge network.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                How long we keep it
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Application and contact messages: up to 3 years after the
                  last exchange, then deleted.
                </li>
                <li>
                  Client accounts and form-check videos: kept as long as your
                  account is active, then deleted upon request or after 12
                  months of inactivity.
                </li>
                <li>
                  Billing records (when Stripe is active): kept for the legal
                  retention period that applies to invoices (typically 10
                  years under French law, if applicable).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Your rights
              </h2>
              <p className="mb-3">
                Under the EU GDPR and similar privacy laws, you have the right
                to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access the personal data we hold about you.</li>
                <li>Correct any inaccurate data.</li>
                <li>
                  Request the deletion of your data ("right to be forgotten").
                </li>
                <li>
                  Export your data in a portable format.
                </li>
                <li>
                  Object to or restrict a specific processing activity.
                </li>
                <li>
                  Lodge a complaint with your local data-protection authority
                  (e.g. the CNIL in France).
                </li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, simply email{" "}
                <a
                  href="mailto:ld_move@icloud.com"
                  className="text-accent hover:underline"
                >
                  ld_move@icloud.com
                </a>
                . We aim to respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Cookies
              </h2>
              <p>
                This website uses only strictly necessary cookies required to
                keep you logged into your client area and to remember your
                language preference. No tracking, advertising or analytics
                cookies are used at this time. If that changes, a cookie
                banner will be added and your consent will be requested.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Updates to this policy
              </h2>
              <p>
                This policy may be updated occasionally. Last updated: April
                2026.
              </p>
            </section>
          </div>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

export default PrivacyPage;
