from fastapi import APIRouter

class Basic:
    def __init__(self, app):
        self.app = app
        self.router = APIRouter()
        self.setup_routes()

    def setup_routes(self):
        @self.router.post("/ping")
        async def ping():
            return {"status": "ok"}
