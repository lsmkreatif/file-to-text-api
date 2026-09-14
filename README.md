# File to Text API

A Node.js / Express API service that extracts text from documents and images, migrated from FastAPI.

## Features

- **PDF Extraction**: Extracts text from `.pdf` files using `pdf-parse`.
- **DOCX Extraction**: Extracts formatted paragraph text from `.docx` files using `mammoth`.
- **Image OCR**: Performs optical character recognition on `.png`, `.jpg`, and `.jpeg` files using `tesseract.js`.
- **Interactive UI**: Includes an in-browser tester at root `/` and `/docs`.
- **Health Check**: Health endpoint at `GET /health`.

## API Endpoints

### `POST /extract-text`

Upload a document or image file to extract its textual content.

- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (binary)
- **Supported File Types**: `.pdf`, `.docx`, `.png`, `.jpg`, `.jpeg`

#### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/extract-text \
  -F "file=@sample.pdf"
```

#### Example Response (200 OK)

```json
{
  "filename": "sample.pdf",
  "text": "Extracted text content from the document..."
}
```

#### Error Responses

- `400 Bad Request`: When no file is uploaded or file type is not supported.
  ```json
  { "error": "Unsupported file type" }
  ```
- `500 Internal Server Error`: Extraction processing failure.
  ```json
  { "error": "Error details..." }
  ```

### `GET /health`

Returns service status and supported file formats.

```json
{
  "status": "ok",
  "service": "file-to-text-api",
  "supportedFormats": [".pdf", ".docx", ".png", ".jpg", ".jpeg"],
  "uptime": 12.34
}
```

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```
