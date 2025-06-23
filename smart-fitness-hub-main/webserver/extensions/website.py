from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

def setup_website_routes(app):
    """
    Configure the FastAPI app to serve the website static files
    """
    # Calculate the path to the website directory
    website_path = Path(os.path.abspath(__file__)).parent.parent.parent / "website"
    
    # Mount the website directory at the root path with explicit HTML support
    app.mount("/", StaticFiles(directory=str(website_path), html=True, check_dir=True), name="website")
    
    print(f"Website files mounted from: {website_path}")