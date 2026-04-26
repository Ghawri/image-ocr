const form = document.getElementById("uploadForm");
const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
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

async function startCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera is not supported in this browser.");
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
    captureBtn.disabled = false;
    retakeBtn.disabled = true;
    statusText.textContent = "Camera ready. Capture a photo to submit.";
  } catch (err) {
    statusText.textContent = `Error: ${err.message}`;
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
  retakeBtn.disabled = true;
  captureBtn.disabled = false;
  startCamera();
}

startCameraBtn.addEventListener("click", startCamera);
captureBtn.addEventListener("click", capturePhoto);
retakeBtn.addEventListener("click", resetCapture);

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
