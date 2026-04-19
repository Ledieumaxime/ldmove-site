import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { motion } from "framer-motion";

const HandstandComingSoon = () => {
  return (
    <Layout>
      <SectionWrapper className="bg-sand pt-28 md:pt-36 min-h-[70vh] flex items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-8">
            Handstand Program – Coming soon
          </h1>
          <p className="font-body text-muted-foreground text-lg leading-relaxed mb-4">
            This handstand program is not available yet. I'm currently building it with my first clients so it's clear, structured, and effective.
          </p>
          <p className="font-body text-muted-foreground text-lg leading-relaxed mb-10">
            If you want to be notified when it's ready, you can reach out to me directly or join the waitlist.
          </p>
          <div className="mt-10">
            <Link
              to="/programmes"
              className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft size={14} />
              Back to Programs
            </Link>
          </div>
        </motion.div>
      </SectionWrapper>
    </Layout>
  );
};

export default HandstandComingSoon;
