const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const submitBtn = document.getElementById("submitBtn");
const statusText = document.getElementById("status");
const resultSection = document.getElementById("resultSection");
const resultMeta = document.getElementById("resultMeta");
const tablesContainer = document.getElementById("tablesContainer");

imageInput.addEventListener("change", () => {
  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    preview.hidden = true;
    preview.removeAttribute("src");
    return;
  }

  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
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

  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    statusText.textContent = "Please select an image first.";
    return;
  }

  const formData = new FormData();
  formData.append("image", file);

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
