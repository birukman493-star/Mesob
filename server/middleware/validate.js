import { z } from "zod";

export const pinSchema = z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits");

export const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  age: z.coerce.number().int().min(1).max(120).optional(),
  pin: pinSchema,
  language: z.enum(["en", "am", "om"]).default("en"),
  email: z.string().email().optional().or(z.literal("")).nullable().optional(),
  phone: z.string().max(30).optional().or(z.literal("")).nullable().optional(),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(2).max(160).optional(),
  email: z.string().max(160).optional().or(z.literal("")).nullable(),
  phone: z.string().max(30).optional().or(z.literal("")).nullable(),
  full_name: z.string().trim().max(120).optional(),
  pin: pinSchema,
});

export const categorySchema = z.object({
  category: z.enum(["patient", "pregnancy", "weight_loss", "weight_gain", "gym", "children"]),
  support_mode: z.enum(["ai", "consultancy", "both"]).default("ai"),
});

export const languageSchema = z.object({
  language: z.enum(["en", "am", "om"]),
});

export const profileSchema = z.object({
  age: z.coerce.number().int().min(1).max(120).nullable().optional(),
  sex: z.enum(["male", "female"]).nullable().optional(),
  height_cm: z.coerce.number().positive().max(250).nullable().optional(),
  weight_kg: z.coerce.number().positive().max(350).nullable().optional(),
  goal_weight_kg: z.coerce.number().positive().max(350).nullable().optional(),
  activity: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
  conditions: z.array(z.string().max(40)).max(8).optional(),
  trimester: z.coerce.number().int().min(1).max(3).nullable().optional(),
  allergies: z.array(z.string().max(40)).max(12).optional(),
  budget_per_day: z.coerce.number().min(0).max(100000).nullable().optional(),
  region: z.string().max(60).nullable().optional(),
  orthodox_fasting: z.boolean().optional(),
  ramadan_mode: z.boolean().optional(),
  child_data: z
    .object({
      child_age_months: z.coerce.number().int().min(0).max(216),
      weight_kg: z.coerce.number().positive().max(200).optional(),
      height_cm: z.coerce.number().positive().max(220).optional(),
    })
    .nullable()
    .optional(),
});

export const logSchema = z.object({
  food_id: z.coerce.number().int().positive(),
  portions: z.coerce.number().positive().max(10),
  source: z.enum(["manual", "scan", "plan", "voice"]).default("manual"),
});

export const waterSchema = z.object({ ml: z.coerce.number().int().positive().max(4000) });
export const weightSchema = z.object({ weight_kg: z.coerce.number().positive().max(350) });
export const growthSchema = z.object({
  age_months: z.coerce.number().int().min(0).max(216),
  weight_kg: z.coerce.number().positive().max(200),
  height_cm: z.coerce.number().positive().max(220),
});

export const planSchema = z.object({
  mode: z.enum(["standard", "ramadan"]).optional(),
  seed: z.coerce.number().int().optional(),
});

const languageCode = z.enum(["en", "am", "om"]);

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  language: languageCode.optional(),
  lang: languageCode.optional(),
});

export const speakSchema = z.object({
  text: z.string().trim().min(1).max(1500),
  language: languageCode.optional(),
  lang: languageCode.optional(),
});

export const recipeSchema = z.object({
  ingredients: z.array(z.string().max(40)).max(20).default([]),
  budget: z.coerce.number().min(0).max(100000).nullable().optional(),
  meal_type: z.enum(["breakfast", "lunch", "snack", "dinner", "suhoor", "iftar"]).nullable().optional(),
});

export const consultSchema = z.object({
  dietitian_id: z.coerce.number().int().positive().nullable().optional(),
  note: z.string().max(1000).optional(),
});

export const consentSchema = z.object({
  dietitian_id: z.coerce.number().int().positive(),
  grant: z.boolean(),
  scope: z.array(z.string()).optional(),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
});

export const checkoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const foodWriteSchema = z.object({
  name_en: z.string().trim().min(2).max(100),
  name_am: z.string().max(100).optional().nullable(),
  name_om: z.string().max(100).optional().nullable(),
  meal_types: z.array(z.enum(["breakfast", "lunch", "snack", "dinner", "suhoor", "iftar"])).min(1),
  is_fasting_ok: z.boolean().default(false),
  region: z.string().max(60).optional().nullable(),
  cost_birr: z.coerce.number().min(0),
  portion_unit: z.string().min(1).max(30),
  portion_grams: z.coerce.number().positive(),
  kcal: z.coerce.number().min(0),
  protein_g: z.coerce.number().min(0),
  carbs_g: z.coerce.number().min(0),
  fat_g: z.coerce.number().min(0),
  fiber_g: z.coerce.number().min(0).default(0),
  sodium_mg: z.coerce.number().min(0).default(0),
  iron_mg: z.coerce.number().min(0).default(0),
  calcium_mg: z.coerce.number().min(0).default(0),
  vit_a_ug: z.coerce.number().min(0).default(0),
  folate_ug: z.coerce.number().min(0).default(0),
  glycemic_level: z.enum(["low", "medium", "high"]).nullable().optional(),
  allergens: z.array(z.string()).default([]),
  ingredients: z.array(z.string()).default([]),
  recipe: z.string().max(2000).optional().nullable(),
  impact_en: z.string().max(2000).optional().nullable(),
  source: z.string().min(3).max(200),
});

export const rulesSchema = z.object({
  activity_factors: z.record(z.number()),
  goal_factors: z.record(z.number()),
  meal_splits: z.record(z.record(z.number())),
  diabetes: z.object({
    main_meal_carb_min_ratio: z.number(),
    main_meal_carb_max_ratio: z.number(),
    injera_max_portions: z.number(),
  }).passthrough(),
  child_age_bands: z.array(z.object({
    min_months: z.number(),
    max_months: z.number(),
    kcal: z.number(),
  }).passthrough()).min(1),
}).passthrough();

export const ramadanSchema = z.object({
  periods: z.array(z.object({
    year: z.coerce.number().int(),
    starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    suhoor_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    iftar_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    region: z.string().max(60).optional().nullable(),
  })),
});

export const subscriptionPatchSchema = z.object({
  subscription_status: z.enum(["trial", "active", "free"]),
});

export const consultUpdateSchema = z.object({
  status: z.enum(["accepted", "done"]),
  note: z.string().max(1000).optional(),
});

export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "VALIDATION", message: parsed.error.issues[0]?.message || "Invalid request." },
      });
    }
    req.body = parsed.data;
    return next();
  };
}
