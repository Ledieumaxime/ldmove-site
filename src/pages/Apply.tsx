import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Lock } from "lucide-react";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { toast } from "sonner";
import { useLang } from "@/contexts/LangContext";
import { supabase } from "@/integrations/supabase/client";

const MAX_TEXT = 200;
const MAX_MESSAGE = 2000;

const ApplyPage = () => {
  const { t } = useLang();
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    phone: "",
    country: "",
    goal: "",
    level: "",
    duration: "",
    message: "",
  });
  const [sending, setSending] = useState(false);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation: show user-friendly messages before hitting the server.
    const prenom = form.prenom.trim();
    const nom = form.nom.trim();
    const email = form.email.trim();

    if (!prenom || !nom || !email || !form.goal || !form.level) {
      toast.error(t("apply.error.missing"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(t("apply.error.email"));
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
          goal: form.goal,
          level: form.level,
          duration: form.duration,
          message: form.message,
        },
      });

      if (error) throw error;

      toast.success(t("apply.success"));
      setForm({
        prenom: "",
        nom: "",
        email: "",
        phone: "",
        country: "",
        goal: "",
        level: "",
        duration: "",
        message: "",
      });
    } catch (err) {
      console.error("Submission error:", err);
      toast.error(t("apply.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <SectionWrapper className="bg-background pt-28 md:pt-36">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("apply.tag")}
          </p>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6">
            {t("apply.title")}
          </h1>
          <p className="font-body text-muted-foreground text-lg leading-relaxed">
            {t("apply.desc")}
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
                {t("apply.firstname")} <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.prenom}
                onChange={(e) => update("prenom", e.target.value)}
                placeholder={t("apply.firstname.ph")}
                required
                maxLength={MAX_TEXT}
                className="bg-card"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium mb-2 block">
                {t("apply.lastname")} <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.nom}
                onChange={(e) => update("nom", e.target.value)}
                placeholder={t("apply.lastname.ph")}
                required
                maxLength={MAX_TEXT}
                className="bg-card"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("apply.email")} <span className="text-destructive">*</span>
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder={t("apply.email.ph")}
              required
              maxLength={255}
              className="bg-card"
            />
          </div>

          {/* Téléphone / WhatsApp */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("apply.phone")}
            </label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder={t("apply.phone.ph")}
              maxLength={30}
              className="bg-card"
            />
            <p className="font-body text-xs text-muted-foreground mt-1.5">
              {t("apply.phone.help")}
            </p>
          </div>

          {/* Pays */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("apply.country")}
            </label>
            <Input
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              placeholder={t("apply.country.ph")}
              maxLength={MAX_TEXT}
              className="bg-card"
            />
          </div>

          {/* Main Goal */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("apply.goal")} <span className="text-destructive">*</span>
            </label>
            <Select value={form.goal} onValueChange={(v) => update("goal", v)}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={t("apply.goal.ph")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="handstand">{t("apply.goal.handstand")}</SelectItem>
                <SelectItem value="mobility">{t("apply.goal.mobility")}</SelectItem>
                <SelectItem value="calisthenics">{t("apply.goal.calisthenics")}</SelectItem>
                <SelectItem value="all">{t("apply.goal.all")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Level */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("apply.level")} <span className="text-destructive">*</span>
            </label>
            <Select value={form.level} onValueChange={(v) => update("level", v)}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={t("apply.level.ph")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">{t("apply.level.beginner")}</SelectItem>
                <SelectItem value="intermediate">{t("apply.level.intermediate")}</SelectItem>
                <SelectItem value="advanced">{t("apply.level.advanced")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("apply.duration")}
            </label>
            <Select value={form.duration} onValueChange={(v) => update("duration", v)}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={t("apply.duration.ph")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">{t("apply.duration.1m")}</SelectItem>
                <SelectItem value="3months">{t("apply.duration.3m")}</SelectItem>
                <SelectItem value="6months">{t("apply.duration.6m")}</SelectItem>
                <SelectItem value="unsure">{t("apply.duration.unsure")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div>
            <label className="font-body text-sm font-medium mb-2 block">
              {t("apply.message")}
            </label>
            <Textarea
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              placeholder={t("apply.message.ph")}
              rows={4}
              maxLength={MAX_MESSAGE}
              className="bg-card"
            />
          </div>

          {/* Reassurance */}
          <div className="bg-sand rounded-xl p-5 border border-border">
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              {t("apply.reassurance")}
            </p>
          </div>

          {/* Submit */}
          <Button
            variant="cta"
            size="xl"
            type="submit"
            className="w-full"
            disabled={sending}
          >
            {t("apply.submit")} <Send size={20} />
          </Button>

          {/* Confidential */}
          <p className="font-body text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
            <Lock size={12} />
            {t("apply.confidential")}
          </p>
        </form>
      </SectionWrapper>
    </Layout>
  );
};

export default ApplyPage;
