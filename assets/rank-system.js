(function () {
  "use strict";

  const TIERS = Object.freeze([
    Object.freeze({ grade: "SSS", minimumExclusive: 97, bonus: 150 }),
    Object.freeze({ grade: "A", minimumExclusive: 90, bonus: 100 }),
    Object.freeze({ grade: "B", minimumExclusive: 80, bonus: 90 }),
    Object.freeze({ grade: "C", minimumExclusive: 70, bonus: 80 }),
    Object.freeze({ grade: "D", minimumExclusive: 60, bonus: 0 }),
    Object.freeze({ grade: "E", minimumExclusive: 50, bonus: 0 }),
    Object.freeze({ grade: "F", minimumExclusive: 40, bonus: 0 }),
    Object.freeze({ grade: "G", minimumExclusive: 30, bonus: 0 }),
    Object.freeze({ grade: "H", minimumExclusive: 20, bonus: 0 }),
    Object.freeze({ grade: "I", minimumExclusive: 10, bonus: 0 }),
    Object.freeze({ grade: "J", minimumExclusive: null, bonus: 0 })
  ]);

  const MESSAGES = Object.freeze({
    SSS: {
      heading: "Exceptional work!",
      message: "You reached the highest rank. Keep challenging yourself and maintain that outstanding accuracy."
    },
    A: {
      heading: "Excellent work!",
      message: "You earned an A. Aim above 97% next time to reach SSS."
    },
    B: {
      heading: "Great work!",
      message: "You earned a B. Keep practising and aim above 90% to reach A."
    },
    C: {
      heading: "Good progress!",
      message: "You earned a C and unlocked a completion bonus. Keep going and aim above 80% to reach B."
    },
    D: {
      heading: "You're making progress!",
      message: "Keep building your skills. Aim above 70% to reach C and unlock an 80-point completion bonus."
    },
    E: {
      heading: "Keep moving forward!",
      message: "Every practice helps you improve. Review your mistakes and aim above 70% to reach C and unlock an 80-point completion bonus."
    },
    F: {
      heading: "Your next step starts here.",
      message: "Keep practising and learn from each correction. Aim above 70% to reach C and unlock an 80-point completion bonus."
    },
    G: {
      heading: "Don't give up!",
      message: "Progress comes from practice. Review the explanations and aim above 70% to reach C and unlock an 80-point completion bonus."
    },
    H: {
      heading: "Every attempt counts.",
      message: "Keep going one question at a time. Aim above 70% to reach C and unlock an 80-point completion bonus."
    },
    I: {
      heading: "Keep building your skills.",
      message: "A new attempt is a fresh opportunity. Aim above 70% to reach C and unlock an 80-point completion bonus."
    },
    J: {
      heading: "Your learning journey starts here.",
      message: "Use the feedback to guide your next attempt. Aim above 70% to reach C and unlock an 80-point completion bonus."
    }
  });

  function fromPercentage(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const percentage = Math.max(0, Math.min(100, numeric));
    const tier = TIERS.find(item =>
      item.minimumExclusive === null || percentage > item.minimumExclusive
    ) || TIERS[TIERS.length - 1];
    const copy = MESSAGES[tier.grade];

    return Object.freeze({
      grade: tier.grade,
      percentage,
      bonus: tier.bonus,
      heading: copy.heading,
      message: copy.message,
      bonusMessage: tier.bonus > 0
        ? "You earned +" + tier.bonus + " bonus avatar points for this " + tier.grade + " result."
        : "No completion bonus at this rank. Points for correct answers still count."
    });
  }

  function fromScore(score, total) {
    const earned = Number(score);
    const possible = Number(total);
    if (!Number.isFinite(earned) || !Number.isFinite(possible) || possible <= 0) return null;
    return fromPercentage((earned / possible) * 100);
  }

  const thresholdLabel = "SSS >97 · A >90 · B >80 · C >70 · D >60 · E >50 · F >40 · G >30 · H >20 · I >10 · J ≤10";
  const bonusLabel = "Completion bonuses: SSS +150 · A +100 · B +90 · C +80 · D–J +0";

  window.RaisingDiamondsRanks = Object.freeze({
    tiers: TIERS,
    fromPercentage,
    fromScore,
    thresholdLabel,
    bonusLabel
  });
})();