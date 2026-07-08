# Base Python image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    libgthread-2.0-0 \
    libxcb1 \
    libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download PaddleOCR models to make the image stateless and start instantly
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='en', use_angle_cls=True, show_log=False)"
RUN echo "try:" > /tmp/download_models.py && \
    echo "    from paddleocr import PPStructureV3" >> /tmp/download_models.py && \
    echo "    PPStructureV3(lang='en', use_doc_orientation_classify=True, use_doc_unwarping=False, use_formula_recognition=False, use_seal_recognition=False, use_chart_recognition=False, ocr_version='PP-OCRv4')" >> /tmp/download_models.py && \
    echo "except ImportError:" >> /tmp/download_models.py && \
    echo "    from paddleocr import PPStructure" >> /tmp/download_models.py && \
    echo "    PPStructure(table=True, ocr=True, lang='en', show_log=False)" >> /tmp/download_models.py && \
    python /tmp/download_models.py && \
    rm /tmp/download_models.py

# Copy source code
COPY . .

# Expose backend port
EXPOSE 8000

# Copy start script
COPY start.sh .
RUN chmod +x start.sh

# Start the combined backend and worker services
CMD ["./start.sh"]
