import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Play, Users, HelpCircle } from "lucide-react";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { useLang } from "@/contexts/LangContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const MiddleSplitPage = () => {
  const { t } = useLang();

  const benefits = [
    t("ms.benefits.b1"),
    t("ms.benefits.b2"),
    t("ms.benefits.b3"),
    t("ms.benefits.b4"),
  ];

  const phases = [
    { title: t("ms.how.phase1.title"), desc: t("ms.how.phase1.desc") },
    { title: t("ms.how.phase2.title"), desc: t("ms.how.phase2.desc") },
    { title: t("ms.how.phase3.title"), desc: t("ms.how.phase3.desc") },
    { title: t("ms.how.phase4.title"), desc: t("ms.how.phase4.desc") },
  ];

  const videos = Array.from({ length: 15 }, (_, i) => ({
    title: t(`ms.video.${i + 1}.title`),
    desc: t(`ms.video.${i + 1}.desc`),
  }));

  const whoItems = [t("ms.who.w1"), t("ms.who.w2"), t("ms.who.w3")];

  const faqs = [
    { q: t("ms.faq.q1"), a: t("ms.faq.a1") },
    { q: t("ms.faq.q2"), a: t("ms.faq.a2") },
    { q: t("ms.faq.q3"), a: t("ms.faq.a3") },
    { q: t("ms.faq.q4"), a: t("ms.faq.a4") },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent/20" />
        <div className="container relative z-10 py-20 pt-32 md:pt-36">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-4">
              {t("ms.hero.tag")}
            </p>
            <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-tight mb-6">
              {t("ms.hero.title")}
            </h1>
            <p className="font-body text-lg md:text-xl text-primary-foreground/80 leading-relaxed mb-10 max-w-lg">
              {t("ms.hero.subtitle")}
            </p>
            <Button variant="cta" size="xl" asChild>
              <Link to="/contact">
                {t("ms.hero.cta")} <ArrowRight size={20} />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <SectionWrapper className="bg-background">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("ms.benefits.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold">
            {t("ms.benefits.title")}
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-4 bg-card rounded-xl p-6 border border-border"
            >
              <CheckCircle2 className="text-accent mt-0.5 shrink-0" size={22} />
              <p className="font-body text-foreground">{b}</p>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      {/* How it works */}
      <SectionWrapper className="bg-sand">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("ms.how.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4">
            {t("ms.how.title")}
          </h2>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <span className="inline-flex items-center gap-2 bg-background rounded-full px-5 py-2 border border-border font-body text-sm font-semibold">
            <Clock size={16} className="text-accent" />
            {t("ms.how.duration")}
          </span>
          <span className="inline-flex items-center gap-2 bg-background rounded-full px-5 py-2 border border-border font-body text-sm font-semibold">
            <Users size={16} className="text-accent" />
            {t("ms.how.frequency")}
          </span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {phases.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="bg-background rounded-xl p-8 border border-border relative"
            >
              <span className="font-heading text-5xl font-bold text-accent/15 absolute top-4 right-4">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-heading text-lg font-bold mb-2">{p.title}</h3>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">
                {p.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      {/* Video Content */}
      <SectionWrapper className="bg-background">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("ms.videos.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold">
            {t("ms.videos.title")}
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {videos.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 6) * 0.05 }}
              className="bg-card rounded-xl border border-border overflow-hidden group"
            >
              <div className="aspect-video bg-muted flex items-center justify-center relative">
                <Play
                  size={40}
                  className="text-accent/40 group-hover:text-accent transition-colors"
                />
                <span className="absolute top-2 left-2 font-body text-xs bg-primary/80 text-primary-foreground rounded px-2 py-0.5 font-semibold">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-heading text-sm font-bold mb-1 leading-snug">
                  {v.title}
                </h3>
                <p className="font-body text-muted-foreground text-xs leading-relaxed">
                  {v.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      {/* Pour qui */}
      <SectionWrapper className="bg-sand">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("ms.who.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold">
            {t("ms.who.title")}
          </h2>
        </div>
        <div className="space-y-4 max-w-2xl mx-auto">
          {whoItems.map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-4 bg-background rounded-xl p-6 border border-border"
            >
              <CheckCircle2 className="text-accent mt-0.5 shrink-0" size={22} />
              <p className="font-body text-foreground">{w}</p>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper className="bg-background">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("ms.faq.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold">
            {t("ms.faq.title")}
          </h2>
        </div>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-card border border-border rounded-xl px-6"
              >
                <AccordionTrigger className="font-heading text-base font-bold hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="font-body text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SectionWrapper>

      {/* CTA Final */}
      <SectionWrapper className="bg-accent text-accent-foreground">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-6">
            {t("ms.cta.title")}
          </h2>
          <p className="font-body text-lg text-accent-foreground/80 mb-10">
            {t("ms.cta.desc")}
          </p>
          <Button
            variant="default"
            size="xl"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            asChild
          >
            <Link to="/contact">
              {t("ms.cta.btn")} <ArrowRight size={20} />
            </Link>
          </Button>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

export default MiddleSplitPage;
