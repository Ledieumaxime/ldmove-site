import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/contexts/LangContext";

const FAQPage = () => {
  const { t } = useLang();

  const faqs = Array.from({ length: 10 }, (_, i) => ({
    q: t(`faq.q${i + 1}`),
    a: t(`faq.a${i + 1}`),
  }));

  return (
    <Layout>
      <SectionWrapper className="bg-background pt-28 md:pt-36">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">{t("faq.tag")}</p>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6">{t("faq.title")}</h1>
          <p className="font-body text-muted-foreground text-lg">{t("faq.desc")}</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-xl border border-border px-6">
                <AccordionTrigger className="font-body font-semibold text-left hover:no-underline py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="font-body text-muted-foreground leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-sand">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="font-heading text-3xl font-bold mb-6">{t("faq.more.title")}</h2>
          <p className="font-body text-muted-foreground mb-8">{t("faq.more.desc")}</p>
          <Button variant="cta" size="lg" asChild>
            <Link to="/contact">{t("faq.more.btn")} <ArrowRight size={16} /></Link>
          </Button>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

export default FAQPage;
