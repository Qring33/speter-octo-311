const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * Search YouTube (recent uploads) and extract LAST URL from each video description
 * @param {string} query
 * @param {string} taskId
 * @param {number} maxResults
 * @returns {Object} { urls, videosChecked, matched, exclude }
 */
async function getYoutubeLink(query, taskId, maxResults = 10) {
  let collectedUrls = [];
  let videosChecked = 0;

  try {
    // 🔹 Read API key from MAIN directory (../yt_api_txt)
    const apiKeyPath = path.join(__dirname, "../yt_api_txt");
    const API_KEY = fs.readFileSync(apiKeyPath, "utf8").trim();

    if (!API_KEY) {
      throw new Error("YouTube API key file is empty.");
    }

    // 1️⃣ Search recent videos
    const searchRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          part: "snippet",
          q: query,
          maxResults,
          order: "date",
          type: "video",
          key: API_KEY,
        },
      }
    );

    const videoIds = searchRes.data.items.map(item => item.id.videoId);

    if (!videoIds.length) {
      return { urls: [], videosChecked, matched: false, exclude: false };
    }

    // 2️⃣ Get video details (descriptions)
    const videosRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        params: {
          part: "snippet",
          id: videoIds.join(","),
          key: API_KEY,
        },
      }
    );

    const videos = videosRes.data.items;

    for (let i = 0; i < videos.length; i++) {
      videosChecked++;
      console.log(`Checking video #${i + 1} for query "${query}"...`);

      const description = videos[i].snippet.description;

      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = description.match(urlRegex) || [];

      if (!urls.length) continue;

      // ONLY last URL in description
      const lastUrl = urls[urls.length - 1];

      if (!collectedUrls.includes(lastUrl)) {
        collectedUrls.push(lastUrl);
      }

      // JMPT match check (unchanged logic)
      if (lastUrl.includes("jmpt.network")) {
        if (lastUrl.includes(taskId)) {
          console.log("Found matching jmpt.network URL:", lastUrl);
          return {
            urls: [lastUrl],
            videosChecked,
            matched: true,
            exclude: false
          };
        } else {
          console.log("Found jmpt.network but different ID:", lastUrl);
          return {
            urls: [],
            videosChecked,
            matched: false,
            exclude: true
          };
        }
      }
    }

    // No jmpt.network URLs found
    return {
      urls: collectedUrls.slice(-3),
      videosChecked,
      matched: false,
      exclude: false,
    };

  } catch (err) {
    console.error("YouTube API error:", err.message);
    return { urls: [], videosChecked, matched: false, exclude: false };
  }
}

module.exports = { getYoutubeLink };