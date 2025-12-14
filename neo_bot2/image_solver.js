const vision = require('@google-cloud/vision');

// Create client using JSON key directly
const client = new vision.ImageAnnotatorClient({
  keyFilename: 'image_solver.json'
});

async function extractContinuousText(imagePath) {
  try {
    const [result] = await client.textDetection(imagePath);
    const detections = result.textAnnotations;

    if (detections.length === 0) return;

    const fullText = detections[0].description;

    // Keep only letters and numbers, remove spaces/newlines
    const continuousText = fullText.replace(/[^A-Za-z0-9]/g, '');

    console.log(continuousText); // Only output the value

  } catch (err) {
    console.error(err);
  }
}

// Path to your image
extractContinuousText('cap.png');