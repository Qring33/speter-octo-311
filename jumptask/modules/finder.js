const { execSync } = require("child_process");

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
    // Fetch EXACTLY maxResults videos (recent uploads)
    const cmd = `yt-dlp -4 --print "%(description)s---VIDEO-END---" "ytsearchdate${maxResults}:${query}"`;

    let output;
    try {
      output = execSync(cmd, { encoding: "utf8" });
    } catch (error) {
      console.error("yt-dlp execution failed.");
      console.error("STDOUT:", error.stdout?.toString());
      console.error("STDERR:", error.stderr?.toString());
      throw error;
    }

    // Split descriptions by our hard separator
    const descriptions = output
      .split("---VIDEO-END---")
      .map(d => d.trim())
      .filter(Boolean)
      .slice(0, maxResults); // HARD LIMIT

    for (let i = 0; i < descriptions.length; i++) {
      videosChecked++;
      console.log(`Checking video #${i + 1} for query "${query}"...`);

      const description = descriptions[i];
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = description.match(urlRegex) || [];

      if (!urls.length) continue;

      // ONLY last URL in description
      const lastUrl = urls[urls.length - 1];

      if (!collectedUrls.includes(lastUrl)) {
        collectedUrls.push(lastUrl);
      }

      // JMPT match check
      if (lastUrl.includes("jmpt.network")) {
        if (lastUrl.includes(taskId)) {
          console.log("Found a URL with jmpt.network and matching ID:", lastUrl);
          return {
            urls: [lastUrl],
            videosChecked,
            matched: true,
            exclude: false
          };
        } else {
          console.log("Found a URL with jmpt.network but different ID:", lastUrl);
          return {
            urls: [],
            videosChecked,
            matched: false,
            exclude: true
          };
        }
      }
    }

    // No jmpt.network URLs found at all
    return {
      urls: collectedUrls.slice(-3), // last 3 URLs
      videosChecked,
      matched: false,
      exclude: false,
    };

  } catch (err) {
    console.error("Failed to get YouTube description:", err.message);
    return { urls: [], videosChecked, matched: false, exclude: false };
  }
}

module.exports = { getYoutubeLink };