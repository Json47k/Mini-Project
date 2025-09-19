// ====== DOM Elements ======
const video = document.getElementById("video");
const canvasDisp = document.getElementById("display");
const ctxDisp = canvasDisp.getContext("2d", { willReadFrequently: true });
const overlayText = document.getElementById("overlayText");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

// ====== Config ======
const SCAN_SIZE = 250; // square scan box in pixels
let scanBox = { x: 0, y: 0, size: SCAN_SIZE };
let lastDecoded = "";
let qrDecoderBusy = false;
let currentColor = "red";
let cvReady = false;
let animationFrameId;  // Store animation frame ID

// ====== Helpers ======
function speak(text) {
  if (!text) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

// ====== Reset Scanning Function ======
function resetScanning() {
  foundResults.clear();
  scanStartTime = Date.now();
  statusEl.textContent = "Scanning reset...";
  overlayText.textContent = "Looking for all color QR codes...";
  resultEl.innerHTML = "";
  console.log("🔄 Scanning reset - looking for all colors");
}

// ====== Camera ======
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  canvasDisp.width = video.videoWidth;
  canvasDisp.height = video.videoHeight;

  scanBox.x = (canvasDisp.width - SCAN_SIZE) / 2;
  scanBox.y = (canvasDisp.height - SCAN_SIZE) / 2;
  
  // Reset scanning state when camera starts
  resetScanning();
}

// ====== Multi-color Decode (Wait for All Colors) ======
let foundResults = new Map(); // Store found results by color
let scanStartTime = Date.now();
const MAX_SCAN_TIME = 30000; // 30 seconds max scanning time

function tryDecodeAll() {
  if (qrDecoderBusy) return;
  qrDecoderBusy = true;

  let imageData = ctxDisp.getImageData(scanBox.x, scanBox.y, scanBox.size, scanBox.size);
  let newResults = [];
  let debugInfo = [];

  // Try each color channel
  ["red", "green", "blue"].forEach(color => {
    // Skip if we already found this color
    if (foundResults.has(color)) return;

    try {
      // Method 1: Try OpenCV filtering if available
      if (cvReady && !foundResults.has(color)) {
        try {
          let filteredImageData = preprocessWithOpenCV(imageData, color);
          const code = jsQR(filteredImageData.data, filteredImageData.width, filteredImageData.height, {
            inversionAttempts: "attemptBoth"
          });

          if (code && code.data) {
            const decoded = code.data.trim().replace(/\s+/g, "");
            console.log(`✅ Decoded from ${color} (OpenCV):`, decoded);
            debugInfo.push(`${color}-OpenCV: ${decoded}`);
            
            let resultData = {
              color,
              decoded,
              method: "OpenCV"
            };

            if (qrData[color] && qrData[color][decoded]) {
              resultData = { ...resultData, ...qrData[color][decoded] };
            } else {
              resultData.text = `Unknown ${color.toUpperCase()} QR: ${decoded}`;
              resultData.voice = `Unknown ${color} QR code detected`;
            }

            foundResults.set(color, resultData);
            newResults.push(resultData);
          }
        } catch (cvError) {
          console.error(`OpenCV error for ${color}:`, cvError);
        }
      }
      
      // Method 2: Try simple RGB channel extraction
      if (!foundResults.has(color)) {
        try {
          let channelImageData = extractColorChannel(imageData, color);
          const code = jsQR(channelImageData.data, channelImageData.width, channelImageData.height, {
            inversionAttempts: "attemptBoth"
          });

          if (code && code.data) {
            const decoded = code.data.trim().replace(/\s+/g, "");
            console.log(`✅ Decoded from ${color} (Channel):`, decoded);
            debugInfo.push(`${color}-Channel: ${decoded}`);
            
            let resultData = {
              color,
              decoded,
              method: "Channel"
            };

            if (qrData[color] && qrData[color][decoded]) {
              resultData = { ...resultData, ...qrData[color][decoded] };
            } else {
              resultData.text = `Unknown ${color.toUpperCase()} QR: ${decoded}`;
              resultData.voice = `Unknown ${color} QR code detected`;
            }

            foundResults.set(color, resultData);
            newResults.push(resultData);
          }
        } catch (channelError) {
          console.error(`Channel extraction error for ${color}:`, channelError);
        }
      }
    } catch (error) {
      console.error(`General error processing ${color}:`, error);
    }
  });

  // Check scanning progress
  const foundColors = Array.from(foundResults.keys());
  const allResults = Array.from(foundResults.values());
  const scanTime = (Date.now() - scanStartTime) / 1000;
  
  // Update status based on progress
  if (foundColors.length === 0) {
    statusEl.textContent = `Scanning... (${scanTime.toFixed(1)}s)`;
    overlayText.textContent = "Looking for QR codes...";
  } else if (foundColors.length < 3) {
    const missing = ["red", "green", "blue"].filter(c => !foundColors.includes(c));
    statusEl.textContent = `Found ${foundColors.length}/3 colors - Missing: ${missing.join(', ')} (${scanTime.toFixed(1)}s)`;
    overlayText.textContent = `Found: ${foundColors.join(', ')} - Keep scanning...`;
    
    // Play sound for newly found QR
    newResults.forEach(r => {
      speak(`${r.color} QR found: ${r.voice || r.text}`);
    });
  }

  // Display current results
  if (allResults.length > 0) {
    resultEl.innerHTML = allResults.map(r =>
      `<div><b style="color:${r.color}">${r.color.toUpperCase()}:</b> ${r.text} <small>(${r.method})</small></div>`
    ).join("");
  }

  // Stop scanning conditions
  const shouldStop = foundColors.length === 3 || scanTime > MAX_SCAN_TIME;
  
  if (shouldStop) {
    if (foundColors.length === 3) {
      statusEl.textContent = "🎉 All colors decoded successfully!";
      overlayText.textContent = "Complete! All QR codes found.";
      speak("All QR codes successfully detected");
    } else {
      statusEl.textContent = `⏰ Scan timeout - Found ${foundColors.length}/3 colors`;
      overlayText.textContent = "Scan completed (timeout)";
      speak("Scan completed");
    }
    
    // Stop scanning
    cancelAnimationFrame(animationFrameId);
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
  } else {
    // Show debug info for missing colors
    const missing = ["red", "green", "blue"].filter(c => !foundColors.includes(c));
    if (debugInfo.length > 0) {
      resultEl.innerHTML += `<br><small style="color: #888">Still looking for: ${missing.join(', ')}</small>`;
    }
  }

  setTimeout(() => { qrDecoderBusy = false; }, 100);
}

// ====== Simple RGB Channel Extraction (Enhanced with Debugging) ======
function extractColorChannel(imageData, color) {
  const data = new Uint8ClampedArray(imageData.data);
  let pixelCount = 0;
  let colorPixels = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    pixelCount++;
    
    if (color === "red") {
      // Keep only red channel, make it grayscale
      const intensity = r;
      if (r > g && r > b && r > 50) colorPixels++; // Count red-dominant pixels
      data[i] = intensity;     
      data[i + 1] = intensity; 
      data[i + 2] = intensity; 
    } else if (color === "green") {
      // Keep only green channel
      const intensity = g;
      if (g > r && g > b && g > 50) colorPixels++; // Count green-dominant pixels
      data[i] = intensity;     
      data[i + 1] = intensity; 
      data[i + 2] = intensity; 
    } else if (color === "blue") {
      // Keep only blue channel
      const intensity = b;
      if (b > r && b > g && b > 50) colorPixels++; // Count blue-dominant pixels
      data[i] = intensity;     
      data[i + 1] = intensity; 
      data[i + 2] = intensity; 
    }
  }
  
  // Debug: Log color statistics
  const colorRatio = colorPixels / pixelCount;
  if (colorRatio > 0.01) { // Only log if there's significant color content
    console.log(`${color} channel: ${colorPixels}/${pixelCount} pixels (${(colorRatio*100).toFixed(1)}%)`);
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

// ====== OpenCV Preprocessing (Enhanced) ======
function preprocessWithOpenCV(imageData, color) {
  if (!cvReady) return imageData;

  const src = cv.matFromImageData(imageData);
  let processed = new cv.Mat();
  
  // Convert to HSV for better color filtering
  cv.cvtColor(src, processed, cv.COLOR_RGBA2RGB);
  cv.cvtColor(processed, processed, cv.COLOR_RGB2HSV);
  
  let mask = new cv.Mat();
  let low, high;

  if (color === "red") {
    // Red has two ranges in HSV (0-10 and 170-180)
    let mask1 = new cv.Mat(), mask2 = new cv.Mat();
    
    // Lower red range (0-10) - more permissive
    low = new cv.Scalar(0, 50, 50);
    high = new cv.Scalar(15, 255, 255);
    cv.inRange(processed, low, high, mask1);
    
    // Upper red range (165-180) - more permissive
    low = new cv.Scalar(165, 50, 50);
    high = new cv.Scalar(180, 255, 255);
    cv.inRange(processed, low, high, mask2);
    
    // Combine both masks
    cv.add(mask1, mask2, mask);
    mask1.delete(); 
    mask2.delete();
    
  } else if (color === "green") {
    // Green range (40-80) - more focused on pure green
    low = new cv.Scalar(40, 40, 40);
    high = new cv.Scalar(80, 255, 255);
    cv.inRange(processed, low, high, mask);
    
  } else if (color === "blue") {
    // Blue range (100-130) - more focused on pure blue
    low = new cv.Scalar(100, 40, 40);
    high = new cv.Scalar(130, 255, 255);
    cv.inRange(processed, low, high, mask);
  }

  // Apply morphological operations to clean up the mask
  let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
  cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
  kernel.delete();

  // Convert mask to RGBA ImageData for jsQR
  let rgba = new cv.Mat();
  cv.cvtColor(mask, rgba, cv.COLOR_GRAY2RGBA);
  const imageDataOut = new ImageData(
    new Uint8ClampedArray(rgba.data), 
    rgba.cols, 
    rgba.rows
  );

  // Clean up
  src.delete(); 
  processed.delete(); 
  mask.delete(); 
  rgba.delete();
  
  return imageDataOut;
}

// ====== Main Loop ======
function processFrame() {
  animationFrameId = requestAnimationFrame(processFrame);
  ctxDisp.drawImage(video, 0, 0, canvasDisp.width, canvasDisp.height);

  // Draw scan box
  ctxDisp.strokeStyle = "yellow";
  ctxDisp.lineWidth = 3;
  ctxDisp.strokeRect(scanBox.x, scanBox.y, scanBox.size, scanBox.size);

  tryDecodeAll();
}

// ====== Initialize ======
function onOpenCVReady() {
  cvReady = true;
  console.log("OpenCV ready");
  statusEl.textContent = "OpenCV loaded - Enhanced color detection enabled";
}

// Debug function to test QR detection
function debugQRDetection() {
  console.log("=== QR Detection Debug ===");
  console.log("jsQR available:", typeof jsQR !== 'undefined');
  console.log("OpenCV ready:", cvReady);
  console.log("Video dimensions:", video.videoWidth, video.videoHeight);
  console.log("Canvas dimensions:", canvasDisp.width, canvasDisp.height);
  console.log("Scan box:", scanBox);
  console.log("QR Data keys:", Object.keys(qrData));
  console.log("Found results:", Array.from(foundResults.entries()));
  console.log("Scan time:", (Date.now() - scanStartTime) / 1000, "seconds");
  
  // Test with current frame
  if (video.videoWidth > 0) {
    let imageData = ctxDisp.getImageData(scanBox.x, scanBox.y, scanBox.size, scanBox.size);
    console.log("Image data:", imageData.width, imageData.height, "pixels");
    
    // Try basic QR detection
    const testCode = jsQR(imageData.data, imageData.width, imageData.height);
    console.log("Basic QR test result:", testCode ? testCode.data : "No QR found");
  }
}

// Restart scanning function
async function restartScanning() {
  console.log("🔄 Restarting scanning...");
  
  // Stop current scanning
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  // Stop camera
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
  
  // Reset state
  resetScanning();
  
  try {
    // Restart camera
    await startCamera();
    statusEl.textContent = "🔄 Scanning restarted";
    processFrame();
  } catch (error) {
    statusEl.textContent = "❌ Camera restart failed";
    console.error("Camera restart error:", error);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("=== App Initialization ===");
  statusEl.textContent = "Initializing...";
  
  // Check dependencies
  if (typeof jsQR === 'undefined') {
    statusEl.textContent = "❌ jsQR library not loaded";
    console.error("jsQR library missing");
    return;
  }
  
  if (typeof qrData === 'undefined') {
    statusEl.textContent = "❌ QR data not loaded";
    console.error("qrData not available");
    return;
  }
  
  console.log("Dependencies OK - jsQR:", typeof jsQR, "qrData:", typeof qrData);
  statusEl.textContent = "Loading OpenCV...";
  
  // Handle OpenCV loading with timeout
  let opencvTimeout = setTimeout(() => {
    console.warn("OpenCV loading timeout - proceeding without it");
    statusEl.textContent = "OpenCV timeout - using basic detection";
  }, 10000);
  
  if (window.cv) {
    if (window.cv.Mat) {
      clearTimeout(opencvTimeout);
      onOpenCVReady();
    } else {
      cv.onRuntimeInitialized = () => {
        clearTimeout(opencvTimeout);
        onOpenCVReady();
      };
    }
  } else {
    // Wait for OpenCV to load
    const checkOpenCV = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(checkOpenCV);
        clearTimeout(opencvTimeout);
        onOpenCVReady();
      }
    }, 100);
  }

  statusEl.textContent = "Starting camera...";
  overlayText.textContent = "Initializing camera...";
  
  try {
    await startCamera();
    statusEl.textContent = cvReady ? "✅ Ready - Enhanced detection" : "⚠️ Ready - Basic detection only";
    overlayText.textContent = "Scanning for QR codes...";
    
    // Add debug and restart functions for testing
    setTimeout(() => {
      window.debugQR = debugQRDetection;
      window.restartScan = restartScanning;
      console.log("🔧 Debug functions available:");
      console.log("- debugQR() - shows debug info");
      console.log("- restartScan() - restarts the scanning process");
    }, 1000);
    
    processFrame();
    
  } catch (error) {
    statusEl.textContent = "❌ Camera access denied";
    statusEl.classList.add("error");
    console.error("Camera error:", error);
  }
});