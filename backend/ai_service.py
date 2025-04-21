import os
import logging
import asyncio
import httpx
import json
from typing import List, Dict, Any, AsyncGenerator, Optional
import PyPDF2
import tempfile
from langdetect import detect
from dotenv import load_dotenv

from vector_db import add_document_to_chroma, query_chroma

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# API keys from environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# API endpoints
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Check if API keys are set
if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY is not set. AI responses will not work.")
if not TAVILY_API_KEY:
    logger.warning("TAVILY_API_KEY is not set. Web search will not work.")

async def generate_response(
    message: str,
    history: List[Dict[str, str]],
    search_results: Optional[List[Dict[str, str]]] = None,
    pdf_context: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Generate a streaming response from the AI model.
    """
    try:
        if not GROQ_API_KEY:
            yield "API key not configured. Please set the GROQ_API_KEY environment variable."
            return
        
        # Prepare system message with context if available
        system_message = "You are a helpful AI assistant."
        
        if search_results:
            system_message += "\n\nWeb search results:\n"
            for i, result in enumerate(search_results, 1):
                system_message += f"{i}. {result['title']}: {result['content']}\n"
        
        if pdf_context:
            system_message += f"\n\nRelevant information from the PDF document:\n{pdf_context}\n"
            system_message += "\nWhen answering, use the information from the PDF document."
        
        # Prepare messages for the API
        messages = [{"role": "system", "content": system_message}]
        messages.extend(history)
        
        # Make API request
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama3-70b-8192",  # Using Llama 3 70B model
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 4000,
                    "stream": True
                },
            )
            
            response.raise_for_status()
            
            # Process streaming response
            buffer = ""
            async for chunk in response.aiter_bytes():
                try:
                    chunk_str = chunk.decode("utf-8")
                    
                    # Handle SSE format
                    for line in chunk_str.split("\n"):
                        if line.startswith("data: ") and line != "data: [DONE]":
                            data = line[6:]  # Remove "data: " prefix
                            
                            try:
                                json_data = json.loads(data)
                                if "choices" in json_data and json_data["choices"]:
                                    delta = json_data["choices"][0].get("delta", {})
                                    if "content" in delta:
                                        content = delta["content"]
                                        buffer += content
                                        yield content
                            except Exception as e:
                                logger.error(f"Error parsing JSON: {str(e)}")
                except Exception as e:
                    logger.error(f"Error processing chunk: {str(e)}")
    
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        yield f"I'm sorry, an error occurred: {str(e)}"

async def search_web(query: str) -> List[Dict[str, str]]:
    """
    Search the web using Tavily API.
    """
    try:
        if not TAVILY_API_KEY:
            logger.error("TAVILY_API_KEY is not set. Web search will not work.")
            return []
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                headers={
                    "Content-Type": "application/json"
                },
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "search_depth": "advanced",
                    "include_domains": [],
                    "exclude_domains": [],
                    "max_results": 5
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Format results
            results = []
            for result in data.get("results", []):
                results.append({
                    "title": result.get("title", ""),
                    "content": result.get("content", ""),
                    "url": result.get("url", "")
                })
            
            return results
    
    except Exception as e:
        logger.error(f"Error searching web: {str(e)}")
        return []

async def process_pdf(pdf_id: str, file_path: str) -> None:
    """
    Process a PDF file and add it to the vector database.
    """
    try:
        # Extract text from PDF
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                text += page.extract_text() + "\n\n"
        
        # Detect language
        try:
            language = detect(text[:1000])  # Use first 1000 chars for detection
        except:
            language = "en"  # Default to English if detection fails
        
        # Add to vector database
        await add_document_to_chroma(pdf_id, text, {"source": file_path, "language": language})
        
        logger.info(f"PDF {pdf_id} processed and added to vector database")
    
    except Exception as e:
        logger.error(f"Error processing PDF {pdf_id}: {str(e)}")

async def query_pdf(pdf_id: str, query: str) -> str:
    """
    Query the vector database for relevant content from a PDF.
    """
    try:
        results = await query_chroma(pdf_id, query, top_k=5)
        
        if not results:
            return "No relevant information found in the document."
        
        # Combine results into a single context string
        context = "\n\n".join([f"Excerpt {i+1}:\n{doc}" for i, doc in enumerate(results)])
        
        return context
    
    except Exception as e:
        logger.error(f"Error querying PDF {pdf_id}: {str(e)}")
        return f"Error retrieving information from the document: {str(e)}"
