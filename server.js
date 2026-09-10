const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD)) {
  throw new Error('DATABASE_URL, SESSION_SECRET and ADMIN_PASSWORD are required in production.');
}
if (isProduction && process.env.ADMIN_PASSWORD === 'change-this-password') {
  throw new Error('Change ADMIN_PASSWORD before deploying to production.');
}

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && isProduction ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/admin', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

const AUTH_COOKIE = 'starling_admin';
const AUTH_MAX_AGE = 1000 * 60 * 60 * 8;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}
function signToken(username) {
  const payload = base64url(JSON.stringify({ username, exp: Date.now() + AUTH_MAX_AGE }));
  const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret-change-me').update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function verifyToken(token) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature) return null;
    const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret-change-me').update(payload).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.username || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}
function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
function currentAdmin(req) {
  return verifyToken(getCookie(req, AUTH_COOKIE));
}
function auth(req, res, next) {
  const admin = currentAdmin(req);
  if (admin) {
    req.admin = admin;
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}
function validUrl(value) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}
function coverData(file) {
  if (!file) return '';
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}
function publicNovel(row) {
  return {
    ...row,
    genres: row.genres ? row.genres.split(',').map(x => x.trim()).filter(Boolean) : []
  };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS novels (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      genres TEXT DEFAULT '',
      status TEXT DEFAULT 'Ongoing',
      synopsis TEXT DEFAULT '',
      patreon_url TEXT NOT NULL,
      cover TEXT DEFAULT '',
      badge TEXT DEFAULT '',
      main_chapters INTEGER DEFAULT 0,
      extra_chapters INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add newer fields to existing installations without deleting existing data.
  await pool.query(`ALTER TABLE novels ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE novels ADD COLUMN IF NOT EXISTS main_chapters INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE novels ADD COLUMN IF NOT EXISTS extra_chapters INTEGER DEFAULT 0`);

}

async function getNovels() {
  const { rows } = await pool.query('SELECT * FROM novels ORDER BY id DESC');
  return rows.map(publicNovel);
}

app.get('/api/novels', async (_, res) => {
  try {
    res.json(await getNovels());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load novels.' });
  }
});


app.get('/api/auth/status', (req, res) => {
  const admin = currentAdmin(req);
  res.json({ loggedIn: !!admin, username: admin?.username || null });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || '';
    if (username !== adminUser || !adminPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const passwordOk = await bcrypt.compare(password || '', await bcrypt.hash(adminPassword, 12));
    if (!passwordOk) return res.status(401).json({ error: 'Invalid username or password' });

    const token = signToken(username);
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_MAX_AGE
    });
    return res.json({ ok: true, username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});

app.post('/api/novels', auth, upload.single('cover'), async (req, res) => {
  try {
    const { title, author, genres, status, synopsis, patreon_url, badge, main_chapters, extra_chapters } = req.body;
    if (!title?.trim() || !validUrl(patreon_url)) {
      return res.status(400).json({ error: 'Title and a valid Patreon URL are required.' });
    }
    const cover = coverData(req.file);
    const allowedBadges = ['', 'HOT', 'NEW'];
    const cleanBadge = allowedBadges.includes(String(badge || '').toUpperCase()) ? String(badge || '').toUpperCase() : '';
    const cleanMainChapters = Math.max(0, parseInt(main_chapters, 10) || 0);
    const cleanExtraChapters = Math.max(0, parseInt(extra_chapters, 10) || 0);
    const { rows } = await pool.query(
      `INSERT INTO novels(title,author,genres,status,synopsis,patreon_url,cover,badge,main_chapters,extra_chapters)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [title.trim(), author?.trim() || '', genres || '', status || 'Ongoing', synopsis?.trim() || '', patreon_url.trim(), cover, cleanBadge, cleanMainChapters, cleanExtraChapters]
    );
    res.json({ ok: true, id: rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create novel.' });
  }
});

app.put('/api/novels/:id', auth, upload.single('cover'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM novels WHERE id=$1', [req.params.id]);
    const old = rows[0];
    if (!old) return res.status(404).json({ error: 'Novel not found' });
    const { title, author, genres, status, synopsis, patreon_url, badge, main_chapters, extra_chapters } = req.body;
    if (!title?.trim() || !validUrl(patreon_url)) {
      return res.status(400).json({ error: 'Title and a valid Patreon URL are required.' });
    }
    const cover = req.file ? coverData(req.file) : old.cover;
    const allowedBadges = ['', 'HOT', 'NEW'];
    const cleanBadge = allowedBadges.includes(String(badge || '').toUpperCase()) ? String(badge || '').toUpperCase() : '';
    const cleanMainChapters = Math.max(0, parseInt(main_chapters, 10) || 0);
    const cleanExtraChapters = Math.max(0, parseInt(extra_chapters, 10) || 0);
    await pool.query(
      `UPDATE novels SET title=$1, author=$2, genres=$3, status=$4, synopsis=$5,
       patreon_url=$6, cover=$7, badge=$8, main_chapters=$9, extra_chapters=$10, updated_at=NOW() WHERE id=$11`,
      [title.trim(), author?.trim() || '', genres || '', status || 'Ongoing', synopsis?.trim() || '', patreon_url.trim(), cover, cleanBadge, cleanMainChapters, cleanExtraChapters, req.params.id]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update novel.' });
  }
});

app.delete('/api/novels/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM novels WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Novel not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete novel.' });
  }
});


initDb()
  .then(() => app.listen(PORT, () => console.log(`Starling Translations running on port ${PORT}`)))
  .catch(error => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
