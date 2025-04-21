import os
import logging
import asyncio
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings

# Use the new PersistentClient API as per migration guide
try:
    from chromadb import PersistentClient
except ImportError:
    PersistentClient = None  # fallback for old versions, but should upgrade chromadb

from chromadb.utils import embedding_functions

# Configure logging
logger = logging.getLogger(__name__)

# ChromaDB client
_client = None


def get_chroma_client():
    """
    Get or create a ChromaDB client using the new PersistentClient API.
    """
    global _client
    if _client is None:
        try:
            persist_dir = os.path.abspath("./chroma_db")
            if PersistentClient:
                _client = PersistentClient(path=persist_dir)
            else:
                # Fallback: try old Client API (should upgrade chromadb if this triggers)
                _client = chromadb.Client(Settings(
                    chroma_db_impl="duckdb+parquet",
                    persist_directory=persist_dir
                ))
            logger.info("ChromaDB client initialized using new PersistentClient API")
        except Exception as e:
            logger.error(f"Error initializing ChromaDB client: {str(e)}")
            raise
    return _client

async def add_document_to_chroma(
    document_id: str,
    text: str,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Add a document to ChromaDB.
    """
    try:
        client = get_chroma_client()
        
        # Split text into chunks (max 1000 tokens per chunk)
        chunks = split_text(text, max_tokens=1000)
        
        # Create collection if it doesn't exist
        collection_name = f"pdf_{document_id}"
        try:
            collection = client.get_collection(collection_name)
        except:
            # Use default embedding function
            default_ef = embedding_functions.DefaultEmbeddingFunction()
            collection = client.create_collection(
                name=collection_name,
                embedding_function=default_ef
            )
        
        # Add chunks to collection
        ids = [f"{document_id}_{i}" for i in range(len(chunks))]
        metadatas = [metadata or {} for _ in range(len(chunks))]
        
        collection.add(
            ids=ids,
            documents=chunks,
            metadatas=metadatas
        )
        
        logger.info(f"Added {len(chunks)} chunks to collection {collection_name}")
    
    except Exception as e:
        logger.error(f"Error adding document to ChromaDB: {str(e)}")
        raise

async def query_chroma(
    document_id: str,
    query: str,
    top_k: int = 3
) -> List[str]:
    """
    Query ChromaDB for relevant document chunks.
    """
    try:
        client = get_chroma_client()
        collection_name = f"pdf_{document_id}"
        
        try:
            collection = client.get_collection(collection_name)
        except:
            logger.error(f"Collection {collection_name} not found")
            return []
        
        # Query collection
        results = collection.query(
            query_texts=[query],
            n_results=top_k
        )
        
        # Extract documents
        documents = results.get("documents", [[]])[0]
        
        return documents
    
    except Exception as e:
        logger.error(f"Error querying ChromaDB: {str(e)}")
        return []

def split_text(text: str, max_tokens: int = 1000) -> List[str]:
    """
    Split text into chunks of approximately max_tokens.
    This is a simple implementation that splits by paragraphs and then combines them.
    """
    # Split by paragraphs
    paragraphs = [p for p in text.split("\n\n") if p.strip()]
    
    chunks = []
    current_chunk = []
    current_size = 0
    
    for paragraph in paragraphs:
        # Rough estimate: 1 token ~= 4 characters
        paragraph_size = len(paragraph) // 4
        
        if current_size + paragraph_size > max_tokens and current_chunk:
            # Add current chunk to chunks and start a new one
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [paragraph]
            current_size = paragraph_size
        else:
            # Add paragraph to current chunk
            current_chunk.append(paragraph)
            current_size += paragraph_size
    
    # Add the last chunk if it's not empty
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
    
    return chunks
