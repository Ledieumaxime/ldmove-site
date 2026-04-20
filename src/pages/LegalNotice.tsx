import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";

const LegalNoticePage = () => {
  return (
    <Layout>
      <SectionWrapper className="bg-background pt-28 md:pt-36">
        <div className="max-w-3xl mx-auto">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            Legal
          </p>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10">
            Legal Notice
          </h1>

          <div className="font-body text-muted-foreground leading-relaxed space-y-8">
            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Publisher
              </h2>
              <p>
                This website is published by <strong>Maxime Ledieu</strong>,
                operating under the brand <strong>LD Move</strong>, an online
                coaching service for handstand, mobility and calisthenics.
              </p>
              <p className="mt-2">
                Based in Bali, Indonesia. For any inquiry, please reach out via
                email at{" "}
                <a
                  href="mailto:ld_move@icloud.com"
                  className="text-accent hover:underline"
                >
                  ld_move@icloud.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Publication director
              </h2>
              <p>Maxime Ledieu.</p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Hosting
              </h2>
              <p>
                The website is hosted by <strong>Vercel Inc.</strong>, 340 S
                Lemon Ave #4133, Walnut, CA 91789, USA —{" "}
                <a
                  href="https://vercel.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  vercel.com
                </a>
                .
              </p>
              <p className="mt-2">
                User accounts, programs and uploaded form-check videos are
                stored with <strong>Supabase</strong> (EU region — Ireland).
                Transactional emails are delivered through{" "}
                <strong>Resend</strong>. Online payments, when active, are
                processed by <strong>Stripe</strong>. The domain name{" "}
                <code>ldmove.com</code> is managed through{" "}
                <strong>Cloudflare</strong>.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Intellectual property
              </h2>
              <p>
                All content on this website (text, photos, videos, programs,
                graphic identity) is the exclusive property of Maxime Ledieu /
                LD Move and is protected by applicable copyright laws.
                Reproduction, redistribution or commercial use without prior
                written consent is strictly prohibited.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Liability
              </h2>
              <p>
                The training programs and advice provided on this website are
                intended for general educational purposes. They do not
                substitute for the advice of a qualified physician,
                physiotherapist or licensed medical professional. You are
                responsible for consulting an appropriate professional before
                starting any new physical activity, and for training within
                your own limits. LD Move accepts no liability for injuries or
                damages resulting from the use of content on this website.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                Updates
              </h2>
              <p>Last updated: April 2026.</p>
            </section>
          </div>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

export default LegalNoticePage;
