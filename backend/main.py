import logging
import os
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uvicorn
import asyncio
import json
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Import local modules
from database import get_db, engine, Base
import models
import schemas
from auth import create_access_token, get_current_user, get_password_hash, verify_password, SECRET_KEY, ALGORITHM
from fastapi import Request, Query
from jose import jwt, JWTError
from fastapi import status
from ai_service import generate_response, search_web, process_pdf, query_pdf
from vector_db import add_document_to_chroma, get_chroma_client
from sqlalchemy.orm import joinedload

# Load environment variables


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Chatbot API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Create upload directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# API Routes

@app.get("/")
async def root():
    return {"message": "AI Chatbot API is running"}

# Auth routes
@app.post("/auth/register", response_model=schemas.TokenResponse)
async def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        # Check if user already exists
        db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        db_user = models.User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # Create access token
        access_token = create_access_token(data={"sub": db_user.email})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": schemas.User.from_orm(db_user)
        }
    except Exception as e:
        import traceback
        logger.error(f"Registration error: {str(e)}\n{traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error. Check backend logs for details.")

@app.post("/auth/login", response_model=schemas.TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        # Find user by email
        user = db.query(models.User).filter(models.User.email == form_data.username).first()
        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token = create_access_token(data={"sub": user.email})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": schemas.User.from_orm(user)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/auth/me", response_model=schemas.User)
async def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/auth/logout")
async def logout():
    # In a stateless JWT setup, the client is responsible for discarding the token
    # This endpoint is provided for API completeness
    return {"message": "Successfully logged out"}

#Chat routes
@app.get("/chats", response_model=List[schemas.Chat])
async def get_chats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # from sqlalchemy.orm import joinedload
        # chats = db.query(models.Chat).options(joinedload(models.Chat.messages)).filter(models.Chat.user_id == current_user.id).order_by(models.Chat.updated_at.desc()).all()
        chats = db.query(models.Chat).filter(models.Chat.user_id == current_user.id).order_by(models.Chat.updated_at.desc()).all()
        return chats
    except Exception as e:
        logger.error(f"Error fetching chats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chats", response_model=schemas.Chat)
async def create_chat(chat_data: schemas.ChatCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        new_chat = models.Chat(
            title=chat_data.title,
            user_id=current_user.id
        )
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)
        return new_chat
    except Exception as e:
        logger.error(f"Error creating chat: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chats/{chat_id}", response_model=schemas.Chat)
async def get_chat(chat_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        from sqlalchemy.orm import joinedload
        chat = db.query(models.Chat).options(joinedload(models.Chat.messages)).filter(models.Chat.id == chat_id, models.Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        db.refresh(chat)
        return chat
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/chats/{chat_id}")
async def delete_chat(chat_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id, models.Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Delete all messages in the chat
        db.query(models.Message).filter(models.Message.chat_id == chat_id).delete()
        
        # Delete the chat
        db.delete(chat)
        db.commit()
        
        return {"message": "Chat deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Message routes with streaming
from fastapi.responses import Response

@app.options("/chats/{chat_id}/messages")
def options_chat_messages(chat_id: int):
    return Response(status_code=200, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    })

@app.get("/chats/{chat_id}/messages", response_class=StreamingResponse)
async def get_chat_messages(
    chat_id: int,
    message: str,
    pdf_id: Optional[str] = None,
    search: bool = False,
    request: Request = None,
    token: str = Query(None),
    db: Session = Depends(get_db)
):
    # Log incoming headers for debugging CORS/token issues
    logger.info(f"Request headers: {dict(request.headers) if request else {}}")
    jwt_token = None
    auth_header = request.headers.get("Authorization") if request else None
    if auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header.split(" ", 1)[1]
    elif token:
        jwt_token = token
    if not jwt_token:
        logger.error("Missing token in request for SSE")
        response = Response(
            content=json.dumps({"detail": "Missing token"}),
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json"
        )
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    try:
        payload = jwt.decode(jwt_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        if user_email is None:
            logger.error("Invalid token payload: no sub")
            response = Response(
                content=json.dumps({"detail": "Invalid token payload"}),
                status_code=status.HTTP_401_UNAUTHORIZED,
                media_type="application/json"
            )
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
        current_user = db.query(models.User).filter(models.User.email == user_email).first()
        if not current_user:
            logger.error(f"User not found for email: {user_email}")
            response = Response(
                content=json.dumps({"detail": "User not found"}),
                status_code=status.HTTP_401_UNAUTHORIZED,
                media_type="application/json"
            )
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
    except JWTError as e:
        logger.error(f"JWT decode error: {str(e)}")
        response = Response(
            content=json.dumps({"detail": "Invalid token"}),
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json"
        )
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    try:
        # Verify chat belongs to user
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id, models.Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Create user message
        user_message = models.Message(
            chat_id=chat_id,
            role="user",
            content=message
        )
        db.add(user_message)
        db.commit()
        db.refresh(user_message)
        
        # Update chat title if it's the first message
        if chat.title == "New Chat":
            chat.title = message[:30] + ("..." if len(message) > 30 else "")
            db.commit()
        
        # Create assistant message placeholder
        assistant_message = models.Message(
            chat_id=chat_id,
            role="assistant",
            content=""
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
        
        # Get chat history for context
        history = db.query(models.Message).filter(
            models.Message.chat_id == chat_id,
            models.Message.id != assistant_message.id
        ).order_by(models.Message.id).all()
        
        # Format history for AI
        formatted_history = [{"role": msg.role, "content": msg.content} for msg in history]
        
        # Define the streaming response function
        async def stream_response():
            try:
                # Search the web if requested
                search_results = None
                if search:
                    try:
                        search_results = await search_web(message)
                        # Send search results to client
                        yield f"data: {json.dumps({'type': 'search_results', 'results': search_results})}\n\n"
                    except Exception as e:
                        logger.error(f"Web search error: {str(e)}")
                        search_results = None
                
                # Query PDF if provided
                pdf_context = None
                if pdf_id:
                    try:
                        pdf_context = await query_pdf(pdf_id, message)
                    except Exception as e:
                        logger.error(f"PDF query error: {str(e)}")
                        pdf_context = None
                
                # Generate AI response
                full_response = ""
                async for chunk in generate_response(
                    message, 
                    formatted_history, 
                    search_results=search_results,
                    pdf_context=pdf_context
                ):
                    full_response += chunk
                    # Send chunk to client
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
                    await asyncio.sleep(0.01)  # Small delay for natural typing effect
                
                # Update assistant message in database
                assistant_message.content = full_response
                db.commit()
                
                # Send end event
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
                
            except Exception as e:
                logger.error(f"Streaming error: {str(e)}")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                logger.error(f"Message processing error: {str(e)}")
                assistant_message.content = f"I'm sorry, an error occurred: {str(e)}"
                db.commit()
                # Do not return a Response here; just let the generator end.
        
        response = StreamingResponse(stream_response(), media_type="text/event-stream")
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
        
    except Exception as e:
        logger.error(f"Message processing error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# PDF routes
@app.post("/pdfs/upload", response_model=schemas.PDFResponse)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Generate unique ID for the PDF
        pdf_id = str(uuid.uuid4())
        
        # Create file path
        file_path = os.path.join(UPLOAD_DIR, f"{pdf_id}.pdf")
        
        # Save the file
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Create PDF record in database
        pdf_record = models.PDF(
            id=pdf_id,
            filename=file.filename,
            path=file_path,
            user_id=current_user.id
        )
        db.add(pdf_record)
        db.commit()
        
        # Process PDF in background
        background_tasks.add_task(process_pdf, pdf_id, file_path)
        
        return {"id": pdf_id, "filename": file.filename, "status": "processing"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF upload error: {str(e)}")
        if 'db' in locals() and db:
            db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)