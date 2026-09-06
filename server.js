const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const multer = require('multer');
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

app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

let adminHash;

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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'change-this-password', 12);
}

function auth(req, res, next) {
  if (req.session.admin) return next();
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

function publicNovel(row) {
  return {
    ...row,
    genres: row.genres
      ? row.genres.split(',').map(x => x.trim()).filter(Boolean)
      : []
  };
}

function coverData(file) {
  if (!file) return '';
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

app.get('/api/novels', async (_, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM novels ORDER BY id DESC');
    res.json(rows.map(publicNovel));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load novels.' });
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    loggedIn: !!req.session.admin,
    username: req.session.admin?.username || null
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const adminUser = process.env.ADMIN_USERNAME || 'admin';

    if (username === adminUser && await bcrypt.compare(password || '', adminHash)) {
      req.session.admin = { username };
      return req.session.save(() => res.json({ ok: true }));
    }

    res.status(401).json({ error: 'Invalid username or password' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/auth/logout', auth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post('/api/novels', auth, upload.single('cover'), async (req, res) => {
  try {
    const { title, author, genres, status, synopsis, patreon_url } = req.body;

    if (!title?.trim() || !validUrl(patreon_url)) {
      return res.status(400).json({ error: 'Title and a valid Patreon URL are required.' });
    }

    const cover = coverData(req.file);
    const { rows } = await pool.query(
      `INSERT INTO novels(title,author,genres,status,synopsis,patreon_url,cover)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        title.trim(),
        author?.trim() || '',
        genres || '',
        status || 'Ongoing',
        synopsis?.trim() || '',
        patreon_url.trim(),
        cover
      ]
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

    const { title, author, genres, status, synopsis, patreon_url } = req.body;

    if (!title?.trim() || !validUrl(patreon_url)) {
      return res.status(400).json({ error: 'Title and a valid Patreon URL are required.' });
    }

    const cover = req.file ? coverData(req.file) : old.cover;

    await pool.query(
      `UPDATE novels
       SET title=$1, author=$2, genres=$3, status=$4, synopsis=$5,
           patreon_url=$6, cover=$7, updated_at=NOW()
       WHERE id=$8`,
      [
        title.trim(),
        author?.trim() || '',
        genres || '',
        status || 'Ongoing',
        synopsis?.trim() || '',
        patreon_url.trim(),
        cover,
        req.params.id
      ]
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

app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Starling Translations running on port ${PORT}`));
  })
  .catch(error => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
