from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
import datetime
from app.database import Base
import enum

# Enum definitions
class UserRole(enum.Enum):
    INFLUENCER = "influencer"
    USER = "user"
    ADMIN = "admin"

class ContentStatus(enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class ContentType(enum.Enum):
    ARTICLE = "article"
    DOCUMENT = "document"
    FAQ = "faq"
    KNOWLEDGE_BASE = "knowledge_base"

class MessageType(enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

##############################

# class Conversation(Base):
#     __tablename__ = "conversations"
#     id = Column(Integer, primary_key=True, index=True)
#     created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
#     messages = relationship("ChatMessageDB", back_populates="conversation")

# class ChatMessageDB(Base):
#     __tablename__ = "chat_messages"
#     id = Column(Integer, primary_key=True, index=True)
#     conversation_id = Column(Integer, ForeignKey("conversations.id"))
#     role = Column(String, index=True)
#     content = Column(String)
#     timestamp = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
#     conversation = relationship("Conversation", back_populates="messages")

# class Persona(Base):
#     __tablename__ = "personas"
    
#     id = Column(Integer, primary_key=True, index=True)
#     name = Column(String, unique=True, nullable=False)  # Persona or influencer name
#     description = Column(Text)  # Long-form persona description / bio
#     created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc)
# )

##########################

# Influencer model
class Influencer(Base):
    __tablename__ = "influencers"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, index=True, default=UserRole.INFLUENCER)
    is_active = Column(Boolean, default=True, index=True)
    display_name = Column(String(100))
    bio = Column(Text)
    avatar_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc), onupdate=datetime.datetime.now(datetime.timezone.utc))

    contents = relationship("Content", back_populates="influencer")
    personas = relationship("Persona", back_populates="influencer")

# User model (for non-influencer users)
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, index=True, default=UserRole.USER)
    is_active = Column(Boolean, default=True, index=True)
    display_name = Column(String(100))
    bio = Column(Text)
    avatar_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc), onupdate=datetime.datetime.now(datetime.timezone.utc))

    chat_sessions = relationship("ChatSession", back_populates="user")
    messages = relationship("Message", back_populates="user")
    usage_entries = relationship("Usage", back_populates="user")

class Persona(Base):
    __tablename__ = "personas"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    influencer_id = Column(Integer, ForeignKey("influencers.id"), nullable=True)
    influencer = relationship("Influencer", back_populates="personas")

class Content(Base):
    __tablename__ = "content"
    id = Column(Integer, primary_key=True)
    title = Column(String(255), index=True, nullable=False)
    content_text = Column(Text, nullable=False)
    content_type = Column(Enum(ContentType), nullable=False, index=True)
    status = Column(Enum(ContentStatus), default=ContentStatus.DRAFT, index=True)
    tags = Column(Text)
    extra_metadata = Column(Text)
    chroma_document_id = Column(String(255), unique=True, index=True)
    influencer_id = Column(Integer, ForeignKey("influencers.id"), nullable=False, index=True)
    influencer = relationship("Influencer", back_populates="contents")
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc), onupdate=datetime.datetime.now(datetime.timezone.utc))
    published_at = Column(DateTime, index=True)
    content_chunks = relationship("ContentChunk", back_populates="content", cascade="all, delete-orphan")


class ContentChunk(Base):
    __tablename__ = "content_chunks"
    id = Column(Integer, primary_key=True)
    content_id = Column(Integer, ForeignKey("content.id"), nullable=False, index=True)
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chroma_chunk_id = Column(String(255), unique=True, index=True)
    start_position = Column(Integer)
    end_position = Column(Integer)
    token_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    content = relationship("Content", back_populates="content_chunks")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_name = Column(String(255))
    system_prompt = Column(Text)
    model_name = Column(String(50), default="gpt-3.5-turbo")
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=1000)
    use_rag = Column(Boolean, default=True)
    rag_k = Column(Integer, default=5)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc), onupdate=datetime.datetime.now(datetime.timezone.utc))
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("Message", back_populates="chat_session", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    chat_session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    message_type = Column(Enum(MessageType), nullable=False, index=True)
    content = Column(Text, nullable=False)
    rag_context = Column(Text)
    rag_sources = Column(Text)
    openai_message_id = Column(String(255))
    model_used = Column(String(50))
    tokens_used = Column(Integer)
    finish_reason = Column(String(50))
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc), index=True)
    chat_session = relationship("ChatSession", back_populates="messages")
    user = relationship("User", back_populates="messages")

class Usage(Base):
    __tablename__ = "usage"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tokens_used = Column(Integer, default=0)
    api_calls = Column(Integer, default=0)
    cost_cents = Column(Integer, default=0)
    date = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    user = relationship("User", back_populates="usage_entries")