const DEFAULT_READER_BASE_URL = "http://localhost:3000";

const input = document.getElementById("baseUrl");
const status = document.getElementById("status");

chrome.storage.sync
  .get({ readerBaseUrl: DEFAULT_READER_BASE_URL })
  .then(({ readerBaseUrl }) => {
    input.value = readerBaseUrl;
  });

document.getElementById("save").addEventListener("click", async () => {
  const value = input.value.trim() || DEFAULT_READER_BASE_URL;
  await chrome.storage.sync.set({ readerBaseUrl: value });
  status.textContent = "Saved";
  setTimeout(() => (status.textContent = ""), 1500);
});
