from fastapi import APIRouter, HTTPException

class Auth:
    def __init__(self, app):
        self.app = app
        self.router = APIRouter()
        self.setup_routes()
        self.usersdb = self.app.db["users"]

    def setup_routes(self):
        @self.router.post("/auth_login")
        async def login(data: dict):
            result = await self.usersdb.find_one({"email": data["email"]})
            if result:
                if result["password"] != data["password"]:
                    raise HTTPException(status_code=401, detail="Invalid credentials")
                result.pop("_id", None)
                return result
            raise HTTPException(status_code=404, detail="Not Found")

        @self.router.post("/auth_signup")
        async def signup(data: dict):
            
            existing_user = await self.usersdb.find_one({"email": data["email"]})
            if existing_user:
                raise HTTPException(status_code=409, detail="Email already exists")
            
            data.pop("confirm_password", None)

            result = await self.usersdb.insert_one(data)
            return {"status": "success", "message": "User created successfully"}
            
            
        @self.router.post("/check_email")
        async def check_email(data: dict):
            user = await self.usersdb.find_one({"email": data["email"]})
            return {"exists": user is not None}