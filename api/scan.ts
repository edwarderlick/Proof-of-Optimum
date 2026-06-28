import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

if (!admin.apps?.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    console.error('Missing Firebase env vars:', {
      hasPrivateKey: !!privateKey,
      hasClientEmail: !!clientEmail,
      hasProjectId: !!projectId,
    });
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      console.error('Firebase Admin init error:', error);
    }
  }
}

const db = admin.apps?.length ? admin.firestore() : null;

// ── HELPERS ──────────────────────────────────────────────────────────────────

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
        screen_name: userLegacy.screen_name,
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

// ── HANDLER ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (!db) {
    return res.status(500).json({
      error: 'Database not initialized — check FIREBASE_* env vars in Vercel dashboard',
      success: false,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { handle } = req.body;
  if (!handle) return res.status(400).json({ error: 'No handle' });

  const cleanHandle = handle.replace('@', '').toLowerCase().trim();
  console.log('Scanning for:', cleanHandle);

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!;
  const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST!;

  if (!RAPIDAPI_KEY || !db) {
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
      },
    });
  }

  try {
    // STRATEGY: Search the global @get_optimum feed and filter for this user.
    // "from:handle" on RapidAPI is unreliable — global search + filter is more accurate.
    const searchQueries = [
      '@get_optimum -is:retweet',
      'get_optimum -is:retweet',
      `"${cleanHandle}" optimum`,
      `"${cleanHandle}" get_optimum`,
    ];

    const userTweets: any[] = [];
    const seenIds = new Set<string>();
    let userProfile: any = null;

    for (const query of searchQueries) {
      let cursor = '';
      let page = 0;
      const MAX_PAGES = 5;

      while (page < MAX_PAGES) {
        const url =
          `https://${RAPIDAPI_HOST}/search` +
          `?query=${encodeURIComponent(query)}&count=100` +
          (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');

        console.log(`Query: "${query}" page ${page + 1}`);

        const resp = await fetch(url, {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
          },
        });

        if (!resp.ok) {
          console.log(`Failed: ${resp.status}`);
          break;
        }

        const data = await resp.json();
        const tweets = parseTweetsFromResponse(data);
        console.log(`Found ${tweets.length} tweets on page ${page + 1}`);

        for (const tweet of tweets) {
          const tweetHandle =
            tweet.screen_name?.toLowerCase() ||
            tweet.user_id?.toLowerCase() ||
            '';

          if (tweetHandle === cleanHandle) {
            const key = tweet.tweet_id || `${tweetHandle}:${tweet.views}:${tweet.likes}`;
            if (!seenIds.has(key)) {
              seenIds.add(key);
              userTweets.push(tweet);
              if (!userProfile && tweet.avatar_url) {
                userProfile = {
                  display_name: tweet.display_name,
                  avatar_url: tweet.avatar_url,
                  verified: tweet.verified,
                  followers_count: tweet.followers_count,
                };
              }
            }
          }
        }

        if (userTweets.length > 0) {
          console.log(`Found ${userTweets.length} posts by @${cleanHandle} so far`);
        }

        const nextCursor = findNextCursor(data);
        if (!nextCursor || tweets.length === 0) break;
        cursor = nextCursor;
        page++;
        await new Promise(r => setTimeout(r, 800));

        // Stop early once we have enough posts
        if (userTweets.length >= 50) break;
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`Total posts found for @${cleanHandle}: ${userTweets.length}`);

    // Fallback: try search_v2 endpoint if still nothing
    if (userTweets.length === 0) {
      console.log('Trying search_v2 endpoint...');
      try {
        const v2Resp = await fetch(
          `https://${RAPIDAPI_HOST}/search_v2` +
          `?query=${encodeURIComponent(`from:${cleanHandle} optimum`)}&count=100`,
          {
            headers: {
              'X-RapidAPI-Key': RAPIDAPI_KEY,
              'X-RapidAPI-Host': RAPIDAPI_HOST,
            },
          }
        );
        if (v2Resp.ok) {
          const v2Data = await v2Resp.json();
          console.log('search_v2 response:', JSON.stringify(v2Data).slice(0, 200));
          const v2Tweets = parseTweetsFromResponse(v2Data);
          for (const tweet of v2Tweets) {
            const key = tweet.tweet_id || `${tweet.user_id}:${tweet.views}:${tweet.likes}`;
            if (tweet.user_id === cleanHandle && !seenIds.has(key)) {
              seenIds.add(key);
              userTweets.push(tweet);
            }
          }
        }
      } catch (v2Err) {
        console.log('search_v2 failed:', v2Err);
      }
    }

    // Profile fallback: try multiple endpoints if no profile from tweets
    if (!userProfile) {
      console.log('Fetching profile for:', cleanHandle);
      const profileEndpoints = [
        `/user/details?username=${cleanHandle}`,
        `/user/info?userName=${cleanHandle}`,
        `/users?username=${cleanHandle}`,
      ];
      for (const endpoint of profileEndpoints) {
        try {
          const pResp = await fetch(`https://${RAPIDAPI_HOST}${endpoint}`, {
            headers: {
              'X-RapidAPI-Key': RAPIDAPI_KEY,
              'X-RapidAPI-Host': RAPIDAPI_HOST,
            },
          });
          if (!pResp.ok) continue;
          const pData = await pResp.json();
          console.log(`Profile from ${endpoint}:`, JSON.stringify(pData).slice(0, 300));

          const legacy =
            pData?.data?.user?.result?.legacy ||
            pData?.user?.result?.legacy ||
            pData?.user?.legacy ||
            pData?.legacy ||
            pData?.result?.legacy ||
            null;

          if (legacy?.name || legacy?.screen_name) {
            userProfile = {
              display_name: legacy.name || cleanHandle,
              avatar_url: (
                legacy.profile_image_url_https ||
                legacy.profile_image_url ||
                ''
              ).replace('_normal.jpg', '_400x400.jpg').replace('_normal.png', '_400x400.png'),
              verified:
                pData?.data?.user?.result?.is_blue_verified ||
                legacy.verified ||
                false,
              followers_count: legacy.followers_count || legacy.normal_followers_count || 0,
            };
            console.log('Got profile:', userProfile);
            break;
          }
        } catch (endpointErr) {
          console.log(`Endpoint ${endpoint} failed:`, endpointErr);
        }
      }
    }

    // Merge with existing Firestore data (never go backwards)
    const existingDoc = await db.collection('indexed_users').doc(cleanHandle).get();
    const existing = existingDoc.exists ? existingDoc.data()! : null;

    const totalViews = userTweets.reduce((s, t) => s + (t.views || 0), 0);
    const totalLikes = userTweets.reduce((s, t) => s + (t.likes || 0), 0);

    const finalUser: any = {
      x_handle: cleanHandle,
      display_name: userProfile?.display_name || existing?.display_name || cleanHandle,
      avatar_url:
        userProfile?.avatar_url ||
        existing?.avatar_url ||
        `https://unavatar.io/twitter/${cleanHandle}`,
      verified: userProfile?.verified || existing?.verified || false,
      followers_count: Math.max(
        userProfile?.followers_count || 0,
        existing?.followers_count || 0
      ),
      total_views: Math.max(totalViews, existing?.total_views || 0),
      total_likes: Math.max(totalLikes, existing?.total_likes || 0),
      total_posts: Math.max(userTweets.length, existing?.total_posts || 0),
      last_indexed_at: admin.firestore.FieldValue.serverTimestamp(),
      created_at: existing?.created_at || admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('indexed_users').doc(cleanHandle).set(finalUser, { merge: true });

    // Rerank all users by total_views (multi-batch — safe for >499 users)
    const allSnap = await db.collection('indexed_users').orderBy('total_views', 'desc').get();
    const total = allSnap.size;
    const rankDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    allSnap.forEach(doc => rankDocs.push(doc));

    let rank = 1;
    for (let i = 0; i < rankDocs.length; i += 499) {
      const batch = db.batch();
      for (const doc of rankDocs.slice(i, i + 499)) {
        const d = doc.data();
        const hasActivity = (d.total_views || 0) > 0 || (d.total_posts || 0) > 0;
        batch.update(doc.ref, {
          rank_views: hasActivity ? rank++ : null,
          total_users: total,
        });
      }
      await batch.commit();
    }

    const updatedDoc = await db.collection('indexed_users').doc(cleanHandle).get();
    const updatedUser = updatedDoc.data();

    console.log(
      `Scan complete for @${cleanHandle}:`,
      `posts=${updatedUser?.total_posts}`,
      `views=${updatedUser?.total_views}`,
      `rank=${updatedUser?.rank_views}`
    );

    return res.json({
      success: true,
      user: updatedUser,
      postsFound: userTweets.length,
    });
  } catch (err: any) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
