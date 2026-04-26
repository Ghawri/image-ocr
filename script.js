const form = document.getElementById("uploadForm");
const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const fallbackCaptureBtn = document.getElementById("fallbackCaptureBtn");
const fallbackCameraInput = document.getElementById("fallbackCameraInput");
const cameraView = document.getElementById("cameraView");
const preview = document.getElementById("preview");
const captureCanvas = document.getElementById("captureCanvas");
const submitBtn = document.getElementById("submitBtn");
const statusText = document.getElementById("status");
const resultSection = document.getElementById("resultSection");
const resultMeta = document.getElementById("resultMeta");
const tablesContainer = document.getElementById("tablesContainer");

let cameraStream = null;
let capturedBlob = null;

function cameraApiAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function showCameraFallback(reason) {
  startCameraBtn.disabled = false;
  captureBtn.disabled = true;
  retakeBtn.disabled = capturedBlob === null;
  fallbackCaptureBtn.hidden = false;
  statusText.textContent = reason;
}

function mapCameraError(err) {
  if (!err) {
    return "Camera access failed.";
  }

  if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
    return "Camera permission was denied. Allow camera in browser site settings and try again.";
  }

  if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
    return "No camera device was found on this system.";
  }

  if (err.name === "NotReadableError" || err.name === "TrackStartError") {
    return "Camera is busy in another app. Close other camera apps and retry.";
  }

  if (err.name === "OverconstrainedError") {
    return "Requested camera mode is not available on this device.";
  }

  return err.message || "Camera access failed.";
}

async function startCamera() {
  try {
    if (!window.isSecureContext) {
      showCameraFallback("Live camera needs HTTPS. Using device camera fallback.");
      return;
    }

    if (window.top !== window.self) {
      showCameraFallback("This page is inside an iframe. Host page must allow camera permission.");
      return;
    }

    if (!cameraApiAvailable()) {
      showCameraFallback("Live camera API is unavailable. Using device camera fallback.");
      return;
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });

    cameraView.srcObject = cameraStream;
    cameraView.hidden = false;
    preview.hidden = true;
    preview.removeAttribute("src");
    capturedBlob = null;
    fallbackCaptureBtn.hidden = true;
    startCameraBtn.disabled = false;
    captureBtn.disabled = false;
    retakeBtn.disabled = true;
    statusText.textContent = "Camera ready. Capture a photo to submit.";
  } catch (err) {
    const reason = mapCameraError(err);
    showCameraFallback(`${reason} Using device camera fallback.`);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraView.srcObject = null;
  cameraView.hidden = true;
}

function capturePhoto() {
  if (!cameraStream) {
    statusText.textContent = "Start the camera first.";
    return;
  }

  const videoWidth = cameraView.videoWidth;
  const videoHeight = cameraView.videoHeight;
  if (!videoWidth || !videoHeight) {
    statusText.textContent = "Camera is still starting. Please try again in a second.";
    return;
  }

  captureCanvas.width = videoWidth;
  captureCanvas.height = videoHeight;

  const context = captureCanvas.getContext("2d");
  context.drawImage(cameraView, 0, 0, videoWidth, videoHeight);

  captureCanvas.toBlob((blob) => {
    if (!blob) {
      statusText.textContent = "Unable to capture image.";
      return;
    }

    capturedBlob = blob;
    preview.src = URL.createObjectURL(blob);
    preview.hidden = false;
    stopCamera();
    captureBtn.disabled = true;
    retakeBtn.disabled = false;
    statusText.textContent = "Photo captured. Submit it to process the image.";
  }, "image/jpeg", 0.95);
}

function resetCapture() {
  capturedBlob = null;
  preview.hidden = true;
  preview.removeAttribute("src");
  fallbackCameraInput.value = "";
  retakeBtn.disabled = true;
  captureBtn.disabled = !cameraApiAvailable() || !window.isSecureContext;
  startCamera();
}

startCameraBtn.addEventListener("click", startCamera);
captureBtn.addEventListener("click", capturePhoto);
retakeBtn.addEventListener("click", resetCapture);
fallbackCaptureBtn.addEventListener("click", () => {
  fallbackCameraInput.click();
});

fallbackCameraInput.addEventListener("change", () => {
  const file = fallbackCameraInput.files && fallbackCameraInput.files[0];
  if (!file) {
    return;
  }

  stopCamera();
  capturedBlob = file;
  captureBtn.disabled = true;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  retakeBtn.disabled = false;
  statusText.textContent = "Photo captured from device camera. Submit to process.";
});

function buildRowTable(obj, index) {
  const table = document.createElement("table");
  table.className = "data-table";

  const caption = document.createElement("caption");
  caption.textContent = `Entry ${index + 1}`;
  caption.style.textAlign = "left";
  caption.style.marginBottom = "6px";
  table.appendChild(caption);

  Object.entries(obj).forEach(([key, value]) => {
    const tr = document.createElement("tr");

    const th = document.createElement("th");
    th.textContent = key;

    const td = document.createElement("td");
    td.textContent = value === null || value === undefined ? "" : String(value);

    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
  });

  return table;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!capturedBlob) {
    statusText.textContent = "Please capture a photo from the camera first.";
    return;
  }

  const formData = new FormData();
  formData.append("image", capturedBlob, "camera-capture.jpg");

  submitBtn.disabled = true;
  statusText.textContent = "Processing image...";
  resultSection.hidden = true;
  tablesContainer.innerHTML = "";

  try {
    const res = await fetch("/extract", {
      method: "POST",
      body: formData,
    });

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.details || payload.error || "Unknown server error");
    }

    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    resultMeta.textContent = `Total extracted entries: ${rows.length}`;
    rows.forEach((entry, idx) => {
      tablesContainer.appendChild(buildRowTable(entry, idx));
    });

    resultSection.hidden = false;
    statusText.textContent = "Completed successfully.";
  } catch (err) {
    statusText.textContent = `Error: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  stopCamera();
});

if (!window.isSecureContext || !cameraApiAvailable()) {
  showCameraFallback("Live camera is blocked here. Tap 'Capture From Device Camera'.");
}

if (cameraApiAvailable() && window.isSecureContext) {
  navigator.permissions?.query?.({ name: "camera" }).then((result) => {
    if (result.state === "denied") {
      showCameraFallback("Camera permission is blocked for this site. Enable it in browser settings.");
    }
  }).catch(() => {});
}
