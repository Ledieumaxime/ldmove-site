import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Heart, Compass, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { useLang } from "@/contexts/LangContext";
import coachImg from "@/assets/maxime-portrait.jpg";

const AProposPage = () => {
  const { t } = useLang();


  return (
    <Layout>
      <SectionWrapper className="bg-background pt-28 md:pt-36">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="order-1 lg:order-1">
            
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6">{t("about.title")}</h1>
            <div className="font-body text-muted-foreground leading-relaxed space-y-4">
              <p>{t("about.p1")}</p>
              <p>{t("about.p2")}</p>
              <p>{t("about.p3")}</p>
            </div>
          </div>
          <div className="order-2 lg:order-2">
            <div className="rounded-2xl overflow-hidden shadow-2xl max-w-md mx-auto">
              <img src={coachImg} alt="Maxime Ledieu, LD Move" className="w-full h-auto object-contain" />
            </div>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-sand">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">{t("about.philo.tag")}</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold">{t("about.philo.title")}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Heart, title: t("about.philo1.title"), desc: t("about.philo1.desc") },
            { icon: Compass, title: t("about.philo2.title"), desc: t("about.philo2.desc") },
            { icon: Sparkles, title: t("about.philo3.title"), desc: t("about.philo3.desc") },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
                <item.icon className="text-accent" size={28} />
              </div>
              <h3 className="font-heading text-2xl font-bold mb-3">{item.title}</h3>
              <p className="font-body text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-accent text-accent-foreground">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">{t("about.cta.title")}</h2>
          <p className="font-body text-lg text-accent-foreground/80 mb-10">{t("about.cta.desc")}</p>
          <Button variant="default" size="xl" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <Link to="/contact">{t("about.cta.btn")} <ArrowRight size={20} /></Link>
          </Button>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

export default AProposPage;
