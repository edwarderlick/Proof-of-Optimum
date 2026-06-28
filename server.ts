import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('ENV CHECK:', {
  projectId: process.env.FIREBASE_PROJECT_ID ? '✅ loaded' : '❌ missing',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? '✅ loaded' : '❌ missing',
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? '✅ loaded' : '❌ missing',
  rapidApiKey: process.env.RAPIDAPI_KEY ? '✅ loaded' : '❌ missing',
  rapidApiHost: process.env.RAPIDAPI_HOST ? '✅ loaded' : '❌ missing',
});

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';

const app = express();
const PORT = 3000;

app.use(express.json());

const hasAdminConfig = !!(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

let adminDb: Firestore | null = null;

if (hasAdminConfig) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');
    const appRef = getApps().length === 0 ? initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      })
    }) : getApp();
    adminDb = getFirestore(appRef);
    console.log('Firebase Admin initialized successfully.');
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error);
  }
} else {
  console.log('Firebase Admin credentials missing. Server running in simulated API fallback mode.');
}

// API Route: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// API Route: Test RapidAPI connection
app.get('/api/test-twitter', async (req, res) => {
  try {
    console.log('Testing RapidAPI connection...');
    console.log('Key:', process.env.RAPIDAPI_KEY ?
      process.env.RAPIDAPI_KEY.slice(0, 10) + '...' : 'MISSING');
    console.log('Host:', process.env.RAPIDAPI_HOST || 'MISSING');

    const response = await fetch(
      'https://' + process.env.RAPIDAPI_HOST +
      '/search?query=optimum&count=10',
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': process.env.RAPIDAPI_HOST!,
        }
      }
    );

    console.log('Response status:', response.status);
    const text = await response.text();
    console.log('Raw response:', text.slice(0, 1000));

    res.json({
      status: response.status,
      body: JSON.parse(text)
    });
  } catch (err) {
    console.error('Test failed:', err);
    res.json({ error: String(err) });
  }
});

// Helpers shared by the refresh route
function parseTweetsFromResponse(data: any): any[] {
  const tweets: any[] = [];
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
      const avatarUrl = (
        userLegacy.profile_image_url_https ||
        userLegacy.profile_image_url ||
        user?.legacy?.profile_image_url_https ||
        ''
      ).replace('_normal.jpg', '_400x400.jpg').replace('_normal.png', '_400x400.png');

      const screenName = userLegacy.screen_name.toLowerCase();
      tweets.push({
        tweet_id: tweetResult.rest_id || tweet.id_str || '',
        user_id: screenName,
        display_name: userLegacy.name || userLegacy.screen_name || '',
        avatar_url: avatarUrl || `https://unavatar.io/twitter/${screenName}`,
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

async function fetchQuery(
  baseUrl: string, query: string,
  headers: Record<string, string>, maxPages: number, label: string
): Promise<any[]> {
  const collected: any[] = [];
  let cursor = '';
  let page = 0;
  while (page < maxPages) {
    const url = baseUrl + '/search?query=' + encodeURIComponent(query) +
      '&count=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const r = await fetch(url, { method: 'GET', headers });
    console.log(`[${label}] page ${page + 1}: ${r.status}`);
    if (!r.ok) break;
    const data: any = await r.json();
    if (page === 0) console.log(`[${label}] sample:`, JSON.stringify(data).slice(0, 200));
    const pageTweets = parseTweetsFromResponse(data);
    collected.push(...pageTweets);
    console.log(`[${label}] page ${page + 1}: ${pageTweets.length} tweets`);
    const next = findNextCursor(data);
    if (!next || pageTweets.length === 0) break;
    cursor = next;
    page++;
    await new Promise(r => setTimeout(r, 1000));
  }
  return collected;
}

const REFRESH_QUERIES = [
  { q: '@get_optimum -is:retweet',     pages: 3 },
  { q: 'from:get_optimum -is:retweet', pages: 3 },
  { q: 'get_optimum -is:retweet',      pages: 3 },
];

// API Route: Refresh (cron job style)
app.get('/api/refresh', async (req, res) => {
  console.log('Cron triggered: /api/refresh');

  if (!process.env.RAPIDAPI_KEY) {
    return res.json({ success: true, simulated: true, usersIndexed: 0 });
  }

  const RAPIDAPI_BASE = `https://${process.env.RAPIDAPI_HOST}`;
  const rapidApiHeaders = {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST!,
  };

  try {
    // Run queries sequentially to avoid rate limits (1 s between pages inside fetchQuery)
    const allResults: any[][] = [];
    for (let i = 0; i < REFRESH_QUERIES.length; i++) {
      const { q, pages } = REFRESH_QUERIES[i];
      console.log(`[refresh] Starting query Q${i + 1}/${REFRESH_QUERIES.length}: ${q}`);
      const qResult = await fetchQuery(RAPIDAPI_BASE, q, rapidApiHeaders, pages, `Q${i + 1}`);
      allResults.push(qResult);
      console.log(`[refresh] Q${i + 1} done: ${qResult.length} tweets`);
      if (i < REFRESH_QUERIES.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    const results = allResults;

    // Deduplicate by tweet_id across all queries
    const seenIds = new Set<string>();
    const allRawTweets: any[] = [];
    for (const tweet of results.flat()) {
      const key = tweet.tweet_id || `${tweet.user_id}:${tweet.views}:${tweet.likes}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      allRawTweets.push(tweet);
    }
    console.log('Total after dedup:', allRawTweets.length);

    // Aggregate fresh tweets by user
    const freshUserMap = new Map<string, any>();
    for (const tweet of allRawTweets) {
      const prev = freshUserMap.get(tweet.user_id) || {
        x_handle: tweet.user_id,
        display_name: tweet.display_name,
        avatar_url: tweet.avatar_url,
        verified: tweet.verified,
        followers_count: tweet.followers_count,
        total_views: 0, total_likes: 0, total_posts: 0,
      };
      prev.total_views += tweet.views;
      prev.total_likes += tweet.likes;
      prev.total_posts += 1;
      freshUserMap.set(tweet.user_id, prev);
    }
    console.log('Unique users this run:', freshUserMap.size);

    if (adminDb) {
      // Read ALL existing users (FIX 3 + FIX 4)
      const existingSnapshot = await adminDb.collection('indexed_users').get();
      const existingData = new Map<string, any>();
      existingSnapshot.forEach(doc => existingData.set(doc.id, doc.data()));
      console.log('Existing users in Firestore:', existingData.size);

      // Merge: start with ALL historical users, then overlay fresh data (take max)
      const allUserMap = new Map<string, any>();
      existingData.forEach((data, handle) => {
        allUserMap.set(handle, {
          x_handle: handle,
          display_name: data.display_name || handle,
          avatar_url: data.avatar_url || '',
          verified: data.verified || false,
          followers_count: data.followers_count || 0,
          total_views: data.total_views || 0,
          total_likes: data.total_likes || 0,
          total_posts: data.total_posts || 0,
        });
      });

      for (const [handle, fresh] of freshUserMap) {
        const prev = allUserMap.get(handle) || { total_views: 0, total_likes: 0, total_posts: 0 };
        allUserMap.set(handle, {
          ...fresh,
          total_views: Math.max(prev.total_views, fresh.total_views),
          total_likes: Math.max(prev.total_likes, fresh.total_likes),
          total_posts: Math.max(prev.total_posts || 0, fresh.total_posts || 0),
        });
      }

      const sortedUsers = [...allUserMap.values()].sort((a, b) => b.total_views - a.total_views);
      console.log('Total users to write:', sortedUsers.length);

      const totalViews = sortedUsers.reduce((s, u) => s + u.total_views, 0);
      const totalLikes = sortedUsers.reduce((s, u) => s + u.total_likes, 0);
      const totalPosts = sortedUsers.reduce((s, u) => s + u.total_posts, 0);

      // Multi-batch writes (Firestore limit: 500 ops per batch)
      const BATCH_SIZE = 499;
      const batches: ReturnType<typeof adminDb.batch>[] = [];
      let batch = adminDb.batch();
      let opCount = 0;

      sortedUsers.forEach((user, idx) => {
        if (opCount >= BATCH_SIZE) {
          batches.push(batch);
          batch = adminDb!.batch();
          opCount = 0;
        }
        const rank = idx + 1;
        const ref = adminDb!.collection('indexed_users').doc(user.x_handle);
        batch.set(ref, {
          ...user,
          rank_views: rank, rank_likes: rank, rank_posts: rank,
          total_users: sortedUsers.length,
          badge: rank <= 3 ? 'top3' : rank <= 10 ? 'top10' : null,
          last_indexed_at: FieldValue.serverTimestamp(),
        }, { merge: true });
        opCount++;
      });

      if (opCount >= BATCH_SIZE) { batches.push(batch); batch = adminDb.batch(); }
      batch.set(adminDb.collection('global_stats').doc('stats'), {
        total_views: totalViews, total_likes: totalLikes, total_posts: totalPosts,
        indexed_users: sortedUsers.length,
        last_updated_at: FieldValue.serverTimestamp(),
        next_update_at: Timestamp.fromDate(new Date(Date.now() + 6 * 60 * 60 * 1000)),
      });
      batches.push(batch);

      try {
        for (const b of batches) await b.commit();
        console.log(`✅ Committed ${batches.length} batch(es) for ${sortedUsers.length} users`);
      } catch (firestoreError) {
        console.error('❌ Firestore commit failed:', firestoreError);
        return res.status(500).json({ error: 'Firestore write failed', details: String(firestoreError) });
      }

      return res.json({ success: true, usersIndexed: sortedUsers.length, tweetsFound: allRawTweets.length });
    }

    res.json({ success: true, usersIndexed: 0, tweetsFound: allRawTweets.length });

  } catch (error: any) {
    console.error('Refresh API failed:', error);
    res.status(500).json({ error: error.message || 'Refresh failed' });
  }
});

// API Route: Single User Scan (On-demand)
app.post('/api/scan', async (req, res) => {
  const { handle } = req.body;
  if (!handle) {
    return res.status(400).json({ error: 'Handle is required' });
  }

  const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
  console.log(`Scan triggered for @${cleanHandle}`);

  if (!process.env.RAPIDAPI_KEY) {
    console.log(`RAPIDAPI_KEY missing. Performing simulated scan for @${cleanHandle}`);
    return res.json({
      success: true,
      simulated: true,
      user: {
        x_handle: cleanHandle,
        display_name: cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1),
        verified: false,
        followers_count: 5000,
        total_views: 120000,
        total_likes: 3500,
        total_posts: 12,
      },
    });
  }

  const RAPIDAPI_BASE = `https://${process.env.RAPIDAPI_HOST}`;
  const rapidApiHeaders = {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST!,
  };

  try {
    const SCAN_QUERIES = [
      `from:${cleanHandle} @get_optimum -is:retweet`,
      `from:${cleanHandle} get_optimum -is:retweet`,
      `from:${cleanHandle} optimum -is:retweet`,
    ];

    const seenScanIds = new Set<string>();
    const allScanTweets: any[] = [];

    for (const q of SCAN_QUERIES) {
      let cursor = '';
      for (let page = 0; page < 3; page++) {
        const url = RAPIDAPI_BASE + '/search?query=' + encodeURIComponent(q) +
          '&count=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        const r = await fetch(url, { method: 'GET', headers: rapidApiHeaders });
        if (!r.ok) break;
        const data: any = await r.json();
        const pageTweets = parseTweetsFromResponse(data);
        for (const t of pageTweets) {
          if (t.user_id !== cleanHandle) continue;
          const key = t.tweet_id || `${t.user_id}:${t.views}:${t.likes}`;
          if (seenScanIds.has(key)) continue;
          seenScanIds.add(key);
          allScanTweets.push(t);
        }
        const next = findNextCursor(data);
        if (!next || pageTweets.length === 0) break;
        cursor = next;
        await new Promise(r => setTimeout(r, 800));
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`Scan complete: ${allScanTweets.length} posts for @${cleanHandle}`);

    let totalViews = 0;
    let totalLikes = 0;
    let postCount = 0;
    let profileFromTweets: any = null;

    for (const tweet of allScanTweets) {
      totalViews += tweet.views;
      totalLikes += tweet.likes;
      postCount += 1;
      if (!profileFromTweets) profileFromTweets = tweet;
    }

    // Fallback: fetch profile via user/details endpoint
    if (!profileFromTweets) {
      try {
        const profileRes = await fetch(
          `${RAPIDAPI_BASE}/user/details?username=${cleanHandle}`,
          { method: 'GET', headers: rapidApiHeaders }
        );
        if (profileRes.ok) {
          const profileData: any = await profileRes.json();
          const legacy = profileData?.data?.user?.result?.legacy ||
            profileData?.user?.legacy || profileData?.legacy || profileData;
          profileFromTweets = {
            display_name: legacy?.name || cleanHandle,
            avatar_url: (
              legacy?.profile_image_url_https || legacy?.profile_image_url || ''
            ).replace('_normal.jpg', '_400x400.jpg').replace('_normal.png', '_400x400.png'),
            verified: profileData?.data?.user?.result?.is_blue_verified || false,
            followers_count:
              legacy?.followers_count || legacy?.normal_followers_count || 0,
          };
        }
      } catch (profileErr) {
        console.error('Profile fallback failed:', profileErr);
      }
    }

    if (adminDb) {
      // Read existing data to apply Math.max (never go backwards)
      const existingDoc = await adminDb.collection('indexed_users').doc(cleanHandle).get();
      const existing = existingDoc.exists ? existingDoc.data()! : null;

      const finalUser = {
        x_handle: cleanHandle,
        display_name: profileFromTweets?.display_name || existing?.display_name || cleanHandle,
        avatar_url:
          profileFromTweets?.avatar_url ||
          existing?.avatar_url ||
          `https://unavatar.io/twitter/${cleanHandle}`,
        verified: profileFromTweets?.verified || existing?.verified || false,
        followers_count: Math.max(
          profileFromTweets?.followers_count || 0,
          existing?.followers_count || 0
        ),
        total_views: Math.max(totalViews, existing?.total_views || 0),
        total_likes: Math.max(totalLikes, existing?.total_likes || 0),
        total_posts: Math.max(postCount, existing?.total_posts || 0),
        last_indexed_at: FieldValue.serverTimestamp(),
      };

      await adminDb.collection('indexed_users').doc(cleanHandle).set(finalUser, { merge: true });

      // Re-rank all users by total_views
      const allSnapshot = await adminDb.collection('indexed_users').orderBy('total_views', 'desc').get();
      const totalUsers = allSnapshot.size;
      const BATCH_SIZE = 499;
      const reRankBatches: ReturnType<typeof adminDb.batch>[] = [];
      let reRankBatch = adminDb.batch();
      let reRankOpCount = 0;
      let rankN = 1;

      allSnapshot.forEach((rankDoc) => {
        if (reRankOpCount >= BATCH_SIZE) {
          reRankBatches.push(reRankBatch);
          reRankBatch = adminDb!.batch();
          reRankOpCount = 0;
        }
        reRankBatch.update(rankDoc.ref, {
          rank_views: rankN,
          rank_likes: rankN,
          rank_posts: rankN,
          total_users_at_rank_time: totalUsers,
          badge: rankN === 1 ? 'gold' : rankN === 2 ? 'silver' :
                 rankN === 3 ? 'bronze' : rankN <= 10 ? 'top10' : null,
        });
        rankN++;
        reRankOpCount++;
      });
      reRankBatches.push(reRankBatch);
      for (const b of reRankBatches) await b.commit();
      console.log(`Re-ranked ${totalUsers} users after scan of @${cleanHandle}`);

      const updatedDoc = await adminDb.collection('indexed_users').doc(cleanHandle).get();
      return res.json({
        success: true,
        user: { ...updatedDoc.data(), x_handle: cleanHandle },
      });
    }

    res.json({
      success: true,
      user: {
        x_handle: cleanHandle,
        display_name: profileFromTweets?.display_name || cleanHandle,
        avatar_url: profileFromTweets?.avatar_url || `https://unavatar.io/twitter/${cleanHandle}`,
        verified: profileFromTweets?.verified || false,
        followers_count: profileFromTweets?.followers_count || 0,
        total_views: totalViews,
        total_likes: totalLikes,
        total_posts: postCount,
      },
    });

  } catch (error: any) {
    console.error(`Scan failed for @${cleanHandle}:`, error);
    res.status(500).json({ error: error.message || 'Scan failed' });
  }
});

// API Route: Get fresh profile data for modal
app.get('/api/user-profile', async (req, res) => {
  const handle = (req.query.handle as string || '').replace(/^@/, '').toLowerCase().trim();
  if (!handle) return res.status(400).json({ error: 'handle required' });
  if (!adminDb) return res.status(503).json({ error: 'Firestore not configured' });

  try {
    const doc = await adminDb.collection('indexed_users').doc(handle).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { ...doc.data(), x_handle: handle } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API Route: Deep-scan a user's full tweet history for accurate post count
app.get('/api/user-history', async (req, res) => {
  const handle = ((req.query.handle as string) || '').replace(/^@/, '').toLowerCase().trim();
  if (!handle) return res.status(400).json({ error: 'missing handle' });
  if (!process.env.RAPIDAPI_KEY) return res.status(503).json({ error: 'RAPIDAPI_KEY not configured' });
  if (!adminDb) return res.status(503).json({ error: 'Firestore not configured' });

  const RAPIDAPI_BASE = `https://${process.env.RAPIDAPI_HOST}`;
  const headers = {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST!,
  };

  try {
    const HISTORY_QUERIES = [
      `from:${handle} @get_optimum -is:retweet`,
      `from:${handle} get_optimum -is:retweet`,
    ];

    const seenIds = new Set<string>();
    const allTweets: any[] = [];

    for (const q of HISTORY_QUERIES) {
      let cursor = '';
      let page = 0;
      while (page < 5) {
        const url = RAPIDAPI_BASE + '/search?query=' + encodeURIComponent(q) +
          '&count=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        const r = await fetch(url, { method: 'GET', headers });
        if (!r.ok) break;
        const data: any = await r.json();
        const tweets = parseTweetsFromResponse(data);
        for (const t of tweets) {
          const key = t.tweet_id || `${t.user_id}:${t.views}:${t.likes}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          allTweets.push(t);
        }
        const next = findNextCursor(data);
        if (!next || tweets.length === 0) break;
        cursor = next;
        page++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const totalViews = allTweets.reduce((s, t) => s + t.views, 0);
    const totalLikes = allTweets.reduce((s, t) => s + t.likes, 0);
    const totalPosts = allTweets.length;
    console.log(`[user-history] @${handle}: ${totalPosts} posts, ${totalViews} views`);

    // Read existing to never decrease counts
    const existingDoc = await adminDb.collection('indexed_users').doc(handle).get();
    const existing = existingDoc.data() || {};

    await adminDb.collection('indexed_users').doc(handle).set({
      total_views: Math.max(totalViews, existing.total_views || 0),
      total_likes: Math.max(totalLikes, existing.total_likes || 0),
      total_posts: Math.max(totalPosts, existing.total_posts || 0),
      last_indexed_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Re-rank all users
    const allSnap = await adminDb.collection('indexed_users').orderBy('total_views', 'desc').get();
    const BATCH_SIZE = 499;
    const batches: ReturnType<typeof adminDb.batch>[] = [];
    let batch = adminDb.batch();
    let opCount = 0;
    let rankN = 1;
    allSnap.forEach((doc) => {
      if (opCount >= BATCH_SIZE) { batches.push(batch); batch = adminDb!.batch(); opCount = 0; }
      batch.update(doc.ref, { rank_views: rankN, rank_likes: rankN, rank_posts: rankN });
      rankN++;
      opCount++;
    });
    batches.push(batch);
    for (const b of batches) await b.commit();

    res.json({ success: true, handle, total_posts: totalPosts, total_views: totalViews, total_likes: totalLikes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API Route: Rerank all users by total_views (one-time fix)
app.get('/api/rerank', async (req, res) => {
  if (!adminDb) return res.status(503).json({ error: 'Firestore not configured' });

  try {
    const snapshot = await adminDb.collection('indexed_users').get();
    const users: { handle: string; total_views: number }[] = [];
    snapshot.forEach(doc => {
      users.push({ handle: doc.id, total_views: doc.data().total_views || 0 });
    });

    users.sort((a, b) => b.total_views - a.total_views);
    console.log(`Reranking ${users.length} users…`);

    const BATCH_SIZE = 499;
    const batches: ReturnType<typeof adminDb.batch>[] = [];
    let batch = adminDb.batch();
    let opCount = 0;

    users.forEach(({ handle }, idx) => {
      if (opCount >= BATCH_SIZE) { batches.push(batch); batch = adminDb!.batch(); opCount = 0; }
      const rank = idx + 1;
      const ref = adminDb!.collection('indexed_users').doc(handle);
      batch.update(ref, {
        rank_views: rank, rank_likes: rank, rank_posts: rank,
        badge: rank <= 3 ? 'top3' : rank <= 10 ? 'top10' : null,
      });
      opCount++;
    });
    batches.push(batch);

    for (const b of batches) await b.commit();
    console.log(`✅ Rerank complete: ${batches.length} batch(es), ${users.length} users`);

    res.json({ success: true, usersReranked: users.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Vite Dev server or Serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
