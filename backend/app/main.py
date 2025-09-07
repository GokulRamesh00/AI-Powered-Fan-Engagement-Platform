from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
from app.routers import onboarding
from app.routers import chat

from app.database import create_db_and_tables


create_db_and_tables()

# Create a new FastAPI app instance
app = FastAPI(
    title="BACKEND: AI-Powered Fan Engagement Platform",
    description="This project is the backend for an AI-powered fan engagement platform. It allows users to create AI personas of public figures by scraping their social media content and documents. These AI personas can then be used for real-time chat interactions.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers in the main app
app.include_router(onboarding.router)
app.include_router(chat.router)

@app.get("/", tags=["Root"])
def get_root() -> Dict[str, str]:
    return {"message": "BACKEND: AI-Powered Fan Engagement Platform"}