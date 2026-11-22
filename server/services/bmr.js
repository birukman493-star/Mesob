export function bmr({ sex, kg, cm, age }) {
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return sex === "female" ? base - 161 : base + 5;
}

export function activityFactor(activity, rules) {
  return rules.activity_factors[activity] || rules.activity_factors.light;
}
