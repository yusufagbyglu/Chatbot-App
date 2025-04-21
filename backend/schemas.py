from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# User schemas
class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

# class User(UserBase):
class User(UserBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}

# Token schemas
class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: User

# Message schemas
class MessageBase(BaseModel):
    role: str
    content: str

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    chat_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# Chat schemas
class ChatBase(BaseModel):
    title: str

class ChatCreate(ChatBase):
    pass

class Chat(ChatBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    messages: List[Message] = []
    
    class Config:
        orm_mode = True

# PDF schemas
class PDFResponse(BaseModel):
    id: str
    filename: str
    status: str
