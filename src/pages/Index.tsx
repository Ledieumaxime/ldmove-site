import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Dumbbell, Scale, TrendingUp, CheckCircle2 } from "lucide-react";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { useLang } from "@/contexts/LangContext";
import heroHome from "@/assets/hero-home.jpg";
import heroVideo from "@/assets/hero-intro.mp4";
import coachingHip from "@/assets/coaching-hip.jpg";
import coachingSeated from "@/assets/coaching-seated.jpg";
import coachingBali from "@/assets/coaching-bali.jpg";

const Index = () => {
  const { t } = useLang();

  const whoCards = [
    { icon: Lock, title: t("home2.who.card1.title"), desc: t("home2.who.p1") },
    { icon: Dumbbell, title: t("home2.who.card2.title"), desc: t("home2.who.p2") },
    { icon: Scale, title: t("home2.who.card3.title"), desc: t("home2.who.p3") },
    { icon: TrendingUp, title: t("home2.who.card4.title"), desc: t("home2.who.p4") },
  ];

  const results = [
    t("home2.philo.a1.desc"),
    t("home2.philo.a2.desc"),
    t("home2.philo.a3.desc"),
    t("home2.philo.a4.desc"),
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="relative bg-sand overflow-hidden">
        <div className="container py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-4">{t("home2.hero.tag")}</p>
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
                {t("home2.hero.title")}
              </h1>
              <p className="font-body text-lg md:text-xl text-muted-foreground leading-relaxed mb-10">
                {t("home2.hero.subtitle")}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative mx-auto max-w-[320px] aspect-[9/16] rounded-2xl overflow-hidden shadow-xl"
            >
              <video
                src={heroVideo}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover bg-foreground"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pour qui (with floating photos straddling boundaries) */}
      <SectionWrapper className="bg-background overflow-visible">
       <div className="relative">
        {/* Left photo — aligned with container left, bleeds up into Hero above */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="hidden md:block absolute left-[25px] -top-[190px] lg:-top-[250px] w-40 h-52 lg:w-56 lg:h-72 rounded-2xl overflow-hidden shadow-xl z-10"
        >
          <img src={coachingHip} alt="" className="w-full h-full object-cover" />
        </motion.div>

        {/* Right photo — aligned with container right, bleeds down into next section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="hidden md:block absolute right-[20px] -bottom-[274px] lg:-bottom-[314px] w-40 h-52 lg:w-56 lg:h-72 rounded-2xl overflow-hidden shadow-xl z-10"
        >
          <img src={coachingSeated} alt="" className="w-full h-full object-cover" />
        </motion.div>

        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-heading text-4xl md:text-6xl font-bold mb-6">{t("home2.who.tag")}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {whoCards.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-card rounded-xl p-8 border border-border hover:border-accent/30 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-5">
                <item.icon className="text-accent" size={24} />
              </div>
              <h3 className="font-heading text-xl font-bold mb-2">{item.title}</h3>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Mobile fallback: stack photos below the section */}
        <div className="md:hidden grid grid-cols-2 gap-3 mt-10 max-w-sm mx-auto">
          <div className="rounded-xl overflow-hidden shadow-lg aspect-[3/4]">
            <img src={coachingHip} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="rounded-xl overflow-hidden shadow-lg aspect-[3/4]">
            <img src={coachingSeated} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
       </div>
      </SectionWrapper>

      {/* Ma philosophie */}
      <SectionWrapper className="bg-background overflow-visible">
       <div className="relative">
        {/* Left photo aligned with bottom-right photo of Who section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="hidden md:block absolute left-[25px] -top-[200px] w-40 h-52 lg:w-56 lg:h-72 rounded-2xl overflow-hidden shadow-xl z-10"
        >
          <img src={coachingBali} alt="" className="w-full h-full object-cover" />
        </motion.div>

        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">{t("home2.philo.tag")}</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-8">{t("home2.philo.title")}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-3 bg-background rounded-xl p-6 border border-border">
              <CheckCircle2 className="text-accent mt-0.5 shrink-0" size={22} />
              <p className="font-body text-foreground">{r}</p>
            </div>
          ))}
        </div>
        <p className="font-body text-muted-foreground text-center text-lg max-w-2xl mx-auto leading-relaxed italic">
          {t("home2.philo.intro")}
        </p>
       </div>
      </SectionWrapper>

      {/* Ce que je propose */}
      <SectionWrapper className="bg-background">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">{t("home2.offer.tag")}</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-6">{t("home2.offer.title")}</h2>
          <p className="font-body text-muted-foreground text-lg">{t("home2.offer.desc")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            { title: t("home2.offer.programs.title"), desc: t("home2.offer.programs.desc"), cta: t("home2.offer.programs.cta"), link: "/programmes", highlight: false },
            { title: t("home2.offer.coaching.title"), desc: t("home2.offer.coaching.desc"), cta: t("home2.offer.coaching.cta"), link: "/coaching", highlight: true },
            { title: t("home2.offer.consult.title"), desc: t("home2.offer.consult.desc"), cta: t("home2.offer.consult.cta"), link: "/consultation", highlight: false },
          ].map((o, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={`rounded-xl p-8 border flex flex-col ${o.highlight ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
              <h3 className="font-heading text-2xl font-bold mb-3">{o.title}</h3>
              <p className={`font-body text-sm leading-relaxed mb-8 flex-1 ${o.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{o.desc}</p>
              <Button variant={o.highlight ? "cta" : "ctaOutline"} size="lg" asChild>
                <Link to={o.link}>{o.cta} <ArrowRight size={16} /></Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

    </Layout>
  );
};

export default Index;
