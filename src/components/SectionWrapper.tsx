import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

const SectionWrapper = ({ children, className, id }: Props) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.6, ease: "easeOut" }}
    className={cn("py-20 md:py-28", className)}
  >
    <div className="container">{children}</div>
  </motion.section>
);

export default SectionWrapper;
