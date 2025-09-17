#!/bin/bash

# Development setup script for Waste Management System

echo "🗂️ Setting up Waste Management System Development Environment"

# Check if Python 3.11+ is installed
python_version=$(python3 --version 2>&1 | grep -o '[0-9]\+\.[0-9]\+' | head -1)
major_version=$(echo $python_version | cut -d. -f1)
minor_version=$(echo $python_version | cut -d. -f2)

if [ "$major_version" -lt 3 ] || ([ "$major_version" -eq 3 ] && [ "$minor_version" -lt 11 ]); then
    echo "❌ Python 3.11+ is required. Found: $python_version"
    exit 1
fi

echo "✅ Python version check passed: $python_version"

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment variables template
if [ ! -f .env ]; then
    echo "⚙️ Creating .env file from template..."
    cp .env.example .env
    echo "📝 Please edit .env file with your configuration"
fi

echo "✅ Development environment setup complete!"
echo ""
echo "🚀 To start the application:"
echo "   source venv/bin/activate"
echo "   python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "🧪 To run tests:"
echo "   pytest backend/tests/ -v"
echo ""
echo "🌐 Application will be available at:"
echo "   Frontend: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"