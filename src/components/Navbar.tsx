import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Instagram, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo-ldmove.png";

const instagramUrl = "https://www.instagram.com/ld_move/";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useLang();
  const { session } = useAuth();
  const appLink = session ? "/app/home" : "/app/login";
  const appLabel = session ? "My space" : "Login";

  const navLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/coaching", label: t("nav.coaching") },
    { to: "/programmes", label: t("nav.programs") },
    { to: "/consultation", label: t("nav.consultation") },
    { to: "/a-propos", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container flex items-center justify-between h-20 md:h-24">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="LD Move" className="h-14 md:h-16 lg:h-24 w-auto" />
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-body text-sm font-medium transition-colors hover:text-accent ${
                location.pathname === link.to ? "text-accent" : "text-foreground/70"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              event.preventDefault();
              window.open(instagramUrl, "_blank", "noopener,noreferrer");
            }}
            aria-label="Open Instagram profile"
            title="@ld_move on Instagram"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Instagram size={20} />
          </a>
          <Link
            to={appLink}
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90 transition-colors"
          >
            <User size={16} />
            {appLabel}
          </Link>
        </div>

        <button
          className="lg:hidden text-foreground"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="container py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={`font-body text-lg font-medium transition-colors ${
                    location.pathname === link.to ? "text-accent" : "text-foreground/70"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={appLink}
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-4 py-3 text-base font-semibold mt-2"
              >
                <User size={18} />
                {appLabel}
              </Link>
              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    event.preventDefault();
                    window.open(instagramUrl, "_blank", "noopener,noreferrer");
                  }}
                  aria-label="Open Instagram profile"
                  title="@ld_move on Instagram"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Instagram size={20} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
