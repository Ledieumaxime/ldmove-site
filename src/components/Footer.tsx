import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import logoWhite from "@/assets/logo-ldmove-white.png";

const Footer = () => {
  const { t } = useLang();

  const footerLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/coaching", label: t("nav.coaching") },
    { to: "/programmes", label: t("nav.programs") },
    { to: "/a-propos", label: t("nav.about") },
    { to: "/faq", label: t("footer.faq") },
    { to: "/contact", label: t("nav.contact") },
  ];

  return (
    <footer className="bg-primary text-primary-foreground py-16">
      <div className="container">
        <div className="flex flex-row justify-between gap-12">
          {/* Left: nav + social */}
          <div className="flex flex-col gap-10 md:flex-row md:gap-16">
            <div>
              <h4 className="font-body font-semibold text-sm uppercase tracking-wider mb-4 text-primary-foreground/50">{t("footer.nav")}</h4>
              <div className="flex flex-col gap-2">
                {footerLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-body font-semibold text-sm uppercase tracking-wider mb-4 text-primary-foreground/50">{t("footer.follow")}</h4>
              <a
                href="https://www.instagram.com/ld_move/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.preventDefault();
                  window.open("https://www.instagram.com/ld_move/", "_blank", "noopener,noreferrer");
                }}
                aria-label="Open Instagram profile"
                title="@ld_move on Instagram"
                className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-primary-foreground/70 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Instagram size={18} />
                @ld_move
              </a>
            </div>
          </div>

          {/* Right: logo — bottom-aligned on md+, top-aligned on mobile */}
          <div className="flex items-start md:items-end">
            <img src={logoWhite} alt="LD Move logo" className="h-16 md:h-24 w-auto opacity-80 invert" />
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link
              to="/legal"
              className="font-body text-xs text-primary-foreground/50 hover:text-accent transition-colors"
            >
              Legal notice
            </Link>
            <span className="text-xs text-primary-foreground/20">·</span>
            <Link
              to="/privacy"
              className="font-body text-xs text-primary-foreground/50 hover:text-accent transition-colors"
            >
              Privacy policy
            </Link>
          </div>
          <p className="font-body text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} LD Move – Maxime Ledieu. {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
