import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { useLang } from "@/contexts/LangContext";

const ConsultationPage = () => {
  const { t } = useLang();

  const bullets = [
    t("consult.box.b1"),
    t("consult.box.b2"),
    t("consult.box.b3"),
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-sand min-h-[50vh] flex items-center">
        <div className="container py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-4">
              {t("consult.tag")}
            </p>
            <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              30-Min<br />Consultation
            </h1>
            <p className="font-body text-lg md:text-xl text-muted-foreground leading-relaxed">
              {t("consult.subtitle")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Booking box */}
      <SectionWrapper className="bg-background">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border-2 border-accent/30 bg-sand p-8 md:p-12"
          >
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">
              {t("consult.box.title")}
            </h2>

            <ul className="space-y-4 mb-8">
              {bullets.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="text-accent mt-1 shrink-0" size={20} />
                  <span className="font-body text-foreground/80">{item}</span>
                </li>
              ))}
            </ul>

            <Button variant="cta" size="xl" className="w-full" asChild>
              <a href="https://buy.stripe.com/5kQ3cvgvJfeL7fJ08mgfu00" target="_blank" rel="noopener noreferrer">
                Book
              </a>
            </Button>

            <p className="font-body text-sm text-muted-foreground text-center mt-4">
              After payment, you'll receive an email within 24 hours to schedule your call.
            </p>
          </motion.div>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

export default ConsultationPage;
