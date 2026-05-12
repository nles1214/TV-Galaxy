const fs = require('fs');
const https = require('https');
const path = require('path');

// Support HTTP_PROXY / HTTPS_PROXY for networks where TMDB is blocked
function getAgent() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  if (!proxyUrl) return undefined;
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    return new HttpsProxyAgent(proxyUrl);
  } catch {
    console.warn('Proxy env set but https-proxy-agent not installed. Run: npm install https-proxy-agent');
    return undefined;
  }
}

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('config.json not found. Please copy config.json.template and fill in your TMDB API key.');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  // Allow env override for CI/CD (GitHub Actions, etc.)
  if (process.env.TMDB_API_KEY) {
    config.tmdbApiKey = process.env.TMDB_API_KEY;
  }

  return config;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const options = { headers: { 'User-Agent': 'TV-Galaxy/1.0' }, agent: getAgent() };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchShows(config) {
  const apiKey = config.tmdbApiKey;
  const networkId = config.networkId || 2552;
  const lang = config.language || 'zh-CN';
  const maxShows = config.maxShows || 50;

  console.log(`Fetching Apple TV+ shows from TMDB (network=${networkId})...`);

  const discoverUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_networks=${networkId}&sort_by=popularity.desc&language=${lang}&page=1`;
  const discover = await httpGet(discoverUrl);

  if (!discover.results || discover.results.length === 0) {
    console.warn('No shows found. Check your API key and network ID.');
    return [];
  }

  const shows = [];
  const results = discover.results.slice(0, maxShows);

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    console.log(`[${i + 1}/${results.length}] Fetching details for: ${item.name}`);

    try {
      const detailUrl = `https://api.themoviedb.org/3/tv/${item.id}?api_key=${apiKey}&language=${lang}`;
      const detail = await httpGet(detailUrl);

      const lastEpisode = detail.last_episode_to_air;
      const nextEpisode = detail.next_episode_to_air;

      // Map TMDB genre IDs to our categories
      const genreMap = {
        18: 'drama', 10759: 'action', 35: 'comedy', 80: 'thriller',
        9648: 'thriller', 10765: 'scifi', 99: 'doc', 16: 'scifi'
      };
      const category = detail.genres
        ? detail.genres.map(g => genreMap[g.id] || 'drama').filter((v, i, a) => a.indexOf(v) === i)
        : ['drama'];

      // Determine status
      let status = 'new';
      if (nextEpisode) status = 'new';
      else if (detail.status === 'Ended' || detail.status === 'Canceled') status = 'ended';
      else if (detail.vote_average >= 8) status = 'hot';

      // Build update note
      let updateNote = '';
      if (lastEpisode) {
        const epName = lastEpisode.name || `S${lastEpisode.season_number}E${lastEpisode.episode_number}`;
        const epDate = lastEpisode.air_date || '';
        updateNote = `最新: ${epName}`;
        if (epDate) updateNote += ` (${epDate})`;
      }
      if (nextEpisode) {
        updateNote += ` | 下集: S${nextEpisode.season_number}E${nextEpisode.episode_number}`;
        if (nextEpisode.air_date) updateNote += ` ${nextEpisode.air_date}播出`;
      }
      if (detail.number_of_seasons) {
        updateNote += ` | 共 ${detail.number_of_seasons} 季`;
      }

      // Map Chinese genre names for tags
      const tagMap = {
        18: '剧情', 10759: '动作', 35: '喜剧', 80: '犯罪', 9648: '悬疑',
        10765: '科幻', 99: '纪录', 16: '动画', 37: '西部'
      };
      const tags = detail.genres
        ? detail.genres.map(g => tagMap[g.id] || g.name).slice(0, 3)
        : [];

      shows.push({
        id: detail.id,
        title: detail.name || item.name,
        season: detail.seasons && detail.seasons.length > 0
          ? `S${detail.seasons[detail.seasons.length - 1].season_number}`
          : 'S1',
        episode: lastEpisode
          ? `E${lastEpisode.episode_number}`
          : '',
        category: category,
        rating: detail.vote_average ? Math.round(detail.vote_average * 10) / 10 : 0,
        source: 'Apple TV+',
        poster: detail.poster_path
          ? `https://image.tmdb.org/t/p/w300${detail.poster_path}`
          : '',
        summary: detail.overview || '',
        updateNote: updateNote,
        time: lastEpisode && lastEpisode.air_date
          ? lastEpisode.air_date.slice(5)
          : new Date().toISOString().slice(5, 10),
        tags: tags,
        status: status,
        firstAirDate: detail.first_air_date || ''
      });

      // Small delay to be polite to TMDB API
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  Failed to fetch ${item.name}:`, err.message);
    }
  }

  return shows;
}

async function main() {
  try {
    const config = loadConfig();
    if (!config.tmdbApiKey || config.tmdbApiKey === 'YOUR_TMDB_API_KEY_HERE') {
      console.error('Please set your TMDB API key in config.json');
      process.exit(1);
    }

    const shows = await fetchShows(config);

    const output = {
      updatedAt: new Date().toISOString(),
      count: shows.length,
      shows: shows
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\nDone! Saved ${shows.length} shows to data.json`);
    console.log(`Updated at: ${output.updatedAt}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
