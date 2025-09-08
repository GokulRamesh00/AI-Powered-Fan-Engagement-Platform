# import os
# import shutil
# from langchain_community.document_loaders import TextLoader, PyPDFLoader
# from langchain_openai import OpenAIEmbeddings
# from langchain.text_splitter import CharacterTextSplitter, RecursiveCharacterTextSplitter
# from app.background.document_process.persona_builder import extract_persona_from_docs
# from app.config import settings
# from langchain_chroma import Chroma

# def add_documents_to_vectorstore(document_paths: list[str], persona_name: str = "Unknown"):
#     print(f"Processing {len(document_paths)} documents for embedding...")
#     all_docs = []
    
#     # 1. Load documents based on their file extension
#     for path in document_paths:
#         try:
#             if path.endswith(".txt"):
#                 loader = TextLoader(path)
#                 all_docs.extend(loader.load())
#             elif path.endswith(".pdf"):
#                 loader = PyPDFLoader(path)
#                 all_docs.extend(loader.load())
#             else:
#                 print(f"Skipping unsupported file type: {path}")
#         except Exception as e:
#             print(f"Error loading document {path}: {e}")

#     if not all_docs:
#         print("No documents were loaded successfully. Aborting embedding process.")
#         return

#     # 2. Split documents into chunks
#     text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
#     chunks = text_splitter.split_documents(all_docs)
#     print(f"Split documents into {len(chunks)} chunks.")

#     full_text = " ".join([doc.page_content for doc in all_docs])

#     try:
#         persona_description = extract_persona_from_docs(full_text, persona_name)
#         print(f"Extracted persona description:\n{persona_description}")
        
#         # Save persona to your DB
#         from app.database import SessionLocal
#         from app.models import Persona
        
#         db = SessionLocal()
#         existing_persona = db.query(Persona).filter(Persona.name == persona_name).first()
#         if not existing_persona:
#             new_persona = Persona(name=persona_name, description=persona_description)
#             db.add(new_persona)
#             db.commit()
#             print(f"Persona '{persona_name}' saved to database.")
#         else:
#             print(f"Persona '{persona_name}' already exists in database.")
#         db.close()

#     except Exception as e:
#         print(f"Error extracting or saving persona: {e}")

#     # 3. Initialize embeddings model
#     embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=settings.OPENAI_API_KEY)

#     # 4. Add document chunks
#     # This will create embeddings and upload the vectors.
#     persist_directory = "db"
#     collection_name = "onboarding_docs"

#     Chroma.from_documents(
#         documents=chunks,
#         embedding=embeddings,
#         collection_name=collection_name,
#         persist_directory=persist_directory
#     )
    
#     print(f"✅ Successfully added {len(chunks)} chunks.")

#     # 5. Clean up the temporary directory that stored the files
#     if document_paths:
#         temp_dir = os.path.dirname(document_paths[0])
#         print(f"Cleaning up temporary directory: {temp_dir}")
#         shutil.rmtree(temp_dir)

import os
import shutil
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from app.background.document_process.persona_builder import extract_persona_from_docs
from app.config import settings
from langchain_chroma import Chroma

from app.database import SessionLocal
from app.models import ContentStatus, ContentType, Persona, Content, ContentChunk


def add_documents_to_vectorstore(document_paths: list[str], persona_name: str = "Unknown"):
    print(f"Processing {len(document_paths)} documents for embedding...")
    all_docs = []

    # 1. Load documents based on their file extension
    for path in document_paths:
        try:
            if path.endswith(".txt"):
                loader = TextLoader(path)
                all_docs.extend(loader.load())
            elif path.endswith(".pdf"):
                loader = PyPDFLoader(path)
                all_docs.extend(loader.load())
            else:
                print(f"Skipping unsupported file type: {path}")
        except Exception as e:
            print(f"Error loading document {path}: {e}")

    if not all_docs:
        print("No documents were loaded successfully. Aborting embedding process.")
        return

    # 2. Split documents into chunks
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(all_docs)
    print(f"Split documents into {len(chunks)} chunks.")

    full_text = " ".join([doc.page_content for doc in all_docs])

    db = SessionLocal()
    try:
        # Extract or load persona description and save Persona in DB
        persona_description = extract_persona_from_docs(full_text, persona_name)
        print(f"Extracted persona description:\n{persona_description}")
        persona = db.query(Persona).filter(Persona.name == persona_name).first()
        if not persona:
            persona = Persona(name=persona_name, description=persona_description)
            db.add(persona)
            db.commit()
            db.refresh(persona)
            print(f"Persona '{persona_name}' saved to database.")
        else:
            print(f"Persona '{persona_name}' already exists in database.")

        # Create Content record linked to Persona/influencer
        content = Content(
            title=f"Documents for {persona_name}",
            content_text=full_text,
            content_type=ContentType.DOCUMENT,
            status=ContentStatus.PUBLISHED,
            influencer_id=persona.id
        )
        db.add(content)
        db.commit()
        db.refresh(content)

        # Save chunks as ContentChunk records with metadata
        for i, chunk in enumerate(chunks):
            content_chunk = ContentChunk(
                content_id=content.id,
                chunk_text=chunk.page_content,
                chunk_index=i,
                # Optionally estimate token count here
            )
            db.add(content_chunk)
            db.flush()  # Assign ID before commit
            # Attach metadata linking this chunk to DB
            chunk.metadata = {
                "content_chunk_id": str(content_chunk.id),
                "content_id": str(content.id),
                "persona_name": persona_name
            }

        db.commit()

    except Exception as e:
        print(f"Error extracting or saving persona/content/chunks: {e}")
        db.rollback()
    finally:
        db.close()

    # 3. Initialize embeddings model
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=settings.OPENAI_API_KEY)

    # 4. Add document chunks to Chroma vectorstore with collection per persona
    persist_directory = "db"
    collection_name = f"persona_{persona_name.lower().replace(' ', '_')}"

    Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=persist_directory
    )

    print(f"✅ Successfully added {len(chunks)} chunks to collection '{collection_name}'.")

    # 5. Clean up the temporary directory that stored the files
    if document_paths:
        temp_dir = os.path.dirname(document_paths[0])
        print(f"Cleaning up temporary directory: {temp_dir}")
        shutil.rmtree(temp_dir)
