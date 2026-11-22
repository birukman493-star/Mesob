CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  name_norm VARCHAR(120) NOT NULL,
  age TINYINT UNSIGNED NULL,
  pin_hash VARCHAR(100) NOT NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(30) NULL,
  role ENUM('user','dietitian','admin') DEFAULT 'user',
  language ENUM('en','am','om') DEFAULT 'en',
  category ENUM('patient','pregnancy','weight_loss','weight_gain','gym','children') NULL,
  support_mode ENUM('ai','consultancy','both') DEFAULT 'ai',
  trial_start DATE NOT NULL,
  subscription_status ENUM('trial','active','free') DEFAULT 'trial',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_name_age (name_norm, age)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  user_id INT PRIMARY KEY,
  sex ENUM('male','female') NULL,
  height_cm DECIMAL(5,1) NULL,
  weight_kg DECIMAL(5,1) NULL,
  goal_weight_kg DECIMAL(5,1) NULL,
  activity ENUM('sedentary','light','moderate','active','very_active') DEFAULT 'light',
  conditions JSON NULL,
  trimester TINYINT NULL,
  allergies JSON NULL,
  budget_per_day DECIMAL(8,2) NULL,
  region VARCHAR(60) NULL,
  orthodox_fasting BOOLEAN DEFAULT FALSE,
  ramadan_mode BOOLEAN DEFAULT FALSE,
  child_data JSON NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(100) NOT NULL,
  name_am VARCHAR(100) NULL,
  name_om VARCHAR(100) NULL,
  meal_types SET('breakfast','lunch','snack','dinner','suhoor','iftar') NOT NULL,
  is_fasting_ok BOOLEAN NOT NULL DEFAULT FALSE,
  region VARCHAR(60) NULL,
  cost_birr DECIMAL(8,2) NOT NULL DEFAULT 0,
  portion_unit VARCHAR(30) NOT NULL,
  portion_grams DECIMAL(7,1) NOT NULL,
  kcal DECIMAL(7,1) NOT NULL,
  protein_g DECIMAL(6,1) NOT NULL,
  carbs_g DECIMAL(6,1) NOT NULL,
  fat_g DECIMAL(6,1) NOT NULL,
  fiber_g DECIMAL(6,1) NOT NULL DEFAULT 0,
  sodium_mg DECIMAL(7,1) NOT NULL DEFAULT 0,
  iron_mg DECIMAL(6,2) NOT NULL DEFAULT 0,
  calcium_mg DECIMAL(7,1) NOT NULL DEFAULT 0,
  vit_a_ug DECIMAL(7,1) NOT NULL DEFAULT 0,
  folate_ug DECIMAL(7,1) NOT NULL DEFAULT 0,
  glycemic_level ENUM('low','medium','high') NULL,
  allergens JSON NULL,
  ingredients JSON NULL,
  recipe TEXT NULL,
  impact_en TEXT NULL,
  source VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  week_start DATE NOT NULL,
  mode ENUM('standard','ramadan') NOT NULL DEFAULT 'standard',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_plans_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NOT NULL,
  day_index TINYINT NOT NULL,
  meal_type VARCHAR(20) NOT NULL,
  food_id INT NOT NULL,
  portions DECIMAL(4,2) NOT NULL DEFAULT 1,
  FOREIGN KEY (plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (food_id) REFERENCES foods(id),
  INDEX idx_items_plan (plan_id, day_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS food_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  food_id INT NOT NULL,
  portions DECIMAL(4,2) NOT NULL,
  logged_at DATETIME NOT NULL,
  source ENUM('manual','scan','plan','voice') NOT NULL DEFAULT 'manual',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (food_id) REFERENCES foods(id),
  INDEX idx_logs_user_date (user_id, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS water_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ml INT NOT NULL,
  logged_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_water_user (user_id, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS weight_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  weight_kg DECIMAL(5,1) NOT NULL,
  logged_at DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS growth_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  age_months SMALLINT NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  height_cm DECIMAL(5,1) NOT NULL,
  logged_at DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_chat_user (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  dietitian_id INT NULL,
  status ENUM('requested','accepted','done') DEFAULT 'requested',
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (dietitian_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consent_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  dietitian_id INT NOT NULL,
  scope JSON NULL,
  granted_at DATETIME NOT NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (dietitian_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guideline_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  audience VARCHAR(60) NOT NULL,
  min_age_months INT NULL,
  max_age_months INT NULL,
  body MEDIUMTEXT NOT NULL,
  source VARCHAR(200) NULL,
  reviewed_by VARCHAR(120) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ramadan_periods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year SMALLINT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  suhoor_time TIME NOT NULL,
  iftar_time TIME NOT NULL,
  region VARCHAR(60) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
