import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Dumbbell } from "lucide-react";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { motion } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

const ProgrammesPage = () => {
  const { t } = useLang();

  const programmes = [
    {
      title: t("prog.p6.title"),
      level: t("prog.p6.level"),
      duration: t("prog.p6.duration"),
      icon: Dumbbell,
      description: t("prog.p6.desc"),
      results: [t("prog.p6.r1"), t("prog.p6.r2"), t("prog.p6.r3")],
      customBtn: t("prog.p6.btn"),
      link: "/programmes/handstand-coming-soon",
      highlight: false,
    },
    {
      title: t("prog.p4.title"),
      level: t("prog.p4.level"),
      duration: t("prog.p4.duration"),
      icon: Dumbbell,
      description: t("prog.p4.desc"),
      results: [t("prog.p4.r1"), t("prog.p4.r2"), t("prog.p4.r3")],
      customBtn: t("prog.p4.btn"),
      link: "/programmes/middle-split-coming-soon",
      highlight: true,
    },
  ];


  return (
    <Layout>
      <SectionWrapper className="bg-sand pt-28 md:pt-36">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">{t("prog.tag")}</p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold mb-6">{t("prog.title")}</h1>
          <p className="font-body text-muted-foreground text-lg">{t("prog.desc")}</p>
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-background">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">{t("prog.how.tag")}</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold">{t("prog.how.title")}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "01", title: t("prog.how.s1.title"), desc: t("prog.how.s1.desc") },
            { step: "02", title: t("prog.how.s2.title"), desc: t("prog.how.s2.desc") },
            { step: "03", title: t("prog.how.s3.title"), desc: t("prog.how.s3.desc") },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="text-center">
              <span className="font-heading text-6xl font-bold text-accent/20">{s.step}</span>
              <h3 className="font-heading text-2xl font-bold mt-2 mb-3">{s.title}</h3>
              <p className="font-body text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      {programmes.map((prog, i) => (
        <SectionWrapper key={i} className={i % 2 === 0 ? "bg-sand" : "bg-background"}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`grid lg:grid-cols-2 gap-12 items-start ${prog.highlight ? "relative" : ""}`}>
            <div>
              {prog.highlight && (
                <span className="inline-block bg-accent text-accent-foreground font-body text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                  {t("prog.popular")}
                </span>
              )}
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-2">{prog.title}</h2>
              <div className="flex flex-wrap gap-3 mb-6">
                <span className="font-body text-xs bg-ocean-light text-ocean px-3 py-1 rounded-full font-semibold">{prog.level}</span>
                <span className="font-body text-xs bg-jungle-light text-jungle px-3 py-1 rounded-full font-semibold">{prog.duration}</span>
              </div>
              <p className="font-body text-muted-foreground leading-relaxed mb-8">{prog.description}</p>
              <Button variant="cta" size="lg" asChild>
                <Link to={prog.link || "/contact"}>{prog.customBtn || t("prog.join")} <ArrowRight size={16} /></Link>
              </Button>
            </div>
            <div className="bg-card rounded-xl p-8 border border-border">
              <h3 className="font-heading text-xl font-bold mb-5">{t("prog.results.title")}</h3>
              <div className="space-y-4">
                {prog.results.map((r, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ArrowRight className="text-accent" size={14} />
                    </div>
                    <p className="font-body text-sm">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </SectionWrapper>
      ))}

    </Layout>
  );
};

export default ProgrammesPage;
