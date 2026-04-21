import { createContext, useContext, useState, ReactNode } from "react";

type Lang = "fr" | "en";

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Lang, string>> = {
  // Navbar
  "nav.home": { fr: "Accueil", en: "Home" },
  "nav.coaching": { fr: "Coaching 1:1", en: "1:1 Coaching" },
  "nav.programs": { fr: "Programmes", en: "Programs" },
  "nav.about": { fr: "À propos", en: "About me" },
  "nav.contact": { fr: "Contact", en: "Contact" },
  "nav.apply": { fr: "Postuler", en: "Apply" },
  "nav.applyCoaching": { fr: "Postuler au coaching", en: "Apply for coaching" },

  // Footer
  "footer.desc": { fr: "Handstand, mobilité et calisthenics pour adultes occupés. Coaching en ligne depuis Bali.", en: "Handstand, mobility and calisthenics for busy adults. Online coaching from Bali." },
  "footer.nav": { fr: "Navigation", en: "Navigation" },
  "footer.follow": { fr: "Suivre LD Move", en: "Follow LD Move" },
  "footer.rights": { fr: "Tous droits réservés.", en: "All rights reserved." },
  "footer.faq": { fr: "FAQ", en: "FAQ" },

  // Homepage Hero
  "home.hero.tag": { fr: "LD Move. Coaching en ligne", en: "LD Move. Online Coaching" },
  "home.hero.title": { fr: "Handstand, Mobilité et Calisthenics pour adultes occupés", en: "Handstand, Mobility and Calisthenics for Busy Adults" },
  "home.hero.subtitle": { fr: "Deviens plus fort, plus mobile et apprends à tenir sur les mains grâce à un coaching en ligne structuré et fun, même si tu pars de zéro.", en: "Get stronger, more mobile, and learn to hold a handstand with structured and fun online coaching, even if you're starting from scratch." },
  "home.hero.cta1": { fr: "Postuler au coaching 1:1", en: "Apply for 1:1 Coaching" },
  "home.hero.cta2": { fr: "Découvrir les programmes", en: "Discover Programs" },

  // Homepage Pour qui
  "home.who.tag": { fr: "Pour qui ?", en: "Who is it for?" },
  "home.who.title": { fr: "Tu te reconnais ?", en: "Sound like you?" },
  "home.who.desc": { fr: "Le coaching LD Move s'adresse aux adultes débutants ou intermédiaires qui veulent progresser concrètement, sans perdre de temps.", en: "LD Move coaching is for beginner to intermediate adults who want real progress without wasting time." },
  "home.who.card1.title": { fr: "Devenir plus mobile", en: "Get More Mobile" },
  "home.who.card1.desc": { fr: "Retrouve une amplitude de mouvement que tu pensais perdue.", en: "Regain range of motion you thought was gone." },
  "home.who.card2.title": { fr: "Améliorer ton handstand", en: "Improve Your Handstand" },
  "home.who.card2.desc": { fr: "Apprends les fondations et progresse étape par étape.", en: "Learn the foundations and progress step by step." },
  "home.who.card3.title": { fr: "Gagner en force", en: "Build Strength" },
  "home.who.card3.desc": { fr: "Deviens plus fort au poids du corps, sans matériel complexe.", en: "Get stronger with bodyweight, no complex equipment needed." },
  "home.who.card4.title": { fr: "Avoir une routine claire", en: "Get a Clear Routine" },
  "home.who.card4.desc": { fr: "Plus besoin de chercher partout, tout est structuré pour toi.", en: "No more searching everywhere, everything is structured for you." },

  // Homepage Results
  "home.results.tag": { fr: "Résultats", en: "Results" },
  "home.results.title": { fr: "Ce qui t'attend", en: "What to Expect" },
  "home.results.r1": { fr: "Améliorer ta force et ton équilibre", en: "Improve strength and balance" },
  "home.results.r2": { fr: "Améliorer ta posture et réduire les douleurs (poignets, épaules, dos)", en: "Improve your posture and reduce pain (wrists, shoulders, back)" },
  "home.results.r3": { fr: "Gagner en confiance, discipline et énergie au quotidien", en: "Gain confidence, discipline, and daily energy" },
  "home.results.r4": { fr: "Avoir un corps plus fonctionnel et plus libre dans ses mouvements", en: "Have a more functional body with greater freedom of movement" },

  // Testimonials
  "home.test1.text": { fr: "En 3 mois, j'ai réussi mon premier handstand libre. Le suivi de Maxime est incroyable !", en: "In 3 months, I hit my first freestanding handstand. Maxime's coaching is incredible!" },
  "home.test2.text": { fr: "Je n'avais plus mal aux épaules après 4 semaines. Le programme mobilité a changé ma vie.", en: "My shoulder pain was gone after 4 weeks. The mobility program changed my life." },
  "home.test3.text": { fr: "Simple, efficace, motivant. Exactement ce qu'il me fallait pour rester régulière.", en: "Simple, effective, motivating. Exactly what I needed to stay consistent." },

  // Homepage How it works
  "home.how.tag": { fr: "Comment ça marche ?", en: "How It Works" },
  "home.how.title": { fr: "3 étapes simples", en: "3 Simple Steps" },
  "home.how.s1.title": { fr: "Partage tes objectifs", en: "Share Your Goals" },
  "home.how.s1.desc": { fr: "Remplis un questionnaire rapide pour que je comprenne ton niveau, tes contraintes et tes envies.", en: "Fill out a quick questionnaire so I can understand your level, constraints, and goals." },
  "home.how.s2.title": { fr: "On crée ton plan", en: "We Build Your Plan" },
  "home.how.s2.desc": { fr: "Je définis un programme adapté à ton niveau, ton temps disponible et ton matériel.", en: "I design a program tailored to your level, available time, and equipment." },
  "home.how.s3.title": { fr: "Tu progresses", en: "You Progress" },
  "home.how.s3.desc": { fr: "Tu suis le programme, tu m'envoies tes vidéos, je te donne du feedback et on ajuste ensemble.", en: "Follow the program, send me your videos, I give you feedback, and we adjust together." },

  // Homepage Offers
  "home.offers.tag": { fr: "Offres", en: "Offers" },
  "home.offers.title": { fr: "Trouve la formule qui te correspond", en: "Find the Right Plan for You" },
  "home.offers.o1.title": { fr: "Coaching 1:1", en: "1:1 Coaching" },
  "home.offers.o1.desc": { fr: "L'accompagnement le plus complet. Programme sur mesure + suivi vidéo hebdomadaire.", en: "The most complete support. Custom program + weekly video feedback." },
  "home.offers.o1.cta": { fr: "Postuler", en: "Apply" },
  "home.offers.programs.title": { fr: "Programmes", en: "Programs" },
  "home.offers.programs.desc": { fr: "Handstand, mobilité, souplesse… Découvre tous nos programmes structurés.", en: "Handstand, mobility, flexibility… Discover all our structured programs." },
  "home.offers.programs.cta": { fr: "Voir les programmes", en: "View Programs" },

  // Homepage CTA
  "home.cta.title": { fr: "Prêt à bouger ?", en: "Ready to Move?" },
  "home.cta.desc": { fr: "Réserve un appel découverte gratuit et parlons de tes objectifs. Zéro engagement, zéro bullshit.", en: "Book a free discovery call and let's talk about your goals. Zero commitment, zero BS." },
  "home.cta.btn": { fr: "Réserver un appel découverte", en: "Book a Discovery Call" },

  // Coaching page - Hero
  "coaching.tag": { fr: "Coaching premium", en: "Premium Coaching" },
  "coaching.title": { fr: "Coaching 1:1 en ligne : Handstand, Mobilité et Calisthenics", en: "Online 1:1 Coaching : Handstand, Mobility and Calisthenics" },
  "coaching.subtitle": { fr: "Un accompagnement personnalisé pour progresser plus vite, avec un plan clair, des retours vidéo et un coach qui te suit vraiment.", en: "Personalized support to progress faster, with a clear plan, video feedback, and a coach who truly follows your journey." },
  "coaching.price.from": { fr: "À partir de 200 USD / mois", en: "Starting at $200 USD / month" },
  "coaching.cta": { fr: "Postuler au coaching 1:1", en: "Apply for 1:1 Coaching" },

  // Coaching - Pour qui
  "coaching.for.tag": { fr: "Pour qui ?", en: "Who is it for?" },
  "coaching.for.title": { fr: "Pour qui est ce coaching ?", en: "Who Is This Coaching For?" },
  "coaching.for.desc": { fr: "Ce coaching s'adresse aux adultes débutants ou intermédiaires en handstand et calisthenics, qui veulent :", en: "This coaching is for beginner to intermediate adults in handstand and calisthenics who want to:" },
  "coaching.for.t1": { fr: "Tenir un handstand plus stable et plus longtemps", en: "Hold a more stable handstand for longer" },
  "coaching.for.t2": { fr: "Gagner en mobilité (épaules, hanches, colonne)", en: "Improve mobility (shoulders, hips, spine)" },
  "coaching.for.t3": { fr: "Se renforcer au poids du corps de manière intelligente", en: "Build bodyweight strength in a smart way" },
  "coaching.for.t4": { fr: "Avoir un suivi sérieux pour ne plus être perdu dans ses entraînements", en: "Get real follow-up so you're never lost in your training again" },

  // Coaching - Ce qui est inclus
  "coaching.included.tag": { fr: "Tout est inclus", en: "Everything's Included" },
  "coaching.included": { fr: "Ce qui est inclus dans le coaching 1:1", en: "What's Included in 1:1 Coaching" },
  "coaching.inc1.title": { fr: "Analyse de départ", en: "Starting Analysis" },
  "coaching.inc1": { fr: "Questionnaire détaillé + vidéo d'évaluation pour comprendre ton niveau, tes objectifs et tes contraintes.", en: "Detailed questionnaire + evaluation video to understand your level, goals, and constraints." },
  "coaching.inc2.title": { fr: "Programme 100% personnalisé", en: "100% Custom Program" },
  "coaching.inc2": { fr: "3 à 5 séances par semaine, adaptées à ton niveau, ton temps disponible et ton matériel.", en: "3 to 5 sessions per week, tailored to your level, available time, and equipment." },
  "coaching.inc3.title": { fr: "Feedback vidéo chaque semaine", en: "Weekly Video Feedback" },
  "coaching.inc3": { fr: "Tu m'envoies tes vidéos, je te renvoie corrections détaillées, conseils et ajustements.", en: "You send me your videos, I send back detailed corrections, tips, and adjustments." },
  "coaching.inc4.title": { fr: "Ajustement du plan chaque semaine", en: "Weekly Plan Adjustments" },
  "coaching.inc4": { fr: "Ton programme évolue en fonction de ta progression, de tes contraintes et de tes éventuelles douleurs.", en: "Your program evolves based on your progress, constraints, and any pain you may have." },
  "coaching.inc5.title": { fr: "Support par messages", en: "Message Support" },
  "coaching.inc5": { fr: "Pose tes questions à tout moment par WhatsApp. Je te réponds rapidement.", en: "Ask your questions anytime via WhatsApp. I reply quickly." },

  // Coaching - Tarifs
  "coaching.pricing.tag": { fr: "Formules", en: "Plans" },
  "coaching.pricing.title": { fr: "Choisis ta formule", en: "Choose Your Plan" },
  "coaching.pricing.monthly.name": { fr: "Starter", en: "Starter" },
  "coaching.pricing.monthly.title": { fr: "Paiement mensuel", en: "Monthly Payment" },
  "coaching.pricing.monthly.desc": { fr: "Idéal pour tester le coaching ou si tu préfères payer mois par mois. Renouvelable, sans engagement long terme.", en: "Ideal to try coaching or if you prefer to pay month by month. Renewable, no long-term commitment." },
  "coaching.pricing.pack.badge": { fr: "Recommandé", en: "Recommended" },
  "coaching.pricing.pack.name": { fr: "Progression", en: "Progression" },
  "coaching.pricing.pack.title": { fr: "Engagement 3 mois", en: "3-Month Commitment" },
  "coaching.pricing.pack.desc": { fr: "Idéal pour un vrai changement. Tu t'engages sur 3 mois pour des résultats concrets.", en: "Ideal for real change. Commit for 3 months for concrete results." },
  "coaching.pricing.pack6.name": { fr: "Transformation", en: "Transformation" },
  "coaching.pricing.pack6.title": { fr: "Engagement 6 mois", en: "6-Month Commitment" },
  "coaching.pricing.pack6.desc": { fr: "Transformation profonde. 6 mois pour ancrer de nouvelles habitudes et progresser durablement.", en: "Deep transformation. 6 months to build lasting habits and make real progress." },
  "coaching.pricing.pack6.badge": { fr: "Meilleur prix", en: "Best Value" },
  "coaching.pricing.custom": { fr: "Le tarif dépend de ton niveau et de tes besoins en accompagnement.", en: "Pricing depends on your level and support needs." },
  "coaching.pricing.cta": { fr: "Postuler au coaching 1:1", en: "Apply for 1:1 coaching" },

  // Coaching - Process
  "coaching.process.tag": { fr: "Comment ça marche ?", en: "How It Works" },
  "coaching.process.title": { fr: "Comment ça se passe concrètement ?", en: "How Does It Work in Practice?" },
  "coaching.process.s1.title": { fr: "Tu remplis le formulaire", en: "Fill Out the Form" },
  "coaching.process.s1.desc": { fr: "Un questionnaire rapide pour que je comprenne ton niveau, tes objectifs et tes disponibilités.", en: "A quick questionnaire so I can understand your level, goals, and availability." },
  "coaching.process.s2.title": { fr: "On fait le point ensemble", en: "We Review Together" },
  "coaching.process.s2.desc": { fr: "Par écrit ou en appel, on discute de tes objectifs et je te recommande la meilleure formule.", en: "By message or call, we discuss your goals and I recommend the best plan." },
  "coaching.process.s3.title": { fr: "Tu reçois ton programme", en: "You Get Your Program" },
  "coaching.process.s3.desc": { fr: "Tu commences ton programme personnalisé, tu m'envoies tes vidéos régulièrement, je t'accompagne et j'ajuste ton plan.", en: "You start your personalized program, send me your videos regularly, I support you and adjust your plan." },

  // Coaching - FAQ
  "coaching.faq.tag": { fr: "FAQ", en: "FAQ" },
  "coaching.faq.title": { fr: "Questions fréquentes sur le coaching", en: "Coaching FAQ" },
  "coaching.faq.q1": { fr: "Est-ce que je peux être totalement débutant ?", en: "Can I be a complete beginner?" },
  "coaching.faq.a1": { fr: "Oui ! La majorité de mes coachés partent de zéro. Je construis ton programme en fonction de ton niveau actuel, quel qu'il soit.", en: "Yes! Most of my clients start from zero. I build your program based on your current level, whatever it may be." },
  "coaching.faq.q2": { fr: "Combien de temps par semaine dois-je prévoir ?", en: "How much time per week should I plan?" },
  "coaching.faq.a2": { fr: "Entre 3 et 5 séances de 30 à 60 minutes. L'essentiel, c'est la régularité. Même 20 minutes bien faites, c'est déjà énorme.", en: "3 to 5 sessions of 30–60 minutes. Consistency is key. Even 20 well-done minutes is already huge." },
  "coaching.faq.q3": { fr: "Où se passent les échanges ?", en: "Where do the exchanges happen?" },
  "coaching.faq.a3": { fr: "Par WhatsApp. Les retours vidéo sont envoyés chaque semaine sur le même canal.", en: "Via WhatsApp. Video feedback is sent weekly through the same channel." },
  "coaching.faq.q4": { fr: "Puis-je passer du mensuel au pack 3 mois ensuite ?", en: "Can I switch from monthly to the 3-month pack later?" },
  "coaching.faq.a4": { fr: "Absolument. Tu peux commencer en mensuel et passer au pack 3 mois à tout moment si tu veux t'engager davantage.", en: "Absolutely. You can start monthly and switch to the 3-month pack anytime if you want to commit further." },
  "coaching.faq.q5": { fr: "Y a-t-il un remboursement possible ?", en: "Is a refund possible?" },
  "coaching.faq.a5": { fr: "Le coaching est un service personnalisé, donc il n'y a pas de remboursement une fois le programme lancé. C'est pourquoi on échange avant pour s'assurer que c'est le bon fit.", en: "Coaching is a personalized service, so there are no refunds once the program starts. That's why we talk first to make sure it's the right fit." },

  // Coaching - CTA final
  "coaching.final.title": { fr: "Prêt à passer au niveau supérieur ?", en: "Ready to Level Up?" },
  "coaching.final.desc": { fr: "Progrès plus rapides, plan 100% personnalisé, feedback vidéo chaque semaine. Rejoins le coaching 1:1 et transforme ta pratique.", en: "Faster progress, 100% custom plan, weekly video feedback. Join 1:1 coaching and transform your practice." },
  "coaching.final.cta": { fr: "Postuler au coaching 1:1", en: "Apply for 1:1 Coaching" },
  "coaching.limited": { fr: "Places limitées, réponse sous 48h", en: "Limited spots, response within 48h" },

  // Programs page
  "prog.tag": { fr: "Programmes", en: "Programs" },
  "prog.title": { fr: "Choisis ton programme", en: "Choose Your Program" },
  "prog.desc": { fr: "Des programmes structurés pour tous les niveaux. Handstand, mobilité, force au poids du corps.", en: "Structured programs for all levels. Handstand, mobility, bodyweight strength." },
  "prog.popular": { fr: "Le plus populaire", en: "Most Popular" },
  "prog.join": { fr: "Rejoindre le programme", en: "Join the Program" },
  "prog.results.title": { fr: "À la fin, tu seras capable de :", en: "By the end, you'll be able to:" },
  "prog.versions": { fr: "Deux versions disponibles :", en: "Two versions available:" },
  "prog.cta.title": { fr: "Tu ne sais pas quoi choisir ?", en: "Not sure which to choose?" },
  "prog.cta.desc": { fr: "Réserve un appel découverte et je t'aide à trouver la formule parfaite pour toi.", en: "Book a discovery call and I'll help you find the perfect plan for you." },
  "prog.cta.btn": { fr: "Réserver un appel", en: "Book a Call" },

  // Programs - How it works
  "prog.how.tag": { fr: "Comment ça marche", en: "How It Works" },
  "prog.how.title": { fr: "Comment fonctionnent les programmes", en: "How the programs work" },
  "prog.how.s1.title": { fr: "Choisis ton focus", en: "Choose your focus" },
  "prog.how.s1.desc": { fr: "Handstand, hanches, colonne… Choisis le programme qui correspond à ton objectif principal.", en: "Handstand, hips, spine… Pick the program that matches your main goal." },
  "prog.how.s2.title": { fr: "Accède à la plateforme", en: "Access the platform" },
  "prog.how.s2.desc": { fr: "Des vidéos claires, des tableaux semaine par semaine et des instructions simples pour chaque séance.", en: "Get clear videos, week-by-week tables, and simple instructions for each session." },
  "prog.how.s3.title": { fr: "Entraîne-toi à ton rythme", en: "Train at your own pace" },
  "prog.how.s3.desc": { fr: "Suis les progressions 2 à 4 fois par semaine, à la maison ou en salle.", en: "Follow the progressions 2–4 times per week, at home or at the gym." },

  "prog.p1.title": { fr: "Programme Signature Handstand", en: "Signature Handstand Program" },
  "prog.p1.level": { fr: "Débutant → Intermédiaire", en: "Beginner → Intermediate" },
  "prog.p1.duration": { fr: "12–16 semaines", en: "12–16 weeks" },
  "prog.p1.desc": { fr: "Un plan progressif en 3 phases : fondations, force et équilibre, contrôle. Vidéos de démonstration, consignes détaillées, progression semaine par semaine.", en: "A progressive 3-phase plan: foundations, strength and balance, control. Demo videos, detailed instructions, week-by-week progression." },
  "prog.p1.r1": { fr: "Tenir un handstand libre 10–30 secondes", en: "Hold a freestanding handstand for 10–30 seconds" },
  "prog.p1.r2": { fr: "Comprendre les mécaniques d'équilibre", en: "Understand balance mechanics" },
  "prog.p1.r3": { fr: "Renforcer épaules, poignets et core", en: "Strengthen shoulders, wrists, and core" },
  "prog.p1.v1.name": { fr: "Standard", en: "Standard" },
  "prog.p1.v1.detail": { fr: "Programme complet + support email", en: "Full program + email support" },
  "prog.p1.v2.name": { fr: "Plus", en: "Plus" },
  "prog.p1.v2.detail": { fr: "Programme + 2 check-ins vidéo / mois", en: "Program + 2 video check-ins / month" },

  "prog.p2.title": { fr: "Pack Mobilité et Préhab", en: "Mobility and Prehab Pack" },
  "prog.p2.level": { fr: "Tous niveaux", en: "All Levels" },
  "prog.p2.duration": { fr: "Séances de 20–30 min", en: "20–30 min sessions" },
  "prog.p2.desc": { fr: "Focus sur hanches, épaules, colonne vertébrale et poignets. Parfait en complément du handstand ou seul pour améliorer ta qualité de mouvement.", en: "Focus on hips, shoulders, spine, and wrists. Perfect alongside handstand training or on its own to improve movement quality." },
  "prog.p2.r1": { fr: "Gagner en amplitude articulaire", en: "Increase joint range of motion" },
  "prog.p2.r2": { fr: "Réduire les douleurs et tensions", en: "Reduce pain and tension" },
  "prog.p2.r3": { fr: "Prévenir les blessures courantes", en: "Prevent common injuries" },

  "prog.p3.title": { fr: "Mini-Challenge 21 Jours", en: "21-Day Mini Challenge" },
  "prog.p3.level": { fr: "Débutant", en: "Beginner" },
  "prog.p3.duration": { fr: "21 jours", en: "21 days" },
  "prog.p3.desc": { fr: "Le point d'entrée idéal. 21 jours de mobilité et handstand basics pour découvrir le style LD Move et poser les fondations.", en: "The ideal entry point. 21 days of mobility and handstand basics to discover the LD Move style and build your foundations." },
  "prog.p3.r1": { fr: "Créer une routine d'entraînement régulière", en: "Build a consistent training routine" },
  "prog.p3.r2": { fr: "Découvrir les bases du handstand", en: "Learn handstand fundamentals" },
  "prog.p3.r3": { fr: "Améliorer ta mobilité générale", en: "Improve your overall mobility" },

  "prog.p4.title": { fr: "8 semaines pour ton side split", en: "8 Weeks to Your Side Split" },
  "prog.p4.level": { fr: "Débutant → Intermédiaire", en: "Beginner → Intermediate" },
  "prog.p4.duration": { fr: "8 semaines", en: "8 weeks" },
  "prog.p4.desc": { fr: "Un programme ciblé pour ouvrir les hanches et les adducteurs afin de te rapprocher du side split complet. 3 séances/semaine de 30–40 minutes, plus une routine quotidienne de 5–10 minutes.", en: "A targeted program to open your hips and adductors to get closer to a full side split. 3 sessions/week of 30–40 minutes, plus a daily 5–10 minute routine." },
  "prog.p4.r1": { fr: "Ouvrir tes hanches et adducteurs en profondeur", en: "Deeply open your hips and adductors" },
  "prog.p4.r2": { fr: "Te rapprocher du side split complet", en: "Get closer to a full side split" },
  "prog.p4.r3": { fr: "Créer une routine de flexibilité durable", en: "Build a sustainable flexibility routine" },
  "prog.p4.btn": { fr: "Coming soon", en: "Coming soon" },

  "prog.p6.title": { fr: "Handstand Débutant : 8 Semaines", en: "Beginner Handstand : 8 Weeks" },
  "prog.p6.level": { fr: "Débutant", en: "Beginner" },
  "prog.p6.duration": { fr: "8 semaines", en: "8 weeks" },
  "prog.p6.desc": { fr: "Construis tes fondations, gagne en force et en confiance sur les mains, même si tu pars de zéro. Programme structuré semaine par semaine avec vidéos de démonstration.", en: "Build your foundations, gain strength and confidence on your hands, even starting from scratch. Week-by-week structured program with demo videos." },
  "prog.p6.r1": { fr: "Maîtriser les positions de base (pike, hollow, bear plank)", en: "Master basic positions (pike, hollow, bear plank)" },
  "prog.p6.r2": { fr: "Tenir un handstand au mur avec contrôle", en: "Hold a wall handstand with control" },
  "prog.p6.r3": { fr: "Commencer à te décoller du mur en toute confiance", en: "Start coming off the wall with confidence" },
  "prog.p6.btn": { fr: "Coming soon", en: "Coming soon" },

  "prog.p5.title": { fr: "6 semaines pour ouvrir ton backbend", en: "6 Weeks to Open Your Backbend" },
  "prog.p5.level": { fr: "Débutant → Intermédiaire", en: "Beginner → Intermediate" },
  "prog.p5.duration": { fr: "6 semaines", en: "6 weeks" },
  "prog.p5.desc": { fr: "Rends le pont plus confortable, améliore la mobilité de ta colonne et de tes épaules, et prépare les backbends liés au handstand et au calisthenics. 2–3 séances/semaine de 30–35 minutes.", en: "Make your bridge more comfortable, improve spine and shoulder mobility, and prepare for handstand and calisthenics backbends. 2–3 sessions/week of 30–35 minutes." },
  "prog.p5.r1": { fr: "Rendre ton pont plus confortable et stable", en: "Make your bridge more comfortable and stable" },
  "prog.p5.r2": { fr: "Améliorer la mobilité de ta colonne et tes épaules", en: "Improve spine and shoulder mobility" },
  "prog.p5.r3": { fr: "Préparer les backbends pour le handstand et le calisthenics", en: "Prepare backbends for handstand and calisthenics" },
  "prog.p5.btn": { fr: "Découvrir le programme backbend", en: "Discover the backbend program" },

  // About page
  "about.tag": { fr: "À propos", en: "About" },
  "about.title": { fr: "Salut, moi c'est Maxime.", en: "Hey, I'm Maxime." },
  "about.p1": { fr: "Coach en handstand, mobilité et calisthenics. J'aide les adultes à reprendre confiance dans leur corps, à bouger mieux et à avoir moins de douleurs depuis n'importe où dans le monde.", en: "Handstand, mobility, and calisthenics coach. I help adults regain confidence in their body, move better, and feel more pain‑free from anywhere in the world." },
  "about.p2": { fr: "Mon parcours ? Une passion du mouvement, une transformation personnelle, et l'envie profonde d'aider les autres à découvrir ce que leur corps est vraiment capable de faire.", en: "My journey? A passion for movement, a personal transformation, and a deep desire to help others discover what their body is truly capable of." },
  "about.p3": { fr: "Mon approche est simple : structurée, bienveillante, et axée sur le progrès long terme. Pas de raccourcis, juste du travail intelligent et du feedback honnête.", en: "My approach is simple: structured, supportive, and focused on long‑term progress. No shortcuts, just smart work and honest feedback." },
  "about.philo.tag": { fr: "Philosophie", en: "Philosophy" },
  "about.philo.title": { fr: "Ma vision du mouvement", en: "My Vision of Movement" },
  "about.philo1.title": { fr: "Liberté", en: "Freedom" },
  "about.philo1.desc": { fr: "Le mouvement est un outil de liberté. Un corps qui bouge bien est un corps qui vit pleinement.", en: "Movement is a tool for freedom. A body that moves well is a body that lives fully." },
  "about.philo2.title": { fr: "Progression", en: "Progression" },
  "about.philo2.desc": { fr: "On ne vise pas la perfection, on vise le progrès. Chaque séance est une victoire.", en: "We don't aim for perfection, we aim for progress. Every session is a win." },
  "about.philo3.title": { fr: "Confiance", en: "Confidence" },
  "about.philo3.desc": { fr: "Quand tu apprends à maîtriser ton corps, tu développes une confiance qui rayonne dans tous les aspects de ta vie.", en: "When you learn to master your body, you build a confidence that shines through every part of your life." },
  "about.cta.title": { fr: "Envie de travailler ensemble ?", en: "Want to Work Together?" },
  "about.cta.desc": { fr: "Que tu sois débutant ou que tu veuilles passer au niveau supérieur, on trouve la formule qui te correspond.", en: "Whether you're a beginner or want to level up, we'll find the right plan for you." },
  "about.cta.btn": { fr: "Prendre contact", en: "Get in Touch" },

  // Contact page
  "contact.tag": { fr: "Contact", en: "Contact" },
  "contact.title": { fr: "Me contacter", en: "Contact Me" },
  "contact.desc": { fr: "Si tu as une question sur le coaching, les programmes, ou simplement envie de partager un retour sur ton entraînement, utilise ce formulaire pour me joindre. Je ferai de mon mieux pour te répondre sous 24–48h.", en: "If you have a question about coaching, programs, or just want to share feedback about your training, you can use this form to reach me. I'll do my best to reply within 24–48 hours." },
  "contact.firstname": { fr: "Prénom", en: "First Name" },
  "contact.firstname.ph": { fr: "Ton prénom", en: "Your first name" },
  "contact.lastname": { fr: "Nom", en: "Last Name" },
  "contact.lastname.ph": { fr: "Ton nom", en: "Your last name" },
  "contact.email": { fr: "Email", en: "Email" },
  "contact.email.ph": { fr: "ton@email.com", en: "your@email.com" },
  "contact.phone": { fr: "Numéro WhatsApp", en: "WhatsApp Number" },
  "contact.phone.ph": { fr: "+33 6 12 34 56 78", en: "+1 555 123 4567" },
  "contact.phone.help": { fr: "Indique ton numéro avec l'indicatif de ton pays.", en: "Include your country code." },
  "contact.phone.none": { fr: "Je n'ai pas WhatsApp", en: "I don't have WhatsApp" },
  "contact.country": { fr: "Pays", en: "Country" },
  "contact.country.ph": { fr: "Ex : France", en: "E.g.: USA" },
  "contact.question": { fr: "Ta question", en: "Your question" },
  "contact.question.ph": { fr: "Écris ta question ou ton message ici…", en: "Write your question or message here…" },
  "contact.reassurance": { fr: "Je lis chaque message avec attention. Je te répondrai par email ou WhatsApp dans les meilleurs délais.", en: "I read every message carefully. I'll reply via email or WhatsApp as soon as possible." },
  "contact.confidential": { fr: "Tes informations restent strictement confidentielles et ne seront jamais partagées.", en: "Your information remains strictly confidential and will never be shared." },
  "contact.submit": { fr: "Envoyer mon message", en: "Send My Message" },
  "contact.success": { fr: "Merci ! Ton message a bien été envoyé. Je te réponds sous 24–48h.", en: "Thanks! Your message has been sent. I'll get back to you within 24–48h." },
  "contact.error": { fr: "Une erreur est survenue. Réessaie plus tard ou contacte-moi directement à ld_move@icloud.com.", en: "Something went wrong. Please try again later or contact me directly at ld_move@icloud.com." },
  "contact.error.missing": { fr: "Merci de remplir tous les champs obligatoires (marqués d'un *).", en: "Please fill in all required fields (marked with *)." },
  "contact.error.email": { fr: "L'adresse email saisie n'est pas valide. Vérifie qu'elle est au bon format (exemple : prenom@domaine.com).", en: "The email address entered is not valid. Please check the format (example: name@domain.com)." },

  // Apply page (coaching application)
  "apply.tag": { fr: "Coaching 1:1", en: "1:1 Coaching" },
  "apply.title": { fr: "Postuler au coaching 1:1", en: "Apply for 1:1 Coaching" },
  "apply.desc": { fr: "Remplis ce formulaire pour postuler au coaching personnalisé. Je te recontacte sous 48h pour discuter de tes objectifs.", en: "Fill out this form to apply for personalized coaching. I'll get back to you within 48h to discuss your goals." },
  "apply.firstname": { fr: "Prénom", en: "First Name" },
  "apply.firstname.ph": { fr: "Ton prénom", en: "Your first name" },
  "apply.lastname": { fr: "Nom", en: "Last Name" },
  "apply.lastname.ph": { fr: "Ton nom", en: "Your last name" },
  "apply.email": { fr: "Email", en: "Email" },
  "apply.email.ph": { fr: "ton@email.com", en: "your@email.com" },
  "apply.phone": { fr: "Numéro WhatsApp", en: "WhatsApp Number" },
  "apply.phone.ph": { fr: "+33 6 12 34 56 78", en: "+1 555 123 4567" },
  "apply.phone.help": { fr: "Indique ton numéro avec l'indicatif de ton pays.", en: "Include your country code." },
  "apply.phone.none": { fr: "Je n'ai pas WhatsApp", en: "I don't have WhatsApp" },
  "apply.country": { fr: "Pays", en: "Country" },
  "apply.country.ph": { fr: "Ex : France", en: "E.g.: USA" },
  "apply.goal": { fr: "Objectif principal", en: "Main Goal" },
  "apply.goal.ph": { fr: "Choisis ton objectif", en: "Choose your goal" },
  "apply.goal.handstand": { fr: "Handstand", en: "Handstand" },
  "apply.goal.mobility": { fr: "Mobilité", en: "Mobility" },
  "apply.goal.calisthenics": { fr: "Calisthenics / Force", en: "Calisthenics / Strength" },
  "apply.goal.all": { fr: "Un peu de tout", en: "A bit of everything" },
  "apply.level": { fr: "Ton niveau actuel", en: "Current Level" },
  "apply.level.ph": { fr: "Choisis ton niveau", en: "Choose your level" },
  "apply.level.beginner": { fr: "Débutant", en: "Beginner" },
  "apply.level.intermediate": { fr: "Intermédiaire", en: "Intermediate" },
  "apply.level.advanced": { fr: "Avancé", en: "Advanced" },
  "apply.duration": { fr: "Durée d'engagement souhaitée", en: "Preferred commitment duration" },
  "apply.duration.ph": { fr: "Choisis une durée", en: "Choose a duration" },
  "apply.duration.1m": { fr: "1 mois", en: "1 month" },
  "apply.duration.3m": { fr: "3 mois", en: "3 months" },
  "apply.duration.6m": { fr: "6 mois", en: "6 months" },
  "apply.duration.unsure": { fr: "Pas encore sûr(e)", en: "Not sure yet" },
  "apply.message": { fr: "Message (optionnel)", en: "Message (optional)" },
  "apply.message.ph": { fr: "Dis-moi un peu plus sur toi, tes objectifs ou tes contraintes…", en: "Tell me a bit more about yourself, your goals, or any constraints…" },
  "apply.reassurance": { fr: "Ce n'est pas un engagement définitif. On échange d'abord pour s'assurer que le coaching est adapté à tes besoins.", en: "This isn't a final commitment. We'll chat first to make sure coaching is the right fit for your needs." },
  "apply.submit": { fr: "Envoyer ma candidature", en: "Submit My Application" },
  "apply.confidential": { fr: "Tes informations restent strictement confidentielles et ne seront jamais partagées.", en: "Your information remains strictly confidential and will never be shared." },
  "apply.success": { fr: "Merci ! Ta candidature a bien été envoyée. Je te recontacte sous 48h.", en: "Thanks! Your application has been sent. I'll get back to you within 48h." },
  "apply.error": { fr: "Une erreur est survenue. Réessaie plus tard ou contacte-moi directement à ld_move@icloud.com.", en: "Something went wrong. Please try again later or contact me directly at ld_move@icloud.com." },
  "apply.error.missing": { fr: "Merci de remplir tous les champs obligatoires (marqués d'un *).", en: "Please fill in all required fields (marked with *)." },
  "apply.error.email": { fr: "L'adresse email saisie n'est pas valide. Vérifie qu'elle est au bon format (exemple : prenom@domaine.com).", en: "The email address entered is not valid. Please check the format (example: name@domain.com)." },

  // FAQ page
  "faq.tag": { fr: "FAQ", en: "FAQ" },
  "faq.title": { fr: "Questions fréquentes", en: "Frequently Asked Questions" },
  "faq.desc": { fr: "Tout ce que tu dois savoir avant de te lancer.", en: "Everything you need to know before getting started." },
  "faq.q1": { fr: "Je suis totalement débutant, est-ce que c'est pour moi ?", en: "I'm a complete beginner, is this for me?" },
  "faq.a1": { fr: "Absolument ! La majorité de mes élèves partent de zéro. Tous les programmes sont pensés pour être progressifs. On commence par les fondations et on avance à ton rythme.", en: "Absolutely! Most of my students start from zero. All programs are designed to be progressive. We start with the foundations and move at your pace." },
  "faq.q2": { fr: "De quel matériel ai-je besoin ?", en: "What equipment do I need?" },
  "faq.a2": { fr: "Le minimum : un mur et un tapis. Pour certains exercices, des parallettes ou une bande élastique peuvent être utiles, mais ce n'est pas obligatoire au début.", en: "The minimum: a wall and a mat. For some exercises, parallettes or a resistance band can be helpful, but they're not required at first." },
  "faq.q3": { fr: "Combien de temps par semaine dois-je consacrer ?", en: "How much time per week do I need?" },
  "faq.a3": { fr: "Entre 3 et 5 séances de 30 à 60 minutes selon ton programme. L'idée, c'est la régularité, pas la quantité. Même 20 minutes bien faites, c'est déjà énorme.", en: "3 to 5 sessions of 30–60 minutes depending on your program. It's about consistency, not volume. Even 20 well-spent minutes is huge." },
  "faq.q4": { fr: "Que se passe-t-il si j'ai une blessure ou une douleur ?", en: "What if I have an injury or pain?" },
  "faq.a4": { fr: "On en parle dès le départ. J'adapte ton programme en conséquence. Je ne suis pas kiné, mais j'ai l'expérience pour contourner les limitations et travailler en sécurité.", en: "We discuss it from the start. I adapt your program accordingly. I'm not a physiotherapist, but I have the experience to work around limitations safely." },
  "faq.q5": { fr: "Est-ce que tout se fait en ligne ?", en: "Is everything done online?" },
  "faq.a5": { fr: "Oui, 100 % en ligne. Tu suis ton programme de manière autonome, tu m'envoies tes vidéos, et je te fais un retour détaillé. Coaching depuis n'importe où dans le monde.", en: "Yes, 100% online. You follow your program independently, send me your videos, and I give you detailed feedback. Coaching from anywhere in the world." },
  "faq.q6": { fr: "Quelle est la différence entre le coaching 1:1 et les programmes ?", en: "What's the difference between 1:1 coaching and programs?" },
  "faq.a6": { fr: "Le coaching 1:1 est entièrement personnalisé avec un suivi vidéo hebdomadaire. Les programmes sont pré-structurés avec un support plus limité, mais restent très efficaces pour progresser.", en: "1:1 coaching is fully personalized with weekly video check-ins. Programs are pre-structured with more limited support but are still very effective for progress." },
  "faq.q7": { fr: "Combien de temps pour voir des résultats ?", en: "How long to see results?" },
  "faq.a7": { fr: "Ça dépend de ton point de départ et de ta régularité. En général, tu sens une différence en mobilité en 2-3 semaines. Pour le handstand, les premiers holds libres arrivent souvent entre 8 et 16 semaines.", en: "It depends on your starting point and consistency. Usually, you feel a difference in mobility within 2–3 weeks. For handstand, first freestanding holds often come between 8 and 16 weeks." },
  "faq.q8": { fr: "Je peux annuler ou changer de formule ?", en: "Can I cancel or switch plans?" },
  "faq.a8": { fr: "Le coaching mensuel est sans engagement. Pour le programme 3 mois, on en discute lors de l'appel découverte pour s'assurer que c'est le bon choix pour toi.", en: "Monthly coaching has no commitment. For the 3-month program, we discuss it during the discovery call to make sure it's the right fit." },
  "faq.q9": { fr: "Tu parles français et anglais ?", en: "Do you speak French and English?" },
  "faq.a9": { fr: "Oui ! Le coaching est disponible en français et en anglais. Choisis la langue qui te convient le mieux.", en: "Yes! Coaching is available in French and English. Choose whichever language suits you best." },
  "faq.q10": { fr: "Comment se passe le premier contact ?", en: "How does the first contact work?" },
  "faq.a10": { fr: "Tu remplis le formulaire de contact, je te réponds sous 48h, et on planifie un appel découverte de 15-20 minutes (gratuit). On discute de tes objectifs et je te recommande la meilleure option.", en: "You fill out the contact form, I respond within 48h, and we schedule a 15–20 minute discovery call (free). We discuss your goals and I recommend the best option." },
  "faq.more.title": { fr: "Encore une question ?", en: "Still have a question?" },
  "faq.more.desc": { fr: "Contacte-moi directement, je te réponds en personne.", en: "Contact me directly, I'll respond personally." },
  "faq.more.btn": { fr: "Me contacter", en: "Contact Me" },

  // Social proof - Home
  "home.social.tag": { fr: "Témoignages", en: "Testimonials" },
  "home.social.title": { fr: "Ils ont transformé leur corps", en: "They Transformed Their Bodies" },

  // Social proof - Coaching
  "coaching.social.tag": { fr: "Témoignages", en: "Testimonials" },
  "coaching.social.title": { fr: "Ce que disent mes coachés", en: "What My Clients Say" },
  "coaching.test1.text": { fr: "Le coaching avec Maxime m'a permis de débloquer mon handstand en 10 semaines. Le suivi vidéo fait toute la différence.", en: "Coaching with Maxime helped me unlock my handstand in 10 weeks. The video feedback makes all the difference." },
  "coaching.test2.text": { fr: "J'ai enfin une routine claire et adaptée à mon emploi du temps. Je progresse chaque semaine, c'est motivant !", en: "I finally have a clear routine adapted to my schedule. I progress every week, it's so motivating!" },
  "coaching.test3.text": { fr: "Maxime est à l'écoute et ses corrections sont ultra précises. Meilleur investissement que j'ai fait pour mon corps.", en: "Maxime listens and his corrections are incredibly precise. Best investment I've made for my body." },

  // Social proof - Programmes
  "prog.social.tag": { fr: "Témoignages", en: "Testimonials" },
  "prog.social.title": { fr: "Ils ont suivi les programmes", en: "They Followed the Programs" },
  "prog.test1.text": { fr: "Le programme Handstand est hyper bien structuré. J'ai vu des résultats dès la 3e semaine.", en: "The Handstand program is incredibly well structured. I saw results by week 3." },
  "prog.test2.text": { fr: "Le pack Mobilité a transformé mes épaules. Plus de douleurs et une bien meilleure posture.", en: "The Mobility pack transformed my shoulders. No more pain and much better posture." },
  "prog.test3.text": { fr: "J'ai commencé par le Mini-Challenge 21 jours et maintenant je suis accro. Simple et efficace !", en: "I started with the 21-Day Mini Challenge and now I'm hooked. Simple and effective!" },

  // Social proof - About
  "about.social.tag": { fr: "Témoignages", en: "Testimonials" },
  "about.social.title": { fr: "Ce qu'ils pensent de Maxime", en: "What They Think of Maxime" },
  "about.test1.text": { fr: "Maxime est passionné et ça se voit. Il prend le temps d'expliquer chaque mouvement avec patience.", en: "Maxime is passionate and it shows. He takes the time to explain every movement with patience." },
  "about.test2.text": { fr: "Un coach humain, pro, et qui connaît vraiment son sujet. Je le recommande à 100 %.", en: "A human, professional coach who truly knows his stuff. I recommend him 100%." },
  "about.test3.text": { fr: "Grâce à Maxime, j'ai découvert que mon corps était capable de bien plus que ce que je croyais.", en: "Thanks to Maxime, I discovered my body was capable of much more than I thought." },

  // Middle Split Program Page
  "ms.hero.tag": { fr: "Programme 8 semaines", en: "8-Week Program" },
  "ms.hero.title": { fr: "8 semaines pour ton Middle Split", en: "8 Weeks to Your Middle Split" },
  "ms.hero.subtitle": { fr: "Un programme progressif pour ouvrir tes hanches, renforcer tes adducteurs et te rapprocher du side split, sans te blesser.", en: "A progressive program to open your hips, strengthen your adductors, and get closer to the side split, without getting hurt." },
  "ms.hero.cta": { fr: "Rejoindre le programme Middle Split", en: "Join the Middle Split Program" },

  "ms.benefits.tag": { fr: "Bénéfices", en: "Benefits" },
  "ms.benefits.title": { fr: "Ce que tu vas gagner", en: "What You'll Gain" },
  "ms.benefits.b1": { fr: "Plus d'ouverture dans les hanches et les adducteurs", en: "More openness in the hips and adductors" },
  "ms.benefits.b2": { fr: "Une meilleure posture et plus de confort dans les positions basses", en: "Better posture and more comfort in low positions" },
  "ms.benefits.b3": { fr: "Des jambes plus fortes et stables pour le handstand, le calisthenics et la vie de tous les jours", en: "Stronger, more stable legs for handstand, calisthenics, and everyday life" },
  "ms.benefits.b4": { fr: "Une méthode claire étape par étape, sans forcer comme un malade sur les étirements", en: "A clear step-by-step method, no forcing your stretches like a maniac" },

  "ms.how.tag": { fr: "Le programme", en: "The Program" },
  "ms.how.title": { fr: "Comment ça marche", en: "How It Works" },
  "ms.how.duration": { fr: "Durée : 8 semaines", en: "Duration: 8 weeks" },
  "ms.how.frequency": { fr: "3 séances/semaine de 30–40 min + routine quotidienne de 5–10 min", en: "3 sessions/week of 30–40 min + daily 5–10 min routine" },
  "ms.how.phase1.title": { fr: "Semaines 1–2 : Réveil", en: "Weeks 1–2: Activation" },
  "ms.how.phase1.desc": { fr: "Réveiller les hanches et les adducteurs, apprendre les bases des étirements.", en: "Wake up the hips and adductors, learn stretching fundamentals." },
  "ms.how.phase2.title": { fr: "Semaines 3–4 : Amplitude", en: "Weeks 3–4: Range" },
  "ms.how.phase2.desc": { fr: "Augmenter l'amplitude avec pancake, frog, side lunge et travail actif.", en: "Increase range with pancake, frog, side lunge, and active work." },
  "ms.how.phase3.title": { fr: "Semaines 5–6 : Profondeur", en: "Weeks 5–6: Depth" },
  "ms.how.phase3.desc": { fr: "Descendre plus bas en contrôle, middle split au mur, isos, renforcement.", en: "Go deeper with control, wall middle split, isometrics, strengthening." },
  "ms.how.phase4.title": { fr: "Semaines 7–8 : Consolidation", en: "Weeks 7–8: Consolidation" },
  "ms.how.phase4.desc": { fr: "Consolidation, répétition des meilleurs drills, test de progression.", en: "Consolidation, repeat the best drills, progression test." },

  "ms.videos.tag": { fr: "Contenu vidéo", en: "Video Content" },
  "ms.videos.title": { fr: "15 vidéos pour te guider", en: "15 Videos to Guide You" },
  "ms.video.1.title": { fr: "Bienvenue dans le programme Middle Split (8 semaines)", en: "Welcome to the Middle Split Program (8 Weeks)" },
  "ms.video.1.desc": { fr: "Introduction au programme, objectifs et conseils pour bien démarrer.", en: "Program introduction, goals, and tips to get started right." },
  "ms.video.2.title": { fr: "Comment progresser sans se blesser", en: "How to Progress Without Getting Hurt" },
  "ms.video.2.desc": { fr: "Les principes clés pour un travail de souplesse sûr et efficace.", en: "Key principles for safe and effective flexibility work." },
  "ms.video.3.title": { fr: "Warm-up hanches et jambes (10 min)", en: "Hip and Leg Warm-Up (10 min)" },
  "ms.video.3.desc": { fr: "Échauffement ciblé pour préparer tes hanches et jambes à chaque séance.", en: "Targeted warm-up to prepare your hips and legs for each session." },
  "ms.video.4.title": { fr: "Routine quotidienne hanches (5–10 min)", en: "Daily Hip Routine (5–10 min)" },
  "ms.video.4.desc": { fr: "Ta mini routine du matin ou du soir pour entretenir la mobilité chaque jour.", en: "Your mini morning or evening routine to maintain mobility every day." },
  "ms.video.5.title": { fr: "Frog stretch et variations", en: "Frog Stretch and Variations" },
  "ms.video.5.desc": { fr: "Technique et progressions du frog stretch pour ouvrir les adducteurs.", en: "Frog stretch technique and progressions to open the adductors." },
  "ms.video.6.title": { fr: "Pancake débutant", en: "Beginner Pancake" },
  "ms.video.6.desc": { fr: "Les bases du pancake : positionnement, activation et premières progressions.", en: "Pancake fundamentals: positioning, activation, and first progressions." },
  "ms.video.7.title": { fr: "Side lunge / Cossack squat", en: "Side Lunge / Cossack Squat" },
  "ms.video.7.desc": { fr: "Renforcement actif et ouverture des hanches avec ces deux exercices clés.", en: "Active strengthening and hip opening with these two key exercises." },
  "ms.video.8.title": { fr: "Middle split au mur / support", en: "Wall Middle Split / Supported" },
  "ms.video.8.desc": { fr: "Utilise le mur comme outil pour descendre progressivement en contrôle.", en: "Use the wall as a tool to gradually go deeper with control." },
  "ms.video.9.title": { fr: "Isométriques adducteurs", en: "Adductor Isometrics" },
  "ms.video.9.desc": { fr: "Travail isométrique pour renforcer et étirer tes adducteurs en profondeur.", en: "Isometric work to strengthen and deeply stretch your adductors." },
  "ms.video.10.title": { fr: "Pancake intermédiaire actif", en: "Active Intermediate Pancake" },
  "ms.video.10.desc": { fr: "Passer au niveau supérieur avec un pancake actif et contrôlé.", en: "Level up with an active, controlled pancake." },
  "ms.video.11.title": { fr: "Renforcement adducteurs et hanches", en: "Adductor and Hip Strengthening" },
  "ms.video.11.desc": { fr: "Exercices de renforcement ciblés pour soutenir ta progression en split.", en: "Targeted strengthening exercises to support your split progress." },
  "ms.video.12.title": { fr: "Core et bas du dos pour splits", en: "Core and Lower Back for Splits" },
  "ms.video.12.desc": { fr: "Un core solide est essentiel pour un split stable. Travail ciblé ici.", en: "A solid core is essential for a stable split. Targeted work here." },
  "ms.video.13.title": { fr: "Séance complète Semaine 1 (30 min, débutant)", en: "Full Session Week 1 (30 min, Beginner)" },
  "ms.video.13.desc": { fr: "Suis cette séance guidée pour bien démarrer ta première semaine.", en: "Follow this guided session to kickstart your first week." },
  "ms.video.14.title": { fr: "Séance complète Semaine 4 (35 min, intermédiaire)", en: "Full Session Week 4 (35 min, Intermediate)" },
  "ms.video.14.desc": { fr: "Mi-parcours : une séance plus intense pour tester ta progression.", en: "Midpoint: a more intense session to test your progress." },
  "ms.video.15.title": { fr: "Séance complète Semaine 8 (35-40 min, test & consolidation)", en: "Full Session Week 8 (35-40 min, Test & Consolidation)" },
  "ms.video.15.desc": { fr: "La séance finale pour mesurer ton évolution et consolider tes acquis.", en: "The final session to measure your progress and consolidate your gains." },

  "ms.who.tag": { fr: "Pour qui ?", en: "Who Is It For?" },
  "ms.who.title": { fr: "Ce programme est fait pour toi si…", en: "This Program Is for You If…" },
  "ms.who.w1": { fr: "Tu es raide des hanches et/ou des adducteurs", en: "You're tight in the hips and/or adductors" },
  "ms.who.w2": { fr: "Tu es débutant ou intermédiaire en mouvement, handstand, calisthenics, yoga ou danse", en: "You're a beginner or intermediate in movement, handstand, calisthenics, yoga, or dance" },
  "ms.who.w3": { fr: "Tu veux progresser en split sans forcer comme en contorsion et sans douleur extrême", en: "You want to progress in splits without forcing like in contortion and without extreme pain" },

  "ms.faq.tag": { fr: "FAQ", en: "FAQ" },
  "ms.faq.title": { fr: "Questions fréquentes", en: "Frequently Asked Questions" },
  "ms.faq.q1": { fr: "Est-ce que je dois déjà être flexible ?", en: "Do I need to be flexible already?" },
  "ms.faq.a1": { fr: "Pas du tout ! Ce programme est conçu pour les personnes raides. On commence doucement et on progresse ensemble, à ton rythme.", en: "Not at all! This program is designed for stiff people. We start gently and progress together, at your pace." },
  "ms.faq.q2": { fr: "Combien de fois par semaine dois-je m'entraîner ?", en: "How many times per week should I train?" },
  "ms.faq.a2": { fr: "3 séances de 30–40 min par semaine + une mini routine quotidienne de 5–10 min. C'est suffisant pour voir de vrais résultats.", en: "3 sessions of 30–40 min per week + a daily mini routine of 5–10 min. That's enough to see real results." },
  "ms.faq.q3": { fr: "Combien de temps avant de voir des résultats ?", en: "How long before I see results?" },
  "ms.faq.a3": { fr: "Tu sentiras une différence dès les 2 premières semaines. En 8 semaines, la transformation sera visible et mesurable.", en: "You'll feel a difference within the first 2 weeks. In 8 weeks, the transformation will be visible and measurable." },
  "ms.faq.q4": { fr: "Puis-je combiner ce programme avec un autre (handstand, calisthenics) ?", en: "Can I combine this program with another one (handstand, calisthenics)?" },
  "ms.faq.a4": { fr: "Oui, c'est même recommandé ! Le middle split complète parfaitement un travail de handstand ou de calisthenics. Assure-toi juste de bien gérer ton volume d'entraînement.", en: "Yes, it's even recommended! The middle split perfectly complements handstand or calisthenics work. Just make sure to manage your training volume well." },

  "ms.cta.title": { fr: "Prêt à ouvrir tes hanches ?", en: "Ready to Open Your Hips?" },
  "ms.cta.desc": { fr: "En 8 semaines, tu vas transformer ta mobilité de hanches et te rapprocher sérieusement de ton middle split. Le tout sans douleur et avec une méthode qui fonctionne.", en: "In 8 weeks, you'll transform your hip mobility and get seriously closer to your middle split. All pain-free, with a method that works." },
  "ms.cta.btn": { fr: "Je commence mon Middle Split", en: "Start My Middle Split" },

  // Handstand Débutant Program Page
  "hs.hero.tag": { fr: "Programme 8 semaines", en: "8-Week Program" },
  "hs.hero.title": { fr: "Handstand Débutant : 8 Semaines", en: "Beginner Handstand : 8 Weeks" },
  "hs.hero.subtitle": { fr: "Construis tes fondations, gagne en force et en confiance sur les mains, même si tu pars de zéro.", en: "Build your foundations, gain strength and confidence on your hands, even if you're starting from scratch." },
  "hs.hero.cta": { fr: "Rejoindre le programme", en: "Join the Program" },

  "hs.rules.title": { fr: "Règles du programme", en: "Program Rules" },
  "hs.rules.freq1": { fr: "Semaines 1–2 : 2–3x / semaine", en: "Weeks 1–2: 2–3x / week" },
  "hs.rules.freq2": { fr: "Semaines 3–6 : 2–4x / semaine", en: "Weeks 3–6: 2–4x / week" },
  "hs.rules.freq3": { fr: "Semaines 7–8 : 3–4x / semaine", en: "Weeks 7–8: 3–4x / week" },
  "hs.rules.rest": { fr: "Toujours au moins 1 jour de repos entre chaque séance.", en: "Always at least 1 rest day between sessions." },
  "hs.rules.progression": { fr: "Ne passe à la phase suivante que si tu complètes tous les exercices et les temps de la semaine en cours. Sinon, reste une semaine de plus.", en: "Only move to the next phase if you complete all exercises and times for the current week. Otherwise, stay one more week." },

  "hs.warmup.title": { fr: "Warm-up (avant chaque séance)", en: "Warm-up (before every session)" },
  "hs.table.exercise": { fr: "Exercice", en: "Exercise" },
  "hs.table.sets": { fr: "Sets", en: "Sets" },
  "hs.table.reps": { fr: "Reps / Durée", en: "Reps / Duration" },
  "hs.table.rest": { fr: "Repos", en: "Rest" },
  "hs.table.video": { fr: "Vidéo", en: "Video" },
  "hs.table.details": { fr: "Détails", en: "Details" },
  "hs.video.btn": { fr: "▶ Vidéo", en: "▶ Video" },
  "hs.details.toggle": { fr: "Voir les détails des exercices", en: "View exercise details" },
  "hs.details.placeholder": { fr: "Les descriptions détaillées des exercices seront ajoutées bientôt.", en: "Detailed exercise descriptions will be added soon." },

  "hs.phase1": { fr: "Phase 1 : Fondations et Confiance", en: "Phase 1 : Foundations and Confidence" },
  "hs.phase2": { fr: "Phase 2 : Inversion et Force", en: "Phase 2 : Inversion and Strength" },
  "hs.phase3": { fr: "Phase 3 : Construire le Handstand", en: "Phase 3 : Building the Handstand" },
  "hs.phase4": { fr: "Phase 4 : Vers l'autonomie", en: "Phase 4 : Towards Independence" },

  "hs.week": { fr: "Semaine", en: "Week" },
  "hs.week1.name": { fr: "Fondations et Confiance", en: "Foundations and Confidence" },
  "hs.week2.name": { fr: "Fondations et Confiance (progression)", en: "Foundations and Confidence (progression)" },
  "hs.week3.name": { fr: "Inversion et Force", en: "Inversion and Strength" },
  "hs.week4.name": { fr: "Inversion et Force (progression)", en: "Inversion and Strength (progression)" },
  "hs.week5.name": { fr: "Construire le Handstand", en: "Building the Handstand" },
  "hs.week6.name": { fr: "Construire le Handstand (progression)", en: "Building the Handstand (progression)" },
  "hs.week7.name": { fr: "Vers l'autonomie", en: "Towards Independence" },
  "hs.week8.name": { fr: "Consolidation et Test", en: "Consolidation and Test" },

  "hs.test.title": { fr: "🎯 TEST FINAL : Semaine 8", en: "🎯 FINAL TEST : Week 8" },
  "hs.test.col.test": { fr: "Test", en: "Test" },
  "hs.test.col.sets": { fr: "Sets", en: "Sets" },
  "hs.test.col.goal": { fr: "Objectif", en: "Goal" },

  "hs.faq.tag": { fr: "FAQ", en: "FAQ" },
  "hs.faq.title": { fr: "Questions fréquentes", en: "Frequently Asked Questions" },
  "hs.faq.q1": { fr: "Je suis totalement débutant, c'est pour moi ?", en: "I'm a total beginner, is this for me?" },
  "hs.faq.a1": { fr: "Oui ! Ce programme est conçu pour les débutants complets. On part de zéro et on construit ensemble, étape par étape.", en: "Yes! This program is designed for complete beginners. We start from zero and build together, step by step." },
  "hs.faq.q2": { fr: "De quel matériel ai-je besoin ?", en: "What equipment do I need?" },
  "hs.faq.a2": { fr: "Un mur, une box ou chaise stable, et un bloc de yoga (optionnel). C'est tout !", en: "A wall, a stable box or chair, and a yoga block (optional). That's it!" },
  "hs.faq.q3": { fr: "Combien de temps par séance ?", en: "How long per session?" },
  "hs.faq.a3": { fr: "Environ 30 à 45 minutes, warm-up inclus. Tu peux adapter selon ton niveau et ton énergie.", en: "About 30 to 45 minutes, warm-up included. You can adapt based on your level and energy." },
  "hs.faq.q4": { fr: "Que faire si je n'arrive pas à finir une semaine ?", en: "What if I can't finish a week?" },
  "hs.faq.a4": { fr: "Pas de stress ! Reste une semaine de plus sur la même phase jusqu'à ce que tu la maîtrises. Le programme est fait pour s'adapter à ton rythme.", en: "No stress! Stay one more week on the same phase until you master it. The program is designed to adapt to your pace." },

  "hs.cta.title": { fr: "Prêt à te lancer ?", en: "Ready to Get Started?" },
  "hs.cta.desc": { fr: "En 8 semaines, tu vas poser les fondations solides de ton handstand. Force, confiance, technique, tout commence ici.", en: "In 8 weeks, you'll build the solid foundations of your handstand. Strength, confidence, technique, it all starts here." },
  "hs.cta.btn": { fr: "Je commence mon programme Handstand", en: "Start My Handstand Program" },

  // ── New Homepage v2 ──
  "home2.hero.tag": { fr: "LD Move. Coaching mouvement", en: "LD Move. Movement Coaching" },
  "home2.hero.title": { fr: "Construis un corps fort, mobile et sans douleur.", en: "Build a body that's strong, mobile and pain‑free." },
  "home2.hero.subtitle": { fr: "Grâce au handstand, à la mobilité et au renforcement au poids du corps, on fait bouger et se sentir mieux ton corps.", en: "Through handstands, mobility and bodyweight training, we make your body move better and feel better." },
  "home2.hero.cta": { fr: "Découvrir les programmes", en: "Discover Programs" },
  "home2.hero.cta2": { fr: "Coaching 1:1", en: "1:1 Coaching" },

  // Pour qui
  "home2.who.tag": { fr: "Pour qui ?", en: "Who Is It For?" },
  "home2.who.title": { fr: "Est-ce que le LD Move System est fait pour toi ?", en: "Is the LD Move System right for you?" },
  "home2.who.card1.title": { fr: "Trop de temps assis", en: "Too Much Sitting" },
  "home2.who.card2.title": { fr: "Fort et mobile", en: "Strong and Mobile" },
  "home2.who.card3.title": { fr: "Skills et mouvement", en: "Skills and Movement" },
  "home2.who.card4.title": { fr: "Système progressif", en: "Progressive System" },
  "home2.who.p1": { fr: "Tu passes beaucoup de temps assis derrière un ordi et tu te sens raide (dos, hanches, épaules).", en: "You spend a lot of time sitting at a computer and feel stiff (back, hips, shoulders)." },
  "home2.who.p2": { fr: "Tu veux un corps à la fois fort et mobile, pas juste des muscles en plus.", en: "You want a body that is both strong and mobile, not just more muscle." },
  "home2.who.p3": { fr: "Tu es attiré par les skills comme le handstand et l'idée de mieux bouger au quotidien.", en: "You're drawn to skills like handstands and the idea of moving better in daily life." },
  "home2.who.p4": { fr: "Tu cherches un système clair et progressif, qui respecte ton rythme de vie d'adulte.", en: "You want a clear, progressive system that fits your adult lifestyle and schedule." },
  "home2.who.closing": { fr: "Si tu te reconnais là-dedans, tu es au bon endroit.", en: "If that sounds like you, you're in the right place." },

  // Coaching en action
  "home2.action.tag": { fr: "Coaching en action", en: "Coaching in Action" },
  "home2.action.title": { fr: "Un accompagnement sur-mesure, pas un programme standard.", en: "Tailored coaching, not a one-size-fits-all program." },
  "home2.action.desc": { fr: "Chaque séance, j'ajuste la technique, la mobilité et l'intensité à ton corps et à ta progression.", en: "Every session, I adjust technique, mobility and intensity to your body and your progress." },

  // Ce que je propose
  "home2.offer.tag": { fr: "Ce que je propose", en: "What I Offer" },
  "home2.offer.title": { fr: "Trois façons de travailler avec moi", en: "Three Ways to Work With Me" },
  "home2.offer.desc": { fr: "Un accompagnement personnalisé, des programmes structurés ou une consultation ponctuelle, à toi de choisir.", en: "Personalised coaching, structured programs, or a one-off consultation, you choose." },

  "home2.offer.consult.title": { fr: "Consultation", en: "Consultation" },
  "home2.offer.consult.desc": { fr: "Un appel de 30 minutes pour analyser ta pratique, répondre à tes questions et te donner des pistes concrètes pour progresser.", en: "A 30-minute call to review your practice, answer your questions, and give you actionable steps to progress." },
  "home2.offer.consult.cta": { fr: "Réserver", en: "Book" },

  "home2.offer.coaching.title": { fr: "Coaching 1:1", en: "1:1 Coaching" },
  "home2.offer.coaching.desc": { fr: "Un suivi personnalisé adapté à tes objectifs : handstand, mobilité, force au poids du corps. Je construis ton programme sur mesure et t'accompagne semaine après semaine.", en: "Personalised guidance tailored to your goals: handstand, mobility, bodyweight strength. I build your custom program and support you week after week." },
  "home2.offer.coaching.cta": { fr: "En savoir plus", en: "Learn More" },

  "home2.offer.programs.title": { fr: "Programmes", en: "Programs" },
  "home2.offer.programs.desc": { fr: "Des programmes sur plusieurs semaines pour le handstand, la flexibilité (middle split) et la mobilité de la colonne. Vidéos guidées, progressions claires, à faire à ton rythme.", en: "Multi-week programs for handstand, flexibility (middle split) and spine mobility. Guided videos, clear progressions, at your own pace." },
  "home2.offer.programs.cta": { fr: "Voir les programmes", en: "View Programs" },

  // Ma philosophie
  "home2.philo.tag": { fr: "Ma philosophie", en: "My Philosophy" },
  "home2.philo.title": { fr: "Comment je travaille", en: "How I Work" },
  "home2.philo.intro": { fr: "Je crois qu'on peut être fort, mobile et s'amuser en s'entraînant, sans y passer des heures. Mon approche combine le meilleur de la mobilité, de la force au poids du corps et du handstand, avec une progression pensée pour des adultes qui ont un job, une vie, et pas envie de se prendre la tête.", en: "I believe you can be strong, mobile, and have fun training, without spending hours at it. My approach combines the best of mobility, bodyweight strength, and handstand, with progression designed for adults with a job, a life, and no desire to overcomplicate things." },
  "home2.philo.a1.title": { fr: "Qualité de mouvement", en: "Movement Quality" },
  "home2.philo.a1.desc": { fr: "La qualité passe avant la performance brute. Bien bouger aujourd'hui, c'est pouvoir bouger mieux demain.", en: "Quality comes before raw performance. Moving well today means moving better tomorrow." },
  "home2.philo.a2.title": { fr: "Mobilité + Force + Contrôle", en: "Mobility + Strength + Control" },
  "home2.philo.a2.desc": { fr: "On intègre force, mobilité et skills dans un plan cohérent.", en: "We integrate strength, mobility and skills in one coherent plan." },
  "home2.philo.a3.title": { fr: "Progression réaliste", en: "Realistic Progression" },
  "home2.philo.a3.desc": { fr: "Des programmes pensés pour des adultes avec un emploi du temps chargé. Pas besoin d'être un athlète pro pour progresser.", en: "Programs designed for adults with busy schedules. You don't need to be a pro athlete to make progress." },
  "home2.philo.a4.title": { fr: "Approche ludique", en: "Playful Approach" },
  "home2.philo.a4.desc": { fr: "Handstand, mouvement ou skills. L'entraînement devrait ressembler à un jeu auquel on a envie de jouer plutôt qu'une tâche à accomplir.", en: "Handstand, movement or skill. Training should feel like a game you get to play than a task you have to do." },

  // Comment ça marche
  "home2.step.tag": { fr: "Comment ça marche ?", en: "How It Works" },
  "home2.step.title": { fr: "4 étapes pour commencer", en: "4 Steps to Get Started" },
  "home2.step.s1.title": { fr: "Choisis ton programme", en: "Choose Your Program" },
  "home2.step.s1.desc": { fr: "Handstand, Hanches, Colonne… Choisis le programme qui correspond à ton besoin principal.", en: "Handstand, Hips, Spine… Choose the program that matches your main need." },
  "home2.step.s2.title": { fr: "Accède à la plateforme", en: "Access the Platform" },
  "home2.step.s2.desc": { fr: "Vidéos guidées, tableaux semaine par semaine, explications claires, tout est structuré pour toi.", en: "Guided videos, week-by-week tables, clear instructions, everything is structured for you." },
  "home2.step.s3.title": { fr: "Pratique à ton rythme", en: "Train at Your Pace" },
  "home2.step.s3.desc": { fr: "2 à 4 fois par semaine, chez toi ou en salle, en suivant les progressions étape par étape.", en: "2 to 4 times per week, at home or at the gym, following step-by-step progressions." },
  "home2.step.s4.title": { fr: "Passe au niveau supérieur", en: "Level Up" },
  "home2.step.s4.desc": { fr: "Programme plus avancé ou coaching 1:1 personnalisé, tu choisis la suite.", en: "More advanced program or personalized 1:1 coaching, you choose what's next." },

  // À propos (mini)
  "home2.about.tag": { fr: "À propos", en: "About" },
  "home2.about.title": { fr: "Maxime, LD Move", en: "Maxime, LD Move" },
  "home2.about.p1": { fr: "Je suis coach de mouvement, spécialisé en handstand, mobilité et calisthenics. Mon parcours mêle la force au poids du corps, le yoga et des années de pratique du handstand. Aujourd'hui, j'aide les adultes « sédentaires actifs » à retrouver un corps dans lequel ils se sentent bien, forts et libres.", en: "I'm a movement coach specializing in handstand, mobility, and calisthenics. My background combines bodyweight strength, yoga, and years of handstand practice. Today, I help 'active sedentary' adults build a body they feel strong, comfortable, and free in." },
  "home2.about.p2": { fr: "Mon approche est simple : des programmes structurés, des retours honnêtes, et une passion sincère pour aider les gens à découvrir ce que leur corps est vraiment capable de faire.", en: "My approach is simple: structured programs, honest feedback, and a genuine passion for helping people discover what their body is truly capable of." },
  "home2.about.cta": { fr: "En savoir plus sur moi", en: "Learn More About Me" },

  // Témoignages
  "home2.testi.tag": { fr: "Témoignages", en: "Testimonials" },
  "home2.testi.title": { fr: "Ce qu'ils en disent", en: "What They Say" },
  "home2.testi.t1": { fr: "En 3 mois, j'ai réussi mon premier handstand libre. Le programme est hyper bien structuré et Maxime est toujours dispo pour répondre aux questions.", en: "In 3 months, I hit my first freestanding handstand. The program is incredibly well structured and Maxime is always available to answer questions." },
  "home2.testi.t1.role": { fr: "Développeur, Paris", en: "Developer, Paris" },
  "home2.testi.t2": { fr: "Je n'avais plus mal aux épaules après 4 semaines. Le programme mobilité a changé ma façon de bouger au quotidien.", en: "My shoulder pain was gone after 4 weeks. The mobility program changed how I move every day." },
  "home2.testi.t2.role": { fr: "Designer, Lyon", en: "Designer, Lyon" },
  "home2.testi.t3": { fr: "Simple, efficace, motivant. Exactement ce qu'il me fallait pour sortir de ma chaise et reprendre le contrôle de mon corps.", en: "Simple, effective, motivating. Exactly what I needed to get out of my chair and take back control of my body." },
  "home2.testi.t3.role": { fr: "Consultant, Remote", en: "Consultant, Remote" },

  // CTA final
  "home2.cta.title": { fr: "Prêt à reprendre le contrôle de ton corps ?", en: "Ready to Take Back Control of Your Body?" },
  "home2.cta.desc": { fr: "Bouge plus librement, deviens plus fort et apprends des skills qui changent ta façon de vivre dans ton corps.", en: "Move more freely, get stronger, and learn skills that change the way you live in your body." },
  "home2.cta.btn": { fr: "Découvrir les programmes", en: "Discover Programs" },

  // Homepage 1:1 Coaching Section
  "home2.coaching.tag": { fr: "Coaching 1:1", en: "1:1 Coaching" },
  "home2.coaching.title": { fr: "Coaching 1:1 : LD_Move System", en: "1:1 Coaching : LD_Move System" },
  "home2.coaching.intro": { fr: "Si tu veux un accompagnement plus personnalisé que les programmes en autonomie, tu peux travailler avec moi en coaching 1:1. On adapte le plan à ton niveau, ton emploi du temps et tes objectifs (handstand, mobilité, force au poids du corps).", en: "If you want more personalized support than self-paced programs, you can work with me 1:1. We'll adapt the plan to your level, schedule and goals (handstands, mobility, bodyweight strength)." },

  "home2.coaching.c1.title": { fr: "Coaching 1 mois", en: "1-Month Coaching" },
  "home2.coaching.c1.ideal": { fr: "Idéal pour : tester le coaching, débloquer un point précis (poignets, kick-up, douleur spécifique…).", en: "Best for: testing coaching, unlocking one specific issue (wrists, kick-up, a specific pain, etc.)." },
  "home2.coaching.c1.i1": { fr: "1 appel de départ (bilan + objectifs)", en: "1 initial call (assessment + goals)" },
  "home2.coaching.c1.i2": { fr: "Programme personnalisé sur 4 semaines", en: "Personalized 4-week plan" },
  "home2.coaching.c1.i3": { fr: "1 check-in par semaine (vidéo/texte)", en: "1 weekly check-in (video/text)" },
  "home2.coaching.c1.price": { fr: "[TON PRIX] € / mois", en: "[YOUR PRICE] € / month" },
  "home2.coaching.c1.cta": { fr: "Commencer 1 mois", en: "Start 1 month" },

  "home2.coaching.c2.title": { fr: "Coaching 3 mois", en: "3-Month Coaching" },
  "home2.coaching.c2.ideal": { fr: "Idéal pour : construire une vraie base en handstand, mobilité et force au poids du corps.", en: "Best for: building a solid base in handstands, mobility and bodyweight strength." },
  "home2.coaching.c2.i1": { fr: "1 appel de départ", en: "1 initial call" },
  "home2.coaching.c2.i2": { fr: "Programme personnalisé mis à jour chaque mois", en: "Personalized program updated every month" },
  "home2.coaching.c2.i3": { fr: "Feedback vidéo chaque semaine", en: "Weekly video feedback" },
  "home2.coaching.c2.i4": { fr: "Support questions via message", en: "Question support via messages" },
  "home2.coaching.c2.price": { fr: "[TON PRIX] € / 3 mois", en: "[YOUR PRICE] € / 3 months" },
  "home2.coaching.c2.cta": { fr: "Commencer 3 mois", en: "Start 3 months" },

  "home2.coaching.c3.title": { fr: "Coaching 6 mois", en: "6-Month Coaching" },
  "home2.coaching.c3.ideal": { fr: "Idéal pour : transformation profonde (posture, mobilité, handstand, force), changement d'habitudes sur le long terme.", en: "Best for: deep transformation (posture, mobility, handstands, strength), long-term habit change." },
  "home2.coaching.c3.i1": { fr: "1 appel de départ + 1 appel de suivi intermédiaire", en: "1 initial call + 1 mid-point check-in call" },
  "home2.coaching.c3.i2": { fr: "Programme personnalisé ajusté en continu", en: "Continuously adjusted personalized program" },
  "home2.coaching.c3.i3": { fr: "Feedback vidéo chaque semaine", en: "Weekly video feedback" },
  "home2.coaching.c3.i4": { fr: "Support illimité par message (dans des limites raisonnables)", en: "Ongoing message support (within reasonable limits)" },
  "home2.coaching.c3.price": { fr: "[TON PRIX] € / 6 mois", en: "[YOUR PRICE] € / 6 months" },
  "home2.coaching.c3.cta": { fr: "Commencer 6 mois", en: "Start 6 months" },

  "home2.coaching.footer": { fr: "Si tu ne sais pas quelle option choisir, tu peux réserver un appel découverte gratuit pour en parler.", en: "Not sure which option is right for you? Book a free discovery call and we'll decide together." },
  "home2.coaching.includes": { fr: "Contenu :", en: "Includes:" },

  // Consultation page
  "nav.consultation": { fr: "Consultation", en: "Consultation" },
  "consult.tag": { fr: "Consultation en ligne", en: "Online Consultation" },
  "consult.title": { fr: "30-Min\nConsultation", en: "30-Min\nConsultation" },
  "consult.subtitle": { fr: "Tu veux un avis personnalisé sur ta pratique de mouvement ? Lors de cette consultation en ligne de 30 minutes, on parle de tes objectifs, on évalue ton niveau actuel et on te donne des pistes claires pour ton entraînement. Tu peux poser toutes tes questions sur le handstand, la mobilité ou la structure de ton entraînement.", en: "Want personal feedback on your movement practice? In this 30‑minute online consultation, we talk about your goals, review your current level, and give you clear next steps for your training. You can ask any questions about handstand, mobility, or overall training structure." },
  "consult.box.title": { fr: "Consultation en ligne de 30 min, 50 USD", en: "30-min online consultation – 50 USD" },
  "consult.box.b1": { fr: "Discuter de ta pratique actuelle et de tes objectifs", en: "Discuss your current practice and goals" },
  "consult.box.b2": { fr: "Poser toutes tes questions sur le handstand, la mobilité ou la structure d'entraînement", en: "Ask any questions about handstand, mobility, or training structure" },
  "consult.box.b3": { fr: "Repars avec des étapes claires et pratiques pour améliorer ta pratique.", en: "Leave with clear, practical steps to upgrade your practice." },
  "consult.cta": { fr: "Book", en: "Book" },
  "consult.after": { fr: "Après le paiement, tu recevras un email sous 24h pour planifier ton appel.", en: "After payment, you'll receive an email within 24 hours to schedule your call." },
};

const LangContext = createContext<LangContextType | undefined>(undefined);

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("en");

  const t = (key: string): string => {
    return translations[key]?.[lang] ?? key;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
};
