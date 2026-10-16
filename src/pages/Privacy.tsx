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
                  href="mailto:coach@ldmove.com"
                  className="text-accent hover:underline"
                >
                  coach@ldmove.com
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
                  <strong>Health and fitness information:</strong> the intake
                  questionnaire you fill in before your first program (age,
                  weight, height, training history, injuries, limitations and
                  anything else you choose to tell your coach), and the sets,
                  reps and loads you record while training. Your coach cannot
                  write a safe program without them, so this is the only
                  purpose they serve: they are never sold, never shared with
                  advertisers, and never used to profile you. They are only
                  stored with your explicit consent, which you give by ticking
                  a box in the questionnaire.
                </li>
                <li>
                  <strong>Form-check uploads:</strong> videos you voluntarily
                  send to your coach for review, together with any comment
                  attached.
                </li>
                <li>
                  <strong>Messages with your coach:</strong> the comments you
                  and your coach exchange in the app about your exercises.
                </li>
                <li>
                  <strong>Notifications:</strong> if you allow notifications in
                  the Android app, a technical identifier for your device so we
                  can send them.
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
                Legal basis
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Contract:</strong> your account, programs, messages
                  and form checks are needed to deliver the coaching you asked
                  for.
                </li>
                <li>
                  <strong>Explicit consent:</strong> your health information.
                  You can withdraw it at any time by email; this does not
                  affect what was done before.
                </li>
                <li>
                  <strong>Legitimate interest:</strong> replying to your
                  application or contact message, and keeping the service
                  secure.
                </li>
                <li>
                  <strong>Legal obligation:</strong> billing records, when
                  payments are active.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Where your data is stored
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Supabase</strong> (database, authentication and
                  video storage). EU region, Ireland (eu-west-1).
                </li>
                <li>
                  <strong>Resend</strong> (transactional emails). EU region.
                </li>
                <li>
                  <strong>Stripe</strong> (payments, when active). Processes
                  payments under its own privacy policy and never exposes your
                  card details to us.
                </li>
                <li>
                  <strong>Vercel</strong> (website hosting and server logs).
                  Global edge network.
                </li>
                <li>
                  <strong>Anthropic</strong> (AI writing assistance). Your
                  coach can use an AI tool to help write and tidy up replies.
                  To do so, the relevant comments from your exchanges are sent
                  to Anthropic, which does not use them to train its models.
                </li>
                <li>
                  <strong>Google Firebase</strong> (notifications in the
                  Android app).
                </li>
              </ul>
              <p className="mt-3">
                Some of these providers are based in the United States
                (Vercel, Stripe, Anthropic, Google). These transfers rely on
                the safeguards the GDPR provides for, such as the EU-US Data
                Privacy Framework or the European Commission's standard
                contractual clauses.
              </p>
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
                  Client accounts, messages and form-check videos: kept as long as your
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
                  Withdraw your consent for your health information at any
                  time.
                </li>
                <li>
                  Lodge a complaint with your local data-protection authority
                  (e.g. the CNIL in France).
                </li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, simply email{" "}
                <a
                  href="mailto:coach@ldmove.com"
                  className="text-accent hover:underline"
                >
                  coach@ldmove.com
                </a>
                . We aim to respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Cookies
              </h2>
              <p>
                This website only stores what is strictly necessary on your
                device: what keeps you logged into your client area, and your
                display preferences such as dark mode. No tracking,
                advertising or analytics cookies are used, and fonts are
                served from our own domain, so no third party is contacted
                when you browse. If that changes, a cookie banner will be
                added and your consent will be requested.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Updates to this policy
              </h2>
              <p>
                This policy may be updated occasionally. Last updated: October
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
