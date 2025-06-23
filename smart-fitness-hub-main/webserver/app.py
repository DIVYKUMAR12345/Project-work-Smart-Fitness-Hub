from fastapi import FastAPI
import uvicorn
import motor.motor_asyncio
from extensions import *

import os
from dotenv import load_dotenv

load_dotenv("webserver/.env")

app = FastAPI()
app.dbclient = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGO_URI"))
app.db = app.dbclient["fitness"] 

extensions = [
    Auth,
    Basic,
    FoodSuggest,
    
]

for ext in extensions:
    ext_instance = ext(app)
    app.include_router(ext_instance.router)

#for website files setup

setup_website_routes(app)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=3400, reload=True)