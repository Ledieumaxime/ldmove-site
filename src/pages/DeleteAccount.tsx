import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";

/**
 * How to have your account and data deleted.
 *
 * Google Play requires a page it can link to from the store listing, and
 * requires it to be reachable without signing in: someone who has already
 * uninstalled the app, or who cannot get back into it, still has to be
 * able to ask. So this lives on the public site, not inside /app.
 *
 * It has to say what is deleted, what is kept and for how long. Those
 * answers are the ones in the privacy policy, restated here rather than
 * linked, because a person reading this page wants them here.
 */
const DeleteAccountPage = () => {
  return (
    <Layout>
      <SectionWrapper className="bg-background pt-28 md:pt-36">
        <div className="max-w-3xl mx-auto">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            Legal
          </p>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10">
            Delete your account
          </h1>

          <div className="font-body text-muted-foreground leading-relaxed space-y-8">
            <section>
              <p>
                You can ask us to delete your LD Move account and everything
                attached to it, at any time and without giving a reason.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                How to ask
              </h2>
              <p className="mb-3">
                Email{" "}
                <a
                  href="mailto:coach@ldmove.com?subject=Delete%20my%20account"
                  className="text-accent hover:underline"
                >
                  coach@ldmove.com
                </a>{" "}
                from the address you use to sign in, with "Delete my account"
                as the subject.
              </p>
              <p>
                We reply within 7 days and delete within 30. You do not need
                the app installed, and you do not need to be able to sign in.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                What gets deleted
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your account, name and email address.</li>
                <li>Your intake answers and assessment.</li>
                <li>Your training programs and everything you logged in them.</li>
                <li>
                  Your form-check videos and the comment threads with your
                  coach.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">
                What we keep, and for how long
              </h2>
              <p>
                Invoices and payment records are kept for 10 years where
                accounting law requires it. Server logs are kept for a short
                period to operate and secure the service, and are not tied to
                your account once it is gone. Nothing else is retained.
              </p>
            </section>

            <section>
              <p className="text-sm">
                See the{" "}
                <a href="/privacy" className="text-accent hover:underline">
                  privacy policy
                </a>{" "}
                for what we collect and why. Last updated: August 2026.
              </p>
            </section>
          </div>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

export default DeleteAccountPage;
