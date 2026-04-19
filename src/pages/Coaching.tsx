import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, ArrowRight, Video, ClipboardList, RefreshCw, Target,
  MessageCircle, Zap, ChevronDown
} from "lucide-react";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { useLang } from "@/contexts/LangContext";
import heroImg from "@/assets/hero-handstand.jpg";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const CoachingPage = () => {
  const { t } = useLang();

  const forItems = [
    t("coaching.for.t1"),
    t("coaching.for.t2"),
    t("coaching.for.t3"),
    t("coaching.for.t4"),
  ];

  const included = [
    { icon: ClipboardList, title: t("coaching.inc1.title"), desc: t("coaching.inc1") },
    { icon: Target, title: t("coaching.inc2.title"), desc: t("coaching.inc2") },
    { icon: Video, title: t("coaching.inc3.title"), desc: t("coaching.inc3") },
    { icon: RefreshCw, title: t("coaching.inc4.title"), desc: t("coaching.inc4") },
    { icon: MessageCircle, title: t("coaching.inc5.title"), desc: t("coaching.inc5") },
  ];

  const steps = [
    { step: "01", title: t("coaching.process.s1.title"), desc: t("coaching.process.s1.desc") },
    { step: "02", title: t("coaching.process.s2.title"), desc: t("coaching.process.s2.desc") },
    { step: "03", title: t("coaching.process.s3.title"), desc: t("coaching.process.s3.desc") },
  ];

  const faqs = [
    { q: t("coaching.faq.q1"), a: t("coaching.faq.a1") },
    { q: t("coaching.faq.q2"), a: t("coaching.faq.a2") },
    { q: t("coaching.faq.q3"), a: t("coaching.faq.a3") },
    { q: t("coaching.faq.q4"), a: t("coaching.faq.a4") },
    { q: t("coaching.faq.q5"), a: t("coaching.faq.a5") },
  ];


  return (
    <Layout>
      {/* Hero */}
      <section className="bg-sand min-h-[60vh] flex items-center">
        <div className="container py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-4">
              {t("coaching.tag")}
            </p>
            <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              {t("coaching.title")}
            </h1>
          </motion.div>
        </div>
      </section>

      {/* Pour qui */}
      <SectionWrapper className="bg-background">
        <div>
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("coaching.for.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            {t("coaching.for.title")}
          </h2>
          <p className="font-body text-muted-foreground mb-8">
            {t("coaching.for.desc")}
          </p>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-4">
            {forItems.map((txt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3"
              >
                <CheckCircle2 className="text-accent mt-0.5 shrink-0" size={22} />
                <p className="font-body text-foreground">{txt}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionWrapper>

      {/* Ce qui est inclus */}
      <SectionWrapper className="bg-sand">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("coaching.included.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold">
            {t("coaching.included")}
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {included.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-background rounded-xl p-8 border border-border hover:border-accent/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-5">
                <item.icon className="text-accent" size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold mb-2">{item.title}</h3>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      {/* Plans */}
      <SectionWrapper className="bg-background">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("coaching.pricing.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold">
            {t("coaching.pricing.title")}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
          {/* Starter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl p-10 border border-border flex flex-col"
          >
            <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-2">
              {t("coaching.pricing.monthly.name")}
            </p>
            <h3 className="font-heading text-xl font-bold mb-6">
              {t("coaching.pricing.monthly.title")}
            </h3>
            <p className="font-body text-muted-foreground text-sm leading-relaxed mb-6 flex-1">
              {t("coaching.pricing.monthly.desc")}
            </p>
            <p className="font-body text-xs text-muted-foreground italic mb-6">
              {t("coaching.pricing.custom")}
            </p>
            <Button variant="ctaOutline" size="lg" className="w-full" asChild>
              <Link to="/apply">{t("coaching.pricing.cta")} <ArrowRight size={16} /></Link>
            </Button>
          </motion.div>

          {/* Progression */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-primary text-primary-foreground rounded-2xl p-10 border-2 border-accent flex flex-col relative overflow-hidden"
          >
            <span className="absolute top-4 right-4 bg-accent text-accent-foreground font-body text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
              {t("coaching.pricing.pack.badge")}
            </span>
            <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-2 mt-2">
              {t("coaching.pricing.pack.name")}
            </p>
            <h3 className="font-heading text-xl font-bold mb-6">
              {t("coaching.pricing.pack.title")}
            </h3>
            <p className="font-body text-primary-foreground/70 text-sm leading-relaxed mb-6 flex-1">
              {t("coaching.pricing.pack.desc")}
            </p>
            <p className="font-body text-xs text-primary-foreground/50 italic mb-6">
              {t("coaching.pricing.custom")}
            </p>
            <Button variant="cta" size="lg" className="w-full" asChild>
              <Link to="/apply">{t("coaching.pricing.cta")} <ArrowRight size={16} /></Link>
            </Button>
          </motion.div>

          {/* Transformation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-2xl p-10 border border-border flex flex-col relative overflow-hidden"
          >
            <span className="absolute top-4 right-4 bg-accent text-accent-foreground font-body text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
              {t("coaching.pricing.pack6.badge")}
            </span>
            <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-2 mt-2">
              {t("coaching.pricing.pack6.name")}
            </p>
            <h3 className="font-heading text-xl font-bold mb-6">
              {t("coaching.pricing.pack6.title")}
            </h3>
            <p className="font-body text-muted-foreground text-sm leading-relaxed mb-6 flex-1">
              {t("coaching.pricing.pack6.desc")}
            </p>
            <p className="font-body text-xs text-muted-foreground italic mb-6">
              {t("coaching.pricing.custom")}
            </p>
            <Button variant="ctaOutline" size="lg" className="w-full" asChild>
              <Link to="/apply">{t("coaching.pricing.cta")} <ArrowRight size={16} /></Link>
            </Button>
          </motion.div>
        </div>
      </SectionWrapper>

      {/* Comment ça se passe */}
      <SectionWrapper className="bg-sand">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("coaching.process.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold">
            {t("coaching.process.title")}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <span className="font-heading text-6xl font-bold text-accent/20">{s.step}</span>
              <h3 className="font-heading text-2xl font-bold mt-2 mb-3">{s.title}</h3>
              <p className="font-body text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-background">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("coaching.faq.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold">
            {t("coaching.faq.title")}
          </h2>
        </div>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-sand rounded-xl border border-border px-6"
              >
                <AccordionTrigger className="font-heading text-base font-semibold hover:no-underline">
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


    </Layout>
  );
};

export default CoachingPage;
