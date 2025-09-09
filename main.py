from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import fitz  # PyMuPDF
import docx
import pytesseract
from PIL import Image
import io

app = FastAPI(title="File to Text API")

def extract_text_pdf(file_bytes):
    text = ""
    pdf = fitz.open(stream=file_bytes, filetype="pdf")
    for page in pdf:
        text += page.get_text()
    return text

def extract_text_docx(file_bytes):
    text = ""
    doc = docx.Document(io.BytesIO(file_bytes))
    for para in doc.paragraphs:
        text += para.text + "\n"
    return text

def extract_text_image(file_bytes):
    img = Image.open(io.BytesIO(file_bytes))
    text = pytesseract.image_to_string(img)
    return text

@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    content = await file.read()
    file_type = file.filename.lower()

    try:
        if file_type.endswith(".pdf"):
            text = extract_text_pdf(content)
        elif file_type.endswith(".docx"):
            text = extract_text_docx(content)
        elif file_type.endswith((".png", ".jpg", ".jpeg")):
            text = extract_text_image(content)
        else:
            return JSONResponse(status_code=400, content={"error": "Unsupported file type"})
        return {"filename": file.filename, "text": text}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
