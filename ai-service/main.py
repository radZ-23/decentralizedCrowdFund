from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
from PIL import Image
import fitz  # PyMuPDF
import hashlib
import os
import re
import time
from pathlib import Path
from datetime import datetime

app = FastAPI(title="MedTrustFund AI Verification Service v2.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Medical keywords for content validation
MEDICAL_KEYWORDS = {
    "diagnosis", "admission", "discharge", "treatment", "surgery",
    "hospital", "doctor", "patient", "bill", "report", "prescription",
    "medication", "procedure", "insurance", "claim", "medical"
}

# Document type keywords
DOCUMENT_TYPE_KEYWORDS = {
    "identity": ["aadhaar", "passport", "id card", "government id", "national id"],
    "diagnosis": ["diagnosis", "test result", "lab report", "scan report", "pathology"],
    "admission_letter": ["admission", "admit", "hospitalization", "bed assignment"],
    "cost_estimate": ["estimate", "cost", "bill", "invoice", "amount", "rs.", "rupees"]
}

# Weights for risk score formula (SRS v2.0)
# RiskScore = w1 × TamperingScore + w2 × AIProbability + w3 × MetadataMismatchScore
WEIGHTS = {
    "tampering": 0.35,      # w1 - Image tampering indicators
    "ai_probability": 0.35, # w2 - AI-generated content probability
    "metadata_mismatch": 0.30 # w3 - Cross-document metadata inconsistencies
}

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF using PyMuPDF"""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text.lower()
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""

def extract_text_from_image(image_path: str) -> str:
    """Extract text from image using Tesseract OCR"""
    try:
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image, lang='eng').lower()
        return text
    except Exception as e:
        print(f"OCR extraction error: {e}")
        return ""

def detect_document_type(text: str) -> str:
    """Classify document type based on content"""
    scores = {}
    for doc_type, keywords in DOCUMENT_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        scores[doc_type] = score

    if max(scores.values()) == 0:
        return "unknown"
    return max(scores, key=scores.get)

def check_image_tampering(file_path: str) -> dict:
    """
    Detect potential image tampering indicators
    Returns tampering score (0-100) and details
    """
    tampering_indicators = []
    tampering_score = 0

    try:
        # Check file size anomalies
        file_size = os.path.getsize(file_path)
        if file_size < 10_000:  # Less than 10KB - suspicious
            tampering_score += 30
            tampering_indicators.append("Very small file size - possible compression artifacts")

        # Check for metadata anomalies
        img = Image.open(file_path)
        info = img.info

        # Check if metadata has been stripped (common in edited images)
        if not info or len(info) == 0:
            tampering_score += 15
            tampering_indicators.append("No EXIF metadata - possibly stripped")

        # Check for inconsistent dimensions
        width, height = img.size
        if width > 4000 or height > 4000:  # Unusually high resolution
            tampering_score += 10
            tampering_indicators.append("Unusually high resolution - possible upsampling")

        # Check for compression artifacts (simple heuristic)
        if file_path.endswith(('.jpg', '.jpeg')):
            # High compression ratio might indicate manipulation
            compression_ratio = file_size / (width * height)
            if compression_ratio < 0.001:
                tampering_score += 20
                tampering_indicators.append("High compression - quality degradation detected")

        img.close()

    except Exception as e:
        tampering_indicators.append(f"Analysis error: {str(e)}")

    return {
        "score": min(100, tampering_score),
        "indicators": tampering_indicators
    }

def analyze_ai_generated_content(text: str) -> dict:
    """
    Analyze text for AI-generated content probability
    Uses heuristic analysis (can be enhanced with ML models)
    """
    ai_indicators = []
    ai_score = 0

    if not text:
        return {"score": 50, "indicators": ["No text content to analyze"]}

    # Check for generic/vague language patterns
    generic_phrases = ["in conclusion", "it is important", "this document serves",
                       "hereby confirm", "to whom it may concern"]
    generic_count = sum(1 for phrase in generic_phrases if phrase in text)
    if generic_count >= 2:
        ai_score += 20
        ai_indicators.append("Generic template-like language detected")

    # Check for repetitive patterns
    words = text.split()
    if len(words) > 100:
        word_freq = {}
        for word in words:
            word_freq[word] = word_freq.get(word, 0) + 1

        # High repetition might indicate AI generation
        avg_freq = sum(word_freq.values()) / len(word_freq)
        if avg_freq > 5:
            ai_score += 15
            ai_indicators.append("High word repetition pattern detected")

    # Check for medical keyword coverage
    medical_coverage = sum(1 for kw in MEDICAL_KEYWORDS if kw in text)
    if medical_coverage < 3:
        ai_score += 25
        ai_indicators.append("Low medical terminology coverage")

    # Check text length
    if len(text) < 100:
        ai_score += 20
        ai_indicators.append("Suspiciously short document content")

    return {
        "score": min(100, ai_score),
        "indicators": ai_indicators,
        "medical_keyword_count": medical_coverage
    }

def validate_metadata_consistency(files_data: list) -> dict:
    """
    Validate consistency across multiple documents
    Checks for metadata mismatches
    """
    inconsistencies = []
    mismatch_score = 0

    if len(files_data) < 2:
        return {"score": 0, "inconsistencies": ["Single document - no cross-validation possible"]}

    # Extract metadata from all files
    metadata_list = []
    for file_path, text in files_data:
        try:
            if file_path.endswith(('.jpg', '.jpeg', '.png')):
                img = Image.open(file_path)
                metadata_list.append({
                    "file": file_path,
                    "modified_date": img.info.get('Modified', img.info.get('Date', '')),
                    "software": img.info.get('Software', ''),
                    "text_content": text
                })
                img.close()
            elif file_path.endswith('.pdf'):
                doc = fitz.open(file_path)
                metadata = doc.metadata
                metadata_list.append({
                    "file": file_path,
                    "modified_date": metadata.get('modDate', ''),
                    "creator": metadata.get('creator', ''),
                    "producer": metadata.get('producer', ''),
                    "text_content": text
                })
                doc.close()
        except Exception as e:
            metadata_list.append({"file": file_path, "error": str(e)})

    # Check for date inconsistencies
    dates_found = []
    date_pattern = r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'
    for meta in metadata_list:
        if 'text_content' in meta:
            dates = re.findall(date_pattern, meta.get('text_content', ''))
            dates_found.extend(dates)

    # If dates span unreasonable timeframes, flag it
    # (This is simplified - production would parse and compare dates properly)

    # Check for creator/producer inconsistencies
    creators = set()
    for meta in metadata_list:
        if 'creator' in meta:
            creators.add(meta.get('creator', ''))
        if 'producer' in meta:
            creators.add(meta.get('producer', ''))

    if len(creators) > 3:
        mismatch_score += 20
        inconsistencies.append(f"Multiple document creators detected: {len(creators)}")

    return {
        "score": min(100, mismatch_score),
        "inconsistencies": inconsistencies
    }

def compute_risk_score(files: list) -> dict:
    """
    Compute weighted risk score per SRS v2.0 formula:
    RiskScore = w1 × TamperingScore + w2 × AIProbability + w3 × MetadataMismatchScore
    """
    start_time = time.time()
    results = {
        "files_analyzed": 0,
        "document_types": [],
        "processing_times": {},
        "tampering_analysis": [],
        "ai_analysis": [],
        "metadata_analysis": None,
        "risk_scores": {},
        "details": [],
        "verdict": "",
        "recommendation": ""
    }

    files_data = []
    total_file_size = 0

    # Stage 1: OCR Processing (10-15 seconds target)
    ocr_start = time.time()
    for file in files:
        try:
            file_path = file if isinstance(file, str) else file.filename

            if file_path.endswith('.pdf'):
                text = extract_text_from_pdf(file_path)
            else:
                text = extract_text_from_image(file_path)

            files_data.append((file_path, text))
            results["files_analyzed"] += 1

            # Detect document type
            doc_type = detect_document_type(text)
            results["document_types"].append(doc_type)

            total_file_size += os.path.getsize(file_path) if os.path.exists(file_path) else 0

        except Exception as e:
            results["details"].append(f"Error processing {file}: {str(e)}")

    results["processing_times"]["ocr_stage"] = round(time.time() - ocr_start, 2)

    # Stage 2: Metadata Validation (5-8 seconds target)
    metadata_start = time.time()
    metadata_result = validate_metadata_consistency(files_data)
    results["metadata_analysis"] = metadata_result
    results["processing_times"]["metadata_stage"] = round(time.time() - metadata_start, 2)

    # Stage 3: AI Forgery Analysis (~5 seconds target)
    ai_start = time.time()
    for file_path, text in files_data:
        tampering_result = check_image_tampering(file_path)
        results["tampering_analysis"].append(tampering_result)

        ai_result = analyze_ai_generated_content(text)
        results["ai_analysis"].append(ai_result)
    results["processing_times"]["ai_analysis_stage"] = round(time.time() - ai_start, 2)

    # Calculate weighted risk scores
    avg_tampering = sum(r["score"] for r in results["tampering_analysis"]) / max(1, len(results["tampering_analysis"]))
    avg_ai = sum(r["score"] for r in results["ai_analysis"]) / max(1, len(results["ai_analysis"]))
    metadata_mismatch = metadata_result["score"]

    # SRS v2.0 Formula
    final_risk_score = int(
        WEIGHTS["tampering"] * avg_tampering +
        WEIGHTS["ai_probability"] * avg_ai +
        WEIGHTS["metadata_mismatch"] * metadata_mismatch
    )

    results["risk_scores"] = {
        "tampering_score": round(avg_tampering, 2),
        "ai_probability_score": round(avg_ai, 2),
        "metadata_mismatch_score": metadata_mismatch,
        "final_risk_score": min(100, final_risk_score)
    }

    # Determine verdict and recommendation per SRS v2.0
    risk_score = min(100, final_risk_score)

    if risk_score < 40:
        results["verdict"] = "Low Risk"
        results["recommendation"] = "approve"
        results["details"].append("Campaign auto-approved for publication")
    elif risk_score < 70:
        results["verdict"] = "Medium Risk"
        results["recommendation"] = "escalate"
        results["details"].append("Advisory note visible to donors recommended")
    else:
        results["verdict"] = "High Risk - Manual Review Required"
        results["recommendation"] = "escalate"
        results["details"].append("Admin review required before publication")

    # Add file hashes for on-chain storage
    for file_path, text in files_data:
        try:
            with open(file_path, "rb") as f:
                file_hash = hashlib.sha256(f.read()).hexdigest()
            results["details"].append(f"File: {os.path.basename(file_path)} - SHA256: {file_hash}")
        except:
            pass

    results["processing_times"]["total"] = round(time.time() - start_time, 2)
    results["total_file_size"] = total_file_size

    # Add keyword coverage details
    all_text = " ".join(text for _, text in files_data)
    medical_keywords_found = sum(1 for kw in MEDICAL_KEYWORDS if kw in all_text)
    results["medical_keyword_coverage"] = {
        "found": medical_keywords_found,
        "total": len(MEDICAL_KEYWORDS),
        "percentage": round((medical_keywords_found / len(MEDICAL_KEYWORDS)) * 100, 2)
    }

    return results

@app.post("/verify")
async def verify_documents(files: list[UploadFile] = File(...)):
    """
    Main verification endpoint
    Processes uploaded documents and returns risk assessment
    """
    saved_files = []

    try:
        # Save uploaded files
        for file in files:
            file_extension = os.path.splitext(file.filename)[1] if file.filename else ".tmp"
            file_name = f"{int(time.time())}_{file.filename}"
            path = f"./uploads/{file_name}"

            # Ensure uploads directory exists
            os.makedirs("./uploads", exist_ok=True)

            with open(path, "wb") as f:
                content = await file.read()
                f.write(content)
            saved_files.append(path)

        # Compute risk score
        result = compute_risk_score(saved_files)

        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            **result
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
    finally:
        # Cleanup: In production, consider keeping files or moving to permanent storage
        # For now, files remain in uploads directory for backend processing
        pass

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "MedTrustFund AI Verification",
        "version": "2.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
