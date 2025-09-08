# app/routers/onboarding.py
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks
from typing import List, Optional
import tempfile
import os
import shutil
from app.background.tasks import process_all_urls
from app.background.document_process.rag_builder import add_documents_to_vectorstore 

router = APIRouter(
    prefix="/onboarding",
    tags=["Onboarding"],
)

@router.post("/")
@router.post("")
async def create_onboarding_profile(
    background_tasks: BackgroundTasks,
    instagram_urls: Optional[List[str]] = Form(None, description="The user's Instagram URL."),
    x_urls: Optional[List[str]] = Form(None, description="The user's X URL."),
    linkedin_urls: Optional[List[str]] = Form(None, description="The user's LinkedIn URL."),
    substack_urls: Optional[List[str]] = Form(None, description="The user's Substack URL."),
    custom_urls: Optional[List[str]] = Form(None, description="The user's Custom URL."),
    documents: Optional[List[UploadFile]] = File(None, description="Optional onboarding documents."),
    influencer_name: str = Form(...),
):
    """
    Accepts user data and URLs, and triggers a background task to process the URLs.
    """
    onboarding_data = {
        "instagram_urls": instagram_urls,
        "x_urls": x_urls,
        "linkedin_urls": linkedin_urls,
        "substack_urls": substack_urls,
        "custom_urls": custom_urls
    }

    # Combine all provided URLs into a single list
    all_submitted_urls = []
    for url_list in onboarding_data.values():
        if url_list:
            all_submitted_urls.extend(url_list)

    # Add the URL processing function to the background tasks
    # background_tasks.add_task(process_all_urls, all_submitted_urls)

    saved_document_paths = []
    if documents:
        # Create a unique temporary directory to store uploaded files
        temp_dir = tempfile.mkdtemp()
        
        for doc in documents:
            # Create a path for each file inside the temporary directory
            file_path = os.path.join(temp_dir, doc.filename)
            saved_document_paths.append(file_path)
            
            # Save the file content to the temporary path
            with open(file_path, "wb") as f:
                shutil.copyfileobj(doc.file, f)
        
        # Add the document embedding task to the background queue
        # Pass the list of file paths, not the UploadFile objects
        background_tasks.add_task(add_documents_to_vectorstore, saved_document_paths, influencer_name)

    # --- Prepare and send the immediate API response ---
    response_message = {
        "status": "Onboarding profile received. Processing has started in the background."
    }

    return response_message
