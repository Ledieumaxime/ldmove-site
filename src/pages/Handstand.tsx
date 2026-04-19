import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Play, Info } from "lucide-react";
import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { useLang } from "@/contexts/LangContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface Exercise {
  name: string;
  sets: string;
  reps: string;
  rest?: string;
  video: string;
  details: string;
}

interface WeekData {
  week: number;
  nameKey: string;
  phase: number;
  exercises: Exercise[];
}

const warmupExercises: Exercise[] = [
  { name: "Cercles de poignets (avant/arrière)", sets: "1", reps: "10 par sens", video: "#", details: "Doux, préparer les articulations" },
  { name: "Extensions poignets au sol (doigts avant)", sets: "1", reps: "8 reps", video: "#", details: "Pencher doucement, pas de douleur" },
  { name: "Extensions poignets au sol (doigts vers soi)", sets: "1", reps: "8 reps", video: "#", details: "Si douleur, réduire l'amplitude" },
  { name: "Fingertip push-ups (sur genoux)", sets: "1", reps: "8 reps", video: "#", details: "Soulever la paume, appuyer sur le bout des doigts" },
  { name: "Child's pose bras tendus", sets: "1", reps: "30s", video: "#", details: "Pousser la tête entre les bras, étirer les épaules" },
  { name: "Shoulder circles + wall slides", sets: "1", reps: "10 reps", video: "#", details: "Ouvrir les épaules en douceur" },
];

const warmupExercisesEn: Exercise[] = [
  { name: "Wrist circles (forward/backward)", sets: "1", reps: "10 per direction", video: "#", details: "Gentle, prepare the joints" },
  { name: "Wrist extensions on floor (fingers forward)", sets: "1", reps: "8 reps", video: "#", details: "Lean gently, no pain" },
  { name: "Wrist extensions on floor (fingers toward you)", sets: "1", reps: "8 reps", video: "#", details: "If pain, reduce range" },
  { name: "Fingertip push-ups (on knees)", sets: "1", reps: "8 reps", video: "#", details: "Lift palm, press fingertips" },
  { name: "Child's pose arms extended", sets: "1", reps: "30s", video: "#", details: "Push head between arms, stretch shoulders" },
  { name: "Shoulder circles + wall slides", sets: "1", reps: "10 reps", video: "#", details: "Open shoulders gently" },
];

const weeksFr: WeekData[] = [
  {
    week: 1, nameKey: "hs.week1.name", phase: 1,
    exercises: [
      { name: "Tuck Hollow Hold", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Bas du dos collé au sol, rentrer les côtes" },
      { name: "Bear Plank", sets: "2", reps: "10s", rest: "30s", video: "#", details: "Genoux 2–3 cm du sol, dos plat" },
      { name: "Pike Handstand (au sol)", sets: "2", reps: "15s", rest: "30s", video: "#", details: "Pousser fort dans le sol, épaules vers les oreilles" },
      { name: "Bear Plank → Pike Handstand", sets: "2", reps: "1 rep", rest: "45s", video: "#", details: "Enchaîner les 2 positions lentement" },
      { name: "Pike step up to the box", sets: "2", reps: "4 reps", rest: "45s", video: "#", details: "Monter un pied à la fois sur la box" },
      { name: "Pike on box (tenue)", sets: "2", reps: "15s", rest: "45s", video: "#", details: "Épaules au-dessus des mains, pousser le sol" },
      { name: "Wall walk (montée face au mur)", sets: "2", reps: "2 reps", rest: "60s", video: "#", details: "Monter aussi haut que confortable, redescendre" },
      { name: "Kick-up intro (léger, une jambe)", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Pas besoin de monter haut, juste apprendre le geste" },
      { name: "Bail drill (sortie latérale)", sets: "2", reps: "3 reps/côté", rest: "30s", video: "#", details: "Apprendre à tomber sans peur, en contrôle" },
      { name: "Tuck Hollow Hold", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Finir par du core pour renforcer la ligne" },
    ],
  },
  {
    week: 2, nameKey: "hs.week2.name", phase: 1,
    exercises: [
      { name: "Tuck Hollow Hold", sets: "3", reps: "30s", rest: "30s", video: "#", details: "Même consigne, tenue un peu plus longue" },
      { name: "Bear Plank", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Reste gainé, ne laisse pas le dos s'arrondir" },
      { name: "Pike Handstand", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Continue à pousser le sol avec les mains" },
      { name: "Bear Plank → Pike Handstand", sets: "2", reps: "2 reps", rest: "45s", video: "#", details: "Transition fluide, sans à-coups" },
      { name: "Pike step up to the box", sets: "2", reps: "6 reps", rest: "45s", video: "#", details: "Contrôle la montée et la descente" },
      { name: "Pike on box", sets: "2", reps: "20s", rest: "45s", video: "#", details: "Tiens la ligne le plus propre possible" },
      { name: "Wall walk", sets: "2", reps: "3 reps", rest: "60s", video: "#", details: "Essaye de monter un peu plus haut qu'en semaine 1" },
      { name: "Chest-to-wall hold (face au mur)", sets: "2", reps: "10s", rest: "60s", video: "#", details: "NOUVEAU : tenir la position haute du wall walk" },
      { name: "Kick-up intro", sets: "3", reps: "8 reps", rest: "45s", video: "#", details: "Toujours léger et contrôlé" },
      { name: "Bail drill", sets: "2", reps: "3 reps/côté", rest: "30s", video: "#", details: "La sortie doit être fluide et sans stress" },
      { name: "Tuck Hollow Hold", sets: "3", reps: "30s", rest: "30s", video: "#", details: "Tenue plus longue, garde la qualité" },
    ],
  },
  {
    week: 3, nameKey: "hs.week3.name", phase: 2,
    exercises: [
      { name: "Bear Plank → Pike Handstand", sets: "3", reps: "2 reps", rest: "45s", video: "#", details: "Transition de plus en plus propre" },
      { name: "Hollow Rock (jambes tendues)", sets: "3", reps: "20s", rest: "30s", video: "#", details: "NOUVEAU : balancer sans casser la forme" },
      { name: "Chest-to-wall hold", sets: "3", reps: "20s", rest: "60s", video: "#", details: "Oreilles entre les bras, corps gainé" },
      { name: "Plank → Pike Handstand", sets: "3", reps: "1 rep", rest: "45s", video: "#", details: "NOUVEAU : départ en plank, bras bien tendus" },
      { name: "Kick-up over a block", sets: "3", reps: "6 reps", rest: "45s", video: "#", details: "NOUVEAU : le bloc t'aide à viser la bonne hauteur" },
      { name: "Pike on box", sets: "3", reps: "25s", rest: "45s", video: "#", details: "Fessiers serrés, pousse le sol" },
      { name: "Heel pull (dos au mur)", sets: "2", reps: "5 reps", rest: "45s", video: "#", details: "NOUVEAU : presse les doigts, décolle les talons 1–2s" },
      { name: "Tuck Hollow Hold", sets: "3", reps: "30s", rest: "30s", video: "#", details: "" },
    ],
  },
  {
    week: 4, nameKey: "hs.week4.name", phase: 2,
    exercises: [
      { name: "Bear Plank → Pike Handstand", sets: "3", reps: "3 reps", rest: "45s", video: "#", details: "" },
      { name: "Hollow Rock", sets: "3", reps: "30s", rest: "30s", video: "#", details: "Garde toujours la même forme du corps" },
      { name: "Chest-to-wall hold", sets: "3", reps: "25s", rest: "60s", video: "#", details: "Rapproche le buste du mur sans cambrer excessivement" },
      { name: "Plank → Pike Handstand", sets: "3", reps: "2 reps", rest: "45s", video: "#", details: "Contrôle la montée des hanches" },
      { name: "Kick-up over a block", sets: "3", reps: "8 reps", rest: "45s", video: "#", details: "Même hauteur à chaque répétition" },
      { name: "Pike on box", sets: "3", reps: "30s", rest: "45s", video: "#", details: "" },
      { name: "Heel pull", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Essaie de rester décollé un peu plus longtemps" },
      { name: "Tuck Hollow Hold", sets: "3", reps: "40s", rest: "30s", video: "#", details: "Challenge : ne laisse pas le bas du dos décoller" },
    ],
  },
  {
    week: 5, nameKey: "hs.week5.name", phase: 3,
    exercises: [
      { name: "Plank → Pike Handstand", sets: "3", reps: "2 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike step up to the box", sets: "3", reps: "4 reps", rest: "45s", video: "#", details: "Monte en contrôle, sans élan" },
      { name: "Pike on box", sets: "3", reps: "35s", rest: "45s", video: "#", details: "Ligne la plus propre possible" },
      { name: "Kick-up to the box (dos au mur)", sets: "2", reps: "5 reps", rest: "60s", video: "#", details: "NOUVEAU : arriver pieds sur le mur, sans taper" },
      { name: "Chest-to-wall hold", sets: "3", reps: "30s", rest: "60s", video: "#", details: "Cherche la sensation de verticalité" },
      { name: "Toe pull (face au mur)", sets: "2", reps: "5 reps", rest: "45s", video: "#", details: "NOUVEAU : décolle les orteils puis reviens au mur" },
      { name: "Single-Leg Pike", sets: "2", reps: "10 reps/côté", rest: "45s", video: "#", details: "NOUVEAU : une jambe en l'air, garde les hanches stables" },
      { name: "Plank → Pike backward walk", sets: "2", reps: "2 reps", rest: "60s", video: "#", details: "NOUVEAU : marche les pieds vers les mains en pike" },
      { name: "Hollow Hold (jambes tendues)", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Version complète : bras et jambes tendus" },
    ],
  },
  {
    week: 6, nameKey: "hs.week6.name", phase: 3,
    exercises: [
      { name: "Plank → Pike Handstand", sets: "3", reps: "3 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike step up to the box", sets: "3", reps: "6 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike on box", sets: "2", reps: "45s", rest: "45s", video: "#", details: "Moins de sets, mais tenue plus longue" },
      { name: "Kick-up to the box", sets: "3", reps: "5 reps", rest: "60s", video: "#", details: "Garde le même point d'arrivée à chaque rep" },
      { name: "Kick-up to the box (tenue)", sets: "2", reps: "8s hold", rest: "60s", video: "#", details: "NOUVEAU : reste en haut après le kick-up" },
      { name: "Chest-to-wall hold", sets: "3", reps: "35s", rest: "60s", video: "#", details: "" },
      { name: "Toe pull", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Cherche 1–2s d'équilibre loin du mur" },
      { name: "Single-Leg Pike", sets: "2", reps: "15s hold/côté", rest: "45s", video: "#", details: "Tiens la position sans bouger" },
      { name: "Plank → Pike backward walk", sets: "2", reps: "2 reps", rest: "60s", video: "#", details: "" },
      { name: "Hollow Hold", sets: "3", reps: "25s", rest: "30s", video: "#", details: "Corps totalement gainé du bout des doigts aux orteils" },
    ],
  },
  {
    week: 7, nameKey: "hs.week7.name", phase: 4,
    exercises: [
      { name: "Plank → Pike Handstand", sets: "3", reps: "3 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike step up to the box", sets: "3", reps: "6 reps", rest: "45s", video: "#", details: "" },
      { name: "Plank → Pike backward walk", sets: "2", reps: "3 reps", rest: "60s", video: "#", details: "Marche lente et contrôlée" },
      { name: "Kick-up from the box", sets: "3", reps: "5 reps", rest: "60s", video: "#", details: "Kick-up contrôlé, pas d'élan violent" },
      { name: "Wall handstand endurance (dos au mur)", sets: "3", reps: "15s", rest: "60s", video: "#", details: "NOUVEAU : vise ton meilleur temps possible" },
      { name: "Heel pull", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Presse les doigts, décolle les talons puis reviens" },
      { name: "Toe pull", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Pareil, mais face au mur" },
      { name: "Finger pressure (micro-décollage)", sets: "4–5", reps: "1 rep (hold max)", rest: "60s", video: "#", details: "NOUVEAU : décolle-toi 1–2s du mur grâce aux doigts" },
      { name: "Hollow Hold", sets: "3", reps: "30s", rest: "30s", video: "#", details: "" },
    ],
  },
  {
    week: 8, nameKey: "hs.week8.name", phase: 4,
    exercises: [
      { name: "Plank → Pike Handstand", sets: "3", reps: "3 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike step up to the box", sets: "3", reps: "6 reps", rest: "45s", video: "#", details: "" },
      { name: "Plank → Pike backward walk", sets: "3", reps: "3 reps", rest: "60s", video: "#", details: "" },
      { name: "Kiss kiss kick-up", sets: "3", reps: "5 reps", rest: "60s", video: "#", details: "NOUVEAU : les talons effleurent le mur en douceur" },
      { name: "Wall handstand endurance", sets: "3", reps: "25s", rest: "60s", video: "#", details: "Cherche ton record de tenue propre" },
      { name: "Finger pressure", sets: "6–7", reps: "1 rep (hold max)", rest: "60s", video: "#", details: "Objectif : rester 3–5 secondes décollé" },
      { name: "Hollow Hold", sets: "3", reps: "40s", rest: "30s", video: "#", details: "Dernière semaine : garde la meilleure qualité possible" },
    ],
  },
];

const weeksEn: WeekData[] = [
  {
    week: 1, nameKey: "hs.week1.name", phase: 1,
    exercises: [
      { name: "Tuck Hollow Hold", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Lower back glued to the floor, tuck your ribs in" },
      { name: "Bear Plank", sets: "2", reps: "10s", rest: "30s", video: "#", details: "Knees 2–3 cm off the floor, flat back" },
      { name: "Pike Handstand (on floor)", sets: "2", reps: "15s", rest: "30s", video: "#", details: "Push hard into the floor, shoulders toward ears" },
      { name: "Bear Plank → Pike Handstand", sets: "2", reps: "1 rep", rest: "45s", video: "#", details: "Chain both positions slowly" },
      { name: "Pike step up to the box", sets: "2", reps: "4 reps", rest: "45s", video: "#", details: "Step up one foot at a time" },
      { name: "Pike on box (hold)", sets: "2", reps: "15s", rest: "45s", video: "#", details: "Shoulders over hands, push the floor" },
      { name: "Wall walk (facing wall)", sets: "2", reps: "2 reps", rest: "60s", video: "#", details: "Go as high as comfortable, come back down" },
      { name: "Kick-up intro (light, one leg)", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "No need to go high, just learn the movement" },
      { name: "Bail drill (side exit)", sets: "2", reps: "3 reps/side", rest: "30s", video: "#", details: "Learn to fall without fear, in control" },
      { name: "Tuck Hollow Hold", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Finish with core to reinforce the line" },
    ],
  },
  {
    week: 2, nameKey: "hs.week2.name", phase: 1,
    exercises: [
      { name: "Tuck Hollow Hold", sets: "3", reps: "30s", rest: "30s", video: "#", details: "Same cues, slightly longer hold" },
      { name: "Bear Plank", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Stay tight, don't let the back round" },
      { name: "Pike Handstand", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Keep pushing the floor with your hands" },
      { name: "Bear Plank → Pike Handstand", sets: "2", reps: "2 reps", rest: "45s", video: "#", details: "Smooth transition, no jerking" },
      { name: "Pike step up to the box", sets: "2", reps: "6 reps", rest: "45s", video: "#", details: "Control the way up and down" },
      { name: "Pike on box", sets: "2", reps: "20s", rest: "45s", video: "#", details: "Hold the cleanest line possible" },
      { name: "Wall walk", sets: "2", reps: "3 reps", rest: "60s", video: "#", details: "Try to go a bit higher than week 1" },
      { name: "Chest-to-wall hold (facing wall)", sets: "2", reps: "10s", rest: "60s", video: "#", details: "NEW: hold the top position of the wall walk" },
      { name: "Kick-up intro", sets: "3", reps: "8 reps", rest: "45s", video: "#", details: "Always light and controlled" },
      { name: "Bail drill", sets: "2", reps: "3 reps/side", rest: "30s", video: "#", details: "The exit should be smooth and stress-free" },
      { name: "Tuck Hollow Hold", sets: "3", reps: "30s", rest: "30s", video: "#", details: "Longer hold, keep the quality" },
    ],
  },
  {
    week: 3, nameKey: "hs.week3.name", phase: 2,
    exercises: [
      { name: "Bear Plank → Pike Handstand", sets: "3", reps: "2 reps", rest: "45s", video: "#", details: "Cleaner and cleaner transition" },
      { name: "Hollow Rock (legs straight)", sets: "3", reps: "20s", rest: "30s", video: "#", details: "NEW: rock without breaking form" },
      { name: "Chest-to-wall hold", sets: "3", reps: "20s", rest: "60s", video: "#", details: "Ears between arms, body tight" },
      { name: "Plank → Pike Handstand", sets: "3", reps: "1 rep", rest: "45s", video: "#", details: "NEW: start from plank, arms fully locked" },
      { name: "Kick-up over a block", sets: "3", reps: "6 reps", rest: "45s", video: "#", details: "NEW: the block helps you aim for the right height" },
      { name: "Pike on box", sets: "3", reps: "25s", rest: "45s", video: "#", details: "Squeeze glutes, push the floor" },
      { name: "Heel pull (back to wall)", sets: "2", reps: "5 reps", rest: "45s", video: "#", details: "NEW: press fingers, lift heels for 1–2s" },
      { name: "Tuck Hollow Hold", sets: "3", reps: "30s", rest: "30s", video: "#", details: "" },
    ],
  },
  {
    week: 4, nameKey: "hs.week4.name", phase: 2,
    exercises: [
      { name: "Bear Plank → Pike Handstand", sets: "3", reps: "3 reps", rest: "45s", video: "#", details: "" },
      { name: "Hollow Rock", sets: "3", reps: "30s", rest: "30s", video: "#", details: "Always keep the same body shape" },
      { name: "Chest-to-wall hold", sets: "3", reps: "25s", rest: "60s", video: "#", details: "Bring chest closer to wall without arching too much" },
      { name: "Plank → Pike Handstand", sets: "3", reps: "2 reps", rest: "45s", video: "#", details: "Control the hip rise" },
      { name: "Kick-up over a block", sets: "3", reps: "8 reps", rest: "45s", video: "#", details: "Same height every rep" },
      { name: "Pike on box", sets: "3", reps: "30s", rest: "45s", video: "#", details: "" },
      { name: "Heel pull", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Try to stay lifted a bit longer" },
      { name: "Tuck Hollow Hold", sets: "3", reps: "40s", rest: "30s", video: "#", details: "Challenge: don't let the lower back lift off" },
    ],
  },
  {
    week: 5, nameKey: "hs.week5.name", phase: 3,
    exercises: [
      { name: "Plank → Pike Handstand", sets: "3", reps: "2 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike step up to the box", sets: "3", reps: "4 reps", rest: "45s", video: "#", details: "Go up with control, no momentum" },
      { name: "Pike on box", sets: "3", reps: "35s", rest: "45s", video: "#", details: "Cleanest line possible" },
      { name: "Kick-up to the box (back to wall)", sets: "2", reps: "5 reps", rest: "60s", video: "#", details: "NEW: land feet on the wall, no slamming" },
      { name: "Chest-to-wall hold", sets: "3", reps: "30s", rest: "60s", video: "#", details: "Feel the sensation of verticality" },
      { name: "Toe pull (facing wall)", sets: "2", reps: "5 reps", rest: "45s", video: "#", details: "NEW: lift toes off then come back to wall" },
      { name: "Single-Leg Pike", sets: "2", reps: "10 reps/side", rest: "45s", video: "#", details: "NEW: one leg up, keep hips stable" },
      { name: "Plank → Pike backward walk", sets: "2", reps: "2 reps", rest: "60s", video: "#", details: "NEW: walk feet toward hands in pike" },
      { name: "Hollow Hold (legs straight)", sets: "3", reps: "20s", rest: "30s", video: "#", details: "Full version: arms and legs straight" },
    ],
  },
  {
    week: 6, nameKey: "hs.week6.name", phase: 3,
    exercises: [
      { name: "Plank → Pike Handstand", sets: "3", reps: "3 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike step up to the box", sets: "3", reps: "6 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike on box", sets: "2", reps: "45s", rest: "45s", video: "#", details: "Fewer sets, but longer hold" },
      { name: "Kick-up to the box", sets: "3", reps: "5 reps", rest: "60s", video: "#", details: "Same landing point every rep" },
      { name: "Kick-up to the box (hold)", sets: "2", reps: "8s hold", rest: "60s", video: "#", details: "NEW: stay up after the kick-up" },
      { name: "Chest-to-wall hold", sets: "3", reps: "35s", rest: "60s", video: "#", details: "" },
      { name: "Toe pull", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Aim for 1–2s of balance away from the wall" },
      { name: "Single-Leg Pike", sets: "2", reps: "15s hold/side", rest: "45s", video: "#", details: "Hold the position without moving" },
      { name: "Plank → Pike backward walk", sets: "2", reps: "2 reps", rest: "60s", video: "#", details: "" },
      { name: "Hollow Hold", sets: "3", reps: "25s", rest: "30s", video: "#", details: "Fully braced from fingertips to toes" },
    ],
  },
  {
    week: 7, nameKey: "hs.week7.name", phase: 4,
    exercises: [
      { name: "Plank → Pike Handstand", sets: "3", reps: "3 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike step up to the box", sets: "3", reps: "6 reps", rest: "45s", video: "#", details: "" },
      { name: "Plank → Pike backward walk", sets: "2", reps: "3 reps", rest: "60s", video: "#", details: "Slow and controlled walk" },
      { name: "Kick-up from the box", sets: "3", reps: "5 reps", rest: "60s", video: "#", details: "Controlled kick-up, no violent swing" },
      { name: "Wall handstand endurance (back to wall)", sets: "3", reps: "15s", rest: "60s", video: "#", details: "NEW: aim for your best time" },
      { name: "Heel pull", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Press fingers, lift heels then come back" },
      { name: "Toe pull", sets: "3", reps: "5 reps", rest: "45s", video: "#", details: "Same thing, but facing the wall" },
      { name: "Finger pressure (micro-lift off)", sets: "4–5", reps: "1 rep (hold max)", rest: "60s", video: "#", details: "NEW: lift off 1–2s from the wall using your fingers" },
      { name: "Hollow Hold", sets: "3", reps: "30s", rest: "30s", video: "#", details: "" },
    ],
  },
  {
    week: 8, nameKey: "hs.week8.name", phase: 4,
    exercises: [
      { name: "Plank → Pike Handstand", sets: "3", reps: "3 reps", rest: "45s", video: "#", details: "" },
      { name: "Pike step up to the box", sets: "3", reps: "6 reps", rest: "45s", video: "#", details: "" },
      { name: "Plank → Pike backward walk", sets: "3", reps: "3 reps", rest: "60s", video: "#", details: "" },
      { name: "Kiss kiss kick-up", sets: "3", reps: "5 reps", rest: "60s", video: "#", details: "NEW: heels gently touch the wall" },
      { name: "Wall handstand endurance", sets: "3", reps: "25s", rest: "60s", video: "#", details: "Go for your clean hold record" },
      { name: "Finger pressure", sets: "6–7", reps: "1 rep (hold max)", rest: "60s", video: "#", details: "Goal: stay 3–5 seconds off the wall" },
      { name: "Hollow Hold", sets: "3", reps: "40s", rest: "30s", video: "#", details: "Last week: keep the best quality possible" },
    ],
  },
];

const finalTestFr = [
  { name: "Chest-to-wall hold MAX", sets: "3", goal: "max hold", video: "#", details: "Note ton temps et compare avec la semaine 2" },
  { name: "Kick-up contrôlé au mur", sets: "5", goal: "1 rep", video: "#", details: "Réussir 5 sur 5 en contrôle" },
  { name: "Finger pressure hold décollé", sets: "5", goal: "max hold", video: "#", details: "Objectif : 3–5 secondes sans toucher le mur" },
  { name: "Hollow Hold MAX", sets: "3", goal: "max hold", video: "#", details: "Compare avec ton temps de la semaine 1" },
];

const finalTestEn = [
  { name: "Chest-to-wall hold MAX", sets: "3", goal: "max hold", video: "#", details: "Record your time and compare with week 2" },
  { name: "Controlled kick-up to wall", sets: "5", goal: "1 rep", video: "#", details: "Hit 5 out of 5 with control" },
  { name: "Finger pressure hold (off wall)", sets: "5", goal: "max hold", video: "#", details: "Goal: 3–5 seconds without touching the wall" },
  { name: "Hollow Hold MAX", sets: "3", goal: "max hold", video: "#", details: "Compare with your week 1 time" },
];

const phaseConfig: Record<number, { bg: string; border: string; badge: string; text: string }> = {
  1: { bg: "bg-jungle-light", border: "border-jungle/30", badge: "bg-jungle text-white", text: "text-jungle" },
  2: { bg: "bg-ocean-light", border: "border-ocean/30", badge: "bg-ocean text-white", text: "text-ocean" },
  3: { bg: "bg-sunset-light", border: "border-sunset/30", badge: "bg-sunset text-white", text: "text-sunset" },
  4: { bg: "bg-ruby-light", border: "border-ruby/30", badge: "bg-ruby text-white", text: "text-ruby" },
};

const VideoButton = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    className="inline-flex items-center gap-1 text-accent hover:text-accent/80 font-semibold text-xs whitespace-nowrap transition-colors"
    onClick={(e) => e.preventDefault()}
  >
    <Play size={12} />
    {label}
  </a>
);

const ExerciseTable = ({
  exercises,
  showRest = true,
  videoLabel,
  t,
}: {
  exercises: Exercise[];
  showRest?: boolean;
  videoLabel: string;
  t: (key: string) => string;
}) => (
  <div className="overflow-x-auto -mx-4 md:mx-0">
    <table className="w-full min-w-[600px] text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-3 px-3 font-heading font-bold text-foreground">{t("hs.table.exercise")}</th>
          <th className="text-center py-3 px-2 font-heading font-bold text-foreground w-16">{t("hs.table.sets")}</th>
          <th className="text-center py-3 px-2 font-heading font-bold text-foreground w-28">{t("hs.table.reps")}</th>
          {showRest && <th className="text-center py-3 px-2 font-heading font-bold text-foreground w-16">{t("hs.table.rest")}</th>}
          <th className="text-center py-3 px-2 font-heading font-bold text-foreground w-20">{t("hs.table.video")}</th>
          <th className="text-left py-3 px-3 font-heading font-bold text-foreground">{t("hs.table.details")}</th>
        </tr>
      </thead>
      <tbody>
        {exercises.map((ex, i) => (
          <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
            <td className="py-3 px-3 font-body font-medium text-foreground">{ex.name}</td>
            <td className="py-3 px-2 text-center font-body text-muted-foreground">{ex.sets}</td>
            <td className="py-3 px-2 text-center font-body text-muted-foreground">{ex.reps}</td>
            {showRest && <td className="py-3 px-2 text-center font-body text-muted-foreground">{ex.rest}</td>}
            <td className="py-3 px-2 text-center"><VideoButton href={ex.video} label={videoLabel} /></td>
            <td className="py-3 px-3 font-body text-muted-foreground text-xs">{ex.details}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const HandstandPage = () => {
  const { t, lang } = useLang();
  const warmup = lang === "fr" ? warmupExercises : warmupExercisesEn;
  const weeks = lang === "fr" ? weeksFr : weeksEn;
  const finalTest = lang === "fr" ? finalTestFr : finalTestEn;
  const videoLabel = t("hs.video.btn");

  const phaseLabels: Record<number, string> = {
    1: t("hs.phase1"),
    2: t("hs.phase2"),
    3: t("hs.phase3"),
    4: t("hs.phase4"),
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent/20" />
        <div className="container relative z-10 py-20 pt-32 md:pt-36">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-4">
              {t("hs.hero.tag")}
            </p>
            <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-tight mb-6">
              {t("hs.hero.title")}
            </h1>
            <p className="font-body text-lg md:text-xl text-primary-foreground/80 leading-relaxed mb-10 max-w-lg">
              {t("hs.hero.subtitle")}
            </p>
            <Button variant="cta" size="xl" asChild>
              <Link to="/contact">
                {t("hs.hero.cta")} <ArrowRight size={20} />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Règles du programme */}
      <SectionWrapper className="bg-background">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-xl border border-border p-8"
          >
            <div className="flex items-start gap-3 mb-6">
              <Info className="text-accent mt-1 shrink-0" size={24} />
              <h2 className="font-heading text-2xl md:text-3xl font-bold">{t("hs.rules.title")}</h2>
            </div>
            <div className="space-y-3 font-body text-foreground">
              <p>📅 {t("hs.rules.freq1")}</p>
              <p>📅 {t("hs.rules.freq2")}</p>
              <p>📅 {t("hs.rules.freq3")}</p>
              <p className="text-muted-foreground mt-2">💤 {t("hs.rules.rest")}</p>
              <div className="mt-4 bg-primary/5 border-l-4 border-primary rounded-r-lg p-4 flex items-start gap-3">
                <Info className="text-primary mt-0.5 shrink-0" size={18} />
                <p className="text-sm font-medium text-foreground/80">{t("hs.rules.progression")}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </SectionWrapper>

      {/* Warm-up */}
      <SectionWrapper className="bg-sand">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl md:text-4xl font-bold mb-8 text-center">{t("hs.warmup.title")}</h2>
          <div className="bg-background rounded-xl border border-border p-4 md:p-6">
            <ExerciseTable exercises={warmup} showRest={false} videoLabel={videoLabel} t={t} />
          </div>
        </div>
      </SectionWrapper>

      {/* Weekly tables */}
      {[1, 2, 3, 4].map((phase) => {
        const phaseWeeks = weeks.filter((w) => w.phase === phase);
        const cfg = phaseConfig[phase];
        return (
          <SectionWrapper key={phase} className={cfg.bg}>
            <div className="max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-10"
              >
                <span className={`inline-block ${cfg.badge} text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3`}>
                  {phaseLabels[phase]}
                </span>
              </motion.div>

              {phaseWeeks.map((week) => (
                <WeekBlock key={week.week} week={week} cfg={cfg} t={t} videoLabel={videoLabel} />
              ))}
            </div>
          </SectionWrapper>
        );
      })}

      {/* Final Test */}
      <SectionWrapper className="bg-ruby-light">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl md:text-4xl font-bold mb-8 text-center">{t("hs.test.title")}</h2>
          <div className="bg-background rounded-xl border border-ruby/30 p-4 md:p-6">
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full min-w-[550px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 font-heading font-bold">{t("hs.test.col.test")}</th>
                    <th className="text-center py-3 px-2 font-heading font-bold w-16">{t("hs.test.col.sets")}</th>
                    <th className="text-center py-3 px-2 font-heading font-bold w-24">{t("hs.test.col.goal")}</th>
                    <th className="text-center py-3 px-2 font-heading font-bold w-20">{t("hs.table.video")}</th>
                    <th className="text-left py-3 px-3 font-heading font-bold">{t("hs.table.details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {finalTest.map((test, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-body font-medium">{test.name}</td>
                      <td className="py-3 px-2 text-center font-body text-muted-foreground">{test.sets}</td>
                      <td className="py-3 px-2 text-center font-body text-muted-foreground">{test.goal}</td>
                      <td className="py-3 px-2 text-center"><VideoButton href={test.video} label={videoLabel} /></td>
                      <td className="py-3 px-3 font-body text-muted-foreground text-xs">{test.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper className="bg-background">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            {t("hs.faq.tag")}
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold">
            {t("hs.faq.title")}
          </h2>
        </div>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-card border border-border rounded-xl px-6"
              >
                <AccordionTrigger className="font-heading text-base font-bold hover:no-underline">
                  {t(`hs.faq.q${i}`)}
                </AccordionTrigger>
                <AccordionContent className="font-body text-muted-foreground leading-relaxed">
                  {t(`hs.faq.a${i}`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SectionWrapper>

      {/* CTA Final */}
      <SectionWrapper className="bg-accent text-accent-foreground">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-6">
            {t("hs.cta.title")}
          </h2>
          <p className="font-body text-lg text-accent-foreground/80 mb-10">
            {t("hs.cta.desc")}
          </p>
          <Button
            variant="default"
            size="xl"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            asChild
          >
            <Link to="/contact">
              {t("hs.cta.btn")} <ArrowRight size={20} />
            </Link>
          </Button>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

const WeekBlock = ({
  week,
  cfg,
  t,
  videoLabel,
}: {
  week: WeekData;
  cfg: { bg: string; border: string; badge: string; text: string };
  t: (key: string) => string;
  videoLabel: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-10"
    >
      <h3 className={`font-heading text-xl md:text-2xl font-bold mb-4 ${cfg.text}`}>
        {t("hs.week")} {week.week} – {t(week.nameKey)}
      </h3>
      <div className={`bg-background rounded-xl border ${cfg.border} p-4 md:p-6`}>
        <ExerciseTable exercises={week.exercises} videoLabel={videoLabel} t={t} />

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent/80 transition-colors cursor-pointer">
            <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
            {t("hs.details.toggle")}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 p-4 bg-muted/30 rounded-lg">
            <p className="font-body text-muted-foreground text-sm">{t("hs.details.placeholder")}</p>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </motion.div>
  );
};

export default HandstandPage;
