-- ========================================================
-- منصة التحليل المالي والتشغيلي للاتحادات — هيكل قاعدة البيانات
-- PostgreSQL (متوافق مع Supabase) — الصق هذا كاملاً في SQL Editor واضغط Run
-- ========================================================

CREATE TABLE IF NOT EXISTS federations (
  id                INT PRIMARY KEY,
  name_en           VARCHAR(255) DEFAULT '',
  name_ar           VARCHAR(255) NOT NULL,
  stream            VARCHAR(100) DEFAULT 'غير محدد',
  tier              VARCHAR(50)  DEFAULT '—',
  category          VARCHAR(100) DEFAULT 'غير محدد',
  size              VARCHAR(50)  DEFAULT 'غير محدد',
  username          VARCHAR(100) DEFAULT '',
  password          VARCHAR(255) DEFAULT '',
  reviewer          VARCHAR(255) DEFAULT '',
  UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS activities (
  id                       INT PRIMARY KEY,
  federation_id            INT NOT NULL REFERENCES federations(id) ON DELETE CASCADE,
  level3                   VARCHAR(100) DEFAULT 'غير محدد',
  name                     VARCHAR(255) DEFAULT 'بدون اسم',
  quarter                  VARCHAR(50)  DEFAULT 'غير محدد',
  country                  VARCHAR(150) DEFAULT 'غير محدد',
  city                     VARCHAR(150) DEFAULT 'غير محدد',
  participant_category     VARCHAR(150) DEFAULT 'غير محدد',
  classification           VARCHAR(150) DEFAULT 'غير محدد',
  gender                   VARCHAR(50)  DEFAULT 'غير محدد',
  staff                    INT DEFAULT 0,
  days                     INT DEFAULT 0,
  expected_players         INT DEFAULT 0,
  actual_players           INT DEFAULT 0,
  expected_gold            INT NULL,
  actual_gold              INT NULL,
  expected_silver          INT NULL,
  actual_silver            INT NULL,
  expected_bronze          INT NULL,
  actual_bronze            INT NULL
);
CREATE INDEX IF NOT EXISTS idx_act_fed ON activities (federation_id);

CREATE TABLE IF NOT EXISTS financial (
  id                SERIAL PRIMARY KEY,
  federation_id     INT NOT NULL REFERENCES federations(id) ON DELETE CASCADE,
  quarter           VARCHAR(50) DEFAULT 'غير محدد',
  is_budget         BOOLEAN NOT NULL DEFAULT FALSE,   -- true = موازنة (تقديري)، false = فعلي
  level1            VARCHAR(150) DEFAULT 'غير محدد',
  level2            VARCHAR(150) DEFAULT 'غير محدد',  -- فني / تشغيلي
  level3            VARCHAR(150) DEFAULT 'غير محدد',
  level4            VARCHAR(150) DEFAULT 'غير محدد',
  level5            VARCHAR(150) DEFAULT 'غير محدد',
  amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
  activity_id       INT NULL REFERENCES activities(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_fin_fed ON financial (federation_id);
CREATE INDEX IF NOT EXISTS idx_fin_activity ON financial (activity_id);

CREATE TABLE IF NOT EXISTS reviewers (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,          -- الاسم المعروض (يُطابَق مع عمود federations.reviewer)
  type              VARCHAR(50)  NOT NULL,          -- "مراجع" أو "مدير"
  username          VARCHAR(100) NOT NULL UNIQUE,
  password          VARCHAR(255) NOT NULL
);

-- ========================================================
-- بيانات تجريبية اختيارية للاختبار — احذف هذا القسم إذا كنت سترفع بياناتك الحقيقية مباشرة
-- ========================================================
INSERT INTO federations (id, name_en, name_ar, stream, tier, category, size, username, password, reviewer) VALUES
  (1, 'Football Federation', 'اتحاد كرة القدم', 'Team', 'A', 'كبير', 'XL', 'user1', 'pass1', 'فيصل الحماد'),
  (2, 'Swimming Federation', 'اتحاد السباحة', 'Individual', 'B', 'متوسط', 'M', 'user2', 'pass2', 'فيصل الحماد'),
  (3, 'Judo Federation', 'اتحاد الجودو', 'Individual', 'B', 'صغير', 'S', 'user3', 'pass3', 'رغد الغامدي')
ON CONFLICT (id) DO NOTHING;

INSERT INTO reviewers (name, type, username, password) VALUES
  ('فيصل الحماد', 'مراجع', 'f', '123456'),
  ('رغد الغامدي', 'مدير', 'r', '111111')
ON CONFLICT (username) DO NOTHING;
