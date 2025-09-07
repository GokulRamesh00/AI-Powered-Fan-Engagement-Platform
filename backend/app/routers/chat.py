from fastapi import APIRouter, HTTPException, Depends
from typing import List
from langchain_chroma import Chroma
from pydantic import BaseModel, Field
from app.config import settings
from langchain_openai import OpenAIEmbeddings
from sqlalchemy.orm import Session, relationship
import datetime
import requests
from openai import OpenAI
from app.database import get_db, engine, Base
from app.models import Conversation, ChatMessageDB, Persona

#####################
# Unified System Prompt Function
#####################

def create_unified_system_prompt(persona: Persona, retrieved_context_snippets: list, is_voice: bool = False):
    """
    Creates a unified system prompt for both text and voice chat to ensure consistent responses.
    """
    voice_instructions = ""
    if is_voice:
        voice_instructions = (
            "- Keep responses concise for voice conversation (1-3 sentences typically)\n"
            "- Use natural speech patterns, contractions, and casual language\n"
        )
    
    if retrieved_context_snippets:
        system_prompt = (
            f"You are an AI assistant embodying this persona:\n\n{persona.description}\n\n"
            f"IMPORTANT: You have access to comprehensive knowledge from textbooks and published works. "
            f"Always prioritize information from these sources when answering questions. "
            f"If a user asks about specific topics, search through your knowledge base below to provide accurate, textbook-based answers.\n\n"
            "--- Your Knowledge Base (from uploaded textbooks/documents) ---\n"
            + "\n".join([f"Knowledge {i+1}: {snippet}" for i, snippet in enumerate(retrieved_context_snippets)])
            + "\n--- End Knowledge Base ---\n\n"
            "INSTRUCTIONS FOR EVERY RESPONSE:\n"
            f"1. Stay in character as {persona.name}\n"
            "2. FIRST check if the question can be answered from your knowledge base above\n"
            "3. If information exists in your knowledge base, use it as your primary source\n"
            "4. If knowledge base doesn't cover the topic, say so honestly and provide general guidance\n"
            "5. Be conversational and engaging while being informative\n"
            + voice_instructions
        )
    else:
        system_prompt = (
            f"You are an AI assistant embodying this persona:\n\n{persona.description}\n\n"
            f"WARNING: No textbook/document knowledge base is currently available. "
            f"You should inform users that you don't have access to specific textbook content right now. "
            f"Answer in the tone, style, and personality of {persona.name}, "
            "but acknowledge when you cannot access uploaded materials.\n"
            + voice_instructions
        )
    
    return system_prompt

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    conversation_id: int | None = Field(None, description="ID of an existing conversation. If null, a new one is created.")
    user_query: str
    influencer_name: str
    # Voice session parameters (optional - when present, creates voice session instead of chat response)
    is_voice_session: bool = Field(False, description="If true, creates a voice session instead of processing chat")
    voice_model: str = Field("gpt-4o-realtime-preview-2024-12-17", description="Voice model to use")
    voice: str = Field("alloy", description="Voice type to use")

class ChatResponse(BaseModel):
    conversation_id: int
    ai_response: str = Field("", description="AI response for text chat")
    retrieved_context: List[str] = []
    # Voice session fields (only populated when is_voice_session=True)
    client_secret: dict | None = Field(None, description="OpenAI client secret for voice session")
    session_config: dict | None = Field(None, description="Voice session configuration")
    persona_instructions: str | None = Field(None, description="Persona instructions for voice session")

class HistoryResponse(BaseModel):
    conversation_id: int
    messages: List[ChatMessage]



router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)

#####################
# START Route
#####################

@router.post("/start", response_model=HistoryResponse)
@router.post("/start/", response_model=HistoryResponse)
def start_new_conversation(db: Session = Depends(get_db)):
    new_conversation = Conversation()
    db.add(new_conversation)
    db.commit()
    db.refresh(new_conversation)
    return HistoryResponse(conversation_id=new_conversation.id, messages=[])

#####################
# History Route
#####################

@router.get("/history/{conversation_id}", response_model=HistoryResponse)
def get_conversation_history(conversation_id: int, db: Session = Depends(get_db)):
    """Retrieves all messages for a given conversation."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    messages = [ChatMessage(role=msg.role, content=msg.content) for msg in conversation.messages]
    return HistoryResponse(conversation_id=conversation.id, messages=messages)

#####################
# Voice Session Helper Function
#####################

async def create_voice_session_response(request: ChatRequest, conversation: Conversation, persona: Persona, db: Session):
    """
    Creates an OpenAI realtime session for voice conversation.
    Uses the same RAG system and conversation tracking as regular chat.
    """
    # Get conversation history for context (same logic as chat)
    history_from_db = [{"role": msg.role, "content": msg.content} for msg in conversation.messages]
    
    # Get comprehensive RAG context for voice session (broader search for voice)
    retrieved_context_snippets = []
    try:
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=settings.OPENAI_API_KEY)
        vectorstore = Chroma(
            collection_name="onboarding_docs",
            persist_directory="db",
            embedding_function=embeddings
        )

        # For voice sessions, get broader context since we can't inject RAG per-message
        # Use generic queries to get comprehensive knowledge base
        broad_queries = [
            f"{persona.name} knowledge base",
            f"{persona.name} content information",
            "textbook content knowledge",
            "published works information"
        ]
        
        all_context_docs = []
        for query in broad_queries:
            try:
                docs = vectorstore.similarity_search(query, k=5)  # Get more docs per query
                all_context_docs.extend(docs)
            except Exception as e:
                print(f"Error retrieving context for query '{query}': {e}")
        
        # Remove duplicates by content
        seen_content = set()
        unique_docs = []
        for doc in all_context_docs:
            if doc.page_content not in seen_content:
                seen_content.add(doc.page_content)
                unique_docs.append(doc)
        
        # Limit to top 10 most relevant chunks to avoid token limits
        retrieved_context_snippets = [doc.page_content for doc in unique_docs[:10]]
        print(f"Retrieved {len(retrieved_context_snippets)} comprehensive context snippets from ChromaDB for voice session.")

    except Exception as e:
        print(f"Warning: Could not retrieve context from ChromaDB for voice session. Error: {e}")

    # Create unified system prompt for voice chat
    system_prompt = create_unified_system_prompt(persona, retrieved_context_snippets, is_voice=True)

    # Add conversation history context
    if history_from_db:
        recent_messages = history_from_db[-6:]  # Last 6 messages for context
        context_summary = f"\n\nRecent conversation context:\n" + "\n".join([
            f"{msg['role']}: {msg['content'][:200]}..." if len(msg['content']) > 200 else f"{msg['role']}: {msg['content']}"
            for msg in recent_messages
        ])
        system_prompt += context_summary

    try:
        # Create OpenAI realtime session
        session_request_data = {
            "model": request.voice_model,
            "voice": request.voice,
        }
        print(f"Creating OpenAI session with data: {session_request_data}")
        
        response = requests.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=session_request_data
        )
        
        print(f"OpenAI API response status: {response.status_code}")
        print(f"OpenAI API response headers: {dict(response.headers)}")
        
        if not response.ok:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        session_data = response.json()
        print(f"OpenAI session response: {session_data}")  # Debug: see the actual response structure
        
        # Check if client_secret exists
        if not session_data.get("client_secret"):
            print(f"Error: No client_secret in OpenAI response. Full response: {session_data}")
            raise HTTPException(
                status_code=500, 
                detail=f"OpenAI did not return client_secret. Response: {session_data}"
            )
        
        # Prepare session configuration with persona instructions
        session_config = {
            "instructions": system_prompt,
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.5,
                "silence_duration_ms": 1500,  # Increased to 1.5 seconds for better listening
                "prefix_padding_ms": 300,      # Add padding before speech detection
                "create_response": True,
                "interrupt_response": True,
            },
            "input_audio_transcription": {
                "model": "whisper-1"
            },
            "temperature": 0.7,
            "max_response_output_tokens": 1000,
        }

        return ChatResponse(
            conversation_id=conversation.id,
            ai_response="",  # Empty for voice session
            retrieved_context=retrieved_context_snippets,
            client_secret=session_data["client_secret"],
            session_config=session_config,
            persona_instructions=system_prompt
        )

    except Exception as e:
        print(f"Error creating OpenAI realtime session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create realtime session.")

#####################
# Chat Route
#####################

@router.post("/", response_model=ChatResponse)
async def handle_chat_request(request: ChatRequest, db: Session = Depends(get_db)):
    if not settings.OPENAI_API_KEY or "your_openai_key" in settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key is not configured on the server.")

    # Common logic for both text chat and voice session
    if request.conversation_id:
        conversation = db.query(Conversation).filter(Conversation.id == request.conversation_id).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found.")
    else:
        conversation = Conversation()
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    persona = db.query(Persona).filter(Persona.name == request.influencer_name).first()
    if not persona:
        raise HTTPException(
            status_code=404,
            detail=f"No persona found for influencer '{request.influencer_name}'"
        )

    # If this is a voice session request, handle it differently
    if request.is_voice_session:
        print(f"Processing voice session request for {request.influencer_name}")
        try:
            return await create_voice_session_response(request, conversation, persona, db)
        except HTTPException as voice_error:
            print(f"Voice session creation failed: {voice_error}")
            raise voice_error  # Re-raise HTTP exceptions
        except Exception as voice_error:
            print(f"Voice session creation failed with unexpected error: {voice_error}")
            raise HTTPException(
                status_code=500, 
                detail=f"Voice session creation failed: {str(voice_error)}"
            )
    
    # Otherwise, handle as regular text chat (existing logic below)

    # --- Step 2: Retrieve Chat History from DB ---
    history_from_db = [{"role": msg.role, "content": msg.content} for msg in conversation.messages]
    
    retrieved_context_snippets = []
    try:
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=settings.OPENAI_API_KEY)
        vectorstore = Chroma(
            collection_name="onboarding_docs",
            persist_directory="db",
            embedding_function=embeddings
        )

        # Use both specific query and general knowledge queries for comprehensive context
        all_context_docs = []
        
        # First, search with the specific user query
        specific_docs = vectorstore.similarity_search(request.user_query, k=3)
        all_context_docs.extend(specific_docs)
        
        # Then, add broader context queries for better coverage
        broad_queries = [
            f"{persona.name} knowledge base",
            f"{persona.name} content information",
            "textbook content knowledge"
        ]
        
        for query in broad_queries:
            try:
                docs = vectorstore.similarity_search(query, k=2)  # Fewer per broad query
                all_context_docs.extend(docs)
            except Exception as e:
                print(f"Error retrieving context for query '{query}': {e}")
        
        # Remove duplicates by content
        seen_content = set()
        unique_docs = []
        for doc in all_context_docs:
            if doc.page_content not in seen_content:
                seen_content.add(doc.page_content)
                unique_docs.append(doc)
        
        # Limit to top 8 most relevant chunks
        retrieved_context_snippets = [doc.page_content for doc in unique_docs[:8]]
        print(f"Retrieved {len(retrieved_context_snippets)} comprehensive context snippets from ChromaDB.")

        for i, doc in enumerate(unique_docs):
            if hasattr(doc, 'metadata') and doc.metadata:
                print(f"Context {i+1} metadata: {doc.metadata}")

    except Exception as e:
        print(f"Warning: Could not connect to or retrieve from ChromaDB. Proceeding without context. Error: {e}")


    # Create unified system prompt for text chat
    system_prompt = create_unified_system_prompt(persona, retrieved_context_snippets, is_voice=False)


    # Combine the system prompt, previous messages, and the new user query.
    full_chat_history = [{"role": "system", "content": system_prompt}]
    full_chat_history.extend(history_from_db)
    full_chat_history.append({"role": "user", "content": request.user_query})

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=full_chat_history,
            temperature=0.7,
            max_tokens=1000,
        )
        ai_message = response.choices[0].message.content

    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        raise HTTPException(status_code=500, detail="Failed to get a response from the AI model.")
    
    user_message_db = ChatMessageDB(conversation_id=conversation.id, role="user", content=request.user_query)
    ai_message_db = ChatMessageDB(conversation_id=conversation.id, role="assistant", content=ai_message)
    db.add(user_message_db)
    db.add(ai_message_db)
    db.commit()
    db.refresh(user_message_db)
    db.refresh(ai_message_db)


    # --- Step 4: Return the Final Response ---
    return ChatResponse(
        conversation_id=conversation.id,
        ai_response=ai_message,
        retrieved_context=retrieved_context_snippets
    )

