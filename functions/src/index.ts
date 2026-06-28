import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ── HELPERS ──────────────────────────────────────────────────────────────────

function parseTweetsFromResponse(data: any): any[] {
  const tweets: any[] = [];
  try {
    const topEntries = data?.body?.entries || data?.entries || [];
    for (const group of topEntries) {
      for (const entry of (group?.entries || [])) {
        const itemContent = entry?.content?.itemContent ?? entry?.itemContent;
        const tweetResult = itemContent?.tweet_results?.result;
        if (!tweetResult || tweetResult.__typename !== 'Tweet') continue;
        const tweet = tweetResult.legacy;
        const user = tweetResult.core?.user_results?.result;
        const userLegacy = user?.legacy;
        if (!tweet || !userLegacy) continue;
        if (tweet.full_text?.startsWith('RT @')) continue;
        const sn = userLegacy.screen_name.toLowerCase();
        const avatarUrl = (
          userLegacy.profile_image_url_https ||
          userLegacy.profile_image_url ||
          user?.legacy?.profile_image_url_https ||
          ''
        ).replace('_normal.jpg', '_400x400.jpg').replace('_normal.png', '_400x400.png');
        tweets.push({
          tweet_id: tweetResult.rest_id || tweet.id_str || '',
          user_id: sn,
          display_name: userLegacy.name || userLegacy.screen_name || '',
          avatar_url: avatarUrl || `https://unavatar.io/twitter/${sn}`,
          verified: user?.is_blue_verified || false,
          followers_count:
            userLegacy.followers_count ||
            userLegacy.normal_followers_count ||
            userLegacy.fast_followers_count ||
            0,
          views: parseInt(tweetResult.views?.count || '0'),
          likes: tweet.favorite_count || 0,
        });
      }
    }
  } catch (e) {
    console.error('Parse error:', e);
  }
  return tweets;
}

function findNextCursor(data: any): string | null {
  try {
    const entries = data?.body?.entries || data?.entries || [];
    for (const group of entries) {
      for (const entry of (group?.entries || [])) {
        if (entry?.content?.__typename === 'TimelineTimelineCursor' &&
            entry?.content?.cursorType === 'Bottom') {
          return entry.content.value;
        }
      }
      if (group?.content?.__typename === 'TimelineTimelineCursor' &&
          group?.content?.cursorType === 'Bottom') {
        return group.content.value;
      }
    }
  } catch (_) {}
  return null;
}

function getRapidApiCreds() {
  const key =
    (functions.config().rapidapi?.key as string | undefined) ||
    process.env.RAPIDAPI_KEY ||
    '';
  const host =
    (functions.config().rapidapi?.host as string | undefined) ||
    process.env.RAPIDAPI_HOST ||
    '';
  return { key, host };
}

// ── SCHEDULED REFRESH (every 6 hours) ────────────────────────────────────────

export const scheduledRefresh = functions.pubsub
  .schedule('every 6 hours')
  .onRun(async (_context) => {
    console.log('Scheduled refresh starting...');
    await runRefresh();
    return null;
  });

// ── HTTP API FUNCTION ─────────────────────────────────────────────────────────

export const api = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Firebase Hosting passes the full original path (e.g. /api/refresh).
  // Strip the /api prefix so route matching stays simple.
  const path = req.path.replace(/^\/api/, '') || '/';
  console.log('API request:', req.method, path);

  // GET /api/refresh
  if (path === '/refresh' && req.method === 'GET') {
    try {
      const result = await runRefresh();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  // POST /api/scan
  if (path === '/scan' && req.method === 'POST') {
    try {
      const { handle } = req.body;
      if (!handle) {
        res.status(400).json({ error: 'No handle provided' });
        return;
      }
      const result = await runScan(handle);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  // GET /api/rerank
  if (path === '/rerank' && req.method === 'GET') {
    try {
      const result = await runRerank();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  // GET /api/user-profile?handle=xxx
  if (path === '/user-profile' && req.method === 'GET') {
    try {
      const handle = (req.query.handle as string || '').replace(/^@/, '').toLowerCase().trim();
      if (!handle) {
        res.status(400).json({ error: 'No handle provided' });
        return;
      }
      const doc = await db.collection('indexed_users').doc(handle).get();
      if (doc.exists) {
        res.json({ success: true, user: { ...doc.data(), x_handle: handle } });
      } else {
        res.json({ success: false, user: null });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  // GET /api/health
  if (path === '/health') {
    res.json({ status: 'ok', ts: Date.now() });
    return;
  }

  res.status(404).json({ error: 'Not found', path });
});

// ── CORE REFRESH LOGIC ────────────────────────────────────────────────────────

async function runRefresh() {
  const { key: RAPIDAPI_KEY, host: RAPIDAPI_HOST } = getRapidApiCreds();

  if (!RAPIDAPI_KEY) {
    console.warn('RAPIDAPI_KEY not configured — skipping refresh');
    return { success: true, simulated: true, message: 'No API key configured' };
  }

  const QUERIES = [
    '@get_optimum -is:retweet',
    'get_optimum -is:retweet',
    'from:get_optimum -is:retweet',
  ];

  const allTweets: any[] = [];
  const seenIds = new Set<string>();

  for (const query of QUERIES) {
    let cursor = '';
    let page = 0;
    while (page < 3) {
      const url =
        `https://${RAPIDAPI_HOST}/search` +
        `?query=${encodeURIComponent(query)}&count=100` +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');

      const resp = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });

      if (!resp.ok) {
        console.log(`Query failed: ${resp.status}`);
        break;
      }

      const data = await resp.json();
      const tweets = parseTweetsFromResponse(data);

      for (const tweet of tweets) {
        const key = tweet.tweet_id || `${tweet.user_id}:${tweet.views}:${tweet.likes}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          allTweets.push(tweet);
        }
      }

      console.log(`Query "${query.slice(0, 30)}" page ${page + 1}: ${tweets.length} tweets`);

      const nextCursor = findNextCursor(data);
      if (!nextCursor || tweets.length === 0) break;
      cursor = nextCursor;
      page++;
      await new Promise(r => setTimeout(r, 1200));
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`Total unique tweets: ${allTweets.length}`);

  // Aggregate by user
  const freshMap = new Map<string, any>();
  for (const tweet of allTweets) {
    const key = tweet.user_id;
    const ex = freshMap.get(key);
    if (ex) {
      ex.total_views += tweet.views;
      ex.total_likes += tweet.likes;
      ex.total_posts += 1;
      if (tweet.followers_count > (ex.followers_count || 0)) {
        ex.followers_count = tweet.followers_count;
        ex.avatar_url = tweet.avatar_url;
        ex.display_name = tweet.display_name;
      }
    } else {
      freshMap.set(key, {
        x_handle: key,
        display_name: tweet.display_name,
        avatar_url: tweet.avatar_url || `https://unavatar.io/twitter/${key}`,
        verified: tweet.verified,
        followers_count: tweet.followers_count,
        total_views: tweet.views,
        total_likes: tweet.likes,
        total_posts: 1,
      });
    }
  }

  // Read existing Firestore data
  const existingSnap = await db.collection('indexed_users').get();
  const existingData = new Map<string, any>();
  existingSnap.forEach(doc => existingData.set(doc.id, doc.data()));

  // Merge: never go backwards
  const finalMap = new Map<string, any>();
  existingData.forEach((data, handle) => finalMap.set(handle, { ...data }));

  freshMap.forEach((fresh, handle) => {
    const existing = finalMap.get(handle);
    if (existing) {
      finalMap.set(handle, {
        ...existing,
        total_views: Math.max(existing.total_views || 0, fresh.total_views),
        total_likes: Math.max(existing.total_likes || 0, fresh.total_likes),
        total_posts: Math.max(existing.total_posts || 0, fresh.total_posts),
        avatar_url: fresh.avatar_url || existing.avatar_url || `https://unavatar.io/twitter/${handle}`,
        display_name: fresh.display_name || existing.display_name,
        verified: fresh.verified || existing.verified,
        followers_count: Math.max(fresh.followers_count || 0, existing.followers_count || 0),
        last_indexed_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      finalMap.set(handle, {
        ...fresh,
        last_indexed_at: admin.firestore.FieldValue.serverTimestamp(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  // Sort and rank
  const sorted = [...finalMap.values()].sort(
    (a, b) => (b.total_views || 0) - (a.total_views || 0)
  );

  sorted.forEach((user, index) => {
    user.rank_views = index + 1;
    user.rank_likes = index + 1;
    user.rank_posts = index + 1;
    user.total_users = sorted.length;
    user.badge =
      index === 0 ? 'gold' :
      index === 1 ? 'silver' :
      index === 2 ? 'bronze' :
      index < 10 ? 'top10' : null;
  });

  // Write in batches of 499
  const entries = [...finalMap.entries()];
  for (let i = 0; i < entries.length; i += 499) {
    const batch = db.batch();
    for (const [handle, userData] of entries.slice(i, i + 499)) {
      batch.set(db.collection('indexed_users').doc(handle), userData, { merge: true });
    }
    await batch.commit();
    console.log(`Wrote batch ${Math.floor(i / 499) + 1}/${Math.ceil(entries.length / 499)}`);
  }

  // Global stats
  const totalViews = sorted.reduce((s, u) => s + (u.total_views || 0), 0);
  const totalLikes = sorted.reduce((s, u) => s + (u.total_likes || 0), 0);
  const totalPosts = sorted.reduce((s, u) => s + (u.total_posts || 0), 0);

  await db.collection('global_stats').doc('stats').set({
    total_views: totalViews,
    total_likes: totalLikes,
    total_posts: totalPosts,
    indexed_users: finalMap.size,
    last_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    next_update_at: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 6 * 60 * 60 * 1000)
    ),
  });

  console.log(`Refresh complete: ${finalMap.size} users`);
  return { success: true, usersIndexed: finalMap.size, tweetsFound: allTweets.length };
}

// ── CORE SCAN LOGIC ───────────────────────────────────────────────────────────

async function runScan(handle: string) {
  const { key: RAPIDAPI_KEY, host: RAPIDAPI_HOST } = getRapidApiCreds();

  if (!RAPIDAPI_KEY) {
    return {
      success: true,
      simulated: true,
      user: {
        x_handle: handle,
        display_name: handle,
        avatar_url: `https://unavatar.io/twitter/${handle}`,
        total_views: 0, total_likes: 0, total_posts: 0,
        rank_views: 999,
      },
    };
  }

  const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();

  const SCAN_QUERIES = [
    `from:${cleanHandle} @get_optimum -is:retweet`,
    `from:${cleanHandle} get_optimum -is:retweet`,
    `from:${cleanHandle} optimum -is:retweet`,
  ];

  const seenIds = new Set<string>();
  const allTweets: any[] = [];
  let userProfile: any = null;

  for (const query of SCAN_QUERIES) {
    let cursor = '';
    for (let page = 0; page < 3; page++) {
      const url =
        `https://${RAPIDAPI_HOST}/search` +
        `?query=${encodeURIComponent(query)}&count=100` +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');

      const resp = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });
      if (!resp.ok) break;

      const data = await resp.json();
      const tweets = parseTweetsFromResponse(data);

      for (const t of tweets) {
        if (t.user_id !== cleanHandle) continue;
        const key = t.tweet_id || `${t.user_id}:${t.views}:${t.likes}`;
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        allTweets.push(t);
        if (!userProfile) {
          userProfile = {
            display_name: t.display_name,
            avatar_url: t.avatar_url,
            verified: t.verified,
            followers_count: t.followers_count,
          };
        }
      }

      const next = findNextCursor(data);
      if (!next || tweets.length === 0) break;
      cursor = next;
      await new Promise(r => setTimeout(r, 800));
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`Scan: ${allTweets.length} posts for @${cleanHandle}`);

  const existingDoc = await db.collection('indexed_users').doc(cleanHandle).get();
  const existing = existingDoc.exists ? existingDoc.data()! : null;

  const finalUser = {
    x_handle: cleanHandle,
    display_name: userProfile?.display_name || existing?.display_name || cleanHandle,
    avatar_url:
      userProfile?.avatar_url ||
      existing?.avatar_url ||
      `https://unavatar.io/twitter/${cleanHandle}`,
    verified: userProfile?.verified || existing?.verified || false,
    followers_count: Math.max(userProfile?.followers_count || 0, existing?.followers_count || 0),
    total_views: Math.max(
      allTweets.reduce((s, t) => s + (t.views || 0), 0),
      existing?.total_views || 0
    ),
    total_likes: Math.max(
      allTweets.reduce((s, t) => s + (t.likes || 0), 0),
      existing?.total_likes || 0
    ),
    total_posts: Math.max(allTweets.length, existing?.total_posts || 0),
    last_indexed_at: admin.firestore.FieldValue.serverTimestamp(),
    created_at: existing?.created_at || admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('indexed_users').doc(cleanHandle).set(finalUser, { merge: true });

  const rerank = await runRerank();

  const updatedDoc = await db.collection('indexed_users').doc(cleanHandle).get();
  return {
    success: true,
    user: { ...updatedDoc.data(), x_handle: cleanHandle },
    totalUsers: rerank.reranked,
  };
}

// ── CORE RERANK LOGIC ─────────────────────────────────────────────────────────

async function runRerank() {
  const snap = await db.collection('indexed_users').orderBy('total_views', 'desc').get();
  const total = snap.size;

  const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  snap.forEach(doc => { docs.push(doc); });

  for (let i = 0; i < docs.length; i += 499) {
    const batch = db.batch();
    for (let j = i; j < Math.min(i + 499, docs.length); j++) {
      batch.update(docs[j].ref, {
        rank_views: j + 1,
        rank_likes: j + 1,
        rank_posts: j + 1,
        total_users: total,
      });
    }
    await batch.commit();
  }

  console.log(`Rerank complete: ${total} users`);
  return { success: true, reranked: total };
}
