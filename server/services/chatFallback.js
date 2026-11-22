const NOTICES = {
  en: null,
  am: "ይህ ምርመራ አይደለም። እባክዎ ሐኪም ወይም የአመጋገብ ባለሙያ ያማክሩ።",
  om: "Kun qorannoo miti. Maaloo doktora yookiin ogeessa nyaataa mariifadhaa.",
};

function findFood(context, pattern) {
  return (context.foods || []).find((food) => pattern.test(food.name_en || "") || pattern.test(food.name_am || "") || pattern.test(food.name_om || ""));
}

function foodName(food, lang) {
  if (!food) return "";
  if (lang === "om" && food.name_om) return food.name_om;
  if (lang === "am" && food.name_am) return food.name_am;
  return food.name_en || "";
}

function needsNotice(message, context) {
  const text = `${message} ${context.category || ""} ${(context.conditions || []).join(" ")}`.toLowerCase();
  return (
    ["patient", "pregnancy", "children"].includes(context.category) ||
    (context.conditions || []).length > 0 ||
    /diabet|pregnan|child|hypertens|blood pressure|fast|sukkaar|dhibee|ulfa|da'ima/.test(text)
  );
}

export function fallbackReply(message, context, lang = "en") {
  const msg = String(message || "").toLowerCase();
  const foods = context.foods || [];
  const targets = context.targets || {};
  const remaining = context.remaining || {};
  const injera = findFood(context, /injera|biddeena|እንጀራ/i);
  let reply = "";

  const isOm = lang === "om";
  const isAm = lang === "am";

  if ((msg.includes("injera") || msg.includes("biddeena") || msg.includes("እንጀራ")) && (msg.includes("diabet") || msg.includes("sukkaar") || msg.includes("ስኳር"))) {
    if (!injera) {
      reply = isOm
        ? "Injeeraan tarree soorata keessatti hin jiru, kanaaf lakkoofsa soorataa isaa ibsuu hin danda'u."
        : isAm
        ? "እንጀራ በምግብ ዝርዝሩ ውስጥ ስለሌለ የስነ-ምግብ መጠኑን መጥቀስ አልችልም።"
        : "Injera is not in the food list I was given, so I cannot quote its nutrition numbers.";
    } else {
      const name = foodName(injera, lang);
      reply = isOm
        ? `Injeeraan karoora soorata dhibee sukkaaraa tokko tokko keessatti dabalatamuu danda'a. ${name} ${injera.portion_unit} tokko (${injera.portion_grams} g) keessatti ${injera.kcal} kcal, kaarboohayidireetii ${injera.carbs_g} g, borootiinii ${injera.protein_g} g, fi cooma ${injera.fat_g} g qaba. Kaarboohayidireetiin har'a hafe: ${remaining.carbs_g || 0} g (kaayyoo ${targets.carbs_g || 0} g keessaa).`
        : isAm
        ? `እንጀራ ለስኳር ታማሚዎች አመጋገብ ውስጥ ሊካተት ይችላል። አንድ ${injera.portion_unit} (${injera.portion_grams} ግራም) ${injera.kcal} ካሎሪ፣ ${injera.carbs_g} ግራም ካርቦሃይድሬት፣ ${injera.protein_g} ግራም ፕሮቲን እና ${injera.fat_g} ግራም ቅባት ይዟል። ዛሬ የቀረው ካርቦሃይድሬት: ${remaining.carbs_g || 0} ግራም (ከ ${targets.carbs_g || 0} ግራም ኢላማ ውስጥ)።`
        : `Injera can be included in some diabetes meal plans. One ${injera.portion_unit} (${injera.portion_grams} g) contains ${injera.kcal} kcal, ${injera.carbs_g} g carbohydrate, ${injera.protein_g} g protein, and ${injera.fat_g} g fat. Your remaining carbohydrate today is ${remaining.carbs_g} g of a ${targets.carbs_g} g target. Portion size and the rest of the day's carbohydrate matter.`;
    }
  } else if (msg.includes("protein") || msg.includes("borootiin") || msg.includes("ፕሮቲን")) {
    const food = foods[0];
    const name = foodName(food, lang);
    if (isOm) {
      reply = food
        ? `Kaayyoon borootiinii keessan har'aa ${targets.protein_g || 0} g dha, ${remaining.protein_g || 0} g hafeera. ${name} ${food.portion_unit} tokko keessatti borootiinii ${food.protein_g} g qaba.`
        : `Kaayyoon borootiinii keessan har'aa ${targets.protein_g || 0} g dha, ${remaining.protein_g || 0} g hafeera.`;
    } else if (isAm) {
      reply = food
        ? `የዛሬ የፕሮቲን ኢላማዎ ${targets.protein_g || 0} ግራም ሲሆን ${remaining.protein_g || 0} ግራም ይቀራል። ${name} በአንድ ${food.portion_unit} ${food.protein_g} ግራም ፕሮቲን ይዟል።`
        : `የዛሬ የፕሮቲን ኢላማዎ ${targets.protein_g || 0} ግራም ሲሆን ${remaining.protein_g || 0} ግራም ይቀራል።`;
    } else {
      reply = food
        ? `Your protein target is ${targets.protein_g} g today, with ${remaining.protein_g} g still open. ${food.name_en} is listed at ${food.protein_g} g protein per ${food.portion_unit}.`
        : `Your protein target is ${targets.protein_g} g today, with ${remaining.protein_g} g still open.`;
    }
  } else if (msg.includes("salt") || msg.includes("sodium") || msg.includes("pressure") || msg.includes("soogidda") || msg.includes("ጨው") || msg.includes("ሶዲየም")) {
    reply = isOm
      ? `Hangi soodiyeemii (soogiddaa) eeyyamame guyyaatti ${targets.sodium_mg || 0} mg dha.`
      : isAm
      ? `ለዚህ ፕሮፋይል የተቀመጠው ከፍተኛ የሶዲየም መጠን በቀን ${targets.sodium_mg || 0} ሚ.ግ ነው።`
      : `The sodium cap saved for this profile is ${targets.sodium_mg} mg per day. A food is flagged in the rules when one portion is above the configured sodium flag.`;
  } else if (msg.includes("ramadan") || msg.includes("suhoor") || msg.includes("iftar") || msg.includes("soomana") || msg.includes("ረመዳን")) {
    if (isOm) {
      const times = context.ramadan
        ? ` Sa'aatii: suxuurii ${context.ramadan.suhoor_time}, ifxaara ${context.ramadan.iftar_time}.`
        : "";
      reply = `Karoorri Ramadaanaa suxuurii, ifxaara fi soorata galgalaa fayyadama.${times}`;
    } else if (isAm) {
      const times = context.ramadan
        ? ` ሰዓት: ሱሁር ${context.ramadan.suhoor_time}፣ ኢፍጣር ${context.ramadan.iftar_time}።`
        : "";
      reply = `የረመዳን እቅዶች ሱሁር፣ ኢፍጣር እና የምሽት መክሰስን ያካትታሉ።${times}`;
    } else {
      const times = context.ramadan
        ? ` Admin times on file: suhoor ${context.ramadan.suhoor_time}, iftar ${context.ramadan.iftar_time}.`
        : " No Ramadan clock times are stored yet.";
      reply = `Ramadan plans use suhoor, iftar, and an evening snack.${times} ${context.reminder || ""}`.trim();
    }
  } else if (msg.includes("budget") || msg.includes("ingredient") || msg.includes("birr") || msg.includes("qarshii") || msg.includes("ብር")) {
    const food = foods[0];
    const name = foodName(food, lang);
    if (isOm) {
      reply = food
        ? `Baajanni soorata guyyaa keessanii ${context.budget_per_day ?? "hin murtoofne"} birr dha. ${name} ${food.portion_unit} tokko ${food.cost_birr} birr, kaalorii ${food.kcal} kcal qaba.`
        : `Baajanni soorata guyyaa keessanii ${context.budget_per_day ?? "hin murtoofne"} birr dha.`;
    } else if (isAm) {
      reply = food
        ? `የዕለቱ የምግብ በጀትዎ ${context.budget_per_day ?? "አልተወሰነም"} ብር ነው። ${name} በአንድ ${food.portion_unit} ${food.cost_birr} ብር ሲሆን ${food.kcal} ካሎሪ አለው።`
        : `የዕለቱ የምግብ በጀትዎ ${context.budget_per_day ?? "አልተወሰነም"} ብር ነው።`;
    } else {
      reply = food
        ? `Your daily food budget is ${context.budget_per_day ?? "not set"} birr. ${food.name_en} is listed at ${food.cost_birr} birr per ${food.portion_unit}, with ${food.kcal} kcal.`
        : `Your daily food budget is ${context.budget_per_day ?? "not set"} birr. I do not have a matching dish in the current food list.`;
    }
  } else if ((msg.includes("what") || msg.includes("maal") || msg.includes("ምን")) && (msg.includes("eat") || msg.includes("meal") || msg.includes("nyaadhu") || msg.includes("ልብላ"))) {
    const names = foods.slice(0, 3).map((food) => `${foodName(food, lang)} (${food.kcal} kcal)`);
    if (isOm) {
      reply = names.length
        ? `Nyaatawwan karoora keessan keessaa: ${names.join(", ")}. Kaalorii har'a hafe: ${remaining.kcal || 0} kcal.`
        : "Nyaanni walsimu tarree keessatti hin argamne.";
    } else if (isAm) {
      reply = names.length
        ? `ከተመደቡልዎት ምግቦች መካከል: ${names.join(", ")}። ዛሬ የቀረ ካሎሪ: ${remaining.kcal || 0} ካሎሪ።`
        : "ተስማሚ ምግብ በዝርዝሩ ውስጥ አልተገኘም።";
    } else {
      reply = names.length
        ? `From the foods already calculated for you: ${names.join(", ")}. Calories still open today: ${remaining.kcal} kcal.`
        : "I do not have candidate foods in the context, so I cannot suggest a dish.";
    }
  } else if (injera && (msg.includes("injera") || msg.includes("biddeena") || msg.includes("እንጀራ"))) {
    const name = foodName(injera, lang);
    reply = isOm
      ? `${name} ${injera.portion_unit} tokko ${injera.kcal} kcal fi kaarboohayidireetii ${injera.carbs_g} g qaba. Kaalorii har'a hafe: ${remaining.kcal || 0} kcal.`
      : isAm
      ? `አንድ ${injera.portion_unit} ${name} ${injera.kcal} ካሎሪ እና ${injera.carbs_g} ግራም ካርቦሃይድሬት አለው። ዛሬ የቀረ ካሎሪ: ${remaining.kcal || 0} ካሎሪ።`
      : `One ${injera.portion_unit} of injera is listed at ${injera.kcal} kcal and ${injera.carbs_g} g carbohydrate. Remaining calories today: ${remaining.kcal} kcal.`;
  } else if (foods.length) {
    const food = foods[0];
    const name = foodName(food, lang);
    reply = isOm
      ? `Odeeffannoo soorata database keessan keessaa: ${name} (${food.portion_unit} tokko): ${food.kcal} kcal, borootiinii ${food.protein_g} g, kaarboohayidireetii ${food.carbs_g} g. Kaalorii har'a hafe: ${remaining.kcal || 0} kcal.`
      : isAm
      ? `ከተመዘገቡት ምግቦች ውስጥ: ${name} (በአንድ ${food.portion_unit}): ${food.kcal} ካሎሪ፣ ${food.protein_g} ግራም ፕሮቲን፣ ${food.carbs_g} ግራም ካርቦሃይድሬት። ዛሬ የቀረ ካሎሪ: ${remaining.kcal || 0} ካሎሪ።`
      : `I can explain foods already in your plan and database. ${food.name_en}: ${food.kcal} kcal, ${food.protein_g} g protein, ${food.carbs_g} g carbohydrate, ${food.fat_g} g fat per ${food.portion_unit}. Remaining today: ${remaining.kcal} kcal.`;
  } else {
    reply = isOm
      ? "Gaaffii kanaaf odeeffannoo soorataa ammaa keessaa deebii hin arganne."
      : isAm
      ? "ለዚህ ጥያቄ አሁን ባለው የምግብ መረጃ ውስጥ መልስ አልተገኘም።"
      : "I do not have that answer in the current nutrition context.";
  }

  if (needsNotice(message, context)) {
    const notice = NOTICES[lang] || context.notice;
    if (notice && !reply.includes(notice)) reply = `${reply} ${notice}`;
    if (lang === "en" && context.notice && !reply.includes(context.notice)) {
      reply = `${reply} ${context.notice}`;
    }
  }
  return reply.trim();
}
