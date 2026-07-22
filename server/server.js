require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

app.use(cors());
app.use(express.json());

// يقدّم ملفات الواجهة (public/index.html) من نفس السيرفر
app.use(express.static(path.join(__dirname, '..', 'public')));

/* ---------------- مسار تشخيصي مؤقت — احذفه بعد ما تتأكد إن كل شي شغّال ----------------
   افتحه بالمتصفح: https://your-app.onrender.com/api/_diag */
app.get('/api/_diag', (req, res) => {
  const fs = require('fs');
  const publicDir = path.join(__dirname, '..', 'public');
  let publicFiles = [];
  let publicDirError = null;
  try{ publicFiles = fs.readdirSync(publicDir); }
  catch(e){ publicDirError = e.message; }

  res.json({
    __dirname,
    publicDir,
    publicDirExists: fs.existsSync(publicDir),
    publicFiles,
    publicDirError,
    indexHtmlExists: fs.existsSync(path.join(publicDir, 'index.html')),
    hasDATABASE_URL: !!process.env.DATABASE_URL,
    hasJWT_SECRET: !!process.env.JWT_SECRET,
    nodeVersion: process.version,
    cwd: process.cwd(),
  });
});

/* ---------------- تحويل صفوف قاعدة البيانات لشكل تتوقعه الواجهة ---------------- */
function mapFed(r){
  return {
    id: r.id, nameEn: r.name_en, nameAr: r.name_ar, stream: r.stream,
    tier: r.tier, category: r.category, size: r.size,
    username: r.username, reviewer: r.reviewer,
    // ملاحظة: كلمة المرور لا تُرسل للواجهة أبداً بعد تسجيل الدخول
  };
}
function mapAct(r){
  return {
    id: r.id, fedId: r.federation_id, level3: r.level3, name: r.name, quarter: r.quarter,
    country: r.country, city: r.city, partCat: r.participant_category, classification: r.classification,
    gender: r.gender, staff: r.staff, days: r.days,
    expPlayers: r.expected_players, actPlayers: r.actual_players,
    expGold: r.expected_gold, actGold: r.actual_gold,
    expSilver: r.expected_silver, actSilver: r.actual_silver,
    expBronze: r.expected_bronze, actBronze: r.actual_bronze,
  };
}
function mapFin(r){
  return {
    fedId: r.federation_id, quarter: r.quarter, isBudget: !!r.is_budget,
    level1: r.level1, level2: r.level2, level3: r.level3, level4: r.level4, level5: r.level5,
    amount: Number(r.amount), activityId: r.activity_id,
  };
}

/* ---------------- Middleware: التحقق من التوكن (JWT) ---------------- */
function authenticate(req, res, next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token) return res.status(401).json({error:'مطلوب تسجيل الدخول'});
  try{
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  }catch(e){
    return res.status(401).json({error:'انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجدداً'});
  }
}

/* ---------------- تسجيل دخول اتحاد ---------------- */
app.post('/api/login/federation', async (req, res) => {
  try{
    const { username, password } = req.body || {};
    if(!username || !password) return res.status(400).json({error:'الرجاء إدخال Username وPassword'});

    const { rows } = await pool.query(
      'SELECT id FROM federations WHERE username = $1 AND password = $2 LIMIT 1',
      [username, password]
    );
    if(!rows.length) return res.status(401).json({error:'بيانات الدخول غير صحيحة. تأكد من Username وPassword.'});

    const auth = { role:'fed', fedId: rows[0].id };
    const token = jwt.sign(auth, JWT_SECRET, { expiresIn:'12h' });
    res.json({ token, auth });
  }catch(err){
    console.error(err);
    res.status(500).json({error:'خطأ في السيرفر'});
  }
});

/* ---------------- تسجيل دخول مراجع / مدير ---------------- */
app.post('/api/login/reviewer', async (req, res) => {
  try{
    const { username, password } = req.body || {};
    if(!username || !password) return res.status(400).json({error:'الرجاء إدخال اسم الدخول وكلمة المرور'});

    const { rows } = await pool.query(
      'SELECT name, type FROM reviewers WHERE username = $1 AND password = $2 LIMIT 1',
      [username, password]
    );
    if(!rows.length) return res.status(401).json({error:'بيانات الدخول غير صحيحة. تأكد من اسم الدخول وكلمة المرور.'});

    const isAdmin = /مدير/.test(rows[0].type);
    const auth = isAdmin ? { role:'admin' } : { role:'reviewer', reviewerName: rows[0].name };
    const token = jwt.sign(auth, JWT_SECRET, { expiresIn:'12h' });
    res.json({ token, auth });
  }catch(err){
    console.error(err);
    res.status(500).json({error:'خطأ في السيرفر'});
  }
});

/* ---------------- التحقق من الجلسة الحالية (لتسجيل الدخول التلقائي عند إعادة تحميل الصفحة) ---------------- */
app.get('/api/me', authenticate, (req, res) => {
  res.json({ auth: req.auth });
});

/* ---------------- جلب البيانات (مفلترة حسب صلاحية المستخدم) ---------------- */
app.get('/api/data', authenticate, async (req, res) => {
  try{
    const { role, fedId, reviewerName } = req.auth;
    let fedRows, actRows, finRows;

    if(role === 'admin'){
      fedRows = (await pool.query('SELECT * FROM federations')).rows;
      actRows = (await pool.query('SELECT * FROM activities')).rows;
      finRows = (await pool.query('SELECT * FROM financial')).rows;

    }else if(role === 'fed'){
      fedRows = (await pool.query('SELECT * FROM federations WHERE id = $1', [fedId])).rows;
      actRows = (await pool.query('SELECT * FROM activities WHERE federation_id = $1', [fedId])).rows;
      finRows = (await pool.query('SELECT * FROM financial WHERE federation_id = $1', [fedId])).rows;

    }else if(role === 'reviewer'){
      fedRows = (await pool.query('SELECT * FROM federations WHERE reviewer = $1', [reviewerName])).rows;
      const fedIds = fedRows.map(f=>f.id);
      if(!fedIds.length){ actRows = []; finRows = []; }
      else{
        actRows = (await pool.query('SELECT * FROM activities WHERE federation_id = ANY($1)', [fedIds])).rows;
        finRows = (await pool.query('SELECT * FROM financial WHERE federation_id = ANY($1)', [fedIds])).rows;
      }
    }else{
      return res.status(403).json({error:'صلاحية غير معروفة'});
    }

    res.json({
      fed: fedRows.map(mapFed),
      act: actRows.map(mapAct),
      fin: finRows.map(mapFin),
    });
  }catch(err){
    console.error(err);
    res.status(500).json({error:'تعذّر جلب البيانات من قاعدة البيانات'});
  }
});

/* أي مسار غير معروف (وليس API) يعيد الواجهة (Single Page App) */
app.use((req, res) => {
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'مسار غير موجود'});
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✔ السيرفر يعمل على المنفذ ${PORT} — افتح http://localhost:${PORT}`);
});
