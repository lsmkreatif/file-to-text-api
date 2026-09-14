import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer in-memory storage for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Helper extraction functions
async function extractTextPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function extractTextDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

async function extractTextImage(buffer: Buffer): Promise<string> {
  const result = await Tesseract.recognize(buffer, 'eng');
  return result.data.text || '';
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'file-to-text-api',
    supportedFormats: ['.pdf', '.docx', '.png', '.jpg', '.jpeg'],
    uptime: process.uptime(),
  });
});

// Main extraction endpoint matching the original FastAPI interface
app.post('/extract-text', upload.single('file') as any, async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "Missing file. Please upload a file with field name 'file'" });
  }

  const filename = req.file.originalname;
  const fileType = filename.toLowerCase();
  const buffer = req.file.buffer;

  try {
    let text = '';
    if (fileType.endsWith('.pdf')) {
      text = await extractTextPdf(buffer);
    } else if (fileType.endsWith('.docx')) {
      text = await extractTextDocx(buffer);
    } else if (
      fileType.endsWith('.png') ||
      fileType.endsWith('.jpg') ||
      fileType.endsWith('.jpeg')
    ) {
      text = await extractTextImage(buffer);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    return res.json({ filename, text });
  } catch (err: any) {
    console.error('Extraction error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Interactive API UI and Documentation served at root / and /docs
app.get(['/', '/docs'], (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File to Text API</title>
  <meta name="description" content="FastAPI to Express migration for extracting text from PDF, DOCX, and image files">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
    code, pre { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen">
  <div class="max-w-4xl mx-auto px-4 py-10">
    <!-- Header -->
    <header class="mb-8 pb-6 border-b border-slate-200">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight text-slate-900">File to Text API</h1>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Online (Port 3000)
            </span>
          </div>
          <p class="text-slate-600 mt-1 text-sm">
            Extract text from <span class="font-medium text-slate-800">PDF</span>, <span class="font-medium text-slate-800">DOCX</span>, and <span class="font-medium text-slate-800">Image (PNG, JPG, JPEG)</span> files.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <a href="/health" target="_blank" class="text-xs px-3 py-1.5 font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition">
            GET /health
          </a>
          <span class="text-xs px-3 py-1.5 font-medium rounded-md bg-slate-900 text-white">
            POST /extract-text
          </span>
        </div>
      </div>
    </header>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
      <!-- Interactive Tester Section (7 cols) -->
      <section class="md:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 class="text-lg font-semibold text-slate-900 mb-1">Interactive Extractor</h2>
        <p class="text-xs text-slate-500 mb-5">Upload any supported document or image to test the API endpoint directly in your browser.</p>

        <!-- Upload Form -->
        <form id="extractForm" class="space-y-4">
          <div
            id="dropzone"
            class="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-slate-50"
          >
            <input type="file" id="fileInput" name="file" class="hidden" accept=".pdf,.docx,.png,.jpg,.jpeg">
            <div id="dropzoneContent" class="flex flex-col items-center">
              <svg class="w-10 h-10 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p class="text-sm font-medium text-slate-700">Click to upload or drag & drop</p>
              <p class="text-xs text-slate-500 mt-1">PDF, DOCX, PNG, JPG, or JPEG (Max 50MB)</p>
            </div>
            <div id="fileSelectedInfo" class="hidden text-left bg-white p-3 rounded-lg border border-slate-200">
              <div class="flex items-center justify-between">
                <div class="truncate">
                  <p id="selectedFileName" class="text-sm font-medium text-slate-800 truncate"></p>
                  <p id="selectedFileSize" class="text-xs text-slate-500 mt-0.5"></p>
                </div>
                <button type="button" id="removeFileBtn" class="text-slate-400 hover:text-rose-500 p-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            id="submitBtn"
            disabled
            class="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <span>Extract Text</span>
            <svg id="loadingSpinner" class="hidden animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </button>
        </form>

        <!-- Status & Result Area -->
        <div id="statusContainer" class="hidden mt-6 pt-5 border-t border-slate-200">
          <div id="errorMessage" class="hidden p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs mb-4"></div>

          <div id="resultBox" class="hidden">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-700">Result</span>
                <span id="statBadge" class="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono"></span>
              </div>
              <button
                type="button"
                id="copyBtn"
                class="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition flex items-center gap-1"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span id="copyBtnText">Copy Text</span>
              </button>
            </div>
            <div class="bg-slate-900 rounded-lg p-4 max-h-72 overflow-y-auto">
              <pre id="outputPre" class="text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed"></pre>
            </div>
          </div>
        </div>
      </section>

      <!-- Documentation & Examples (5 cols) -->
      <aside class="md:col-span-5 space-y-6">
        <!-- Endpoint Spec Card -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 class="text-sm font-semibold text-slate-900 mb-3">API Specification</h2>
          <div class="space-y-3 text-xs">
            <div>
              <span class="text-slate-500 block mb-1">Method & Path</span>
              <div class="font-mono bg-slate-100 text-slate-800 px-2.5 py-1.5 rounded border border-slate-200 font-medium">
                POST /extract-text
              </div>
            </div>
            <div>
              <span class="text-slate-500 block mb-1">Content-Type</span>
              <code class="bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200 block">multipart/form-data</code>
            </div>
            <div>
              <span class="text-slate-500 block mb-1">Body Parameter</span>
              <div class="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                <span class="font-mono font-medium text-slate-900">file</span>
                <span class="text-slate-500 text-[11px] block mt-0.5">Binary document or image file</span>
              </div>
            </div>
            <div>
              <span class="text-slate-500 block mb-1">Supported Extensions</span>
              <div class="flex flex-wrap gap-1">
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">.pdf</span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">.docx</span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">.png</span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">.jpg</span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">.jpeg</span>
              </div>
            </div>
          </div>
        </div>

        <!-- cURL Snippet Card -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 class="text-sm font-semibold text-slate-900 mb-2">cURL Example</h2>
          <div class="bg-slate-900 rounded-lg p-3 text-[11px] text-slate-200 overflow-x-auto">
            <pre><code>curl -X POST \\
  http://localhost:3000/extract-text \\
  -F "file=@document.pdf"</code></pre>
          </div>
        </div>

        <!-- Response Schema Card -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 class="text-sm font-semibold text-slate-900 mb-2">Response (200 OK)</h2>
          <div class="bg-slate-900 rounded-lg p-3 text-[11px] text-slate-200 overflow-x-auto">
            <pre><code>{
  "filename": "document.pdf",
  "text": "Extracted text content..."
}</code></pre>
          </div>
        </div>
      </aside>
    </div>
  </div>

  <script>
    const form = document.getElementById('extractForm');
    const fileInput = document.getElementById('fileInput');
    const dropzone = document.getElementById('dropzone');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const fileSelectedInfo = document.getElementById('fileSelectedInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const submitBtn = document.getElementById('submitBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const statusContainer = document.getElementById('statusContainer');
    const errorMessage = document.getElementById('errorMessage');
    const resultBox = document.getElementById('resultBox');
    const outputPre = document.getElementById('outputPre');
    const statBadge = document.getElementById('statBadge');
    const copyBtn = document.getElementById('copyBtn');
    const copyBtnText = document.getElementById('copyBtnText');

    let currentFile = null;

    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('#removeFileBtn')) return;
      fileInput.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-slate-900', 'bg-slate-100');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-slate-900', 'bg-slate-100');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-slate-900', 'bg-slate-100');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelected(e.target.files[0]);
      }
    });

    function formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function handleFileSelected(file) {
      currentFile = file;
      selectedFileName.textContent = file.name;
      selectedFileSize.textContent = formatBytes(file.size);
      dropzoneContent.classList.add('hidden');
      fileSelectedInfo.classList.remove('hidden');
      submitBtn.disabled = false;
      errorMessage.classList.add('hidden');
    }

    removeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentFile = null;
      fileInput.value = '';
      dropzoneContent.classList.remove('hidden');
      fileSelectedInfo.classList.add('hidden');
      submitBtn.disabled = true;
      resultBox.classList.add('hidden');
      statusContainer.classList.add('hidden');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentFile) return;

      submitBtn.disabled = true;
      loadingSpinner.classList.remove('hidden');
      statusContainer.classList.remove('hidden');
      errorMessage.classList.add('hidden');
      resultBox.classList.add('hidden');

      const formData = new FormData();
      formData.append('file', currentFile);

      try {
        const res = await fetch('/extract-text', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to extract text (' + res.status + ')');
        }

        const textContent = data.text || '';
        outputPre.textContent = textContent.length > 0 ? textContent : '[Document contains no extractable text]';
        const wordCount = textContent.trim() ? textContent.trim().split(/\\s+/).length : 0;
        statBadge.textContent = wordCount + ' words • ' + textContent.length + ' chars';
        resultBox.classList.remove('hidden');
      } catch (err) {
        errorMessage.textContent = err.message || 'An error occurred during extraction';
        errorMessage.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        loadingSpinner.classList.add('hidden');
      }
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(outputPre.textContent);
        copyBtnText.textContent = 'Copied!';
        setTimeout(() => { copyBtnText.textContent = 'Copy Text'; }, 2000);
      } catch (err) {
        copyBtnText.textContent = 'Failed';
      }
    });
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start listening on port 3000 (0.0.0.0)
app.listen(PORT, HOST, () => {
  console.log(`File to Text API server running at http://${HOST}:${PORT}`);
});
