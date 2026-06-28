import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (getApps().length === 0 && process.env.FIREBASE_PROJECT_ID) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } catch (error) {
    console.error('Firebase Admin init error:', error);
  }
}

function parseTweetsFromResponse(data: any): any[] {
  const tweets: any[] = [];
  const topEntries = data?.body?.entries || data?.entries || [];

  for (const group of topEntries) {
    const innerEntries = group?.entries || [];
    for (const entry of innerEntries) {
      const itemContent = entry?.content?.itemContent ?? entry?.itemContent;
      const tweetResult = itemContent?.tweet_results?.result;
      if (!tweetResult || tweetResult.__typename !== 'Tweet') continue;

      const tweet = tweetResult.legacy;
      const user = tweetResult.core?.user_results?.result;
      const userLegacy = user?.legacy;
      const views = parseInt(tweetResult.views?.count || '0');

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
        views,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { handle } = req.body;
  if (!handle) {
    return res.status(400).json({ error: 'Handle is required' });
  }

  const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();

  if (!process.env.RAPIDAPI_KEY) {
    return res.status(200).json({
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
        last_indexed_at: new Date(),
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

    const seenIds = new Set<string>();
    const allTweets: any[] = [];

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
          // Only count tweets authored by this user
          if (t.user_id !== cleanHandle) continue;
          const key = t.tweet_id || `${t.user_id}:${t.views}:${t.likes}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          allTweets.push(t);
        }
        const next = findNextCursor(data);
        if (!next || pageTweets.length === 0) break;
        cursor = next;
        await new Promise(r => setTimeout(r, 800));
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    // Broader fallback: search general optimum tweets and filter for this user.
    // Catches posts where the user doesn't tag @get_optimum directly every time.
    const GENERAL_QUERIES = [
      `@get_optimum -is:retweet`,
      `get_optimum -is:retweet`,
    ];
    for (const q of GENERAL_QUERIES) {
      try {
        const url = RAPIDAPI_BASE + '/search?query=' + encodeURIComponent(q) + '&count=100';
        const r = await fetch(url, { method: 'GET', headers: rapidApiHeaders });
        if (!r.ok) continue;
        const data: any = await r.json();
        const pageTweets = parseTweetsFromResponse(data);
        for (const t of pageTweets) {
          if (t.user_id !== cleanHandle) continue;
          const key = t.tweet_id || `${t.user_id}:${t.views}:${t.likes}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          allTweets.push(t);
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 800));
    }

    console.log(`Scan complete: ${allTweets.length} posts for @${cleanHandle}`);

    let totalViews = 0;
    let totalLikes = 0;
    let postCount = 0;
    let profileFromTweets: any = null;

    for (const tweet of allTweets) {
      totalViews += tweet.views;
      totalLikes += tweet.likes;
      postCount += 1;
      if (!profileFromTweets) {
        profileFromTweets = {
          display_name: tweet.display_name,
          avatar_url: tweet.avatar_url,
          verified: tweet.verified,
          followers_count: tweet.followers_count,
        };
      }
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
            profileData?.user?.result?.legacy ||
            profileData?.user?.legacy || profileData?.legacy || null;
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
        console.error('Profile fallback fetch failed:', profileErr);
      }
    }

    if (getApps().length) {
      const adminDb = getFirestore();

      // Read existing to apply Math.max (never go backwards)
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
          reRankBatch = adminDb.batch();
          reRankOpCount = 0;
        }
        const docData = rankDoc.data();
        const hasActivity = (docData.total_posts || 0) > 0 || (docData.total_views || 0) > 0;
        if (hasActivity) {
          reRankBatch.update(rankDoc.ref, {
            rank_views: rankN,
            rank_likes: rankN,
            rank_posts: rankN,
            total_users: totalUsers,
            badge: rankN === 1 ? 'gold' : rankN === 2 ? 'silver' :
                   rankN === 3 ? 'bronze' : rankN <= 10 ? 'top10' : null,
          });
          rankN++;
        } else {
          reRankBatch.update(rankDoc.ref, {
            rank_views: null,
            rank_likes: null,
            rank_posts: null,
            badge: null,
            total_users: totalUsers,
          });
        }
        reRankOpCount++;
      });
      reRankBatches.push(reRankBatch);
      for (const b of reRankBatches) await b.commit();
      console.log(`Re-ranked ${totalUsers} users after scan of @${cleanHandle}`);

      const updatedDoc = await adminDb.collection('indexed_users').doc(cleanHandle).get();
      return res.status(200).json({
        success: true,
        user: { ...updatedDoc.data(), x_handle: cleanHandle },
      });
    }

    return res.status(200).json({
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
    return res.status(500).json({ error: error.message || 'Serverless scan failed' });
  }
}
