import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    console.error('Missing Firebase env vars:', {
      projectId: !!projectId,
      clientEmail: !!clientEmail,
      privateKey: !!privateKey,
    });
  } else {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin initialized');
    } catch (error) {
      console.error('Firebase Admin init error:', error);
    }
  }
}

const db = getApps().length ? getFirestore() : null;

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
  baseUrl: string,
  query: string,
  headers: Record<string, string>,
  maxPages: number,
  label: string
): Promise<any[]> {
  const collected: any[] = [];
  let cursor = '';
  let page = 0;
  while (page < maxPages) {
    const url =
      baseUrl + '/search?query=' + encodeURIComponent(query) +
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

const QUERIES = [
  { q: '@get_optimum -is:retweet',     pages: 3 },
  { q: 'from:get_optimum -is:retweet', pages: 3 },
  { q: 'get_optimum -is:retweet',      pages: 3 },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (!db) {
    return res.status(500).json({
      error: 'Database not initialized — check FIREBASE_* env vars in Vercel dashboard',
      success: false,
    });
  }

  if (!process.env.RAPIDAPI_KEY) {
    return res.status(200).json({
      success: true,
      simulated: true,
      message: 'Simulated refresh: Add RAPIDAPI_KEY to trigger real Twitter API lookups.',
    });
  }

  const RAPIDAPI_BASE = `https://${process.env.RAPIDAPI_HOST}`;
  const rapidApiHeaders = {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST!,
  };

  try {
    // Run queries sequentially to avoid rate limits (1 s between pages inside fetchQuery)
    const allResults: any[][] = [];
    for (let i = 0; i < QUERIES.length; i++) {
      const { q, pages } = QUERIES[i];
      console.log(`[refresh] Starting query Q${i + 1}/${QUERIES.length}: ${q}`);
      const qResult = await fetchQuery(RAPIDAPI_BASE, q, rapidApiHeaders, pages, `Q${i + 1}`);
      allResults.push(qResult);
      console.log(`[refresh] Q${i + 1} done: ${qResult.length} tweets`);
      if (i < QUERIES.length - 1) await new Promise(r => setTimeout(r, 2000));
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
    console.log(`Total after dedup: ${allRawTweets.length} tweets`);

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

    // FIX 3 + FIX 4: Read ALL existing indexed_users once
    const existingSnapshot = await db.collection('indexed_users').get();
    const existingData = new Map<string, any>();
    existingSnapshot.forEach(doc => existingData.set(doc.id, doc.data()));
    console.log('Existing users in Firestore:', existingData.size);

    // Merge: start with ALL historical users, then apply fresh data on top
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

    // Overlay fresh data: views/likes take the max (latest count wins),
    // posts are additive (accumulate across refresh cycles to approach true all-time count)
    for (const [handle, fresh] of freshUserMap) {
      const prev = allUserMap.get(handle) || { total_views: 0, total_likes: 0, total_posts: 0 };
      allUserMap.set(handle, {
        ...fresh,
        total_views: Math.max(prev.total_views, fresh.total_views),
        total_likes: Math.max(prev.total_likes, fresh.total_likes),
        total_posts: Math.max(prev.total_posts || 0, fresh.total_posts || 0),
      });
    }

    // Sort all users (fresh + historical) by total_views
    const sortedUsers = [...allUserMap.values()].sort((a, b) => b.total_views - a.total_views);
    console.log('Total users to write:', sortedUsers.length);

    // Calculate global stats from ALL users
    const totalViews = sortedUsers.reduce((s, u) => s + u.total_views, 0);
    const totalLikes = sortedUsers.reduce((s, u) => s + u.total_likes, 0);
    const totalPosts = sortedUsers.reduce((s, u) => s + u.total_posts, 0);

    // Write in batches of 499 (Firestore hard limit is 500 ops per batch)
    const BATCH_SIZE = 499;
    const batches: any[] = [];
    let batch = db.batch();
    let opCount = 0;

    sortedUsers.forEach((user, idx) => {
      if (opCount >= BATCH_SIZE) {
        batches.push(batch);
        batch = db.batch();
        opCount = 0;
      }
      const rank = idx + 1;
      const ref = db.collection('indexed_users').doc(user.x_handle);
      batch.set(ref, {
        ...user,
        rank_views: rank, rank_likes: rank, rank_posts: rank,
        total_users: sortedUsers.length,
        badge: rank <= 3 ? 'top3' : rank <= 10 ? 'top10' : null,
        last_indexed_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      opCount++;
    });

    // Global stats in final batch (or new batch if needed)
    if (opCount >= BATCH_SIZE) {
      batches.push(batch);
      batch = db.batch();
    }
    batch.set(db.collection('global_stats').doc('stats'), {
      total_views: totalViews,
      total_likes: totalLikes,
      total_posts: totalPosts,
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

    return res.status(200).json({
      success: true,
      usersIndexed: sortedUsers.length,
      tweetsFound: allRawTweets.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Serverless refresh failed' });
  }
}
