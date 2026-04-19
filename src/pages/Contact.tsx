import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Lock } from "lucide-react";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { toast } from "sonner";
import { useLang } from "@/contexts/LangContext";
import { supabase } from "@/integrations/supabase/client";

const MAX_TEXT = 200;
const MAX_MESSAGE = 2000;

const ContactPage = () => {
  const { t } = useLang();
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    phone: "",
    country: "",
    message: "",
  });
  const [sending, setSending] = useState(false);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const prenom = form.prenom.trim();
    const nom = form.nom.trim();
    const email = form.email.trim();

    if (!prenom || !nom || !email) {
      toast.error(t("contact.error.missing"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(t("contact.error.email"));
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.functions.invoke("send-coaching-application", {
        body: {
          first_name: prenom,
          last_name: nom,
          email,
          phone: form.phone,
          country: form.country,
          message: form.message,
        },
      });

      if (error) throw error;

      toast.success(t("contact.success"));
      setForm({
        prenom: "",
        nom: "",
        email: "",
        phone: "",
        country: "",
        message: "",
      });
    } catch (err) {
      console.error("Submission error:", err);
      toast.error(t("contact.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <SectionWrapper className="bg-background pt-28 md:pt-36">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("contact.tag")}
          </p>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6">
            {t("contact.title")}
          </h1>
          <p className="font-body text-muted-foreground text-lg leading-relaxed">
            {t("contact.desc")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-w-xl mx-auto space-y-6"
          noValidate
        >
          {/* Prénom / Nom */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-sm font-medium mb-2 block">
                {t("contact.firstname")} <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.prenom}
                onChange={(e) => update("prenom", e.target.value)}
                placeholder={t("contact.firstname.ph")}
                required
                maxLength={MAX_TEXT}
                className="bg-card"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium mb-2 block">
                {t("contact.lastname")} <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.nom}
                onChange={(e) => update("nom", e.target.value)}
                placeholder={t("contact.lastname.ph")}
                required
                maxLength={MAX_TEXT}
                className="bg-card"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("contact.email")} <span className="text-destructive">*</span>
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder={t("contact.email.ph")}
              required
              maxLength={255}
              className="bg-card"
            />
          </div>

          {/* Téléphone / WhatsApp */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("contact.phone")}
            </label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder={t("contact.phone.ph")}
              maxLength={30}
              className="bg-card"
            />
            <p className="font-body text-xs text-muted-foreground mt-1.5">
              {t("contact.phone.help")}
            </p>
          </div>

          {/* Pays */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("contact.country")}
            </label>
            <Input
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              placeholder={t("contact.country.ph")}
              maxLength={MAX_TEXT}
              className="bg-card"
            />
          </div>

          {/* Question / Message */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("contact.question")} <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              placeholder={t("contact.question.ph")}
              rows={5}
              maxLength={MAX_MESSAGE}
              className="bg-card"
              required
            />
          </div>

          {/* Texte rassurant */}
          <div className="bg-sand rounded-xl p-5 border border-border">
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              {t("contact.reassurance")}
            </p>
          </div>

          {/* Bouton */}
          <Button
            variant="cta"
            size="xl"
            type="submit"
            className="w-full"
            disabled={sending}
          >
            {t("contact.submit")} <Send size={20} />
          </Button>

          {/* Confidentialité */}
          <p className="font-body text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
            <Lock size={12} />
            {t("contact.confidential")}
          </p>
        </form>
      </SectionWrapper>
    </Layout>
  );
};

export default ContactPage;
